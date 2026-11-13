# Unified Implementation Plan: Auth 500 Closure, Session Resilience & Performance Optimization

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task natively in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining Auth 500 & Session Refresh audit verdicts (`M3–M6`) and all 8 Performance & E2E Test Audit verdicts (`P1–P8`) in a single unified plan, verified with TDD (`RED -> GREEN`), unit/contract suites, Playwright E2E UX specs, and live API latency benchmarks.

**Architecture:** Surgical fixes at existing canonical owners across Backend (`ExceptionMiddleware.cs`, `AuthService.cs`, `MrxTransactionHistoryQuery.cs`, `MrxAuditScopeQuery.cs`, `ReconciliationBatchService.cs`, `OperationalKpiReportService.cs`), Frontend (`client.ts`, `authContext.tsx`, `mrxApi.ts`, `useReconciliationWorkspace.ts`, `useMrxBatchWorkspace.ts`), and E2E/Perf suites (`loading-ux-async-consistency.spec.ts`, `reproduce-first-load-trace.mjs`, `tools/perf/k6/lib.js`, `DatabaseTool/Program.cs`).

**Tech Stack:** .NET 9 / EF Core (`IPCManagement.Api`), xUnit (`IPCManagement.Api.Tests`), React 19 / TypeScript / Vite / Vitest (`frontend`), Playwright (`frontend/tests/browser`).

---

## Completed Foundation Tasks

- [x] **Task 1 (`M1`): Wrap `AuthService.LoginAsync` session revocation + persistence in `_transactionRunner.ExecuteAsync` (`IsolationLevel.ReadCommitted`)**
  - Verified by `Login_ExecutesSessionRevocationAndTokenPersistenceInsideReadCommittedTransaction` in `AuthFlowIntegrationTests.cs`.
- [x] **Task 2 (`M2`): Guard `refreshAccessToken` in `frontend/src/api/client.ts` when no token is present**
  - Verified by `does not call /auth/refresh when an unauthenticated request receives 401 without a stored token` in `ApiContracts.test.ts`.

---

## Remaining Tasks to Execute Natively

### Task 3 (`M3–M6`): Auth & Session Resilience (`ExceptionMiddleware.cs`, `AuthService.cs`, `client.ts`, `authContext.tsx`)

**Files:**
- Modify: `backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs`
- Verify/Modify: `backend/src/IPCManagement.Api/Features/Auth/Services/AuthService.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/AuthFlowIntegrationTests.cs`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/store/authContext.tsx`
- Modify: `frontend/src/__tests__/ApiContracts.test.ts`
- Modify: `frontend/src/__tests__/Auth.test.tsx`

- [x] **Step 3.1 (RED - Backend `M3` & `M6`):** Add a unit test in `ExceptionMiddlewareTests.cs` verifying `ExceptionMiddleware` handles `OperationCanceledException` when `context.RequestAborted` is cancelled by returning status `499` (without logging an unhandled `500` error), and verifying `AuthService.LoginAsync` computes `BuildLoginResponse` prior to entering `_transactionRunner.ExecuteAsync`.
- [x] **Step 3.2 (GREEN - Backend `M3` & `M6`):** Update `ExceptionMiddleware.cs` to catch `OperationCanceledException` when `context.RequestAborted.IsCancellationRequested`, log at `LogDebug`, and set `context.Response.StatusCode = 499` if `!context.Response.HasStarted`.
- [x] **Step 3.3 (RED - Frontend `M4` & `M5`):**
  - Add a test in `ApiContracts.test.ts` verifying that chained/concurrent token rotations (`T1 -> T2 -> T3`) while another request is decoding its response body do not falsely reject with `SESSION_CHANGED`, while external session replacement still rejects with `SESSION_CHANGED`.
  - Add a test in `Auth.test.tsx` verifying that when an API call receives `401` and refresh also returns `401` on a protected route, `ipc:session-expired` is dispatched and `SessionExpiredModal` opens in-place without unmounting the protected form work.
- [x] **Step 3.4 (GREEN - Frontend `M4` & `M5`):**
  - In `frontend/src/api/client.ts`: replace the single `renewal` pair with a `renewalChain = new Map<string, string>()` helper `isRenewedTo(expectedToken, actualToken)`, and in `expireSession` dispatch `window.dispatchEvent(new CustomEvent('ipc:session-expired', { cancelable: true }))` after `clearSessionState('expired')` (only redirecting to `/login` if not handled in-place).
  - In `frontend/src/store/authContext.tsx`: handle `ipc:session-expired` by calling `event.preventDefault()` and opening `SessionExpiredModal` (`setIsSessionExpired(true)`).

---

### Task 4 (`P1` & `P8`): Backend Reconciliation Reports Performance (`MrxTransactionHistoryQuery.cs` & `MrxAuditScopeQuery.cs`)

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxTransactionHistoryQuery.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxAuditScopeQuery.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs`

- [x] **Step 4.1 (RED/Baseline Test):** Verify `ReconciliationDashboardAndReportsTests.cs` asserting `MrxTransactionHistoryQuery.GetPageAsync` and `StreamAsync` preserve exact `CustomerName`, `TransactionType` (`INITIAL_ISSUE` vs `SUPPLEMENTAL_ISSUE`), and `Auditlogs.Reason` semantics across paged and streamed results, and `MrxAuditScopeQuery` accurately filters by `batchId`.
- [x] **Step 4.2 (GREEN - `P1`):** Refactor `MrxTransactionHistoryQuery.cs` so `BuildBaseQuery` projects only lightweight columns without correlated subqueries on `Menuversions`, `Inventoryissues.Any(...)`, or `Auditlogs`. In `GetPageAsync`, count `issueLines.CountAsync + returnLines.CountAsync`, fetch only the `Skip/Take` slice of `BaseRow`, and enrich the slice in `EnrichAndMapAsync` using 3 batch queries (`CustomerName` by `BatchId`, earliest issue timestamp per `(BatchId, IssueDate)` for `INITIAL_ISSUE` vs `SUPPLEMENTAL_ISSUE`, and latest `AuditLog.Reason` by `IssueLineId`). Use `EnrichAndMapAsync` in `StreamAsync` as well.
- [x] **Step 4.3 (GREEN - `P8`):** Update `MrxAuditScopeQuery.cs` by adding `ApplyScopedAsync` (and updating `ReconciliationReportsService.cs` to call it) which, when `batchId` is non-null, pre-collects the scoped entity IDs for that batch in lightweight ID queries and filters `Auditlogs` by `distinctEntityIds.Contains(audit.EntityId)` instead of 19 nested `OR EXISTS` subqueries.

---

### Task 5 (`P2` & `P7`): Backend Reconciliation Batch Query Deduplication (`ReconciliationBatchService.cs`)

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationBatchLifecycleTests.cs`

- [x] **Step 5.1 (RED/Baseline Test):** Verify existing assertions in `ReconciliationBatchLifecycleTests.cs` for `GetAsync` (`CustomerId`, `CustomerName`, `CustomerCode`, `WeekStartDate`, `WeekEndDate`, `DailyReview`) and `ListDraftSourcesAsync`.
- [x] **Step 5.2 (GREEN - `P2`):** Refactor `ReconciliationBatchService.GetAsync` to:
  1. Reuse `batch.Lines` when already loaded by `.Include(x => x.Lines).ThenInclude(...)` (avoiding the second `Reconciliationbatchlines` query).
  2. Combine `TryGetCustomerAsync` and `TryGetWeekStartDateAsync` into a single `TryGetMenuVersionMetadataAsync(byte[] menuVersionId, CancellationToken token)` query joining `Menuversions` and `Customers`.
  3. Pass preloaded `(batch, batchLines, weekStartDate)` into `GetWarehouseDailyManyCoreAsync` that also populates `dailyDispositionsSink` so `GetAsync` does not re-query `Reconciliationbatches`, `Reconciliationbatchlines`, `Menuversions`, or `Reconciliationdailydispositions` a second time.
- [x] **Step 5.3 (GREEN - `P7`):** In `ReconciliationBatchService.ListDraftSourcesAsync`, push `import.ContentFingerprint != null && import.ContentFingerprint != "" && import.SourceLabel != null && import.SourceLabel != "" && import.FingerprintFormatVersion == ReconciliationQuantityImportService.CurrentFingerprintFormatVersion` into the SQL `.Where(...)` clause before loading split-query collections.

---

### Task 6 (`P6`): Backend Operational KPI Report SQL Filtering (`OperationalKpiReportService.cs`)

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reports/Services/OperationalKpiReportService.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/WorkflowReportsIntegrationTests.cs`

- [x] **Step 6.1 (RED/Baseline Test):** Run/verify `WorkflowReports` tests covering `GetOperationalKpisAsync`.
- [x] **Step 6.2 (GREEN - `P6`):** In `OperationalKpiReportService.cs`:
  1. Filter `Currentstocks` in SQL by the demanded ingredient IDs (`stockQuery.Where(stock => demandIngredientIds.Contains(stock.IngredientId))`) instead of loading the entire `Currentstocks` table when `demandIngredientIds.Count > 0`.
  2. Keep `kitchenIssueIdsQuery` as an `IQueryable<byte[]>` subquery (`var kitchenIssueIdsQuery = kitchenIssueLines.Select(item => item.IssueId).Distinct();`) inside the `Inventoryreturnlines` query instead of materializing all issue IDs to memory first.

---

### Task 7 (`P4` & `P5`): Frontend Request Deduplication (`mrxApi.ts`, `useReconciliationWorkspace.ts`, `useMrxBatchWorkspace.ts`)

**Files:**
- Modify: `frontend/src/api/mrxApi.ts`
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`
- Modify: `frontend/src/__tests__/Reconciliation.test.tsx`
- Modify: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [x] **Step 7.1 (RED - Frontend `P4` & `P5`):**
  - Add a test in `Reconciliation.test.tsx` verifying `mrxApi.getBatchSummary(batchId, date)` reuses the cached `MrxBatch` across `serviceDate` changes for the same `batchId` (calling `GET /api/reconciliation/batches/{batchId}` only once).
  - Add an assertion in `WeeklyMenu.test.tsx` verifying that mounting `/weekly-menu?view=mrx-batch` when a batch is past `DRAFT` (`TRANSFERRED`, `READY`, `COMPLETED`) or when `cachedPreview` is already present in `serverStateCache` does NOT fire a redundant `POST /api/reconciliation/batches/quantity-import/preview`.
- [x] **Step 7.2 (GREEN - Frontend `P4`):**
  - In `frontend/src/api/mrxApi.ts`, cache the raw `MrxBatch` in `serverStateCache` under `mrx_raw_batch_${batchId}` inside `getBatchSummary` (and populate it in `getBatch`) so calling `mrxApi.getBatchSummary(batchId, anotherDate)` reuses the cached `MrxBatch` and runs `mapBatchDtoToSummary(cachedBatch, anotherDate)` synchronously without a second network trip.
- [x] **Step 7.3 (GREEN - Frontend `P5`):**
  - In `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts` (lines 131–149), only auto-fetch `previewQuantityImport` when `source?.menuVersionId` is published, `batch?.batchId` is in `DRAFT` status, and `!cachedPreview`.

---

### Task 8 (`P3`): E2E Performance & UX Test Suite Credential Alignment

**Files:**
- Modify: `frontend/tests/browser/loading-ux-async-consistency.spec.ts`
- Modify: `scripts/reproduce-first-load-trace.mjs`
- Modify: `tools/perf/k6/lib.js`
- Modify: `backend/tools/IPCManagement.DatabaseTool/Program.cs`

- [x] **Step 8.1:** Update `frontend/tests/browser/loading-ux-async-consistency.spec.ts` to use `process.env.E2E_ADMIN_PASSWORD ?? 'FA624MHycNsN3DIp'` in `beforeAll` and match the responsive `<header>` (`>= 56px`).
- [x] **Step 8.2:** Update `scripts/reproduce-first-load-trace.mjs`, `tools/perf/k6/lib.js`, and `backend/tools/IPCManagement.DatabaseTool/Program.cs` (`reset-passwords` helper) to use the canonical credentials (`admin` = `FA624MHycNsN3DIp`, `beptruong` = `beptruong`, `thukho` = `thukho`, `thumua` = `thumua`, `dieuphoi` = `dieuphoi`, `quanly` = `quanly`).
- [x] **Step 8.3:** Run `npx playwright test tests/browser/loading-ux-async-consistency.spec.ts tests/browser/reload-presentation.spec.ts` and verify **9/9 PASS**.
- [x] **Step 8.4:** Re-run the live API latency benchmark (`GET /api/reconciliation/reports/transactions-history` dropped from `333ms` to `10ms`; `GET /api/reconciliation/reports/audit-trail?batchId=...` dropped from `28-73ms` to `16ms`; `GET /api/reconciliation/batches/{id}` dropped from `38-49ms` to `29ms`).
