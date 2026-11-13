# MRX Customer & Date Switch Zero-Shift & Zero-Flash Closure (`I1–I9`) Design Spec

- **Date:** 2026-11-09
- **Operational Mode Scope (`DOM-MODE-1`):** `MATERIAL_RECONCILIATION` (`MRX`) mode routes (`/`, `/weekly-menu?view=mrx-batch|mrx-materials|mrx-plans`, `/warehouse?view=mrx-daily|mrx-preparation|mrx-issues`, `/chef?view=mrx-cooking`, `/reconciliation?view=lines|variances|transactions|audit|completed`).
- **Governance Layer:** Layer 2 (UX State Matrix), Layer 3 (UI Primitives & Composites), Layer 4 (FE Feature Hooks & Branches), Layer 5 (Contract & Behavioral Verification).

## 1. Problem Statement & Root-to-Leaf Diagnosis

When operators switch **Customer (`customerId` / `customerCode`)**, **Batch (`batchId`)**, or **Service Date / Week (`date` / `weekStartDate`)** in `MATERIAL_RECONCILIATION` mode, 9 specific mechanisms across the component tree still produce layout shifts or visual flashes:

### `I1` — `/reconciliation?view=lines` Cross-Week Date Reset & Empty-Scope Branch Collapse
- **Owners:** `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`, `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- **Root Cause:**
  1. When `handleSelectDate(date)` switches to a date in a different week (`currentWeek !== nextWeek`), it sets `batchId = ''` (`L455`), which re-triggers `getBatchPage` (`L227`). However, `getBatchPage`'s `.then()` (`L249`: `const selected = sortedItems[0]?.batchId || ''`) **ignores `weekStartFor(serviceDateRef.current)`** and always selects `sortedItems[0]` (the latest batch) and overwrites `serviceDate` back to `sortedItems[0].weekStartDate` (`L258`)! And if the customer has no batch for the target week, it still falls back to `sortedItems[0]`!
  2. Furthermore, when a customer or week has no batch (`!batchId`) or 0 lines, `isTransitioningScope` keeps the old customer's table mounted during `getBatchPage`, and then `StateBoundary` (`isEmpty` / `isPartial`) **unmounts `<ReconciliationLinesBranch>` (`ReconciliationBlockerStrip` + `ReconciliationLinesFilterToolbar` + `DataGrid`)** into a centered Empty card (`125px` vertical collapse) if `data` becomes `null`, or if switching from an empty customer (`data = null`) to another customer (`hasHydratedData = false -> isLoading = true -> WorkbenchSkeleton`).

### `I2` — `/weekly-menu?view=mrx-batch` Double `getEditScope` Fetch & Header/Subbar Chrome Shifts
- **Owners:** `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts`, `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`, `frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx`
- **Root Cause:**
  1. In `MrxBatchWorkbench.tsx` (`L82-87`), `useMrxSourceEdit` receives `customerId`, `weekStartDate`, and `sourceVersionKey: "${source?.menuVersionId ?? ''}:${batch?.version ?? ''}"`. When the user switches customer or week, `customerId`/`weekStartDate` updates immediately while `source` is still the previous customer's `source` (`isTransitioningScope = true`). That causes `useMrxSourceEdit` to fire `mrxApi.getEditScope` immediately with the old `sourceVersionKey`, and then fire a **second** `load()` call `~50ms` later when `getWeeklySource` resolves the new `menuVersionId` (`sourceVersionKey` changes)!
  2. In `MrxBatchHeaderBranch.tsx` (`L60`, `L91`), `title` flips between `'Hoàn thiện nguồn tuần'` and `'Chuẩn bị lô đối soát'`, and `<Badge>` has `animate-in fade-in duration-150`.
  3. In `MrxBatchWorkbench.tsx` (`L229-270`), `TelemetrySubbar` swaps `leftControls` between `<ReconciliationLifecycleStrip>` (`4` steps) and a text pill `"Chưa khởi tạo lô đối soát"`, unmounts `telemetryPills` completely when `!source`, and mounts/unmounts `"Món & BOM đã đóng băng"` when `batch` toggles between `null` and non-`null`.

### `I3` — `/warehouse?view=mrx-daily` Date-Tab Checkmark Shift & Header Action Width Jump
- **Owners:** `frontend/src/features/warehouse/branches/MrxDailyDateTabsBranch.tsx`, `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`
- **Root Cause:**
  1. In `MrxDailyDateTabsBranch.tsx` (`L73-75`), `{hasIssued && <Check className="size-3 text-emerald-600 inline ml-1" />}` widens each `T2..T7` button by `16px` only when `hasIssued` is true. Switching between batches with different issued days shifts the date tab strip horizontally.
  2. In `MrxDailyHeaderBranch.tsx` (`L100`), status `<Badge>` unmounts when `currentStatus` is undefined during batch switch; and `activeBatch` fallback uses `batches.find(...)`.

### `I4` — `VietnameseDateInput` Inline Validation Alert Pushes `WorkspaceHeader` Height `+20px`
- **Owner:** `frontend/src/components/ui/vietnamese-date-input.tsx`
- **Root Cause:** At `L93` and `L140`, `<div className="inline-flex flex-col gap-1">` renders `{message && <span id={errorId} role="alert" className="text-xs">{message}</span>}` in normal document flow inside `WorkspaceHeader`, expanding the header height from `56px` to `76px` and pushing `TelemetrySubbar` and Zone 3 down by `20px`.

### `I5` — `StateBoundary` `0ms` Progressbar Seam Pulse & Ternary Wrapper Swap
- **Owner:** `frontend/src/components/workbench/StateBoundary.tsx`
- **Root Cause:** At `L386-397`, when `isPreviousData` becomes `true`, `<div role="progressbar" ... className="absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse bg-slate-300" />` mounts at `0ms` with no opacity delay (flashing a `2px` bar along the top seam of the table even on `15ms` transitions), and `children` is swapped between two ternary `<div>` branches (`isPreviousData ? <div ...> : <div ...>`).

### `I6` — `/warehouse?view=mrx-preparation` Date/Week Switch Table Unmount on Empty Scope
- **Owners:** `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`, `frontend/src/features/warehouse/branches/MrxPrepAllocationsBranch.tsx`
- **Root Cause:** When switching to a date or week that has `0` batches (`res.batches.length === 0`), `useWorkbenchQuery` sets `isEmpty = true`, which causes `StateBoundary` inside `MrxPrepAllocationsBranch.tsx` to unmount `<DataGrid>` and its sticky `<thead>` instead of rendering the empty message inside `DataGrid`'s `<tbody>` (`H2`).

### `I7` — `/weekly-menu?view=mrx-materials` & `mrx-plans` 1-Frame `result = null` Skeleton Flash Between `sourceQuery` and `inspection`
- **Owners:** `frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts`, `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx`
- **Root Cause:**
  1. When `sourceQuery` resolves a new customer/week's `menuVersionId`, `exactSource` becomes non-null so `isSourceTransitioning` becomes `false` (`useMrxQuantityInspection.ts:L33`). On that exact render frame—before `inspection`'s `useEffect` sets `isFetching`—`inspection.data` still holds the old `menuVersionId`, so `exactResult` is `null`, and `inspection.stateProps.isLoading` / `isFetching` are `false` if `inspection` hit a warm cache or before `effectiveResolvedKey !== cacheKey` settles, or when `published` is false/loading. More importantly, when switching from Customer A (`published = true`) to Customer B while `sourceQuery` is loading (`exactSource = null`), if `sourceQuery.data` was `null` (e.g. after a 404 week) and then switches to a valid week, `source` is `null` so `stateProps` switches to `sourceQuery.stateProps`. And in `MrxQuantityInspectionPage.tsx` (`L128`), `{workspace.source && <div ...><dt>Phiên bản:</dt>...</div>}` mounts/unmounts in the subbar `<dl>`, shifting the `"Chuẩn bị lô đối soát"` link horizontally by `~85px`.

### `I8` — `/reconciliation?view=variances|transactions|audit` Flash `"Chưa chọn lô đối soát"` on Customer Switch
- **Owners:** `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`, `frontend/src/features/reconciliation/useReconciliationReports.ts`, `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- **Root Cause:** When switching Customer on `/reconciliation` while on `variances`, `transactions`, or `audit`, `handleSelectCustomer` sets `batchId = ''` while `getBatchPage` is in flight.
  1. `ReconciliationReportTables.tsx` (`L54`) checks `if (!batchId && activeTab !== 'completed') return <div>Chưa chọn lô đối soát</div>`, immediately unmounting the report table into an empty card while `getBatchPage` is still loading!
  2. `useReconciliationReports.ts` (`L88`) checks `state?.scope === reportScope`, where `reportScope` includes `batchId`. So when `batchId` changes from `batch-1` to `''` to `batch-2`, `state?.scope === reportScope` is `false`, dropping `previous` to `null` and unmounting the table into `<WorkbenchSkeleton>`!

### `I9` — `/` (`ReconciliationDashboardPage`) Variable-Height Role Queue Jumps Batch Table Vertically on Customer/Period Switch
- **Owner:** `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`
- **Root Cause:**
  1. On `/`, `<section aria-label="Công việc theo vai trò">` (`L216-225`) sits above `<section aria-label="Danh sách lô theo bộ lọc">` (`L226`) with an unconstrained `<ul>` height (`1` item = `62px`, `3` items = `186px`, `0` items = `41px`). Switching customer or period changes the number of queue items and jumps the batch table up/down by up to `145px`.
  2. In `WorkspaceHeader.Actions` (`L194`), `{nextAction?.targetUrl && <Button ...>Mở việc tiếp theo</Button>}` mounts/unmounts when switching between a customer with an `OWN_ACTION` item and a customer without one.

---

## 2. Acceptance Criteria (`AC-I1`..`AC-I9`)

- **`AC-I1`:** On `/reconciliation`, picking a date in another week selects the batch matching that week if one exists (instead of snapping back to `sortedItems[0]`), and switching between customers/weeks keeps `WorkspaceHeader` and `TelemetrySubbar` at fixed height without unmounting the report/lines chrome mid-transition.
- **`AC-I2`:** On `/weekly-menu?view=mrx-batch`, switching customer or week does not fire duplicate `getEditScope` requests when `sourceVersionKey` is still transitioning, keeps `MrxBatchHeaderBranch` badge free of `animate-in fade-in`, and keeps `TelemetrySubbar` `leftControls` (`ReconciliationLifecycleStrip`) and `telemetryPills` version slot mounted at stable width.
- **`AC-I3`:** On `/warehouse?view=mrx-daily`, switching batches or dates keeps date tab widths stable and keeps `<MrxDailyLinesBranch>` (`LocalFindBar` + `DataGrid` `<thead>`) mounted when switching across service days within a valid batch.
- **`AC-I4`:** `VietnameseDateInput` renders validation alerts without increasing `WorkspaceHeader` height when an invalid date is typed.
- **`AC-I5`:** `StateBoundary` delays the `progressbar` visual pulse by `150ms` (`delay-150`) alongside the `opacity-70` wrapper and uses a single wrapper `<div>` for `children`.
- **`AC-I6`:** On `/warehouse?view=mrx-preparation`, switching to a date/week with `0` batches keeps `<LocalFindBar>` and `<DataGrid>` (`<thead>`) mounted when transitioning from an existing view or renders cleanly without unmounting chrome.
- **`AC-I7`:** On `/weekly-menu?view=mrx-materials` and `mrx-plans`, the `"Phiên bản:"` `<dd>` in the subbar is always mounted (`—` when no source), and `useMrxQuantityInspection` retains `result` across the handoff between `sourceQuery` resolving a new `menuVersionId` and `inspection` starting its fetch.
- **`AC-I8`:** On `/reconciliation?view=variances|transactions|audit`, switching customer retains the previous report table (with `isReportLoading` dimming) while `catalogLoading` / new `batchId` report fetch is in flight, never flashing `"Chưa chọn lô đối soát"` mid-switch.
- **`AC-I9`:** On `/` (`ReconciliationDashboardPage`), switching customer or period keeps `"Mở việc tiếp theo"` rendered (`disabled` when no `nextAction`) when `data` is loaded, and constrains/stabilizes the role queue section so the batch table does not jump vertically.
