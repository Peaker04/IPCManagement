# Frontend UX Fluidity, Zero-Flash Transitions, Layout Stability, & Bundle Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate Frontend white flashes, layout shifts (CLS), IME search input breaks, redundant network refetches on cached pagination/tab switches, and the monolithic `922 kB` JS bundle across all 9 findings (`C1–C9`).

**Architecture:** Fix state transition and caching boundaries at their root owners (`useWorkbenchQuery.ts`, `useMrxQuantityInspection.ts`, `MrxQuantityInspectionPage.tsx`, `useReconciliationWorkspace.ts`, `ReconciliationPage.tsx`) so existing rows remain visible under `StateBoundary`'s `isPreviousData` overlay during filter/page/date changes, stabilize toolbar/header/pagination heights (`LocalFindBar.tsx`, `MrxCookingWorkbench.tsx`, `ReconciliationDashboardPage.tsx`, `ReconciliationHeaderBranch.tsx`, `PaginationBar.tsx`), and code-split route pages in `App.tsx` + `vite.config.ts`.

**Tech Stack:** React 19, TypeScript, React Router v7, Vite 6, Tailwind CSS v4, Vitest + React Testing Library.

**Spec:** [`docs/superpowers/specs/2026-11-08-fe-ux-performance-closure-design.md`](../specs/2026-11-08-fe-ux-performance-closure-design.md)

## Global Constraints

- Zero backend C# or database schema changes.
- Zero ad-hoc CSS tokens outside `frontend/src/styles/index.css`.
- Preserve all uncommitted working-tree changes (`T1–T5`, `V1–V3`, `A1–A10`, `B1–B8`), keep git index empty, and perform no unapproved git commits or destructive git operations.
- Keep running dev servers (`task-166` Backend `:5262`, `task-167` Frontend `:5173`) intact.
- Emit Scoped Pre-Code UI Gate Block before modifying `.tsx` files.

## Review Focus

1. **External URL search param changes on `MrxQuantityInspectionPage` (e.g. browser Back/Forward or clear):** `searchInput` must sync when `searchKeyword` in URL changes externally so the input box never shows stale text after Back navigation.
2. **Stale completion guard on `/reconciliation` during `serviceDate` / `batchId` transition:** While `isPreviousData` is `true` (showing previous date's lines while new date loads), `canComplete` must be `false` so a user cannot complete a batch using stale readiness state.
3. **Foreign batch cooking guard on `/chef?view=mrx-cooking`:** Keeping `LocalFindBar` mounted while loading must NOT expose foreign batch rows or enable CSV/XLSX/Print buttons while `cookingData?.batchId !== batchId` (`Chef.test.tsx:L337`).
4. **Failed dashboard revalidation (`ReconciliationDashboardPage`):** When background refresh fails (`current?.error !== null`), `"Mở việc tiếp theo"` must remain hidden (`MrxDashboard.test.tsx:L93`), whereas while `refreshing` is in-flight without error (`!current?.error && data`), it stays visible and `disabled`.
5. **Warm cache hit on `useWorkbenchQuery` key change:** Returning to an already-cached `cacheKey` (e.g. Page 1 after visiting Page 2) must hydrate synchronously (`isFetching = false`, `isPreviousData = false`) without firing a duplicate network call when `!cached.isStale`.

---

### Task 1: `useWorkbenchQuery` Cache-Aware Key Transitions, TTL Visibility Revalidation, & `MrxQuantityInspectionPage` Debounced Search (`C1`, `C2`, `C4`)

**Files:**
- Modify: `frontend/src/hooks/useWorkbenchQuery.ts:180-226`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts:38-62`
- Modify: `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx:71-129`
- Test: `frontend/src/__tests__/useWorkbenchQuery.test.ts`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `serverStateCache.get<unknown>(cacheKey)` from `frontend/src/store/serverStateCache.ts`
- Produces:
  - `useWorkbenchQuery`: synchronous warm-cache hydration on `cacheKey` change when `!cached.isStale`, `setIsFetching(true)` on network fetch start, and `refetch(false)` on `visibilitychange`.
  - `useMrxQuantityInspection`: keeps `result` populated when `inspection.data?.view === view && inspection.data.data.menuVersionId === menuVersionId` and forwards `isPreviousData: Boolean(result && inspection.stateProps.isPreviousData)`.
  - `MrxQuantityInspectionPage`: `250ms` debounced `searchInput` (`replace: true` URL update) and stable `key={`${result.view}:${result.data.menuVersionId}`}`.

- [ ] **Step 1: Write the failing tests in `useWorkbenchQuery.test.ts` and `WeeklyMenu.test.tsx`**

Add to `frontend/src/__tests__/useWorkbenchQuery.test.ts`:
- `C4: hydrates warm cache entry on cacheKey transition without firing network queryFn and respects cache TTL on visibilitychange`

Add to `frontend/src/__tests__/WeeklyMenu.test.tsx`:
- `C1 & C2: keeps inspection rows and PaginationBar mounted with isPreviousData during paging and debounces search input by 250ms`

- [ ] **Step 2: Run tests to verify they fail (RED)**

Run: `npx vitest run src/__tests__/useWorkbenchQuery.test.ts src/__tests__/WeeklyMenu.test.tsx`
Expected: FAIL (`useWorkbenchQuery` calls `queryFn` even when returning to warm `cache_A` and calls `queryFn` on `visibilitychange` despite fresh TTL; `WeeklyMenu` unmounts rows/PaginationBar while Page 2 is pending and fires API immediately on keystroke before 250ms).

- [ ] **Step 3: Implement `C4`, `C1`, and `C2` in `useWorkbenchQuery.ts`, `useMrxQuantityInspection.ts`, and `MrxQuantityInspectionPage.tsx`**

1. In `frontend/src/hooks/useWorkbenchQuery.ts`:
   - In `useEffect` (`lines 180-217`), check `const cachedEntry = serverStateCache.get<unknown>(cacheKey);`. If `cachedEntry` exists, hydrate `data`, `error`, `hasLoadedOnce`, `resolvedCacheKey`, and `snapshotKey`; if `!cachedEntry.isStale`, set `setIsFetching(false)` and `return`. Otherwise set `setIsFetching(true)` before calling `queryFnRef.current(undefined, controller.signal)`.
   - In `visibilitychange` effect (`line 222`), change `void refetch(true)` to `void refetch(false)`.
2. In `frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts`:
   - Keep `result` when `inspection.data?.view === view && inspection.data.data.menuVersionId === menuVersionId` even while `inspection.stateProps.isPreviousData` is `true`, and set `isPreviousData: Boolean(result && inspection.stateProps.isPreviousData)` in `stateProps`.
3. In `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx`:
   - Add `searchInput` state synced with `searchKeyword` and debounced by `250ms` into `setParams(..., { replace: true })`.
   - Use `replace: true` in `update` for filter/search changes and keep `key={`${result.view}:${result.data.menuVersionId}`}` on the table wrapper.

- [ ] **Step 4: Run tests to verify they pass (GREEN)**

Run: `npx vitest run src/__tests__/useWorkbenchQuery.test.ts src/__tests__/WeeklyMenu.test.tsx`
Expected: PASS

---

### Task 2: Smooth Scope Transitions & Customer-Switch Guard on `/reconciliation` (`C3`, `C5`)

**Files:**
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:84-390`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx:266-318`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `StateBoundaryProps.isPreviousData`
- Produces: `isPreviousData: Boolean(data && loadedScope !== reconCacheKey)` from `useReconciliationWorkspace`, `canComplete = false` while `isPreviousData` is `true`, and `setHasBatchesLoaded(false)` on customer change in `handleSelectCustomer`.

- [ ] **Step 1: Write the failing test in `Reconciliation.test.tsx`**

Add to `frontend/src/__tests__/Reconciliation.test.tsx`:
- `C3 & C5: keeps previous reconciliation lines visible with progressbar during date switch and never flashes empty state while switching customers`

- [ ] **Step 2: Run test to verify it fails (RED)**

Run: `npx vitest run src/__tests__/Reconciliation.test.tsx -t "C3 & C5"`
Expected: FAIL (switching customer immediately flashes `"Chưa có dữ liệu đối soát cho ngày đã chọn"` while `getBatchPage` is pending, and switching date unmounts the table into an empty div instead of keeping previous rows with `isPreviousData`).

- [ ] **Step 3: Implement `C3` and `C5` in `useReconciliationWorkspace.ts` and `ReconciliationPage.tsx`**

1. In `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`:
   - Keep `storedData` visible when `storedData?.batchId === batchId` (`const data = storedData?.batchId === batchId ? storedData : null; const isPreviousData = Boolean(data && loadedScope !== reconCacheKey);`).
   - Require `!isPreviousData` in `canComplete` (`const canComplete = !isPreviousData && data?.status === 'IN_PROGRESS' && data.weeklyStatus === 'WEEK_COMPLETE';`).
   - In `handleSelectCustomer`, call `setHasBatchesLoaded(false)` and `setIsLoading(true)` so `isBootstrapping` stays `true` until the new customer's batch catalog loads.
   - In `handleSelectDate`, if `currentWeek === nextWeek` and `batchId` is present, check `serverStateCache.get<ReconciliationBatchSummary>(\`mrx_recon_\${batchId}_\${date}\`)?.data`: if cached, hydrate `setData(cached)` + `setLoadedScope(\`mrx_recon_\${batchId}_\${date}\`)`; otherwise set `setIsFetching(true)` while keeping `storedData` on screen under `isPreviousData`.
2. In `frontend/src/features/reconciliation/ReconciliationPage.tsx`:
   - Pass `isPreviousData={isPreviousData && activeReportTab === 'lines'}` to `<StateBoundary>`.

- [ ] **Step 4: Run test to verify it passes (GREEN)**

Run: `npx vitest run src/__tests__/Reconciliation.test.tsx`
Expected: PASS

---

### Task 3: Fixed-Height Chrome, Stable Pagination Footer, Single-Layer Fade, & Route Code-Splitting (`C6`, `C7`, `C8`, `C9`)

**Files:**
- Modify: `frontend/src/components/workbench/LocalFindBar.tsx:6-36`
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx:225-232`
- Modify: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx:157-194`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx:77-119`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationLinesBranch.tsx:81`
- Modify: `frontend/src/components/workbench/PaginationBar.tsx:26-28`
- Modify: `frontend/src/App.tsx:13-162`
- Modify: `frontend/vite.config.ts:9-12`
- Test: `frontend/src/__tests__/ZeroJitterHeaderGeometry.test.tsx`
- Test: `frontend/src/__tests__/Primitives.test.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`
- Test: `frontend/src/__tests__/MrxDashboard.test.tsx`

**Interfaces:**
- Consumes: `LocalFindBarProps`, `PaginationBarProps`, `React.lazy`, `Suspense`
- Produces:
  - `LocalFindBar` with `disabled?: boolean` prop, always mounted on `MrxCookingWorkbench` when `!isLegacyLineageMissing && !displayedError`.
  - `PaginationBar` with `min-h-12` on footer/toolbar placement.
  - `ReconciliationDashboardPage` keeping `"Mở việc tiếp theo"` mounted (`disabled={refreshing}`) during in-flight refresh when `!current?.error && data`.
  - `ReconciliationHeaderBranch` with `min-h-9 flex items-center` on `completed` tab and no redundant `animate-in` on badge/lines branch.
  - `App.tsx` + `vite.config.ts` with route-level `React.lazy` + `Suspense` and vendor chunking (`< 500 kB` per chunk).

- [ ] **Step 1: Write the failing tests in `ZeroJitterHeaderGeometry.test.tsx` and `Primitives.test.tsx`**

Add assertions to `ZeroJitterHeaderGeometry.test.tsx`:
- `C6 & C9: ReconciliationHeaderBranch preserves min-h-9 on completed tab and omits redundant nested animate-in on status badge`

Add assertions to `Primitives.test.tsx`:
- `C8: PaginationBar reserves min-h-12 on footer placement even on single-page datasets`

- [ ] **Step 2: Run tests to verify they fail (RED)**

Run: `npx vitest run src/__tests__/ZeroJitterHeaderGeometry.test.tsx src/__tests__/Primitives.test.tsx`
Expected: FAIL (`completed` tab label lacks `min-h-9` wrapper; `PaginationBar` footer lacks `min-h-12`).

- [ ] **Step 3: Implement `C6`, `C7`, `C8`, and `C9`**

1. Update `LocalFindBar.tsx` (add `disabled?: boolean` prop passed to `<Input>` and clear `<Button>`) and `MrxCookingWorkbench.tsx` (keep `<LocalFindBar>` mounted with `disabled={!hasData}` when `!isLegacyLineageMissing && !displayedError`).
2. Update `ReconciliationDashboardPage.tsx` (`const nextAction = !current?.error && data ? data.summary.items.find(...) : undefined;` and add `disabled={refreshing}` on the `"Mở việc tiếp theo"` `<Button>`).
3. Update `ReconciliationHeaderBranch.tsx` (`<div className="min-h-9 flex items-center"><span className="text-xs text-slate-500 font-medium whitespace-nowrap">Lô đối soát đã hoàn tất</span></div>`, remove `animate-in fade-in duration-150` from badge) and `ReconciliationLinesBranch.tsx` (remove `animate-in fade-in duration-150 ease-out`).
4. Update `PaginationBar.tsx` (add `min-h-12` to non-selector `<nav>` className).
5. Update `App.tsx` to wrap route page components in `lazy(...)` and `<Suspense fallback={<div className="flex-1 min-h-0 w-full bg-white" aria-busy="true" />}>`, and configure `manualChunks` in `vite.config.ts`.

- [ ] **Step 4: Run unit tests, lint, and production build to verify GREEN and bundle sizes (`< 500 kB`)**

Run: `npx vitest run src/__tests__/ZeroJitterHeaderGeometry.test.tsx src/__tests__/Primitives.test.tsx src/__tests__/Chef.test.tsx src/__tests__/MrxDashboard.test.tsx && npm run lint:fe && npm run build:fe`
Expected: All tests PASS, lint exits `0`, and `npm run build:fe` succeeds with multiple route chunks and zero `> 500 kB` chunk warnings.
