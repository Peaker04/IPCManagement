# Subagent run 36a44479-9f79-4af0-8013-fb4e1343b41c

- **Mode:** single
- **CWD:** D:\Kì 7\PRN222 Doanh Nghiệp\IPCManagement
- **Started:** 2026-09-15T10:10:01.234Z
- **Ended:** 2026-09-15T10:15:36.014Z
- **Duration:** 5m34s
- **Session:** C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\2026-09-15T04-53-45-769Z_01a0a369-f6a8-7370-ba7d-0f6a77ac3ec8\749430c9-1de9-451e-8e38-49970d9b2c58\run-0\session.jsonl
- **Artifacts:** C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\subagent-artifacts

## Steps
| Step | Agent | Status | Duration |
| --- | --- | --- | --- |
| 1 | scout | complete | 5m34s |

## Summary
scout:
# Code Context

Read-only, source/test-only re-audit of H13-H16 against the current dirty working tree. No database connection, query execution, schema/data mutation, runtime profiling, or index recommendation was performed.

## Files Retrieved

1. `C:/Users/Administrator/Downloads/AGENT_REAUDIT_AND_REMEDIATE.md` (lines 504-625, 763-810) — H13-H16 evidence requirements and finding format.
2. `backend/src/IPCManagement.Api/Features/Planning/Controllers/ServiceRunsController.cs` (lines 49-54) — public `GET /api/service-runs/page` entry point.
3. `backend/src/IPCManagement.Api/Features/Planning/Services/ServiceRunService.cs` (lines 96-235, 253-334, 566-572) — lifecycle projection, list read path, status filtering/paging, and adjustment-history query.
4. `backend/src/IPCManagement.Api/Features/Planning/Contracts/ServiceRunDto.cs` (lines 7-68, 130-150) — detailed lifecycle DTO nested inside every operational list row.
5. `frontend/src/api/chefApi.ts` (lines 86-99, 146-149) — RTK Query list/detail endpoints.
6. `frontend/src/features/reports/pages/ServiceRunReportPanel.tsx` (lines 27-65) — list consumer that launches one adjustment-detail query per closed row.
7. `frontend/src/components/common/ServiceRunBlockerPanel.tsx` (lines 32-39) — Warehouse/Purchasing consumer that requests the full operational page and filters the blocker subset in the browser.
8. `frontend/src/features/purchasing/pages/PurchasingPage.tsx` (lines 286-294) and `frontend/src/features/warehouse/pages/WarehousePage.tsx` (lines 493-501) — hot-screen mounts of the shared blocker consumer.
9. `backend/src/IPCManagement.Api/Features/Reports/Services/DemandReportService.cs` (lines 99-169, 190-331) — positive control: `AsNoTracking`, DB filtering/counting/sorting/paging, and direct DTO projection.
10. `backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseOrderService.cs` (lines 205-230, 280-291) — positive control: `AsNoTracking` and server paging on another list endpoint.
11. `backend/src/IPCManagement.Api/Features/Planning/Persistence/ServiceRunEntityConfiguration.cs` (lines 9-20, 79-91) — declared Service Run indexes in the EF model.
12. `backend/src/IPCManagement.Api/Features/Planning/Persistence/ServiceRunAdjustmentEntityConfiguration.cs` (lines 7-14) — declared `(ServiceRunId, CreatedAt)` adjustment index.
13. `backend/tests/IPCManagement.Api.Tests/ServiceRunLifecycleTests.cs` (lines 139-145) — current page behavior/domain-isolation coverage; no query-count ceiling.
14. `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.GenerationAndWorkbench.cs` (lines 368-403) and `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.SupplierOrdersAndPerformance.cs` (lines 898-938) — existing `DbCommandInterceptor` performance-test pattern suitable for validation.

## Hypothesis classification

| Hypothesis | Classification | Evidence |
|---|---|---|
| H13 — backend hot read paths: projection, `AsNoTracking`, paging/filter/sort, materialization, over-fetch | **Confirmed, scoped rather than systemic** | `ServiceRunService.GetPageAsync` uses no-tracking for reads, but performs per-row enrichment and client-side status filtering/paging. By contrast, `DemandReportService` and `PurchaseOrderService` show established server-side paging/projection/no-tracking patterns. |
| H14 — N+1 in backend and frontend | **Confirmed on both sides** | Backend: `GetPageAsync` calls the multi-query `GetProjectionAsync` and six more queries inside the row loop. Frontend: `ServiceRunReportPanel` launches `/service-runs/{id}/adjustments` for every closed row. |
| H15 — DB optimization/index evidence | **Needs evidence; no index change justified** | EF model declares several relevant indexes, but the authorized evidence contains no production slow-query trace, execution plan, rows scanned, frequency, p95/p99, or demonstrated index bottleneck. |
| H16 — API payload | **Confirmed** | The page nests the full command/detail lifecycle projection and full ID/code collections. `ServiceRunBlockerPanel` consumes only blockers and three code collections; the report separately downloads full adjustment histories merely to read item zero. No measured wire-byte trace is available, so byte magnitude remains `NEEDS_EVIDENCE`. |

## Key Code

```csharp
// ServiceRunService.cs:271-325
foreach (var run in candidateRuns)
{
    var lifecycle = await GetProjectionAsync(...);
    var planRequestIds = await context.Materialrequests...ToListAsync(...);
    var issueCandidates = await context.Inventoryissues...ToListAsync(...);
    var materialRequestLines = await context.Materialrequestlines...ToListAsync(...);
    var purchaseCosts = await (...).ToListAsync(...);
    var actualReceivedCosts = await (...).ToListAsync(...);
    var supplementalCodes = await context.Supplementalmaterialrequests...ToListAsync(...);
}
```

`GetProjectionAsync` itself issues explicit reads for the run, plan, plan lines, demand lines, source-line IDs, issues, supplementals, discrepancy audits, adjustment count, waiver state, declarations, BOM blocker, and latest correction (`ServiceRunService.cs:96-203`). Thus the list path is row-count-dependent even before the six outer-loop reads.

```csharp
// ServiceRunService.cs:263-334
var candidateRuns = hasStatusFilter
    ? await orderedRuns.ToListAsync(cancellationToken)
    : await orderedRuns.Skip(...).Take(...).ToListAsync(cancellationToken);
...
if (hasStatusFilter)
{
    rows = rows.Where(row => row.Lifecycle.Status == ...).ToList();
    totalCount = rows.Count;
    rows = rows.Skip(...).Take(...).ToList();
}
```

```tsx
// ServiceRunReportPanel.tsx:27-35, 63
const { data: adjustments } = useGetServiceRunAdjustmentsQuery(serviceRunId, {
  skip: !isCloseSnapshot,
});
const latest = adjustments?.[0];
...
correction: <CorrectionOverlay serviceRunId={lifecycle.serviceRunId} ... />
```

The list DTO already contains `lifecycle.correctionOverlay` (`ServiceRunDto.cs:24-25`; populated at `ServiceRunService.cs:200-219`), but this report ignores it and requests every closed run's complete adjustment collection.

## Findings

### Finding 1 — Service Run page query count grows linearly with returned rows

- **Severity:** P1
- **Area:** Backend
- **Evidence:** `GET /api/service-runs/page` enters through `ServiceRunsController.cs:49-54`. `ServiceRunService.cs:271-325` invokes `GetProjectionAsync` and six additional EF queries inside `foreach (var run in candidateRuns)`. `GetProjectionAsync` contains its own sequence of database reads at `ServiceRunService.cs:96-203`. Current `ServiceRunLifecycleTests.cs:139-145` checks source-family correctness but establishes no query-count ceiling.
- **Problem:** A page of N runs produces an O(N) query fan-out. Source inspection shows at least 18 explicit EF query awaits per row when the outer reads and projection reads are combined, plus the delegated BOM-blocker read; a default 20-row page can therefore generate hundreds of SELECTs. This is a structurally confirmed N+1 even though no DB timing was collected.
- **Root cause:** `GetProjectionAsync` is a single-record detail/command projection, but `GetPageAsync` reuses it row-by-row and then repeats related demand, issue, purchase, receipt, and supplemental lookups for the same run scope.
- **Impact:** Database round trips and endpoint latency scale with page size; the shared endpoint is mounted by Reports, Warehouse, and Purchasing consumers. Closed rows still pay enrichment cost before being replaced by their stored close snapshot.
- **Fix:** Keep the domain/lane predicates intact, but create one page-oriented read-model path: select the page's base run IDs first, load each related dataset once for all page IDs/scopes, group by run key, and build the operational rows from those grouped results. Do not replace repository architecture globally and do not merge unrelated endpoints.
- **Scope:** Shared backend endpoint/read model: `ServiceRunService.GetPageAsync`; consumers remain contract-compatible or migrate to a versioned/list DTO.
- **Validation:** Add a SQLite `DbCommandInterceptor` regression following the existing bounded-query tests. Seed equivalent 1-row and 20-row pages and assert query count stays within a fixed bounded delta rather than increasing per row. Retain the existing DEFAULT-vs-MRX collision assertions and verify page contents/costs/blockers are identical.

### Finding 2 — Status filtering disables server paging and materializes the full candidate set

- **Severity:** P1
- **Area:** Backend
- **Evidence:** `ServiceRunService.cs:263-268` calls `orderedRuns.ToListAsync()` whenever `query.Status` is present. Every candidate is then fully enriched in `ServiceRunService.cs:270-325`; only afterward do lines 326-334 filter by lifecycle status and apply `Skip/Take` in memory.
- **Problem:** `pageNumber`/`pageSize` no longer bound database materialization or enrichment work for status-filtered requests. Sorting begins in SQL, but filter, count, and paging happen after all lifecycle projections are built.
- **Root cause:** Public status is recomputed from lifecycle evidence and is not expressed as a server-translatable page read model; the implementation falls back to materialize-all correctness.
- **Impact:** Data volume, memory, query count, and response latency grow with the entire matching date/customer/shift history rather than the requested page. This compounds Finding 1.
- **Fix:** Make the canonical list-status computation usable before materialization. Prefer a page read-model/query expression that computes or joins the status evidence in bulk, then performs database-side filter/count/order/`Skip`/`Take`. If stored `ServiceRun.Status` is selected as the canonical list filter, first prove every lifecycle transition keeps it equivalent; do not silently substitute it without that contract proof.
- **Scope:** Backend Service Run list filtering/paging contract.
- **Validation:** Seed more than two pages across several derived statuses. Assert exact `totalCount`, stable ordering, and page membership, then inspect intercepted SQL/command counts to prove status-filtered page 1 does not enrich off-page rows. Test DEFAULT/MATERIAL_RECONCILIATION separation unchanged.

### Finding 3 — Reports performs frontend N+1 adjustment-history requests

- **Severity:** P1
- **Area:** Cross-cutting (Frontend + Backend API)
- **Evidence:** `ServiceRunReportPanel.tsx:27-35` calls `useGetServiceRunAdjustmentsQuery(serviceRunId)` and reads only `adjustments?.[0]`; line 63 mounts it once for every row. The hook maps to `GET /service-runs/{id}/adjustments` in `chefApi.ts:146-149`. The backend returns the entire ordered history with no paging/`Take` at `ServiceRunService.cs:566-572`. The page's lifecycle object already contains the latest correction overlay, populated at `ServiceRunService.cs:200-219` and declared at `ServiceRunDto.cs:24-25`.
- **Problem:** Loading one 20-row page causes one list request plus up to one detail request per closed row. Each detail response materializes full adjustment history although the UI uses only the newest item.
- **Root cause:** The report bypasses the latest-correction summary already included in its list response and treats a per-row full-history hook as a cell renderer.
- **Impact:** Avoidable request burst, extra DB queries, staggered cell loading, and possible per-row error states. The request count scales with closed rows.
- **Fix:** Render the report cell from `lifecycle.correctionOverlay`. Keep the full history endpoint for an explicit on-demand history/detail interaction only. If the embedded overlay is intentionally insufficient, use one page-level batch projection rather than row hooks.
- **Scope:** Reports Service Run table plus the existing Service Run list contract; no mega endpoint required.
- **Validation:** Add a mounted RTK/MSW behavior test with 20 closed rows and assert the report renders latest correction data while issuing exactly the page request and zero `/adjustments` requests. Separately preserve one test proving the history endpoint still works when explicitly opened.

### Finding 4 — The Service Run list contract over-fetches detail/command state for list consumers

- **Severity:** P1
- **Area:** Cross-cutting (Backend payload + Frontend consumers)
- **Evidence:** `ServiceRunOperationalRowDto` nests all of `ServiceRunLifecycleProjectionDto` (`ServiceRunDto.cs:7-68, 140-150`), including `Tracks`, `AllowedActions`, `CloseSnapshot`, action booleans, `SourceLineOptions`, and `PendingVarianceDeclarations`. `ServiceRunBlockerPanel.tsx:32-39` requests 20 full operational rows, browser-filters four blocker codes, and renders only plan/shift/blockers plus material-request, issue, and supplemental codes. It is mounted from Purchasing (`PurchasingPage.tsx:286-294`) and Warehouse (`WarehousePage.tsx:493-501`). The Reports table (`ServiceRunReportPanel.tsx:42-65`) also uses only a subset of the detailed lifecycle fields.
- **Problem:** List screens receive nested command/detail state and collections they do not render. Producing those fields also drives several of the expensive projection queries in Finding 1. The blocker panel additionally downloads costs, line-ID arrays, return codes, serving state, and correction/detail state to show a compact warning list.
- **Root cause:** One detailed lifecycle DTO is reused as the list DTO for three distinct read purposes.
- **Impact:** Excess serialization/wire data and backend work on Warehouse, Purchasing, and Reports hot views. Actual byte savings cannot be claimed without runtime payload capture.
- **Fix:** Introduce the minimum page/list projection already justified by these consumers (identity, date/shift/status/blockers, displayed document summaries, report totals). Keep detailed lifecycle/allowed actions/source options on the single-run endpoints. If blocker and report needs cannot share a coherent list grain, provide a dedicated blocker-summary projection rather than optional fields on a mega DTO. Preserve existing API consumers via additive/versioned migration.
- **Scope:** Service Run read DTO/API contract and its three frontend consumers.
- **Validation:** Contract tests must enumerate fields required by each consumer; serialize representative 20-row fixtures before/after and record payload bytes; assert OpenAPI/type generation and all three consumers pass. Backend command-count validation should prove omitted detail collections are no longer queried for list requests.

## H15 DB-index evidence gate

- **Classification:** `NEEDS_EVIDENCE`, not an actionable defect or index proposal.
- **Current source evidence:** The EF model already declares Service Run uniqueness/status indexes (`ServiceRunEntityConfiguration.cs:15-18`), source-line uniqueness (`ServiceRunEntityConfiguration.cs:82-91`), variance declaration lookup (`ServiceRunVarianceEntityConfiguration.cs:10-13`), and adjustment `(ServiceRunId, CreatedAt)` lookup (`ServiceRunAdjustmentEntityConfiguration.cs:10-13`).
- **Missing evidence:** no authorized execution plan, actual rows scanned, slow-query log, endpoint frequency, DB duration, p95/p99, or proof that any declared index is present/effective in the active protected lane.
- **Decision:** **Không đủ evidence để thay đổi index.** The confirmed problems are query shape, repeated materialization, and FE request fan-out; fix and measure those first. Any future index work requires a separately authorized non-protected profiling lane and evidence showing the residual bottleneck.
- **Validation before any future index change:** capture endpoint and DB timings, query count, generated SQL, `EXPLAIN`/actual plan, rows examined, selectivity, write-cost tradeoff, and before/after p95 on an authorized disposable lane.

## Architecture

`ServiceRunReportPanel`, `ServiceRunBlockerPanel` (Warehouse/Purchasing), and RTK Query call `GET /api/service-runs/page`. The controller delegates directly to `ServiceRunService.GetPageAsync`. That method selects run candidates, then invokes the detail-oriented `GetProjectionAsync` and further document/cost queries once per row. Reports then adds another client-side row fan-out to the adjustment-history endpoint. The codebase already contains better read-path precedents—DB-side projection/paging in `DemandReportService`, server paging in `PurchaseOrderService`, and bounded query-count tests using `DbCommandInterceptor`—so remediation can be local to the Service Run read model without a new repository framework.

## Start Here

Open `backend/src/IPCManagement.Api/Features/Planning/Services/ServiceRunService.cs` at lines 253-334 first. It contains the shared root cause for H13/H14/H16: per-row detail projection, repeated related-data queries, and materialize-all status filtering. Then open `frontend/src/features/reports/pages/ServiceRunReportPanel.tsx` at lines 27-35 to remove the independent frontend N+1 by reusing the already-returned correction summary.

Output saved to: C:\Users\Administrator\.pi\agent\sessions\--D--Kì 7-PRN222 Doanh Nghiệp-IPCManagement--\subagent-artifacts\outputs\d8af2668-f032-4d08-8902-f1e13f88d7db\.artifacts\goal-ui-ux\reaudit-async-performance-20260915-sol\backend.md (16.6 KB, 139 lines). Read this file if needed.
