# Spec: Auth 500 Closure, Session Resilience & Performance Optimization (Unified Plan)

- **Date:** 2026-11-09
- **Status:** Approved for Native Inline Execution
- **Scope Owners:**
  - `FR-AUTH`: `backend/src/IPCManagement.Api/Features/Auth/Services/AuthService.cs`, `backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs`, `frontend/src/api/client.ts`, `frontend/src/store/authContext.tsx`
  - `FR-RECON` / `FR-MENU` / `FR-REP`:
    - `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxTransactionHistoryQuery.cs`
    - `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxAuditScopeQuery.cs`
    - `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`
    - `backend/src/IPCManagement.Api/Features/Reports/Services/OperationalKpiReportService.cs`
    - `frontend/src/api/mrxApi.ts`
    - `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`
    - `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`
    - `frontend/tests/browser/loading-ux-async-consistency.spec.ts`, `scripts/reproduce-first-load-trace.mjs`, `tools/perf/k6/lib.js`

---

## 1. Context & Problem Statement

This unified specification combines the Auth 500 & Session Refresh audit verdicts (`M1–M6`) with all 8 Performance & Test Audit verdicts (`P1–P8`) into a single native execution plan:

### Part A — Auth 500 & Session Refresh Verdicts (`M1–M6`)

- **`M1` (Completed — Must-Fix #1):** `AuthService.LoginAsync` previously ran `RevokeRefreshSessionsAsync` (`SELECT ... FOR UPDATE`) without wrapping in `_transactionRunner.ExecuteAsync`, throwing `InvalidOperationException` (`500 Internal Server Error`) on MySQL under `EnableRetryOnFailure`.
- **`M2` (Completed — Must-Fix #2):** `frontend/src/api/client.ts` previously fired `POST /api/auth/refresh` on `401` even when `localStorage.getItem('ipc_v3_token')` was null/empty.
- **`M3` (Should-Fix #3):** `ExceptionMiddleware.cs` catches `OperationCanceledException` when a client aborts an in-flight HTTP request (`context.RequestAborted.IsCancellationRequested`) in its generic `catch (Exception ex)` handler, logging false-positive `500` errors and attempting to write a `500` JSON body.
- **`M4` (Should-Fix #4):** `frontend/src/api/client.ts` tracks only a single `{ previous, current }` token pair in `renewal` and validates `requireSameSession(token)` after `authenticatedFetch` using the pre-refresh token captured at the start of `apiClient`. If multiple token rotations occur or if `authenticatedFetch` rotates `T1 -> T2` and another refresh rotates `T2 -> T3` while `response.json()` is decoding, valid same-session requests can be falsely rejected with `401 SESSION_CHANGED`.
- **`M5` (Should-Fix #5):** `expireSession` in `frontend/src/api/client.ts` clears session state and redirects without dispatching `window.dispatchEvent(new Event('ipc:session-expired'))`, leaving `authContext.tsx`'s `ipc:session-expired` listener and `SessionExpiredModal` unreachable when a session expires on an active protected screen.
- **`M6` (Nice-to-Have #6):** Verify and guarantee in `AuthService.cs` that `BuildLoginResponse` (including `BCrypt.HashPassword` inside `HashRefreshToken`) is always computed outside/before `_transactionRunner.ExecuteAsync` so BCrypt CPU work never holds open a database transaction lock.

### Part B — Performance & E2E Test Audit Verdicts (`P1–P8`)

- **`P1` (Must-Fix #1):** `MrxTransactionHistoryQuery.cs` (`GET /api/reconciliation/reports/transactions-history`) embeds 3 correlated subqueries (`CustomerName` via `Menuversions`, `TransactionType` via `Inventoryissues.Any(...)`, and `Reason` via `Auditlogs...FirstOrDefault()`) inside both halves of a `UNION ALL` before `CountAsync` and `Skip/Take`, causing `333ms` local latency for 25 rows.
- **`P2` (Must-Fix #2):** `ReconciliationBatchService.GetAsync` executes redundant duplicate SQL queries (`Reconciliationbatches` 2x, `Reconciliationbatchlines` 3x, `Menuversions` 3x, `Reconciliationdailydispositions` 2x — ~16 sequential round-trips per `GET /api/reconciliation/batches/{id}`).
- **`P3` (Must-Fix #3):** `frontend/tests/browser/loading-ux-async-consistency.spec.ts` (and perf/trace scripts `scripts/reproduce-first-load-trace.mjs`, `tools/perf/k6/lib.js`) hardcode the old `Admin@123456` password, causing 6/6 Playwright UX/Performance tests in `loading-ux-async-consistency.spec.ts` to fail with `401` on `beforeAll` login.
- **`P4` (Should-Fix #4):** `mrxApi.getBatchSummary(batchId, serviceDate)` fetches `GET /api/reconciliation/batches/{batchId}` over the network on every date switch and when `useReconciliationWorkspace` snaps `serviceDate` to `result.weekStartDate`, even though the `MrxBatch` payload already contains all days of the week (`dailyReview.lines`).
- **`P5` (Should-Fix #5):** `useMrxBatchWorkspace.ts` fires an uncached `POST /api/reconciliation/batches/quantity-import/preview` on every mount whenever `source` is published and `batch?.batchId` exists, even when `batch.status` is already `DRAFT`, `READY`, `TRANSFERRED`, `IN_PROGRESS`, or `COMPLETED` (where `primaryAction` never uses `preview`) or when `cachedPreview` is already present.
- **`P6` (Should-Fix #6):** `OperationalKpiReportService.cs` loads the entire `Currentstocks` table into memory (`ToListAsync`) instead of filtering by `demandIngredientIds` in SQL, and materializes all `kitchenIssueIds` into a list before querying `Inventoryreturnlines` instead of using an `IQueryable` subquery.
- **`P7` (Nice-to-Have #7):** `ReconciliationBatchService.ListDraftSourcesAsync` can pre-filter `Quantityimportbatches` in SQL by non-empty `ContentFingerprint`, `SourceLabel`, and current `FingerprintFormatVersion` before loading related `Mealquantityplans` split queries.
- **`P8` (Nice-to-Have #8):** `MrxAuditScopeQuery.cs` builds a 19-branch correlated `OR EXISTS` query across `Auditlogs` when `batchId` is specified. Pre-resolving the scoped `EntityId` set for a specific `batchId` turns the `Auditlogs` query into a fast indexed `(EntityName, EntityId)` lookup.

---

## 2. Requirements & Invariants

1. **Zero Regression on Existing Contracts:**
   - All existing unit/integration tests in `IPCManagement.Api.Tests` and `frontend/src/__tests__/` must remain green.
   - `DOM-MODE-1` isolation between `DEFAULT` and `MATERIAL_RECONCILIATION` must remain intact.
2. **Auth & Session Invariants (`M1–M6`):**
   - `LoginAsync` and `RefreshAsync` execute all `FOR UPDATE` mutations inside `_transactionRunner.ExecuteAsync` (`IsolationLevel.ReadCommitted`), with `BuildLoginResponse` (and BCrypt refresh token hashing) computed before opening the transaction.
   - `ExceptionMiddleware` catches `OperationCanceledException` when `context.RequestAborted.IsCancellationRequested`, logs at `Debug` (not `Error`), and sets status `499` if `!context.Response.HasStarted`.
   - `client.ts` tracks token renewals across multi-step refresh chains (`renewalChain` map) and returns the effective session token from `authenticatedFetch` so concurrent requests sharing or chaining refreshes never fail with false `401 SESSION_CHANGED`, while genuine external session replacement (`localStorage.setItem('ipc_v3_token', 'replacement-session')`) still rejects with `401 SESSION_CHANGED`.
   - `expireSession` in `client.ts` dispatches `window.dispatchEvent(new Event('ipc:session-expired'))` before clearing expired session state, and `authContext.tsx` preserves the username for `SessionExpiredModal` when a session expires on an active protected screen (while keeping `localStorage.getItem('ipc_v3_token') === null` as required by `ApiContracts.test.ts`).
3. **Performance & Query Invariants (`P1–P8`):**
   - `MrxTransactionHistoryQuery.GetPageAsync` pages the base issue/return union in SQL first without correlated subqueries, then batch-enriches only the paged rows (max 100 rows) with `CustomerName`, `TransactionType` (`INITIAL_ISSUE` vs `SUPPLEMENTAL_ISSUE`), and `Auditlogs.Reason` in 3 lightweight batch queries. `StreamAsync` uses the same batch enrichment so CSV/Excel exports also avoid per-row subqueries.
   - `ReconciliationBatchService.GetAsync` reuses the already-loaded `batch`, `batchLines`, single-query `(customer, weekStartDate)` metadata, and `dailyDispositions` via an internal helper shared with `GetWarehouseDailyManyAsync`, cutting SQL round-trips in half while returning the exact same `ReconciliationBatchDto`.
   - `OperationalKpiReportService` filters `Currentstocks` in SQL by `demandIngredientIds.Contains(stock.IngredientId)` and uses `kitchenIssueLines.Select(item => item.IssueId).Distinct()` as an `IQueryable` subquery for `Inventoryreturnlines`.
   - `MrxAuditScopeQuery.BuildAsync` pre-collects the scoped entity IDs when `batchId` is provided so `Auditlogs` is filtered by `(EntityName, EntityId)` sets instead of 19 nested `EXISTS` subqueries.
   - `mrxApi.getBatchSummary(batchId, serviceDate)` caches the raw `MrxBatch` in `serverStateCache` (`mrx_raw_batch_${batchId}`, invalidated by `invalidateMrxCaches()` and `reloadBatchSummary`) so switching `serviceDate` or snapping `serviceDate` to `weekStartDate` reuses the cached weekly batch without firing duplicate `GET /api/reconciliation/batches/{batchId}` network requests.
   - `useMrxBatchWorkspace.ts` skips the automatic `useEffect` call to `mrxApi.previewQuantityImport` when `batch` already exists (`batch?.batchId` is already created, so `primaryAction` does not use `preview`) or when `cachedPreview` is already available.
   - `loading-ux-async-consistency.spec.ts` uses `process.env.E2E_ADMIN_PASSWORD ?? 'FA624MHycNsN3DIp'` and passes 6/6 Playwright tests against the live local stack.
