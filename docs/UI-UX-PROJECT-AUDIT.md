# UI/UX Project Audit

Updated: 2026-08-11
Status: baseline complete; interaction matrix pending

## Scope and evidence

The audit covers the nine protected routes, five desktop viewports, table/tab/modal source inventory, and read-only headed runtime. Screenshots are reviewer evidence only; verdicts use DOM/runtime/source evidence.

| Surface | Inventory | Coverage now | Verdict |
|---|---:|---|---|
| Protected routes | 9 | 5 desktop viewports = 45 headed route probes | PARTIAL |
| Table owners | 35 files | global-overflow/control gate + source inventory | PARTIAL |
| Tab/view-switcher owners | 10 files | default route states only | NEEDS_EVIDENCE |
| Dialog/modal owners | 24 files | shared dialog contract only | NEEDS_EVIDENCE |
| Loading/empty/error/permission states | route-specific | selected fixture states only | NEEDS_EVIDENCE |

## Measured baseline

- `npm run test:ui-measurements -w frontend`: 10/10 passed. It proves no global page overflow or clipped controls under its fixture; it does not prove task hierarchy, action semantics, tab states, or modal owner behavior.
- Headed Chrome, current source `501789a5`, `ipc_lane9`: 45 route probes, zero overflow, console/page/request error, or escaped mutation.
- Runtime CLS exceeds the 0.1 lab threshold at Warehouse/1920 (`0.23392082403435271`) and at multiple Approvals probes (`0.101–0.152`). These are runtime findings, not screenshot judgments.

## Confirmed gaps

| ID | Scope | Verdict | Evidence | Root cause |
|---|---|---|---|---|
| UX-01 | Reports › Biến động giá › Theo dòng nhập | GAP | `ReportsPricePanel.tsx` uses a fixed 10-column table; column 10 is 8% wide while `ipc-report-action-cell` permits `overflow-wrap:anywhere`. | A workflow instruction is rendered as cell text beneath the misleading header `Xử lý`, so it wraps into an unreadable pseudo-action. |
| UX-02 | Reports › Biến động giá › Theo dòng nhập | GAP | Current live screen shows 6 of 17,194 records (`Trang 1/2866`); page size and jump-to-page are the only navigation. | Pagination is used as primary discovery instead of a constrained query/filter/detail workflow. |
| UX-03 | Warehouse and Approvals | GAP | Headed manifest above reports CLS > 0.1. | Route data/layout settles after initial render; trace is required before choosing a fix. |
| UX-04 | Whole project | GAP in assurance | Current UI measurement suite visits route defaults plus one Admin stress table, not every tab/dialog/state owner. | Existing gate proves geometry only, not complete interactive-surface coverage. |
| UX-05 | Control-surface regression coverage | GAP | Targeted Playwright matrix: 4/6 failures. Reports expects obsolete heading `Phân tích biến động giá` but `MainLayout` renders `Báo cáo vận hành`; Purchasing lacks the workbench fixture needed for its table; Warehouse selector assumes the old wrapper location. | Test contracts/fixtures drifted from current UI, leaving several tab/table states without valid regression evidence. |
| UX-06 | Reports › Chất lượng dữ liệu | GAP | Current control-surface fixture makes `data-quality` ready with an array payload; `useReportsPageModel.ts:208` calls `data.totalIssues.toString()` and crashes. | The report view assumes a required response field exists instead of rendering an explicit incomplete/error state. |

## Required next audit matrix

For every tab owner: activate each permitted tab at all five desktop viewports and record DOM overflow, row/header alignment, focus, console/page/request state, and CLS/long-task sample. For each dialog owner: open only a non-mutating/read-only instance where available; otherwise classify `NEEDS_EVIDENCE`, not PASS. Exercise loading, empty, error and permission states from existing fixtures. Record one structured result per surface as PASS, GAP, NOT_APPLICABLE, or NEEDS_EVIDENCE.

## Interaction evidence collected

- Dialog group: 3/3 current dialog checks passed (weekly-menu import/edit, meal-order confirmation, approval decision modal).
- Table/control group: 2/6 passed; Reports wide-table and Weekly Menu matrix local-scroll checks passed. Four failures are UX-05 and must be diagnosed as current fixture/state drift before any assertion is updated.

### UX-05 classification

| Failed check | Classification | Evidence | Required follow-up |
|---|---|---|---|
| Route/control heading for Reports | Obsolete test contract | `MainLayout.tsx` intentionally renders `Báo cáo vận hành`; test/support fixture still names `Phân tích biến động giá`. | Update only the test vocabulary after a source-backed route-name decision. |
| Reports mobile filter check | Obsolete test contract | Same stale heading blocks the test before layout is measured. | Update heading expectation, then re-run its existing geometry assertions. |
| Purchasing table local-scroll check | Fixture missing state | Production `PurchaseServiceDateWorkbench.tsx` exposes the named table, but `stubOperationalApis` does not construct the required workbench state. | Extend the read-only fixture; do not change the production table to satisfy the test. |
| Warehouse local-scroll check | Selector ownership drift | Current `WarehousePage.tsx` places `ipc-warehouse-table-shell` on `TableViewport`, not the old table wrapper assumed by the test. | Replace the test selector with the current named table region and preserve the scroll assertion. |

## Planning constraint

Do not implement the above gaps from this baseline. After the interaction matrix is complete, group only evidence-backed GAPs by shared owner into one implementation phase with at most three waves.
