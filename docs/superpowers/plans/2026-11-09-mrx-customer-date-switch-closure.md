# MRX Customer & Date Switch Zero-Shift & Zero-Flash Closure (`I1–I9`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all remaining layout shifts (`CLS`) and visual flashes when switching Customer, Batch, or Service Date / Week across all 18 MRX route/view leaves (`I1`–`I9`).

**Architecture:** Fix shared primitives (`VietnameseDateInput` overlay validation alert `I4`, `StateBoundary` `delay-150` progressbar & unified wrapper `I5`) first, then close customer/date switch transition gaps in `/reconciliation` (`I1`, `I8`), `/weekly-menu` (`I2`, `I7`), `/warehouse` (`I3`, `I6`), and `/` (`I9`). All changes are strictly isolated to `MATERIAL_RECONCILIATION` mode and shared workbench primitives (`DOM-MODE-1`).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (`frontend/src/styles/index.css`), Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-mrx-customer-date-switch-closure-design.md`

## Global Constraints

- Operational Mode Isolation (`DOM-MODE-1`): `DEFAULT != MATERIAL_RECONCILIATION`.
- Single Styling Authority: Zero ad-hoc CSS tokens outside `frontend/src/styles/index.css`.
- Rule TA-1 to TA-5 (`ipc-test-audit`): Backend-grounded fixtures, no self-mocking of components/hooks under test, zero exemption padding.

## Review Focus

- Cross-week date selection on `/reconciliation` when the customer has multiple weekly batches (`sortedItems[0]` vs matching `weekStartDate`).
- Customer switch on `/reconciliation?view=variances` while `getBatchPage` is in flight (`batchId === ''` while `catalogLoading === true`).
- Customer switch on `/weekly-menu?view=mrx-batch` not firing duplicate `getEditScope` requests before `getWeeklySource` resolves the new `menuVersionId`.
- Customer switch on `/weekly-menu?view=mrx-materials` not dropping `result` to `null` on the render frame when `sourceQuery` resolves a new `menuVersionId`.
- Typing an invalid date in `VietnameseDateInput` inside `WorkspaceHeader` without expanding the header container height.

---

### Task 1: Shared Primitives — `VietnameseDateInput` Overlay Alert & `StateBoundary` Delayed Progressbar (`I4` + `I5`)

**Files:**
- Modify: `frontend/src/components/ui/vietnamese-date-input.tsx:91-142`
- Modify: `frontend/src/components/workbench/StateBoundary.tsx:386-398`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

**Interfaces:**
- Consumes: `VietnameseDateInputProps`, `StateBoundaryProps`
- Produces: Zero-height-shift `VietnameseDateInput` alert positioning (`absolute top-full left-0 mt-1 z-30`) and `delay-150` on `StateBoundary`'s `role="progressbar"` with a single unified `children` wrapper `<div>`.

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/Primitives.test.tsx`**
  Assert that when `VietnameseDateInput` shows a validation `role="alert"`, the outer wrapper has `relative` and the alert has `absolute top-full` so it does not push sibling header elements down; and when `StateBoundary` renders with `isPreviousData={true}` and `hasExistingData={true}`, the `role="progressbar"` element has `delay-150`.
- [ ] **Step 2: Run test to verify it fails (`RED`)**
  Run: `npx vitest run src/__tests__/Primitives.test.tsx`
- [ ] **Step 3: Implement `I4` & `I5` in `vietnamese-date-input.tsx` and `StateBoundary.tsx`**
- [ ] **Step 4: Run test to verify it passes (`GREEN`)**
  Run: `npx vitest run src/__tests__/Primitives.test.tsx`

---

### Task 2: `/reconciliation` Cross-Week Date Selection & Report-Tab Customer-Switch Continuity (`I1` + `I8`)

**Files:**
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:237-271`
- Modify: `frontend/src/features/reconciliation/useReconciliationReports.ts:86-103`
- Modify: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx:15-67`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx:326-346`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `useReconciliationWorkspace`, `useReconciliationReports`, `ReconciliationReportTables`
- Produces:
  1. In `useReconciliationWorkspace.ts`, when `getBatchPage` resolves and `currentBatchId` is not in `sortedItems`, prefer `const targetWeek = weekStartFor(serviceDateRef.current); const matchedByWeek = sortedItems.find(b => b.weekStartDate === targetWeek); const selectedBatch = matchedByWeek ?? sortedItems[0];` so cross-week `handleSelectDate` selects the batch for that week (and preserves the user's chosen `serviceDate` within that week) instead of snapping back to `sortedItems[0].weekStartDate`.
  2. In `useReconciliationReports.ts`, retain `previous = !currentData && !current?.error && state?.data ? state : null` across `batchId` switches within the same `activeReportTab` (by tracking `tabKey = "${activeReportTab}_${activeReportTab === 'audit' ? auditSubTab : ''}"` on `ReportState`), and keep `enabled` data visible while `isCatalogLoading` is true.
  3. In `ReconciliationReportTables.tsx`, accept `isCatalogLoading?: boolean` and only render the `"Chưa chọn lô đối soát"` empty box when `!batchId && !isCatalogLoading && !hasCurrentReport && activeTab !== 'completed'`.

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/Reconciliation.test.tsx`**
  Test that (a) picking a date in an earlier week (`2026-10-12`) selects the batch for `2026-10-12` instead of snapping back to `2026-10-19`, and (b) switching customer while on `/reconciliation?view=variances` keeps the variance report table mounted while `getBatchPage` and `getVarianceRegister` are in flight without flashing `"Chưa chọn lô đối soát"`.
- [ ] **Step 2: Run test to verify it fails (`RED`)**
  Run: `npx vitest run src/__tests__/Reconciliation.test.tsx`
- [ ] **Step 3: Implement `I1` & `I8` in `useReconciliationWorkspace.ts`, `useReconciliationReports.ts`, `ReconciliationReportTables.tsx`, and `ReconciliationPage.tsx`**
- [ ] **Step 4: Run test to verify it passes (`GREEN`)**
  Run: `npx vitest run src/__tests__/Reconciliation.test.tsx`

---

### Task 3: `/weekly-menu` Customer & Week Switch Deduplication & Subbar/Inspection Continuity (`I2` + `I7`)

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx:82-87,224-275`
- Modify: `frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx:86-96`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts:26-117`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts:51-65`
- Modify: `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx:124-132`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `useMrxBatchWorkspace`, `useMrxSourceEdit`, `useMrxQuantityInspection`
- Produces:
  1. In `MrxBatchWorkbench.tsx`, pass `isTransitioningParent: stateProps.isPreviousData` to `useMrxSourceEdit` (or gate `useMrxSourceEdit`'s `useEffect` fetch while `source` belongs to the previous customer/week) so switching customer/week only calls `mrxApi.getEditScope` **once** for the new scope, remove `animate-in fade-in duration-150` from `MrxBatchHeaderBranch.tsx`, and keep `TelemetrySubbar` `telemetryPills` version slot mounted (`v${source?.menuVersionNo ?? '—'}`).
  2. In `useMrxQuantityInspection.ts`, include `Boolean(published && inspection.data && (inspection.data.view !== view || inspection.data.data.menuVersionId !== menuVersionId))` in `isInspectionTransitioning` so `result` never drops to `null` for 1 frame between `sourceQuery` resolving a new `menuVersionId` and `inspection` starting its fetch; and in `MrxQuantityInspectionPage.tsx`, always render the `"Phiên bản:"` `<div className="flex items-baseline gap-1">` (`workspace.source ? <Num value={workspace.source.menuVersionNo} /> : '—'`).

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/WeeklyMenu.test.tsx`**
  Test that (a) switching customer on `/weekly-menu?view=mrx-batch` calls `getEditScope` only once for the target customer and keeps `"Phiên bản nguồn:"` in the subbar without `animate-in fade-in`, and (b) on `/weekly-menu?view=mrx-materials`, switching customer keeps `MaterialsTable` mounted across the frame where `getWeeklySource` resolves before `getMaterialInspection` resolves, and always renders `"Phiên bản:"` in the subbar.
- [ ] **Step 2: Run test to verify it fails (`RED`)**
  Run: `npx vitest run src/__tests__/WeeklyMenu.test.tsx`
- [ ] **Step 3: Implement `I2` & `I7` across `/weekly-menu` files**
- [ ] **Step 4: Run test to verify it passes (`GREEN`)**
  Run: `npx vitest run src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx`

---

### Task 4: `/warehouse` & `/` Customer/Date Switch Chrome & Queue Stability (`I3` + `I6` + `I9`)

**Files:**
- Modify: `frontend/src/features/warehouse/branches/MrxDailyDateTabsBranch.tsx:56-77`
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx:103-107`
- Modify: `frontend/src/features/warehouse/branches/MrxPrepAllocationsBranch.tsx:30-75`
- Modify: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx:192-225`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`
- Test: `frontend/src/__tests__/MrxDashboard.test.tsx`

**Interfaces:**
- Consumes: `MrxDailyDateTabsBranch`, `MrxPrepAllocationsBranch`, `ReconciliationDashboardPage`
- Produces:
  1. In `MrxDailyDateTabsBranch.tsx`, render the issued checkmark inside a fixed-width slot or consistent padding so toggling `hasIssued` across batch switches does not jump date tab widths.
  2. In `MrxPrepAllocationsBranch.tsx`, when `stateBoundaryProps.isEmpty` is true because the selected date/week has `0` batches (`filter-empty`), keep `<DataGrid>` mounted with `data={[]}` and `emptyState` instead of unmounting `<DataGrid>` `<thead>` via `<StateBoundary isEmpty={true}>`.
  3. In `ReconciliationDashboardPage.tsx`, keep `"Mở việc tiếp theo"` rendered (`disabled={refreshing || !nextAction?.targetUrl}`) whenever `data` is loaded and the user has an operational role (`pendingMetricCount > 0`), and place `<section aria-label="Danh sách lô theo bộ lọc">` above `<section aria-label="Công việc theo vai trò">` (or constrain the queue list height) so changing customer/period filter never shifts the batch table's vertical position!

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/Warehouse.test.tsx` and `frontend/src/__tests__/MrxDashboard.test.tsx`**
  Test that (a) on `/warehouse?view=mrx-preparation`, switching to a date with `0` batches keeps `<table>` and `<thead className="sticky top-0">` mounted (`tableCount = 1`) while displaying `"Không có lô đối soát trong phạm vi đã chọn"`, and (b) on `/`, switching customer from a customer with 3 queue items to a customer with 0 queue items keeps `"Mở việc tiếp theo"` mounted in the header (disabled) and does not shift the vertical order/position of `"Danh sách lô theo bộ lọc"`.
- [ ] **Step 2: Run tests to verify they fail (`RED`)**
  Run: `npx vitest run src/__tests__/Warehouse.test.tsx src/__tests__/MrxDashboard.test.tsx`
- [ ] **Step 3: Implement `I3`, `I6`, & `I9`**
- [ ] **Step 4: Run tests to verify they pass (`GREEN`)**
  Run: `npx vitest run src/__tests__/Warehouse.test.tsx src/__tests__/MrxDashboard.test.tsx`
