# Subagent run c2eb2dd1-c8c8-4fb4-96cf-5617140f5e1d

- **Mode:** single
- **CWD:** D:\Kì 7\PRN222 Doanh Nghiệp\IPCManagement
- **Started:** 2026-09-15T10:10:01.234Z
- **Ended:** 2026-09-15T10:15:32.376Z
- **Duration:** 5m31s
- **Session:** C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\2026-09-15T04-53-45-769Z_01a0a369-f6a8-7370-ba7d-0f6a77ac3ec8\35cb13d7-a742-4665-8a80-61254ff40d0d\run-0\session.jsonl
- **Artifacts:** C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\subagent-artifacts

## Steps
| Step | Agent | Status | Duration |
| --- | --- | --- | --- |
| 1 | scout | complete | 5m31s |

## Summary
scout:
# Code Context

## Re-audit scope and verdicts

Read-only re-audit of H6–H7 from `C:/Users/Administrator/Downloads/AGENT_REAUDIT_AND_REMEDIATE.md`: RTK Query tags/invalidation, duplicate requests, conditional waterfalls, preload strategy, and query ownership. No runtime was started and no production/test source was edited.

| Hypothesis | Result | Severity | Evidence class |
|---|---|---:|---|
| Broad RTK Query invalidation | **Confirmed, scoped** | **P1 / High** | Static source; request-count runtime still needed |
| Duplicate identical requests | **Not found in the audited shared path** | — | Static + focused unit-test evidence |
| Unnecessary conditional request waterfall | **Not found; known chains are data/security dependent** | — | Static; network timing needed for exhaustive confirmation |
| Route preload causes excessive speculative reads | **Partial / risk confirmed, user impact unmeasured** | **P2 / Medium** | Static; runtime data-volume/request ledger needed |
| Query ownership causes unnecessary reads | **Confirmed on Warehouse demand view** | **P1 / Medium-High** | Static; runtime payload/time needed |

## Files Retrieved

1. `frontend/src/api/apiSlice.ts` (lines 1-84, 248-265) - one shared RTK Query slice, global cache lifetime, tag registry, mutation request coalescing, and auth retry behavior.
2. `frontend/src/api/workflowCacheTags.ts` (lines 1-78) - granular workflow tag registry and aggregate/audit source-tag relationships.
3. `frontend/src/api/coordinationApi.ts` (lines 140-326, 365-460) - broad plain `Coordination` tag shared by unrelated query families and invalidated by many mutations.
4. `frontend/src/features/projects/pages/WeeklyMenuPage.tsx` (lines 70-175, 264-292) - four concurrently active `Coordination` consumers on the weekly-menu shell and sequential idle tab-code preload.
5. `frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts` (lines 65-164) - parallel demand/document/staleness/aggregate reads and a genuinely dependent approval-history query.
6. `frontend/src/api/reportsApi.ts` (lines 200-330, 570-597) - `useWorkflowOverview` always owns four report queries and only exposes coarse skip/skipPrice controls.
7. `frontend/src/api/workflowOverviewModel.ts` (lines 12-66) - proves Warehouse inbox items can only come from workflow documents; demand items belong to planning and price items belong to purchasing.
8. `frontend/src/features/warehouse/pages/WarehousePage.tsx` (lines 90-210) - Warehouse demand view invokes the four-query workflow overview but consumes only `roleInboxItems.filter(laneId === 'warehouse')`.
9. `frontend/src/routes/routeDataPreloaders.ts` (lines 1-104) - route-intent read sets, five-minute age policy, mode-specific bounds, and routes intentionally not prefetched.
10. `frontend/src/routes/routeLoaders.ts` (lines 1-86) - route module preload and best-effort route-data preload boundaries.
11. `frontend/src/app/layout/MainLayout.tsx` (lines 38-58, 188-195) - pointer, focus, and touch all trigger both code and data preloads.
12. `frontend/src/routes/routeDataPreloaders.test.ts` (lines 14-97) - repeated pointer/focus/touch prefetches coalesce and speculative report/MRX reads are bounded.
13. `frontend/src/api/apiSlice.requestDeduplication.test.ts` (lines 65-120) - exact query-key subscribers and concurrent identical mutations issue one request.
14. `frontend/src/api/workflowApi.cacheInvalidation.test.ts` (lines 1-129) - focused evidence that granular workflow tags reduced one remediation mutation from the documented 10-query baseline to two semantically related refetches.
15. `frontend/src/api/workflowApi.cacheContract.test.ts` (lines 1-81) - locks the granular workflow tag/source registry.
16. `frontend/src/features/purchasing/purchasingModel.test.ts` (lines 350-450) - scoped workbench invalidation refetches only the touched week.
17. `frontend/src/components/reconciliation/ReconciliationIssueDetailDialog.tsx` (lines 25-40) - issue detail must resolve and verify its batch ID before the batch query.
18. `frontend/src/features/reconciliation/pages/ReconciliationPage.tsx` (lines 55-99) - list-to-selected-detail chain is required for filter/default-selection correctness.
19. `frontend/src/features/warehouse/pages/ReconciliationWarehousePage.tsx` (lines 195-305) - batch list determines valid selected batch; detail/history/dishes then load by that validated ID.
20. `frontend/src/features/coordination/components/dish-detail-dialog.tsx` (lines 25-51) - lazy metadata request happens only when the already-returned order lacks dish-role metadata.
21. `frontend/src/routes/AppRouter.tsx` (lines 1-91) - routes unmount normally; no route KeepAlive subscription owner was found, so invalidation network fanout is principally the currently mounted route.

## Key Code

### Finding DF-01 — `Coordination` is still a domain-wide invalidation tag

**Classification:** Confirmed H6 defect/risk. **Severity: P1 / High.**

The same plain tag is attached to unrelated resources:

```ts
getCustomerContracts ... providesTags: ['Customers', 'Coordination']
getCommittedWeeklyMenu ... providesTags: ['Coordination']
getReconciliationWeeklyMenu ... providesTags: ['Coordination']
getMenuSchedules ... providesTags: ['Coordination']
getMealQuantityPlans ... providesTags: ['Coordination']
getCoordinationOrders ... providesTags: ['Coordination']
getMenuAmendments ... providesTags: ['Coordination']
getMenuAmendmentDecisionPage ... providesTags: ['Coordination']
getWeeklyMenuImportHistory ... providesTags: ['Coordination']
getProductionPlans ... providesTags: ['Coordination']
```

Evidence: `frontend/src/api/coordinationApi.ts:146-185`, `:235-262`, `:417-455`.

Many narrow mutations invalidate that entire tag. Examples include a forecast edit, a weekly-menu edit, an amendment review, and import rollback (`frontend/src/api/coordinationApi.ts:286-292`, `:405-420`, `:443-448`). A particularly concrete trace is:

```text
upsertQuickServings
  -> invalidates 'Coordination' plus workflow source tags
  -> weekly-menu mounted Coordination subscribers refetch:
     getCustomerContracts
     getCommittedWeeklyMenu OR getReconciliationWeeklyMenu
     getMenuSchedules
     getMealQuantityPlans
```

Mutation evidence: `frontend/src/api/coordinationApi.ts:294-311`. Consumer evidence: `frontend/src/features/projects/pages/WeeklyMenuPage.tsx:70-154`.

**Root cause:** the older `Coordination` tag models a whole bounded context rather than resource identity, query scope, or aggregate dependency. Granular workflow tags were introduced elsewhere, but coordination endpoints have not converged to that contract.

**Impact/scope:** active-subscriber request fanout on Weekly Menu and Coordination surfaces; cache entries for inactive query args are also invalidated/removed. Because `AppRouter` uses ordinary route mounting (`frontend/src/routes/AppRouter.tsx:52-84`), this is not evidence that every route refetches simultaneously. The confirmed blast radius is the current mounted route, not the entire cached application.

**Recommended fix:** split the plain tag at the API boundary, minimally by resource family, then add argument-derived IDs where mutation scope is available:

- customer contracts;
- committed/reconciliation weekly menu (`customerId + weekStartDate`);
- menu schedules (`customerId/week/serviceDate/shift` or entity ID);
- meal quantity plans (same service scope);
- coordination orders (day/date/shift);
- amendments/decision page;
- import history;
- production plans.

Keep explicit cross-resource invalidations only where backend behavior proves the derived resource changes. Do not simply remove tags to lower request counts.

**Change scope:** primarily `frontend/src/api/coordinationApi.ts`, tag types/registry, plus cache-fanout tests. No page-by-page workaround is appropriate.

**Validation:** create a store-level fanout test analogous to `workflowApi.cacheInvalidation.test.ts`; subscribe to all coordination families, execute representative mutations, assert exact GET paths/args. Then use headed Network evidence for quick servings, forecast update, schedule publication, and amendment review; report request count and retained stale-content behavior.

### Finding DF-02 — Warehouse demand owns three report reads it cannot use

**Classification:** Confirmed query-ownership/duplicate-data-flow defect. **Severity: P1 / Medium-High.**

`WarehousePage` calls:

```ts
const { roleInboxItems } = useWorkflowOverview({
  skip: activeView !== 'demand',
});
const warehouseInbox = roleInboxItems.filter((item) => item.laneId === 'warehouse');
```

Evidence: `frontend/src/features/warehouse/pages/WarehousePage.tsx:193-200`.

But `useWorkflowOverview` always starts four reads when enabled:

```ts
getWorkflowDocuments({ limit: 100 })
getIngredientDemand({ limit: 100 })
getPriceVariance({ limit: 100 })
getStockMovements({ limit: 100 })
```

Evidence: `frontend/src/api/reportsApi.ts:570-597`.

The model proves only document-derived items can belong to Warehouse. Demand-derived items are hard-coded to `planning`, price-derived items to `purchasing`, and stock movements affect `workflowLanes`, which Warehouse does not consume here (`frontend/src/api/workflowOverviewModel.ts:15-66`). Therefore the Warehouse demand view needs the document input but cannot use the demand, price, or movement responses for `warehouseInbox`.

This is not an identical URL duplicate: the page's other demand/current-stock/kitchen reads use different endpoints and grains (`frontend/src/features/warehouse/pages/WarehousePage.tsx:105-192`). It is duplicated **ownership/work**, caused by importing a dashboard-wide composite hook to derive one lane.

**Root cause:** `useWorkflowOverview` owns both data fetching and all-lane presentation derivation; its only controls are whole-hook `skip` and `skipPrice`. A page needing one lane cannot express its actual data dependencies.

**Impact/scope:** three unnecessary `limit=100` report requests whenever Warehouse demand is opened; unnecessary payload mapping and cache/tag subscriptions; price-variance may also be permission-sensitive for Warehouse-only users. Exact bytes and latency are not statically known.

**Recommended fix:** use the already-installed RTK Query endpoints directly at the Warehouse owner: query workflow documents only and derive Warehouse warning/danger document items with the existing owner/lane mapping. Alternatively extract only a pure lane selector from the existing model; do not add a second mega hook or backend endpoint without measurements.

**Change scope:** `WarehousePage.tsx`, `workflowOverviewModel.ts` only if a reusable pure selector is needed, and focused ownership/request tests.

**Validation:** mounted Warehouse demand test with a real RTK store/fetch spy: expected report calls should change from four overview endpoints to only workflow-documents, while the same Warehouse inbox fixtures render. Headed runtime should record count, payload bytes, 403s, and time-to-ready before/after.

### Finding DF-03 — Exact duplicate requests are already coalesced

**Classification:** H7 duplicate-fetch hypothesis not found for identical endpoint/cache keys.

- RTK Query coalesces concurrent subscribers to the same query key (`frontend/src/api/apiSlice.requestDeduplication.test.ts:72-88`).
- The shared base query additionally coalesces exact concurrent non-idempotent request signatures (`frontend/src/api/apiSlice.ts:19-84`; test `apiSlice.requestDeduplication.test.ts:90-120`).
- Repeated dashboard intent preloads from pointer/focus/touch produce four distinct dashboard reads, not 12; the focused test asserts this (`frontend/src/routes/routeDataPreloaders.test.ts:34-58`).
- Purchasing already has argument-specific invalidation: supplier confirmation refetches the touched workbench week and not another cached week (`frontend/src/features/purchasing/purchasingModel.test.ts:405-450`).

**Constraint:** this does not prove no semantically overlapping endpoints exist. DF-02 is such overlapping work even though URLs differ. Runtime Network URL/query normalization remains necessary for a whole-app duplicate claim.

### Finding DF-04 — No unnecessary conditional waterfall was confirmed

**Classification:** H7 waterfall hypothesis **not found in inspected chains**; runtime exhaustive audit still needed.

Supported dependencies:

1. `ReconciliationIssueDetailDialog`: issue detail returns the authoritative `reconciliationBatchId`; only then does batch data load. This prevents joining an issue to an unverified expected batch (`frontend/src/components/reconciliation/ReconciliationIssueDetailDialog.tsx:33-39`). Parallelizing with `expectedBatchId` would weaken the linkage check.
2. `ReconciliationPage`: list success establishes whether the requested batch survives active filters and supplies a default; selected detail then loads (`frontend/src/features/reconciliation/pages/ReconciliationPage.tsx:55-99`).
3. MRX Warehouse: eligible batch list validates/defaults `batchId`; detail, movement history, and dish projection depend on that ID (`frontend/src/features/warehouse/pages/ReconciliationWarehousePage.tsx:218-305`).
4. Weekly demand approval history requires `activeDemand.materialRequestId`, which comes from demand/staleness data (`frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts:145-164`).
5. Dish detail lazy-loads schedules only when the order payload lacks dish metadata; it is conditional enrichment, not an independent request delayed accidentally (`frontend/src/features/coordination/components/dish-detail-dialog.tsx:25-51`).

Parallel work is already explicit in the Weekly demand model: demand and documents start together, seven per-service-date staleness queries start independently, and the selected-day aggregate starts once a UI-selected service date exists (`frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts:75-115`). The seven staleness reads are a request-count/batching question, not a waterfall.

**Validation still required:** headed Network initiator/timing evidence on Weekly Menu, Reconciliation, Warehouse, and modal detail paths. A static hook trace cannot prove browser scheduling, HTTP connection contention, or server-internal sequential calls.

### Finding DF-05 — Intent preload is bounded and deduplicated, but focus can still speculate many reads

**Classification:** Partial preload-strategy concern. **Severity: P2 / Medium pending runtime.**

Positive evidence:

- Five-minute `ifOlderThan` policy avoids repeated warm-cache reads (`frontend/src/routes/routeDataPreloaders.ts:5-6`).
- same-key preloads coalesce (`frontend/src/routes/routeDataPreloaders.test.ts:34-58`);
- Reports does not speculate before view/permission scope is known (`routeDataPreloaders.test.ts:60-67`);
- MRX Warehouse preload is bounded to its selector (`routeDataPreloaders.test.ts:69-84`);
- route-data preload is best-effort and normal page queries remain fallback (`frontend/src/routes/routeLoaders.ts:78-86`).

Risk evidence:

`MainLayout` invokes both code and data preload on `onPointerEnter`, `onFocus`, and `onTouchStart` (`frontend/src/app/layout/MainLayout.tsx:188-193`). A keyboard user tabbing across visible navigation links can therefore initiate default data bundles without activating them. Static route bundles contain up to 4 dashboard reads, 4 Weekly Menu reads, 3 Coordination reads, 3 Approval reads, 1 Purchasing read, 3 Warehouse reads, and 3 Approval Rules reads (`frontend/src/routes/routeDataPreloaders.ts:8-83`). Repetition is deduped, permissions/mode hide ineligible routes, and unsubscribed prefetched cache does not prove network harm; nevertheless first traversal can be materially speculative.

Weekly Menu's separate idle **code** preload is more conservative: it waits one second, serializes tab chunks through idle callbacks, cancels on unmount, and opts out on Save-Data/2G (`frontend/src/features/projects/pages/WeeklyMenuPage.tsx:264-292`).

**Recommended decision/fix only after measurement:** retain code preload on focus, but consider data preload on stronger intent (pointer dwell or activation-adjacent event), add Save-Data/2G gating shared with Weekly Menu, or narrow each route's default data set. Do not remove all preloading based on static request counts.

**Validation:** clean-cache headed runs for pointer hover, keyboard traversal, touchstart/cancel, and actual navigation. Capture initiated/completed/cancelled reads, transfer bytes, cache-hit rate on subsequent activation, and time-to-content. Compare enabled vs disabled/throttled network before changing policy.

## Architecture

All frontend endpoint modules inject into one `apiSlice`, so identical endpoint+serialized args share cache and all tag invalidations cross module boundaries. `keepUnusedDataFor: 300s` keeps route data warm, but ordinary React Router routes unmount; only queries with active subscribers refetch immediately after invalidation. Unsubscribed invalidated entries are evicted rather than proving a live network request.

The codebase contains two generations of cache contracts:

1. **Granular workflow contract:** `WorkflowReports` IDs model documents, demand, workbench, stock, audit, etc. Aggregate queries deliberately provide their source tags so source mutations refresh dependent KPI/audit projections. Focused tests already lock reduced fanout: data-quality remediation refetches only data-quality and audit rather than the recorded former 10/10 broad baseline (`workflowApi.cacheInvalidation.test.ts:43-108`).
2. **Legacy broad domain tags:** `Coordination`, `PurchaseOrders`, and several catalog tags represent whole resource families. The clearest active blast radius is `Coordination`, because Weekly Menu mounts multiple unrelated consumers at once.

Route preload follows navigation intent: `MainLayout` starts route chunk preload and a curated default RTK prefetch set. RTK coalescing and the five-minute freshness threshold prevent repeated identical reads. Page/tab query ownership mostly uses `skip` correctly, but `WarehousePage` bypasses that discipline by importing the all-dashboard `useWorkflowOverview` composite for one lane.

## Static evidence versus runtime needs

### Proven statically / by focused repository tests

- Plain `Coordination` invalidation reaches every active query providing that tag.
- Weekly Menu concurrently subscribes to at least contracts, committed menu, menu schedules, and meal plans under that tag.
- Warehouse demand's `warehouseInbox` cannot use overview demand, price, or movement inputs.
- Same endpoint+args request ownership is coalesced.
- Inspected conditional chains depend on an ID/verification result or user-selected scope.
- Navigation focus triggers data prefetch; the route default request sets are known.

### Needs runtime evidence before quantitative claims or remediation priority promotion

- Exact request count after each real mutation, including permission/mode-specific subscribers.
- Payload sizes, TTFB/duration, browser cache behavior, connection contention, and server timing.
- Whether navigation-focus speculative reads are commonly completed before real navigation and whether they improve subsequent route readiness.
- Whether the seven Weekly demand staleness reads warrant an aggregate endpoint; no batching recommendation is justified without timing/load evidence.
- No whole-app “no waterfall/no duplicate” PASS can be issued from static source alone.

## Start Here

Open `frontend/src/api/coordinationApi.ts` first. It contains the confirmed architectural root cause: one plain `Coordination` tag spans contracts, weekly menus, schedules, meal plans, orders, amendments, import history, and production plans. Build an endpoint→tag→mutation→mounted-consumer matrix from that file before changing any page.

Output saved to: C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\subagent-artifacts\outputs\d8af2668-f032-4d08-8902-f1e13f88d7db\.artifacts\goal-ui-ux\reaudit-async-performance-20260915-sol\dataflow.md (19.4 KB, 218 lines). Read this file if needed.
