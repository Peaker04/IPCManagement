# MRX Final 10-Verdict Flash, Seam & Waterfall Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the final 10 MRX flash, seam layout shift, cross-tab waterfall, and backend over-fetching findings (`M1–M10` / `AC-M1..AC-M10`) across all 18 MRX route/view leaves.

**Architecture:** Eagerly import the remaining settings routes in `App.tsx` (`M1`); unify `useMrxBatchWorkspace`, `useMrxSourceEdit`, and `useMrxQuantityInspection` cache keys and pre-warming so `/weekly-menu` MRX views never flash intermediate loading text, unmount tables on empty search, or shift height on serving alerts (`M2`, `M3`, `M6`, `M7`); keep `ReconciliationAuditBranch` and `ReconciliationHeaderBranch` geometry stable across `auditSubTab` and report-tab switches (`M4`, `M5`); persist `snapshot:mrx_cooking` (`M8`); invalidate MRX caches after BOM edits (`M9`); and replace eager `.ThenInclude(bl => bl.Contributors)` in `ReconciliationReportsService.GetVarianceRegisterAsync` with a lightweight SQL projection (`M10`).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library, ASP.NET Core 9, Entity Framework Core, xUnit.

**Spec:** [`docs/superpowers/specs/2026-11-09-mrx-final-10-verdicts-closure-design.md`](../specs/2026-11-09-mrx-final-10-verdicts-closure-design.md)

## Global Constraints

- `DOM-MODE-1`: `DEFAULT != MATERIAL_RECONCILIATION`; `ProtectedRoute` must continue to block stored `DEFAULT` routes until `systemApi.getOperationalMode()` resolves.
- Single styling authority: only existing classes from `frontend/src/styles/index.css` / Tailwind tokens; zero inline style hacks.
- Anti-tautology (`TA-1..TA-5`): all tests must use real components, hooks, and backend services with backend-grounded DTOs, watching each test fail (`RED`) before implementing the fix (`GREEN`).

## Review Focus

- Navigating to `/settings/advanced` in MRX mode mounts `AdvancedSettingsPage` synchronously without a lazy-chunk `<Suspense>` fallback.
- Switching Customer on `/weekly-menu?view=mrx-batch` keeps `<MrxSourceEditGrid>` mounted with `isPreviousData` dimming until the new customer's `editScope` is ready, and never flashes `<p>Đang tải phạm vi nguồn tuần MRX…</p>` above/instead of the matrix skeleton.
- Searching with `0` matches on `/weekly-menu?view=mrx-materials` and `?view=mrx-plans` keeps `<DataGrid>` and its sticky `<thead>` mounted (`tableCount >= 1`).
- Clicking between `Kho` and `Nguồn & BOM` on `/reconciliation?view=audit` keeps `<LocalFindBar>`, `<DataGrid>`, and `<PaginationBar>` mounted without flashing `<WorkbenchSkeleton>`.
- Calling `ReconciliationReportsService.GetVarianceRegisterAsync` resolves the correct `FrozenShiftName` per `DailyLineId` via a lightweight projection without `.ThenInclude(bl => bl.Contributors)`.

---

### Task 1: Eager Settings Route Import (`M1`) & Chef Cooking Snapshot Persistence (`M8`)

**Files:**
- Modify: `frontend/src/App.tsx:18-27`
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx:39-52`
- Test: `frontend/src/__tests__/Render1CacheHitVerification.test.tsx`, `frontend/src/__tests__/Chef.test.tsx`

**Interfaces:**
- Consumes: `AdvancedSettingsPage`, `ApprovalRulesPage`, `serverStateCache.set('snapshot:mrx_cooking', { batchId, selectedShift })`
- Produces: Synchronous 0ms route mount for `/settings/advanced` and `/settings/approval-rules`; persistent `{ batchId, selectedShift }` restoration on `/chef?view=mrx-cooking`

- [ ] **Step 1: Write the failing tests in `Render1CacheHitVerification.test.tsx` and `Chef.test.tsx`**
  - In `Chef.test.tsx`, add test `M8: MrxCookingWorkbench persists selectedShift and batchId to snapshot:mrx_cooking so returning from a naked sidebar link restores the selected shift`.
- [ ] **Step 2: Run Vitest on `Chef.test.tsx` to verify RED**
  - Run: `npx vitest run src/__tests__/Chef.test.tsx`
  - Expected: FAIL because `snapshot:mrx_cooking` is never written when `selectedShift` changes to `'MORNING'`.
- [ ] **Step 3: Implement `M1` in `App.tsx` and `M8` in `MrxCookingWorkbench.tsx`**
  - Replace `lazy(...)` for `ApprovalRulesPage` and `AdvancedSettingsPage` in `App.tsx` with eager imports.
  - Add `useEffect` in `MrxCookingWorkbench.tsx` writing `serverStateCache.set('snapshot:mrx_cooking', { batchId, selectedShift })` whenever `batchId` or `selectedShift` is truthy/updated.
- [ ] **Step 4: Run Vitest on `Chef.test.tsx` and `Render1CacheHitVerification.test.tsx` to verify GREEN**
  - Run: `npx vitest run src/__tests__/Chef.test.tsx src/__tests__/Render1CacheHitVerification.test.tsx`
  - Expected: PASS

---

### Task 2: Weekly Menu MRX Atomic Edit-Scope Pre-Warm, Search-Empty Table Retention, Footer Serving Alert & Cross-Tab Cache Sharing (`M2`, `M3`, `M6`, `M7`)

**Files:**
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts:51-95`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts:26-95`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx:378-488`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts:15-78`
- Modify: `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx:41-140`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `mrxApi.getEditScope`, `adminApi.getDishes`, `serverStateCache`
- Produces: Synchronously hydrated `editScope` on `mrx-batch`, persistent `<DataGrid>` on zero-match search in `mrx-materials`/`mrx-plans`, inline footer serving validation alert, and shared `catalog_customers` + `mrx_inspection_source_${customerId}_${weekStartDate}` cache across all 3 `/weekly-menu` MRX views

- [ ] **Step 1: Write the failing test in `WeeklyMenu.test.tsx`**
  - Add test `M2, M3, M6 & M7: keeps MrxSourceEditGrid dimmed during editScope transition, keeps serving error alert inside footer, keeps DataGrid mounted on 0-match search in mrx-materials/mrx-plans, and shares warm customer/source cache from mrx-batch to mrx-materials`.
- [ ] **Step 2: Run Vitest on `WeeklyMenu.test.tsx` to verify RED**
  - Run: `npx vitest run src/__tests__/WeeklyMenu.test.tsx`
  - Expected: FAIL on search-empty unmounting `<table>`, serving error `<p>` mounting above `<MrxSourceEditGrid>`, and `mrx-materials` re-fetching `getCustomers` / `getWeeklySource`.
- [ ] **Step 3: Implement `M2`, `M3`, `M6`, `M7` in `/weekly-menu` hooks and components**
  - In `useMrxBatchWorkspace.ts`: seed `mrx_inspection_source_${customerId}_${weekStartDate}` with `sourceResult`, and when `sourceResult` is non-null, pre-warm `mrx_edit_scope_${customerId}_${weekStartDate}_${sourceResult.menuVersionId ?? ''}:${loadedBatch?.version ?? ''}` and `mrx_catalog_dishes` in parallel.
  - In `useMrxSourceEdit.ts`: include `:${scope.sourceVersionKey ?? ''}` in `scopeKey` and update `dishOptions` during render-phase warm cache hydration.
  - In `MrxBatchWorkbench.tsx`: pass `isLoading={stateProps.isLoading || Boolean(source && !sourceEdit.editScope && !sourceEdit.error)}`, `isPreviousData={Boolean(stateProps.isPreviousData || sourceEdit.isTransitioningScope)}`, and move `<span id={servingErrorId} role="alert">` inside the bottom footer bar.
  - In `useMrxQuantityInspection.ts` & `MrxQuantityInspectionPage.tsx`: use `cacheKey: 'catalog_customers'`, keep `isEmpty = false` on `<StateBoundary>` when `Boolean(query.searchKeyword?.trim()) && Boolean(result)`, and pass `emptyMessage` into `<MaterialsTable>` and `<PlansTable>` `<DataGrid>`.
- [ ] **Step 4: Run Vitest on `WeeklyMenu.test.tsx` and `MrxSourceEdit.test.tsx` to verify GREEN**
  - Run: `npx vitest run src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx`
  - Expected: PASS

---

### Task 3: Reconciliation Audit Sub-Tab Stability, Batch-Switch Pre-Warm & Header/Partial Seam Fix (`M4`, `M5`)

**Files:**
- Modify: `frontend/src/features/reconciliation/useReconciliationReports.ts:28-114`
- Modify: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx:54-106`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationAuditBranch.tsx:20-165`
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:542-562`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx:104-110`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx:285-293`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `useReconciliationReports`, `ReconciliationReportTables`, `ReconciliationAuditBranch`, `ReconciliationHeaderBranch`
- Produces: Zero `<WorkbenchSkeleton>` unmount when toggling `Kho` ↔ `Nguồn & BOM` on `/reconciliation?view=audit`, constant `min-w-[155px] h-9` header date/scope slot, and zero duplicate `isPartial` + `isEmpty` banner on empty dates

- [ ] **Step 1: Write the failing test in `Reconciliation.test.tsx`**
  - Add test `M4 & M5: keeps LocalFindBar and DataGrid mounted when switching audit sub-tabs (Kho <-> Nguồn & BOM) while getSourceChanges is pending, and locks ReconciliationHeaderBranch scope slot width to min-w-[155px] h-9`.
- [ ] **Step 2: Run Vitest on `Reconciliation.test.tsx` to verify RED**
  - Run: `npx vitest run src/__tests__/Reconciliation.test.tsx`
  - Expected: FAIL because switching from `Kho` to `Nguồn & BOM` while `getSourceChanges` is pending unmounts `<DataGrid>` and renders `<WorkbenchSkeleton>`.
- [ ] **Step 3: Implement `M4` and `M5`**
  - In `useReconciliationReports.ts`: keep `baseTabScope = mrx_report_${user?.userId}_${operationalMode}_${activeReportTab}` so `previous` is retained across `auditSubTab` switches (`warehouse` ↔ `source`), exposing both `auditReport` and `sourceChanges` from `currentData ?? previous?.data`.
  - In `ReconciliationReportTables.tsx`: set `hasCurrentReport` for `activeTab === 'audit'` to `Boolean(auditReport || sourceChanges)`.
  - In `ReconciliationAuditBranch.tsx`: compute `displaySubTab` so while `pending` is `true` and the newly requested sub-tab's data is still `null`, the currently loaded sub-tab's `<DataGrid>` stays mounted inside the dimmed container.
  - In `useReconciliationWorkspace.ts`: in `handleSelectBatch`, if `activeReportTab !== 'lines'` and `activeReportTab !== 'completed'`, pre-warm or retain the report cache consistently.
  - In `ReconciliationHeaderBranch.tsx`: add `inline-flex h-9 w-38 sm:w-40 min-w-[155px] shrink-0 items-center text-xs text-slate-500` to `"Phạm vi: cả lô"`.
  - In `ReconciliationPage.tsx`: remove the redundant `isPartial` when `data.lines.length === 0` (since `isEmpty` already renders the empty state).
- [ ] **Step 4: Run Vitest on `Reconciliation.test.tsx` to verify GREEN**
  - Run: `npx vitest run src/__tests__/Reconciliation.test.tsx`
  - Expected: PASS

---

### Task 4: Cross-Station BOM Cache Invalidation (`M9`) & Backend Variance Register Contributor Projection (`M10`)

**Files:**
- Modify: `frontend/src/api/mrxCacheInvalidation.ts:1-7`
- Modify: `frontend/src/features/admin/branches/AdminBomBranch.tsx:60-64`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs:164-243`
- Test: `frontend/src/__tests__/AdminBomBranch.test.tsx`, `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs`

**Interfaces:**
- Consumes: `invalidateMrxCaches()`, `ReconciliationReportsService.GetVarianceRegisterAsync`
- Produces: Automatic invalidation of `mrx_*` preview/source caches after BOM save/import; lightweight SQL projection for `FrozenShiftName` in `GetVarianceRegisterAsync`

- [ ] **Step 1: Write the failing tests in `AdminBomBranch.test.tsx` and `ReconciliationPreparationWorkbookTests.cs`**
  - In `AdminBomBranch.test.tsx`: add test `M9: saving or importing BOM invalidates mrx_source_ and mrx_preview_ caches so /weekly-menu?view=mrx-batch reloads fresh BOM diagnostics`.
  - In `ReconciliationPreparationWorkbookTests.cs`: add test verifying `GetVarianceRegisterAsync` resolves contributor `FrozenShiftName` accurately for variance daily lines without requiring tracked/eager-loaded navigation collections.
- [ ] **Step 2: Run Vitest on `AdminBomBranch.test.tsx` to verify RED**
  - Run: `npx vitest run src/__tests__/AdminBomBranch.test.tsx`
  - Expected: FAIL because `mrx_preview_...` remains in `serverStateCache` after saving BOM in `AdminBomBranch`.
- [ ] **Step 3: Implement `M9` and `M10`**
  - Call `invalidateMrxCaches()` inside `AdminBomBranch.tsx`'s `afterSaved` and include `'admin_data_bom_coverage'` and `'snapshot:admin_bom_coverage'` in `invalidateMrxCaches()`.
  - In `ReconciliationReportsService.cs` (`GetVarianceRegisterAsync`): remove `.Include(d => d.BatchLine).ThenInclude(bl => bl.Contributors.Where(...))` and query `(DailyLineId, FrozenShiftName)` directly from `context.Reconciliationbatchcontributors.AsNoTracking()` for `dailyIds`.
- [ ] **Step 4: Run Frontend and Backend test suites to verify GREEN**
  - Run: `npx vitest run src/__tests__/AdminBomBranch.test.tsx` and `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~Reconciliation"`
  - Expected: PASS
