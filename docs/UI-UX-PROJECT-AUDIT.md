# UI/UX Project Audit

Updated: 2026-08-11
Status: baseline complete; route-default interaction records measured; remaining owner states need evidence

## Scope and evidence

The audit covers the nine protected routes, five desktop viewports, table/tab/modal source inventory, and read-only headed runtime. Screenshots are reviewer evidence only; verdicts use DOM/runtime/source evidence.

| Surface | Inventory | Coverage now | Verdict |
|---|---:|---|---|
| Protected routes | 9 | 5 desktop viewports = 45 headed route probes | PARTIAL |
| Table owners | 35 files | global-overflow/control gate + source inventory | PARTIAL |
| Tab/view-switcher owners | 10 files | route-default record at five desktop viewports; non-default tab paths explicitly recorded | NEEDS_EVIDENCE |
| Dialog/modal owners | 24 files | shared dialog contract only; unopened read-only path explicitly recorded | NEEDS_EVIDENCE |
| Loading/empty/error/permission states | route-specific | selected fixture states only; unexercised paths explicitly recorded | NEEDS_EVIDENCE |

## Measured baseline

- `npm run test:ui-measurements -w frontend -- --workers=1`: 10/10 passed. Each five-desktop JSON report now contains route/owner/state/viewport records with DOM geometry, focus, console/page errors, non-read request capture, and an explicit `PASS`, `GAP`, or `NEEDS_EVIDENCE` outcome. The 45 route-default records are `PASS`; unexercised Reports tabs, Approvals dialog, and loading/empty/error/permission paths remain `NEEDS_EVIDENCE` rather than synthetic passes.
- Headed Chrome, current source `501789a5`, `ipc_lane9`: 45 route probes, zero overflow, console/page/request error, or escaped mutation.
- Runtime CLS exceeds the 0.1 lab threshold at Warehouse/1920 (`0.23392082403435271`) and at multiple Approvals probes (`0.101–0.152`). These are runtime findings, not screenshot judgments.

## Confirmed gaps

| ID | Scope | Verdict | Evidence | Root cause |
|---|---|---|---|---|
| UX-01 | Reports › Biến động giá › Theo dòng nhập | GAP | `ReportsPricePanel.tsx` uses a fixed 10-column table; column 10 is 8% wide while `ipc-report-action-cell` permits `overflow-wrap:anywhere`. | A workflow instruction is rendered as cell text beneath the misleading header `Xử lý`, so it wraps into an unreadable pseudo-action. |
| UX-02 | Reports › Biến động giá › Theo dòng nhập | GAP | Current live screen shows 6 of 17,194 records (`Trang 1/2866`); page size and jump-to-page are the only navigation. | Pagination is used as primary discovery instead of a constrained query/filter/detail workflow. |
| UX-03 | Warehouse and Approvals | GAP | Headed manifest above reports CLS > 0.1. | Route data/layout settles after initial render; trace is required before choosing a fix. |
| UX-04 | Whole project | GAP in assurance | Current UI measurement suite visits route defaults plus one Admin stress table, not every tab/dialog/state owner. | Existing gate proves geometry only, not complete interactive-surface coverage. |
| UX-05 | Control-surface regression coverage | NEEDS_EVIDENCE | Reports now uses the `Báo cáo vận hành` shell title and its non-empty price fixture; the Reports controls pass. Purchasing and Warehouse fixture-backed mobile controls still do not reach their intended non-empty state under the current control harness. | Reports fixture/title drift is resolved in test scope. Purchasing/Warehouse remain evidence gaps; do not change production owners until their read-only fixture/auth route state is proven. |
| UX-06 | Reports › Chất lượng dữ liệu | RESOLVED | The current control-surface fixture makes `data-quality` ready with an array payload; the view-model now uses `(totalIssues ?? 0).toString()`. | The context-strip count safely falls back to zero instead of crashing on an incomplete ready payload. |

## Required next audit matrix

For every tab owner: activate each permitted tab at all five desktop viewports and record DOM overflow, row/header alignment, focus, console/page/request state, and CLS/long-task sample. For each dialog owner: open only a non-mutating/read-only instance where available; otherwise classify `NEEDS_EVIDENCE`, not PASS. Exercise loading, empty, error and permission states from existing fixtures. Record one structured result per surface as PASS, GAP, NOT_APPLICABLE, or NEEDS_EVIDENCE.

## Interaction evidence collected

- Dialog group: 3/3 current dialog checks passed (weekly-menu import/edit, meal-order confirmation, approval decision modal).
- Table/control group: 2/6 passed; Reports wide-table and Weekly Menu matrix local-scroll checks passed. Four failures are UX-05 and must be diagnosed as current fixture/state drift before any assertion is updated.

### UX-05 classification

| Failed check | Classification | Evidence | Required follow-up |
|---|---|---|---|
| Route/control heading for Reports | PASS | `MainLayout.tsx` intentionally renders `Báo cáo vận hành`; the control test now asserts that shell title. | No production change. |
| Reports mobile filter and price-table check | PASS | `stubWorkflowReports` supplies a non-empty price-table row before geometry is read. | No production change. |
| Purchasing table local-scroll check | NEEDS_EVIDENCE | The composed Phase 09 workbench fixture does not yet produce the intended workbench state under the control harness. | Reconcile fixture/auth route setup before changing `PurchaseServiceDateWorkbench.tsx`. |
| Warehouse local-scroll check | NEEDS_EVIDENCE | The control now targets the `TableViewport` named region (`Bảng tồn kho hiện tại trong kho`), but its non-empty current-stock row is not observed in the current harness. | Reconcile fixture route precedence before changing `WarehousePage.tsx`. |

## Planning constraint

Do not implement the above gaps from this baseline. After the interaction matrix is complete, group only evidence-backed GAPs by shared owner into one implementation phase with at most three waves.
