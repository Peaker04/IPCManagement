# UI/UX Project Audit

Updated: 2026-08-11
Status: Reports price-list remediation verified; Approvals CLS remediation remains open; remaining non-Reports owner states need evidence

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
- Wave 2 headed Chrome recheck, current source `9741e976`, `ipc_lane9`: 45 route probes across all five desktop viewports, 606 post-action GET responses, zero overflow, console/page/request error, escaped mutation, or non-success API response. The owned `3010/8010` runtime was torn down after capture; artifact pointer is in `docs/EVIDENCE-INDEX.md`.
- The Wave 2 corrective headed run on `ipc_lane9` records layout-shift source rectangles and action intervals. Approvals now has a lowest owner: its queue `SplitWorkbench` strip labelled `Chứng từ` is removed from about `148px` to a zero rect. A queue-only `148px` reservation makes the delayed-query regression pass, but the five live CLS samples remain `0.1010878640403376`–`0.15160781061436363`; it is not a completed `<= 0.1` repair. The run has 603 successful GET responses and zero overflow, console/page/request errors, or escaped mutation; the owned `3010/8010` runtime was torn down.
- Wave 3 Reports fixture verification: focused control tests 3/3 and the five-desktop measurement suite 10/10 pass. `ReportsPricePanel` records the warning-detail action at each approved desktop viewport; it is focusable, non-wrapping, and links to the existing detail region. The existing debounced `searchKeyword` query is exercised before pagination. ESLint and the production build pass. This is DOM/focus/query evidence, not a screenshot verdict.

## Confirmed gaps

| ID | Scope | Verdict | Evidence | Root cause |
|---|---|---|---|---|
| UX-01 | Reports › Biến động giá › Theo dòng nhập | RESOLVED | `ReportsPricePanel` now renders a focusable `Xem đề xuất` control with an accessible owner-specific label and `aria-controls` link to the existing warning-detail region. Five-desktop measurement records no wrapping or clipping. | The narrow cell no longer contains a wrapped instructional pseudo-action. |
| UX-02 | Reports › Biến động giá › Theo dòng nhập | RESOLVED | The existing labelled search control is exercised with the server-bound debounced `searchKeyword` before pagination; the warning action opens the existing detail path. | Discovery can constrain the price list before a user navigates pagination. |
| UX-03 | Warehouse and Approvals | GAP | Corrective headed evidence identifies the Approvals `SplitWorkbench` `Chứng từ` strip as the layout-shift source, but its CLS remains `0.1011`–`0.1516` after the loading-state reservation. The one Warehouse attempt records `0.2011` CLS at `1920×1080` plus `55/69/60/71/71ms` document-navigation tasks with varying sources. | Keep the Approvals CLS gate open pending live-route removal/remount attribution. Warehouse remains `NEEDS_EVIDENCE`; do not alter its production UI without a lowest owner. |
| UX-04 | Whole project | GAP in assurance | Current UI measurement suite visits route defaults plus one Admin stress table, not every tab/dialog/state owner. | Existing gate proves geometry only, not complete interactive-surface coverage. |
| UX-05 | Control-surface regression coverage | NEEDS_EVIDENCE | Reports now uses the `Báo cáo vận hành` shell title and its non-empty price fixture; the Reports controls pass. Purchasing remains non-empty-state unproven; the isolated Warehouse stock control returns to the local login page before the named table region can be observed. | Reports fixture/title drift is resolved in test scope. Purchasing/Warehouse remain read-only fixture/auth evidence gaps; do not change production owners until their intended route state is proven. |
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
| Warehouse local-scroll check | NEEDS_EVIDENCE | The control targets the `TableViewport` named region (`Bảng tồn kho hiện tại trong kho`), but the isolated run returns to the local login page before it is observed. | Reconcile the read-only auth/fixture route state before changing `WarehousePage.tsx`; do not turn this into a production component change. |

## Wave 2 trace disposition

The corrective helper records layout-shift source rectangles and action intervals. It proves the Approvals queue `SplitWorkbench` document strip is removed during live route settlement; the local delayed-query reservation regression passes but the actual five-viewpoint CLS gate remains above `0.1`. This is an open performance defect, not a screenshot judgment or a resolved source change. Warehouse has one corrective attribution attempt only and remains `NEEDS_EVIDENCE`: its CLS/task sources vary and Long Task API has no component stack. Reports work remains independently authorized.

## Wave 3 Reports disposition

UX-01 and UX-02 are closed by the owner-local `ReportsPricePanel` repair and deterministic fixture evidence. The retained Wave 2 runtime manifest remains the authoritative record for Warehouse and Approvals only; it does not authorize a production change there.

## Planning constraint

Do not implement the above gaps from this baseline. After the interaction matrix is complete, group only evidence-backed GAPs by shared owner into one implementation phase with at most three waves.
