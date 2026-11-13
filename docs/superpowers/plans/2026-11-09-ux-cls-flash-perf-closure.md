# UX Fluidity, Zero Layout Shift (CLS = 0), Flash Elimination & Backend/Concurrency Closure (F1–F9) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all Layout Shifts (`CLS: 0.43440 -> 0.00000`), eliminate all `0–150ms` blank white unmount flashes (`emptyBusyCount: 1 -> 0`) across workbenches and report tabs, deduplicate concurrent in-flight `GET` requests (preventing `<React.StrictMode>` `HTTP 499` self-aborts and duplicate SQL queries), fix Backend EF Core `Skip/Take without OrderBy` warnings and `GetOperationalSummaryAsync` over-fetching, optimize `>= 10,000`-row streaming Excel (`XLSX`) export (`< 2,000ms`), and verify multi-user concurrent load (`k6` + automated xUnit + live 20-worker burst).

**Architecture:**
- **Backend (`F6`, `F8`, `F9`):** Deterministic `.OrderBy(x => x.Id)` before `.Take(2)` on `Systemoperationmodes`; `bool includeMetadata = true` on `ReconciliationBatchService.GetWarehouseDailyManyAsync` so `ReconciliationReportsService.GetOperationalSummaryAsync` skips unnecessary `Ingredient`/`CanonicalUnit` joins and `ReconciliationWarehouseRevisionQuery`; `64 KiB` `StreamWriter` buffer + reusable `StringBuilder` + multi-letter Excel column reference (`GetColumnName`) in `MrxReportWorkbookExporter.cs`; `MRX_ENDPOINTS` in `tools/perf/k6/lib.js` + `tools/perf/k6/mrx-concurrency.js`.
- **Frontend (`F1`, `F2`, `F3`, `F4`, `F5`, `F7`):** Selector `PaginationBar` hides navigation when `totalPages === undefined`; `LocalizedBoundary` renders `<WorkbenchSkeleton>` immediately with `minDurationMs = 0` when loading without existing content; `apiClient` and `useWorkbenchQuery` deduplicate concurrent in-flight `GET` requests without `<React.StrictMode>` self-abort; `useReconciliationWorkspace`, `useReconciliationReports`, `MrxCookingWorkbench`, `useMrxDailyWorkspace`, `AdminBomBranch`, `AdminCatalogBranch`, `AdminCustomersBranch`, and `useMrxBatchWorkspace` retain `previousData` (`isPreviousData = true`, `hasExistingData = true`) across scope/tab transitions and lock chrome geometry (`LocalFindBar`, header buttons, `telemetryPills`, `ReconciliationLifecycleStrip`, `tabular-nums` counters).

**Tech Stack:** .NET 9 / EF Core / xUnit (`IPCManagement.Api`), React 19 / TypeScript / Vite / Vitest / Playwright (`frontend`), k6 (`tools/perf/k6`).

---

## Scoped Pre-Code UI Gate Block

- **Route:** `/`, `/weekly-menu`, `/warehouse`, `/chef`, `/reconciliation`, `/admin-data`
- **Single Primary Work Object:** `OperationalFrame` (`WorkspaceFrame.Root` + `WorkspaceHeader` + `TelemetrySubbar` + `StateBoundary` / `LocalizedBoundary` + `DataGrid`)
- **Server Mode:** `DEFAULT` | `MATERIAL_RECONCILIATION` (`DOM-MODE-1`)
- **RBAC Guards:** `RoleGuard` | `ActionGuard` | `ActionAvailability` with token permission preserved unchanged
- **6 UI States:** `loading` | `empty` | `error` | `permission-denied` | `partial` | `write-reconciliation`
- **Primitives & Composites:** `components/ui/*` (`Button`, `Select`, `Badge`, `Num`, `Input`, `InlineBanner`), `components/workbench/*` (`WorkspaceHeader`, `TelemetrySubbar`, `PaginationBar`, `LocalFindBar`, `StateBoundary`, `LocalizedBoundary`, `DataGrid`, `ReconciliationLifecycleStrip`)
- **Compliance Pledges:** D6 (>=12px), D7 (1 primary), T7 (frozen header/col), T8 (compact density 36-40px), M1.2 (1 blocking modal), N6 (nested sidebar v2), Single Styling Authority (`frontend/src/styles/index.css` tokens only)

---

### Task 1: Backend Fixes (`F6`, `F8`, `F9`) — Deterministic `OrderBy`, Lightweight `GetOperationalSummaryAsync`, 10,500-Row XLSX Streaming, and Concurrency Suite

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeGuard.cs`
- Modify: `backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxReportWorkbookExporter.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs`
- Modify: `tools/perf/k6/lib.js`
- Create: `tools/perf/k6/mrx-concurrency.js`

- [ ] **Step 1: Write failing Backend tests (`RED`) in `ReconciliationPreparationWorkbookTests.cs`**
  - Add `MrxReportWorkbookExporter_Streams_10500_Rows_Under_2000ms_With_Valid_OpenXml_And_MultiLetter_Columns` testing 10,500 rows streamed through `MrxReportWorkbookExporter.TransactionsAsync` and testing `MrxReportWorkbookExporter.GetColumnName(0)` (`"A"`), `GetColumnName(25)` (`"Z"`), `GetColumnName(26)` (`"AA"`).
  - Add `GetWarehouseDailyManyAsync_WithoutMetadata_Matches_Status_Counts_And_Concurrent_Reads_Succeed` verifying `includeMetadata: false` on `ReconciliationBatchService.GetWarehouseDailyManyAsync` and parallel execution of `GetOperationalSummaryAsync`, `GetTransactionsHistoryAsync`, `GetVarianceRegisterAsync`, and `GetAuditTrailAsync`.
- [ ] **Step 2: Run `dotnet test` to verify `RED` failure**
- [ ] **Step 3: Implement `F6`, `F8`, and `F9`**
  - Add `.OrderBy(x => x.Id)` before `.Take(2)` in `SystemOperationModeGuard.cs` and `SystemOperationModeService.cs`.
  - Add `bool includeMetadata = true` to `GetWarehouseDailyManyAsync` and `GetWarehouseDailyManyCoreAsync` in `ReconciliationBatchService.cs`, and pass `includeMetadata: false` in `ReconciliationReportsService.GetOperationalSummaryAsync`.
  - Update `MrxReportWorkbookExporter.cs` to use a `65536`-byte `StreamWriter`, reusable `StringBuilder` with `WriteRow`, and `public static string GetColumnName(int colIndex)` supporting `A..Z`, `AA..ZZ`.
  - Update `tools/perf/k6/lib.js` with `MRX_ENDPOINTS` and create `tools/perf/k6/mrx-concurrency.js`.
- [ ] **Step 4: Run `dotnet test` to verify `GREEN` pass**

---

### Task 2: Frontend Core Primitives & In-Flight Request Deduplication (`F1`, `F2`, `F4`, `F7`)

**Files:**
- Modify: `frontend/src/components/workbench/PaginationBar.tsx`
- Modify: `frontend/src/components/workbench/LocalizedBoundary.tsx`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/hooks/useWorkbenchQuery.ts`
- Modify: `frontend/src/__tests__/Primitives.test.tsx`
- Modify: `frontend/src/__tests__/ApiContracts.test.ts`

- [ ] **Step 1: Write failing Frontend unit tests (`RED`) in `Primitives.test.tsx` and `ApiContracts.test.ts`**
  - In `Primitives.test.tsx`:
    - Test that `<PaginationBar placement="selector" page={1} totalPages={undefined} />` renders `sr-only` (`!showNavigation`) instead of popping out `Trang 1/—` + 2 buttons while `totalPages` is `undefined`.
    - Test that `<LocalizedBoundary isLoading={true} loadingGeometry="table">` renders `<WorkbenchSkeleton>` (`data-testid="workbench-skeleton"`) immediately without an empty `<div aria-busy="true" />` and immediately unmounts the skeleton when `isLoading` becomes `false` (no `250ms` forced hold).
  - In `ApiContracts.test.ts`:
    - Test that concurrent identical `apiClient('/reconciliation/batches')` `GET` calls share a single in-flight `fetch()` call and sequential calls after resolution invoke `fetch()` normally.
- [ ] **Step 2: Run Vitest on `Primitives.test.tsx` and `ApiContracts.test.ts` to confirm `RED`**
- [ ] **Step 3: Implement `F1`, `F2`, `F4`, `F7` in core primitives & hooks**
  - Update `PaginationBar.tsx`: for `isSelector`, require `(totalPages !== undefined && totalPages > 1) || page > 1 || hasPrev || hasNext` for `showNavigation`; wrap numeric counters in `tabular-nums`.
  - Update `LocalizedBoundary.tsx`: render `<WorkbenchSkeleton geometry={loadingGeometry} className={className} minDurationMs={0} />` immediately when `isLoading` is `true` without existing content, and remove the `250ms` post-load hold.
  - Update `client.ts`: deduplicate concurrent `GET` requests (when `!options.signal`) via `inFlightGetRequests = new Map<string, Promise<unknown>>()` keyed by `${token ?? 'anon'}:${url}`, always cleaning up in `.finally()`.
  - Update `useWorkbenchQuery.ts`: deduplicate concurrent in-flight `queryFn` executions per `cacheKey` in `inFlightWorkbenchQueries` so `<React.StrictMode>` double-effects reuse the active promise instead of aborting the first request (`HTTP 499`).
- [ ] **Step 4: Run Vitest on `Primitives.test.tsx`, `ApiContracts.test.ts`, `Auth.test.tsx`, and `Render1CacheHitVerification.test.tsx` to confirm `GREEN`**

---

### Task 3: Smooth Workbench Transitions & Fixed Chrome Geometry (`F1`, `F2`, `F3`, `F5`, `F7`)

**Files:**
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`
- Modify: `frontend/src/features/reconciliation/useReconciliationReports.ts`
- Modify: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts`
- Modify: `frontend/src/features/admin/AdminDataPage.tsx`
- Modify: `frontend/src/features/admin/branches/AdminCatalogBranch.tsx`
- Modify: `frontend/src/features/admin/branches/AdminBomBranch.tsx`
- Modify: `frontend/src/features/admin/branches/AdminCustomersBranch.tsx`
- Modify: `frontend/src/__tests__/Reconciliation.test.tsx`
- Modify: `frontend/src/__tests__/Chef.test.tsx`
- Modify: `frontend/src/__tests__/Warehouse.test.tsx`
- Modify: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [ ] **Step 1: Write failing Vitest tests (`RED`) in `Reconciliation.test.tsx`, `Chef.test.tsx`, `Warehouse.test.tsx`, and `WeeklyMenu.test.tsx`**
  - `Reconciliation.test.tsx`: switching customers retains the previous customer's table (`isPreviousData = true`) while the new customer's batch summary is loading, and switching back to a warm customer hydrates synchronously.
  - `Chef.test.tsx`: `<LocalFindBar>` and the 3 export/print buttons stay mounted and disabled when `409 KITCHEN_FROZEN_LINEAGE_MISSING` is returned (`CLS = 0`), and switching to another batch keeps the current dish table mounted (`isPreviousData`) while loading.
  - `Warehouse.test.tsx`: switching batches keeps the previous batch's table mounted (`isPreviousData`) with `canSubmit = false` while the new batch is loading, and does not re-fetch `getBatchPage`.
- [ ] **Step 2: Run Vitest on those test files to confirm `RED`**
- [ ] **Step 3: Implement workbench transition & chrome geometry fixes across all target features**
  - `useReconciliationWorkspace.ts`, `useReconciliationReports.ts`, `ReconciliationReportTables.tsx`, `ReconciliationPage.tsx`
  - `MrxCookingWorkbench.tsx`
  - `useMrxDailyWorkspace.ts`, `MrxDailyIssueWorkbench.tsx`
  - `useMrxBatchWorkspace.ts`, `useMrxSourceEdit.ts`
  - `AdminDataPage.tsx`, `AdminCatalogBranch.tsx`, `AdminBomBranch.tsx`, `AdminCustomersBranch.tsx`
- [ ] **Step 4: Run all Vitest suites to confirm `GREEN`**

---

### Task 4: Full Verification Gates & Live Chrome DevTools CDP (`CLS` / Flash / Network / Concurrency) Re-Measurement

**Files:**
- Modify: `.planning/WORK.md`

- [ ] **Step 1: Run full Frontend & Backend verification gates (`vitest`, `lint`, `build`, `dotnet test`, `git diff --check`)**
- [ ] **Step 2: Start Backend (`5262`) & Frontend (`5173`), run live Chrome DevTools CDP probes (`cdp-ux-perf-audit.mjs` + `cdp-interactive-switches.mjs`) and live 20-worker concurrency probe**
- [ ] **Step 3: Stop temporary servers, update `.planning/WORK.md` to `IDLE`, and report before/after metrics**
