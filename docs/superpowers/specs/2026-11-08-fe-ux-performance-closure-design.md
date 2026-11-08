# Frontend UX Fluidity, Zero-Flash Transitions, Layout Stability, & Bundle Splitting Design (`C1–C9`)

- **Date:** 2026-11-08
- **Status:** Approved by user for immediate Spec + Plan + Native execution
- **Baseline Commit:** `e0019978b2ce785945f4ea1a9514fc6bd0bde8f1` (`feature/ui-interaction-data-states`)
- **Governance:** [`AGENTS.md`](../../../AGENTS.md), [`.planning/WORK.md`](../../../.planning/WORK.md), [`docs/DESIGN.md`](../../DESIGN.md), [`docs/UI-KIT.md`](../../UI-KIT.md)

---

## 1. Intent & Why

Although all MRX and DEFAULT business contracts pass verification, the Frontend experience suffers from visual flashes, layout shifts (CLS), IME composition breaks when typing Vietnamese search terms, unnecessary network refetches on cached pagination/tab switches, and a monolithic `922 kB` JS bundle.

This specification addresses all 9 findings (`C1–C9`) from the Frontend UX & Performance Ponytail Audit by fixing the root state/rendering owners without altering business rules, backend contracts, or styling tokens outside `frontend/src/styles/index.css`.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
1. **Keep Previous Data Across Pagination & Search (`C1`):** Prevent `/weekly-menu?view=mrx-materials` and `view=mrx-plans` from blanking `result` to `null` and unmounting `DataGrid` + `PaginationBar` on page/search changes; preserve selected detail rows in `MaterialsTable` when paging/searching within the same `menuVersionId`.
2. **Debounced Vietnamese IME-Safe Search (`C2`):** Decouple local input state (`searchInput`) from URL `searchParams.get('q')` in `MrxQuantityInspectionPage.tsx` with a `250ms` debounce and `{ replace: true }` history updates so typing Vietnamese Telex/VNI never drops diacritics, spams API calls on every keystroke, or pollutes browser Back history.
3. **Eliminate White-Flash & Premature Empty Transitions (`C3`, `C5`):**
   - Preserve hydrated table data (`keepPreviousData` with `isPreviousData` / `isFetching` overlay) during same-surface scope transitions (`serviceDate` / `batchId` / `customerId` changes on `/reconciliation`, `/weekly-menu?view=mrx-batch`) while strictly blocking mutations and exports until the active scope resolves.
   - Fix `handleSelectCustomer` in `useReconciliationWorkspace.ts` so switching customers sets `hasBatchesLoaded = false` and `isFetching = true` (when `storedData` exists) or `isLoading = true` instead of flashing the empty state `"Chưa có lô đối soát..."` while `getBatchPage` is in flight.
4. **Synchronous SWR Cache Hits on Key Change & TTL-Aware Visibility Revalidation (`C4`):**
   - Update `useWorkbenchQuery.ts` so changing `cacheKey` checks `serverStateCache.get(cacheKey)` first: if a fresh entry (`!cached.isStale`) exists, hydrate synchronously with `isFetching = false`; if stale, hydrate immediately and revalidate in background with `isFetching = true`; if absent, set `isFetching = true` while keeping previous `data`.
   - Change the `visibilitychange` listener in `useWorkbenchQuery.ts` from `refetch(true)` to `refetch(false)` so Alt+Tabbing back to the browser respects `serverStateCache` TTL instead of forcing network refetches on fresh cache entries.
5. **Fixed-Height Chrome & Zero Vertical/Horizontal Layout Shift (`C6`, `C8`, `C9`):**
   - Keep `<LocalFindBar>` mounted (with `disabled` search input when `!hasData`) in `MrxCookingWorkbench.tsx` so loading completion does not push the table down by `48px`.
   - Keep the `"Mở việc tiếp theo"` button stable in `ReconciliationDashboardPage.tsx` during background `refreshing` (`!current?.error && data`) so header actions do not shift horizontally on refresh.
   - Give `contextSelectors` in `ReconciliationHeaderBranch.tsx` a consistent `min-h-9 flex items-center` wrapper on the `completed` tab, give footer/toolbar `PaginationBar.tsx` a consistent `min-h-12`, and remove redundant nested `animate-in fade-in` classes on `ReconciliationLinesBranch.tsx` and `ReconciliationHeaderBranch.tsx`.
6. **Route-Level Code Splitting & Vendor Chunking (`C7`):**
   - Lazy-load the 13 protected route pages in `App.tsx` inside `<Suspense>` within `AuthorizedAppShell` so `AppShell` sidebar remains static across route transitions, and configure `manualChunks` in `vite.config.ts` so no application chunk exceeds Vite's `500 kB` threshold.

### Non-Goals & Anti-Goals
- **No Backend Changes:** Zero C# controller, service, or database edits.
- **No Stale Mutation / Export Leakage:** Keeping previous rows visible during a scope transition (`isPreviousData = true`) must **never** enable mutation or export buttons for the new scope until the new scope's response has resolved (`!isPreviousData && !isFetching`) and never display a foreign batch's cooking sheet on `/chef?view=mrx-cooking` (preserving the safety invariant tested in `Chef.test.tsx:L337`).
- **No Ad-Hoc CSS Tokens:** Use only existing Tailwind classes and tokens from `frontend/src/styles/index.css`.

---

## 3. Detailed Technical Design (`C1–C9`)

### 3.1 `C4`: `useWorkbenchQuery` Cache-Aware Key Transitions & Visibility Revalidation
- **Owner:** [`frontend/src/hooks/useWorkbenchQuery.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/hooks/useWorkbenchQuery.ts#L180-L226)
- **Design:**
  - In `useEffect` (`lines 180-217`), when `isScopeProvided && enabled`:
    1. Check `const cachedEntry = serverStateCache.get<unknown>(cacheKey);`.
    2. If `cachedEntry` exists:
       - Extract `payload = resolveCachePayload<TData>(cachedEntry.data)` and `blocked = hasCompatibilityFlag(cachedEntry.data) && Boolean(cachedEntry.data.isCompatibilityBlocked)`.
       - Immediately update state (`setDataState(payload)`, `setError(blocked ? new Error('LEGACY_DAILY_LINEAGE_MISSING') : null)`, `setHasLoadedOnce(true)`, `setResolvedCacheKey(cacheKey)`).
       - If `!cachedEntry.isStale`, set `setIsFetching(false)` and return early without firing a network request!
    3. Before invoking `queryFnRef.current(undefined, controller.signal)`, call `setIsFetching(true)`.
  - In the `visibilitychange` effect (`lines 219-226`), call `void refetch(false)` instead of `void refetch(true)` so fresh cache entries (`!isStale`) do not trigger redundant network traffic on every Alt+Tab.

### 3.2 `C1` & `C2`: `MrxQuantityInspectionPage` & `useMrxQuantityInspection` Zero-Blank Paging & Debounced Search
- **Owners:**
  - [`frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts#L49-L58)
  - [`frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx#L71-L129)
- **Design:**
  - In `useMrxQuantityInspection.ts`:
    - Change `result` derivation (`line 49`) from `!inspection.stateProps.isPreviousData && inspection.data?.view === view && inspection.data.data.menuVersionId === menuVersionId ? inspection.data : null` to:
      ```ts
      const result = inspection.data?.view === view
        && inspection.data.data.menuVersionId === menuVersionId
        ? inspection.data
        : null;
      ```
    - In `stateProps` (`line 57`), pass `isPreviousData: Boolean(result && inspection.stateProps.isPreviousData)` so `StateBoundary` dims the existing table (`opacity-70`, `progressbar`) while keeping `result` and `PaginationBar` mounted during page/search transitions!
  - In `MrxQuantityInspectionPage.tsx`:
    - Add local state `const [searchInput, setSearchInput] = useState(searchKeyword);` synced when `searchKeyword` changes externally (e.g., browser Back/Forward).
    - Debounce `searchInput -> searchParams ('q')` by `250ms` using `setTimeout` and `{ replace: true }`.
    - Change `<div key={...}>` at `line 122` from `key={`${result.view}:${result.data.contentFingerprint}:${pageNumber}:${searchKeyword}`}` to `key={`${result.view}:${result.data.menuVersionId}`}` so paging or searching does not unmount `MaterialsTable` / `PlansTable` or lose the selected master row if it remains in the page.

### 3.3 `C3` & `C5`: Smooth Scope Transitions & Customer-Switch Guard on `/reconciliation` and `/weekly-menu?view=mrx-batch`
- **Owners:**
  - [`frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts#L84-L356)
  - [`frontend/src/features/reconciliation/ReconciliationPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/features/reconciliation/ReconciliationPage.tsx#L266-L318)
- **Design:**
  - In `useReconciliationWorkspace.ts`:
    - When `handleSelectCustomer(nextCode)` is called (`lines 299-317`):
      - Set `setHasBatchesLoaded(false)` and `setIsLoading(true)` (if `!storedData`) or `setIsFetching(true)` so `isBootstrapping` remains `true` until the new customer's `getBatchPage` resolves. This completely eliminates the premature Empty State flash (`"Chưa có lô đối soát..."`) during customer switching!
    - When `handleSelectDate(date)` is called (`lines 339-356`) within the same week (`currentWeek === nextWeek`):
      - Check `serverStateCache.get<ReconciliationBatchSummary>(\`mrx_recon_\${batchId}_\${date}\`)?.data`. If cached, hydrate `setData(cached)` and `setLoadedScope(\`mrx_recon_\${batchId}_\${date}\`)` immediately; otherwise keep `storedData` visible as `displayData` with `isPreviousData = true` and `setIsFetching(true)` while `getBatchSummary(batchId, date)` resolves, while keeping `canComplete = false` whenever `loadedScope !== reconCacheKey`.
    - In the `useEffect` that loads `getBatchPage` (`lines 186-205`): when resolving `initialDate` or selecting `sortedItems[0]`, align `serviceDate` to `selectedBatch.weekStartDate` before `getBatchSummary` fires so `getBatchSummary` does not fire twice back-to-back on initial mount.

### 3.4 `C6`, `C8`, & `C9`: Fixed-Height Chrome, Stable Pagination Footer, & Single-Layer Fade
- **Owners:**
  - [`frontend/src/components/workbench/LocalFindBar.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/components/workbench/LocalFindBar.tsx#L6-L36)
  - [`frontend/src/features/chef/MrxCookingWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/features/chef/MrxCookingWorkbench.tsx#L225-L231)
  - [`frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/features/dashboard/ReconciliationDashboardPage.tsx#L157-L194)
  - [`frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx#L77-L119)
  - [`frontend/src/features/reconciliation/branches/ReconciliationLinesBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/features/reconciliation/branches/ReconciliationLinesBranch.tsx#L81)
  - [`frontend/src/components/workbench/PaginationBar.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/components/workbench/PaginationBar.tsx#L26-L28)
- **Design:**
  - `LocalFindBar.tsx` & `MrxCookingWorkbench.tsx`: Add optional `disabled?: boolean` prop to `LocalFindBar`. In `MrxCookingWorkbench.tsx`, render `<LocalFindBar disabled={!hasData} ...>` unconditionally whenever `!isLegacyLineageMissing && !displayedError` so the `48px` find bar does not pop in/out during batch switches.
  - `ReconciliationDashboardPage.tsx`: Keep `nextAction` visible during manual/background refresh as long as `!current?.error && data` (instead of `!refreshing && !current?.error && current?.data`), and disable the button while `refreshing` is true so the header button row never shifts horizontally when clicking **Làm mới** while still preventing stale navigation on error.
  - `ReconciliationHeaderBranch.tsx`: Wrap the `activeReportTab === 'completed'` context label in `<div className="min-h-9 flex items-center">` so Zone 1 header height stays uniform across all 5 reconciliation tabs, and remove `animate-in fade-in duration-150` from the status badge inside the reserved slot.
  - `ReconciliationLinesBranch.tsx`: Remove redundant `animate-in fade-in duration-150 ease-out` from the inner branch container (`StateBoundary` already owns transition styling).
  - `PaginationBar.tsx`: Add `min-h-12` to non-selector `<nav>` so single-page and multi-page states share the exact same footer height (`48px`).

### 3.5 `C7`: Route-Level Code Splitting (`React.lazy` + `Suspense`) & Rollup `manualChunks`
- **Owners:**
  - [`frontend/src/App.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/App.tsx#L1-L168)
  - [`frontend/vite.config.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/vite.config.ts#L9-L12)
- **Design:**
  - Convert protected route page imports in `App.tsx` (`DashboardPage`, `ReconciliationDashboardPage`, `WeeklyMenuPage`, `MealOrdersPage`, `ChefDashboardPage`, `PurchasingPage`, `WarehousePage`, `ApprovalPage`, `ReconciliationPage`, `ReportsPage`, `AdminDataPage`, `ApprovalRulesPage`, `AdvancedSettingsPage`) to `lazy(() => import(...).then(m => ({ default: m.PageName })))`.
  - Wrap the `<Outlet />` / route elements inside `<Suspense fallback={<div className="flex-1 min-h-0 w-full bg-white" aria-busy="true" />}>` so `AppShell` (sidebar, header chrome) never unmounts during lazy chunk loading.
  - Configure `build.rollupOptions.output.manualChunks` in `vite.config.ts` to split `vendor-react` (`react`, `react-dom`, `react-router-dom`) and `vendor-icons` (`lucide-react`), bringing every production JS chunk well below `500 kB`.

---

## 4. Acceptance Criteria Matrix (`AC-C1` to `AC-C9`)

| ID | Finding | Acceptance Criterion | Verification Owner |
|---|---|---|---|
| `AC-C1` | `C1` | Paging or searching on `/weekly-menu?view=mrx-materials` and `view=mrx-plans` keeps current rows and `PaginationBar` mounted with `isPreviousData` overlay instead of blanking `result` to `null` or remounting the table. | `WeeklyMenu.test.tsx` |
| `AC-C2` | `C2` | Typing into the search input on `MrxQuantityInspectionPage` updates the input value immediately (preserving Vietnamese IME composition) and debounces URL `searchParams` (`replace: true`) + API requests by `250ms`. | `WeeklyMenu.test.tsx` |
| `AC-C3` | `C3` | Switching `serviceDate` on `/reconciliation` keeps existing lines visible with `isPreviousData` progress overlay (or hydrates 0ms from `serverStateCache`) instead of blanking to an empty `<div />` or skeleton, while disabling `canComplete` until the active date resolves. | `Reconciliation.test.tsx` |
| `AC-C4` | `C4` | Changing `cacheKey` in `useWorkbenchQuery` synchronously hydrates fresh entries from `serverStateCache` without network calls, sets `isFetching = true` when fetching uncached keys, and `visibilitychange` calls `refetch(false)` (respecting cache TTL). | `useWorkbenchQuery.test.ts` |
| `AC-C5` | `C5` | Switching customer in `useReconciliationWorkspace.handleSelectCustomer` sets `hasBatchesLoaded = false` and enters loading/fetching state without flashing `"Chưa có lô đối soát..."` while `getBatchPage` is pending. | `Reconciliation.test.tsx` |
| `AC-C6` | `C6` | `MrxCookingWorkbench` keeps `LocalFindBar` mounted (disabled while loading) when switching batches; `ReconciliationDashboardPage` keeps `"Mở việc tiếp theo"` mounted (disabled) during manual refresh; `ReconciliationHeaderBranch` keeps `min-h-9` on `completed` tab. | `Chef.test.tsx`, `MrxDashboard.test.tsx`, `ZeroJitterHeaderGeometry.test.tsx` |
| `AC-C7` | `C7` | `App.tsx` lazy-loads route pages with `<Suspense>` and `vite.config.ts` splits vendor chunks so `npm run build:fe` produces multiple route chunks with zero chunks > `500 kB`. | `npm run build:fe` |
| `AC-C8` | `C8` | Footer/toolbar `PaginationBar` maintains `min-h-12` across single-page and multi-page states. | `Primitives.test.tsx` |
| `AC-C9` | `C9` | Redundant nested `animate-in fade-in` classes are removed from `ReconciliationLinesBranch` and `ReconciliationHeaderBranch` badge slot. | `ZeroJitterHeaderGeometry.test.tsx`, `Reconciliation.test.tsx` |
