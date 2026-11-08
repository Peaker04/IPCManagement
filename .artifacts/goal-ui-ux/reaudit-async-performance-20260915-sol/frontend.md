# Subagent run 137d4cc5-2fba-42d1-a8e9-de190cb4eef6

- **Mode:** single
- **CWD:** D:\Kì 7\PRN222 Doanh Nghiệp\IPCManagement
- **Started:** 2026-09-15T10:10:01.235Z
- **Ended:** 2026-09-15T10:17:31.029Z
- **Duration:** 7m29s
- **Session:** C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\2026-09-15T04-53-45-769Z_01a0a369-f6a8-7370-ba7d-0f6a77ac3ec8\d9e6d296-094f-4ef5-8db2-065d04769573\run-0\session.jsonl
- **Artifacts:** C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\subagent-artifacts

## Steps
| Step | Agent | Status | Duration |
| --- | --- | --- | --- |
| 1 | scout | complete | 7m29s |

## Summary
scout:
# Code Context

## Re-audit envelope

Read-only source/test re-audit of the **current dirty worktree** against `C:/Users/Administrator/Downloads/AGENT_REAUDIT_AND_REMEDIATE.md`, limited to H1-H5, H8-H12, H17-H18. No application runtime, browser, React Profiler, network trace, CLS measurement, build, lint, or test execution was performed. Existing tests were inspected as source only; no PASS claim below means that those tests were run in this lane.

Project authority applied in this order: `AGENTS.md` / `MEMORY.md` safety and evidence constraints; `docs/DESIGN.md` geometry/state ownership; `docs/DASHBOARD-UI-RULES.md`; `docs/FRONT-END-CHECKLIST-INTEGRATION.md`; then the external re-audit brief.

## Denominator / inventory method

A production-source inventory excluded files whose names contain `.test.` or `.spec.` and scanned `frontend/src/**/*.{ts,tsx}`. Regex/literal counts were then manually checked at the shared owners and representative operational routes.

| Inventory cell | Denominator / observed count | Method and limitation |
|---|---:|---|
| Production TS/TSX files | 361 | Files under `frontend/src`; excludes filename-marked tests/specs, not generated contract files. |
| Configured route paths | 13 + wildcard redirect | Manual count in `frontend/src/routes/AppRouter.tsx` lines 68-91. Route wrappers are not counted as user destinations. |
| Query-hook callsites | 114 in 47 files | Regex `use(Get|LazyGet)*Query(` over production TS/TSX. Custom non-RTK hooks can own additional queries. |
| Shared async boundary callsites | 35 | 13 `QueryViewBoundary`, 9 `AdminQueryBoundary`, 11 `ReportQueryBoundary`, 2 `ChefQueryBoundary`. Counts include JSX occurrences, then owners were manually read. |
| Dialog / drawer callsites | 32 / 2 | Literal JSX occurrence count. A closed component may still be conditionally omitted by its caller; count is inventory, not concurrent-mount evidence. |
| Empty-state callsites | 39 `EmptyState`; 0 `TableEmptyState` | Literal production JSX count. Raw `<tr><td>` empty rows are separate and not included. |
| Table skeleton callsites | 8 | Literal `<TableSkeleton`; route/local handwritten skeletons are additional. |
| Pagination callsites | 40 `PaginationBar`; 4 `CursorPaginationBar` | Literal JSX count. |
| Index-bearing key candidates | 14 simple matches in 13 files, plus 6 report-row compound keys manually found | Automated scan for `key={index|idx|i}` and index-bearing template keys; skeleton/static-copy cases were dispositioned separately from data rows. |

The async denominator is therefore **114 query-hook callsites**, with detailed seam review of all four shared query-boundary implementations and representative consumers in Reports, Weekly Menu, Coordination, Purchasing, Warehouse, Chef, Admin, Dashboard, and Reconciliation. This is a source coverage statement, not runtime coverage.

## Files Retrieved

1. `C:/Users/Administrator/Downloads/AGENT_REAUDIT_AND_REMEDIATE.md` (lines 108-290, 351-504, 629-695, 763-797, 947-1018) - hypotheses, finding schema, and prohibition on invented performance claims.
2. `docs/DESIGN.md` (lines 1-113) - one-state/one-surface, geometry-role, async boundary, empty-state, table, dialog, and drawer ownership contracts.
3. `docs/DASHBOARD-UI-RULES.md` (lines 1-240) - authority, evidence requirements, table/list rules, and modal rules including the no-stacked-modal requirement.
4. `docs/FRONT-END-CHECKLIST-INTEGRATION.md` (lines 1-96) - conservative source-supported review and runtime-evidence boundary.
5. `frontend/src/lib/queryView.ts` (lines 1-73) - canonical semantic query state conversion.
6. `frontend/src/components/common/QueryViewBoundary.tsx` (lines 1-135) - shared geometry, blocking-state, refresh, truncation, and fallback behavior.
7. `frontend/src/components/common/QueryViewBoundary.test.tsx` (lines 1-105) - current semantic-state and refresh assertions.
8. `frontend/src/components/common/RefreshStatus.tsx` (lines 1-17) - refresh indicator is explicitly mounted in normal document flow.
9. `frontend/src/features/reports/pages/ReportQueryBoundary.tsx` (lines 1-48) - report initial/error replacement and ready-refresh handling.
10. `frontend/src/app/pages/admin-data/AdminQueryBoundary.tsx` (lines 1-96) - grouped Admin query behavior and inline refresh status.
11. `frontend/src/features/chef/ChefQueryBoundary.tsx` (lines 1-130) - grouped Chef behavior, inline notices, and fixed `32rem` initial reservation.
12. `frontend/src/features/chef/ChefQueryBoundary.test.tsx` (lines 1-136) - tests intentionally lock in-flow refresh and fixed initial geometry.
13. `frontend/src/components/common/EmptyState.tsx` (lines 1-78) and `EmptyState.test.tsx` (lines 1-63) - domain variants and compact `min-h-0` contract.
14. `frontend/src/components/common/TableEmptyState.tsx` (lines 1-42) - separate table-only empty surface with a `220px` table footprint; currently no production JSX consumer.
15. `frontend/src/features/reports/pages/ReportsPage.tsx` (lines 83-173, 274-359, 382-494) - report boundaries wrap whole sections; five data tables use index-bearing keys.
16. `frontend/src/features/reports/pages/ReportsPricePanel.tsx` (lines 145-169) - price rows include both page and index in keys.
17. `frontend/src/features/reports/pages/ReportsPage.model-ownership.test.ts` (lines 1-69) - existing source contract verifies hidden-query skips but not render/DOM continuity.
18. `frontend/src/features/projects/pages/WeeklyMenuPage.tsx` (lines 1-320, 320-609) - route scope, multiple base queries, many workflow hooks, derived models, alerts, modal state, and selected-view orchestration in one page owner.
19. `frontend/src/app/operationalPagePerformanceContracts.test.ts` (lines 1-126) - existing source-level hidden-query and server-search contracts.
20. `frontend/src/features/coordination/pages/CoordinationPage.tsx` (lines 1-126) - grouped parallel query boundary and fallback preservation example.
21. `frontend/src/features/purchasing/pages/PurchasingPage.tsx` (lines 1-344) - view-scoped query skip, retained ready data, and conditional drawer composition.
22. `frontend/src/components/ui/dialog.tsx` (lines 1-458) and `dialog.contract.test.tsx` (lines 1-139) - focus, inert, scroll lock, close reasons, return focus, and intentionally supported nested modal stack.
23. `frontend/src/components/ui/drawer.tsx` (lines 1-128) - non-modal master-detail drawer semantics and focus-return behavior.
24. `frontend/src/components/common/PaginationBar.tsx` (lines 1-169) - pending-state retention, focus restoration, and scroll-anchor preservation.
25. `frontend/src/routes/AppRouter.tsx` (lines 1-93) - route denominator and route-level fallback geometry.

## Key Code

### Canonical semantic state is already present

```ts
// frontend/src/lib/queryView.ts
const data = query.currentData !== undefined ? query.currentData : query.data;
if (data !== undefined) {
  return { phase: 'ready', data, isRefreshing: query.isFetching, truncation: ... };
}
```

This correctly distinguishes initial loading from a refetch with retained data. It is an existing abstraction and should remain the state owner.

### Shared refresh feedback changes normal-flow height

```tsx
// frontend/src/components/common/QueryViewBoundary.tsx
{isRefreshing && <RefreshStatus>{refreshLabel}</RefreshStatus>}
{children}
```

```tsx
// frontend/src/components/common/RefreshStatus.tsx
/** Non-blocking query refresh feedback that remains in document flow. */
<div className="ipc-refresh-status-slot">...</div>
```

The content remains mounted, but the boundary gains/removes a flow child above it whenever background fetching toggles.

### Reports replace the complete work section during initial/error states

```tsx
// frontend/src/features/reports/pages/ReportsPage.tsx
<ReportQueryBoundary view={reportViews.demand}>
  <SectionPanel title="Nhu cầu theo ngày trong khoảng chọn">
    <SearchField ... />
    <TableViewport ...><table>...</table></TableViewport>
    <PaginationBar ... />
  </SectionPanel>
</ReportQueryBoundary>
```

```tsx
// frontend/src/features/reports/pages/ReportQueryBoundary.tsx
if (view.phase === 'loading') return <TableSkeleton columns={6} rows={8} ... />;
if (view.phase === 'error') return <QueryErrorAlert ... />;
```

This removes the section heading, search/filter, actual column definitions, and pagination shell during initial loading/error.

### Fixed reservations do not encode the actual child geometry

```ts
// frontend/src/components/common/QueryViewBoundary.tsx
const geometryMinHeight = {
  compact: 'min-h-0',
  section: 'min-h-[180px]',
  table: 'min-h-[380px]',
  workspace: 'min-h-[380px]',
};
```

```tsx
// frontend/src/features/chef/ChefQueryBoundary.tsx
className={cn('relative flex flex-col gap-3', isInitialLoad && 'min-h-[32rem]')}
```

The reservation disappears when ready and is not tied to the mounted table row count, toolbar, or accepted content geometry.

### Data row identity is coupled to order/page

```tsx
// frontend/src/features/reports/pages/ReportsPage.tsx
<tr key={`${row.id}-${index}`}>
```

This pattern occurs in five Reports tables. Price lines additionally use:

```tsx
<tr key={`${item.id}-${pricePage}-${index}`}>
```

Even when a business row remains present, sorting/filtering/page changes can change its key and force remount rather than reconciliation by stable grain identity.

### Nested modal support is intentional in the shared primitive

```ts
// frontend/src/components/ui/dialog.tsx
let activeDialogs: DialogEntry[] = [];
const overlayZ = 1000 + (stackDepth - 1) * 20;
```

`dialog.contract.test.tsx` explicitly opens “Modal Lớp 2” over “Modal Lớp 1” and asserts both depths. This conflicts with `DASHBOARD-UI-RULES.md` M1.2, although this source audit did not establish a production flow that opens two workflow dialogs concurrently.

## Hypothesis disposition

| Hypothesis | Result | Source evidence / disposition |
|---|---|---|
| H1 — async semantic states / stable footprint | **CONFIRMED** | Semantic states exist, but `QueryViewBoundary`, Admin, Report, and Chef boundaries conditionally insert refresh/notices in flow; generic fixed reservations are not content-shaped. Source proves footprint changes, not measured CLS magnitude. |
| H2 — initial loading vs background refresh | **PARTIAL** | `toQueryView` correctly returns ready + `isRefreshing` when `currentData/data` exists, and boundaries generally retain children. Presentation still adds/removes an in-flow status; Reports initial/error states replace the complete section shell. |
| H3 — independently resolving multi-query insertion/layout | **PARTIAL** | Grouped boundaries prevent some false-empty/progressive insertion (Coordination, Weekly Menu, Admin, Chef), but grouped ready/error policy is inconsistent and notices can still appear above retained content. No request timing trace was collected. |
| H4 — page orchestration ownership | **PARTIAL** | Reports has split view-model hooks and hidden-query skips. Weekly Menu still owns route state, six base query views, several workflows, derived data, readiness, alerts, navigation, publishing and two dialogs in one route component. This is a source architecture concern, not measured slowness. |
| H5 — page render blast radius | **NEEDS_RUNTIME** | Weekly Menu and other route parents structurally receive broad state changes, but React commit cost and affected subtree renders require Profiler evidence. Existing tests verify source ownership/skips, not render counts or commit duration. |
| H8 — alert/warning/banner insertion | **CONFIRMED** | Refresh, truncation, fallback-error, and several domain notices are conditionally inserted before ready content. `RefreshStatus` explicitly remains in flow; `QueryViewBoundary` supports overlay only for preserved errors, not refresh/truncation. |
| H9 — one oversized EmptyState used everywhere | **NOT_FOUND** | Shared `EmptyState` is `min-h-0`, has distinct business/error/forbidden semantics, and tests reject a generic `min-h-[200px]`. A separate table-only `TableEmptyState` owns `220px` but currently has zero production JSX callsites. |
| H10 — table/data-grid async contract | **CONFIRMED** | Reports’ domain boundary wraps and replaces the entire `SectionPanel`; initial loading does not preserve the real toolbar/header/columns/pagination shell. Other tables use local row skeletons, so the contract is inconsistent rather than universally absent. |
| H11 — unnecessary rerender | **NEEDS_RUNTIME** | No React Profiler/commit evidence exists in this lane. Source shows potential broad parents but does not justify blanket memoization. Existing source tests cannot certify rerender cost. |
| H12 — frontend list rendering / keys | **CONFIRMED** | Five Reports tables key data rows with `row.id + index`; price lines add page + index. Stable business-grain keys should not depend on position/page. Index keys limited to fixed skeleton/static option lists were not treated as defects. Dataset size/virtualization remains `NEEDS_RUNTIME`. |
| H17 — modal/drawer/overlay contract | **PARTIAL** | Shared Dialog satisfies escape, backdrop, close veto, focus trap, inert background, return focus, scroll lock and sizing tests; Drawer intentionally remains non-modal. Shared Dialog intentionally supports stacked modals contrary to project M1.2. Actual production concurrency is not established. |
| H18 — visual stability / CLS | **NEEDS_RUNTIME** | Source-confirmed risk seams exist (in-flow refresh/notices, shell replacement, fixed reservation removal), but CLS/layout-shift/scrollbar claims require headed browser measurement and are not made here. |

## Concrete findings

### F-01 — Async refresh and warning feedback changes the ready-content footprint

**[Severity]** P1
**[Area]** Frontend / Cross-cutting
**[Hypotheses]** H1, H2, H3, H8, H18
**[Evidence]**
- `frontend/src/components/common/RefreshStatus.tsx` lines 8-16 declares the indicator remains in document flow.
- `frontend/src/components/common/QueryViewBoundary.tsx` lines 98-129 conditionally inserts fallback errors, refresh status, and truncation alerts before children.
- `frontend/src/app/pages/admin-data/AdminQueryBoundary.tsx` lines 84-94 inserts `RefreshStatus` above children.
- `frontend/src/features/reports/pages/ReportQueryBoundary.tsx` lines 40-46 inserts `RefreshStatus` above children.
- `frontend/src/features/chef/ChefQueryBoundary.tsx` lines 100-118 inserts refresh and query notices above children.
- `QueryViewBoundary.test.tsx` lines 77-84 and `ChefQueryBoundary.test.tsx` lines 78-88 intentionally assert that the refresh element is not absolute.

**[Problem]** Background refetch retains stale content correctly, but toggling `isRefreshing` adds/removes a visible flow row above it. Truncation and preserved-error notices can do the same. Thus an async state transition changes the boundary height and pushes the work surface.

**[Root cause]** State semantics and feedback geometry are coupled: shared boundaries own both query state and a conditionally mounted, normal-flow notice. The test name calls this “stable,” but the asserted non-absolute flow placement proves insertion/removal rather than a stable footprint.

**[Impact]** Source-confirmed layout movement risk across shared consumers; possible focus/scroll displacement in tables and long workspaces. Magnitude and CLS remain unmeasured.

**[Fix]** Keep `toQueryView` unchanged. At the lowest shared owner, define a compact status slot whose geometry is stable for ready/refresh transitions, or use a non-overlapping contextual overlay where content remains readable. Treat truncation/error separately: persistent decision-relevant warnings belong in a stable section region; rare errors may use the existing overlay option. Do not add a large generic reserved area.

**[Scope]** Shared (`RefreshStatus`, `QueryViewBoundary`) plus parity review for Admin/Report/Chef domain wrappers; 35 boundary callsites are the consumer denominator.

**[Validation]** Component rerender test from ready → refreshing → ready asserting unchanged work-surface `getBoundingClientRect().top` and retained DOM node identity; then headed layout-shift/scroll measurement on representative table, section, and workspace consumers. No such runtime validation was performed here.

---

### F-02 — Reports loading/error replaces the table shell rather than the table state

**[Severity]** P1
**[Area]** Frontend
**[Hypotheses]** H2, H3, H10, H18
**[Evidence]**
- `frontend/src/features/reports/pages/ReportQueryBoundary.tsx` lines 12-38 returns only an alert or generic six-column/eight-row skeleton for forbidden/error/uninitialized/loading.
- `frontend/src/features/reports/pages/ReportsPage.tsx` lines 125-173 shows `ReportQueryBoundary` outside `SectionPanel`, so the section heading, search control, actual 8-column table, and pagination disappear together.
- The same boundary pattern is used 11 times across two Reports production files.
- `ReportsPage.model-ownership.test.ts` lines 24-44 validates query adapters and hidden-view skips, but not preservation of toolbar/header/columns/pagination.

**[Problem]** Initial loading does not retain the real report work-surface structure. Error also replaces the whole section instead of a section/table error state. The generic skeleton column count can differ from the actual table.

**[Root cause]** `ReportQueryBoundary` is placed at the view/section level but implements a table-level fallback without knowing the child table contract.

**[Impact]** Deterministic DOM replacement, likely geometry mismatch, lost table/header context during loading, and a larger rerender/remount boundary than needed. Actual visual shift magnitude is not claimed.

**[Fix]** Preserve each `SectionPanel`, filters/search, semantic table header/column definitions, and pagination shell. Limit the async state boundary to table body/results, using the existing row-skeleton/empty-row patterns with the actual column count. Keep ready rows during background refresh and express pending state through `aria-busy` plus the shared compact refresh seam.

**[Scope]** Reports domain shared boundary and its 11 consumers; no mega endpoint and no global table rewrite.

**[Validation]** Mounted tests for loading → ready, ready → refreshing, empty, and error asserting stable section heading, search input, table headers, pagination owner, focus, and row-container identity. Browser geometry/CLS validation remains required for a visual-stability claim.

---

### F-03 — Generic fixed reservations are not tied to accepted content geometry

**[Severity]** P2
**[Area]** Frontend / Cross-cutting
**[Hypotheses]** H1, H3, H18
**[Evidence]**
- `frontend/src/components/common/QueryViewBoundary.tsx` lines 20-25 hard-code `180px` for section and `380px` for both table/workspace.
- `frontend/src/features/chef/ChefQueryBoundary.tsx` lines 82-104 applies `min-h-[32rem]` only during initial load and absolutely positions the notice.
- `ChefQueryBoundary.test.tsx` lines 90-125 explicitly locks `32rem` while loading and verifies it disappears when ready.
- `docs/DESIGN.md` lines 45-62 requires geometry roles and permits section min-height only when the skeleton size is known; lines 80-90 prohibit meaningless generic whitespace/flex/min-height fill.

**[Problem]** The reservation is a category default, not the geometry of the actual toolbar/header/rows/workspace. It is removed at ready state, so it cannot guarantee equal initial and ready footprints; it can also create excess whitespace for short content.

**[Root cause]** “Layout preserving” was implemented as fixed minimum height rather than a structural fallback owned by the content seam.

**[Impact]** Contract inconsistency and source-level risk of both collapse and excess whitespace. Runtime visual impact is unmeasured.

**[Fix]** Remove blanket numeric geometry from generic boundaries. Keep `compact` content-sized; make table consumers supply real header plus accepted skeleton row count/density; let genuine workspace owners declare their canvas geometry. Retain explicit per-work-object geometry only where the project contract proves a fixed workspace.

**[Scope]** Shared query boundary and Chef domain boundary; review 15 direct consumers of these two owners first rather than changing all 114 query callsites.

**[Validation]** Source/mounted contract that no generic boundary invents workspace height; per-role fixtures compare loading and ready structural owners. Headed measurements are still required before claiming CLS improvement.

---

### F-04 — Weekly Menu remains a broad orchestration/render owner

**[Severity]** P2
**[Area]** Frontend
**[Hypotheses]** H4, H5, H11
**[Evidence]**
- `frontend/src/features/projects/pages/WeeklyMenuPage.tsx` lines 42-320 owns URL state, operation mode, Redux selections, catalog/customers/contracts/menu/schedule/meal-plan queries, publishing mutation, scope normalization, multiple local feedback states, and route preloading.
- Lines 320-487 instantiate import, schedule editor, production plan, material demand, demand-readiness query, cost, purchase-summary, and dish-material workflows and derive several maps/summaries.
- Lines 488-604 compose readiness, navigation, alerts, selected content, and two lazy dialogs from that single owner.
- `operationalPagePerformanceContracts.test.ts` lines 41-63 verifies several hidden-view query skips; it does not measure route-parent or child render counts.

**[Problem]** A scope/view/feedback change re-executes a route component that coordinates nearly every weekly-menu workflow and recreates a large prop graph. Several expensive derivations are memoized, and some subqueries are skipped, so source alone does not prove a performance regression.

**[Root cause]** Domain hooks were extracted, but orchestration/state ownership remains centralized in the route rather than in selected work-view owners.

**[Impact]** Maintainability and potential broad render blast radius. Commit duration, actual child rerenders, and user-visible latency are unknown.

**[Fix]** Do **not** blanket `memo`/`useCallback`. First profile transitions for customer/week, active view, quick serving, feedback, and dialog state. If commits show unrelated subtrees rerendering, move state/query ownership into stable scope shell + selected view owners while reusing existing domain hooks and query skips.

**[Scope]** Weekly Menu page/domain. Reports is a positive partial precedent: its five view models and hidden-query predicates are explicit, though its table boundary still needs F-02.

**[Validation]** React Profiler commit/rerender matrix by state transition, plus mounted behavior tests proving inactive view state and dialogs are retained correctly. **NEEDS_RUNTIME** before treating this as a performance optimization task.

---

### F-05 — Report data-row keys depend on list position/page

**[Severity]** P2
**[Area]** Frontend
**[Hypotheses]** H12, H11
**[Evidence]**
- `frontend/src/features/reports/pages/ReportsPage.tsx` lines 148-150, 281-283, 345-347, 390-392, and 486-488 use `${row.id}-${index}` across demand, stock, kitchen issue, usage, and audit rows.
- `frontend/src/features/reports/pages/ReportsPricePanel.tsx` lines 156-158 uses `${item.id}-${pricePage}-${index}`.
- Other index keys found in fixed skeleton arrays and immutable copy presets were dispositioned as intentional and are not included in this finding.

**[Problem]** Position/page participates in row identity. When sorting/filtering changes a row’s position, React sees a new key and remounts the row even if the business record remains.

**[Root cause]** Index was appended to avoid collisions instead of expressing the backend/domain grain in the key.

**[Impact]** Avoidable row DOM churn and possible loss of row-local focus/expanded/control state. No measured commit cost is claimed.

**[Fix]** Use the exact stable row grain already present in each view model/DTO (for example document/line identity, or the complete aggregate composite including unit/date/scope). If `row.id` is not unique, correct the mapper’s presentation identity rather than appending the current index.

**[Scope]** Reports domain, six data-list render sites. Do not change fixed skeleton keys.

**[Validation]** Mounted reorder/filter tests with stable business rows and a stateful/focused row control, asserting DOM-node identity and focus survive position changes; mapper tests assert key-grain uniqueness for duplicate-name/unit scenarios.

---

### F-06 — Shared Dialog intentionally supports a modal stack prohibited by the project contract

**[Severity]** P2
**[Area]** Frontend / Cross-cutting / Accessibility
**[Hypotheses]** H17
**[Evidence]**
- `frontend/src/components/ui/dialog.tsx` lines 101-155 maintains a global dialog stack, makes lower portals inert, and computes depth.
- Lines 287-299 increase overlay/content z-index for every nested depth.
- `frontend/src/components/ui/dialog.contract.test.tsx` lines 94-139 intentionally opens a second modal above the first and asserts depth/inert/Escape behavior.
- `docs/DASHBOARD-UI-RULES.md` modal rule M1.2 prohibits modal-on-modal and requires one blocking layer.
- Inventory found 32 production Dialog callsites plus a global session-timeout dialog in `AppRouter.tsx` lines 61-64; this audit did not prove two are open simultaneously in a production flow.

**[Problem]** The primitive makes a prohibited interaction a supported/tested contract. Most individual dialog mechanics are strong, but the architecture permits nested blocking layers.

**[Root cause]** Accessibility mechanics for stacking were implemented instead of preventing/coordinating stacking at the application level.

**[Impact]** Contract divergence and potential cognitive/focus complexity. Actual concurrent production use is **NEEDS_RUNTIME** / integration-flow evidence.

**[Fix]** Inventory legitimate overlap scenarios first, especially session timeout over a dirty workflow. Introduce one blocking-dialog policy at the existing shared/app-shell owner: queue, replace, or suspend the lower dialog according to data-safety requirements. Do not simply delete stack handling until global/session and unsaved-form recovery are dispositioned.

**[Scope]** Shared Dialog plus app-shell/session integration; production feature dialogs only where overlap is possible. Drawer remains separate and correctly non-modal by project design.

**[Validation]** Integration tests for global-session warning during an open clean dialog and dirty form, asserting one interactive blocking surface, correct close veto/recovery, focus return, body scroll restoration, and no data loss. Browser keyboard validation required for final accessibility acceptance.

## Existing abstractions and tests that should be reused

- `toQueryView` / `toLabeledQueryView`: correct semantic state owner; do not create another `AsyncState` abstraction.
- `QueryViewBoundary`, `AdminQueryBoundary`, `ReportQueryBoundary`, `ChefQueryBoundary`: consolidate rather than adding a fifth boundary. Their geometry/notice policies need convergence, not parallel components.
- `SkeletonTableRow`, `TableSkeleton`, `TableViewport`, `PaginationBar`: existing seams for structural loading and stable pagination/focus behavior.
- `EmptyState`: compact, semantically distinct business/error/forbidden states; H9 does not justify new page/section variants without a concrete footprint failure.
- `Dialog` / `Drawer`: shared ownership is correct. Dialog tests already cover escape, backdrop, veto, focus trap, inert, focus return and scroll lock; remediation should preserve these.
- `operationalPagePerformanceContracts.test.ts` and `ReportsPage.model-ownership.test.ts`: useful source ownership gates, but insufficient as render-performance or visual-stability evidence.

## Architecture

RTK Query results are normalized by `toQueryView` into `uninitialized | loading | forbidden | error | ready`, with background refetch represented as `ready.isRefreshing`. Four presentation boundaries then diverge in geometry and notice policy. Route pages compose these boundaries around domain sections/tables. Reports places its boundary outside whole sections; Weekly Menu groups six base query views at the page shell while also orchestrating view-specific workflows; Coordination is a smaller grouped-query example; Purchasing scopes the main workbench query to the selected view.

Tables do not have one universal data-grid owner: `TableViewport`, raw semantic `<table>`, local empty rows, `TableSkeleton`/`SkeletonTableRow`, and pagination are composed per domain. Therefore the lowest safe table fix for F-02 is Reports’ boundary/composition seam, not a new global grid.

Dialogs and drawers are centralized. Dialog is modal, portal-based, focus-trapping, inerting and scroll-locking; Drawer is a non-modal master-detail surface with `aria-modal="false"`, no background inert/lock, and conditional focus return. The main contract gap is not missing mechanics but the intentionally supported dialog stack.

## Intentional / not changed / evidence limits

- H9 is **NOT_FOUND**: no remediation is justified for `EmptyState` footprint from current source.
- Pagination already retains controls, disables them while pending, restores requested focus, and preserves scroll anchor (`PaginationBar.tsx` lines 35-68, 82-166); no separate H10 pagination defect was confirmed.
- Fixed index keys for skeleton rows or static immutable option/preset lists are intentional and were excluded from F-05.
- No virtualization recommendation: dataset/DOM bottleneck evidence is absent.
- No blanket memoization recommendation: H11 remains **NEEDS_RUNTIME**.
- No CLS, commit-time, request-count, render-count, payload, or before/after number is claimed.
- No files were edited except this required audit artifact.

## Start Here

Open `frontend/src/components/common/QueryViewBoundary.tsx` first. It is the lowest shared seam connecting H1/H2/H3/H8/H18, and its current in-flow refresh/truncation policy plus generic geometry is copied or reimplemented by the Admin, Reports, and Chef boundaries. Before any implementation, pair it with `frontend/src/features/reports/pages/ReportQueryBoundary.tsx` to avoid “fixing” refresh while leaving the larger Reports shell-replacement contract unchanged.

Output saved to: C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\subagent-artifacts\outputs\d8af2668-f032-4d08-8902-f1e13f88d7db\.artifacts\goal-ui-ux\reaudit-async-performance-20260915-sol\frontend.md (29.7 KB, 348 lines). Read this file if needed.
