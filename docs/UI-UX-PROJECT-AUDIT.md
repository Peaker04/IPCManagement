# UI/UX Project Audit

Updated: 2026-08-11
Status: Reports disclosure and protected-route tab matrix verified; dialog and fixture-state coverage remains open, and Warehouse navigation performance remains `NEEDS_EVIDENCE` because no production owner is attributable

## Scope and evidence

The audit covers the nine protected routes, five desktop viewports, table/tab/modal source inventory, and read-only headed runtime. Screenshots are reviewer evidence only; verdicts use DOM/runtime/source evidence.

| Surface | Inventory | Coverage now | Verdict |
|---|---:|---|---|
| Protected routes | 9 | 5 desktop viewports = 45 headed route probes | PARTIAL |
| Table owners | 35 files | global-overflow/control gate + source inventory | PARTIAL |
| Tab/view-switcher owners | 10 files | every initially permitted tab is activated at all five desktop viewports; a tab that remounts before its post-action state is measured is recorded with its owner as `NEEDS_EVIDENCE` | PARTIAL |
| Dialog/modal owners | 24 files | shared dialog contract only; unopened read-only path explicitly recorded | NEEDS_EVIDENCE |
| Loading/empty/error/permission states | route-specific | selected fixture states plus Warehouse receipt-lifecycle read-error at all five desktop viewports; remaining paths explicitly recorded | NEEDS_EVIDENCE |

## Measured baseline

- `npm run test:ui-measurements -w frontend -- --workers=1`: 10/10 passed. Each five-desktop JSON report now contains route/owner/state/viewport records with DOM geometry, focus, console/page errors, non-read request capture, and an explicit `PASS`, `GAP`, or `NEEDS_EVIDENCE` outcome. The 45 route-default records are `PASS`; unexercised Reports tabs, Approvals dialog, and loading/empty/error/permission paths remain `NEEDS_EVIDENCE` rather than synthetic passes.
- Headed Chrome, current source `501789a5`, `ipc_lane9`: 45 route probes, zero overflow, console/page/request error, or escaped mutation.
- Wave 2 headed Chrome recheck, current source `9741e976`, `ipc_lane9`: 45 route probes across all five desktop viewports, 606 post-action GET responses, zero overflow, console/page/request error, escaped mutation, or non-success API response. The owned `3010/8010` runtime was torn down after capture; artifact pointer is in `docs/EVIDENCE-INDEX.md`.
- The final Wave 2 headed run on `ipc_lane9` verifies the owner-local queue viewport across loading, populated, and empty states. Approvals CLS is `0.00004046950619652848`–`0.0001129114009909525` at all five desktop viewports, below `0.1`; the 606 GET run has zero overflow, console/page/request errors, or escaped mutation and the owned `3010/8010` runtime was torn down. The helper remains `failed` only for unrelated Warehouse/Admin long-task thresholds.
- Wave 3 Reports fixture verification: focused control tests 3/3 and the five-desktop measurement suite 10/10 pass. `ReportsPricePanel` records the warning-detail action at each approved desktop viewport; it is focusable, non-wrapping, and links to the existing detail region. The existing debounced `searchKeyword` query is exercised before pagination. ESLint and the production build pass. This is DOM/focus/query evidence, not a screenshot verdict.
- Wave 3 headed recheck, current source on `ipc_lane9`: 45 route probes across five desktop viewports, 604 GET responses, zero console/page/request failure, escaped mutation, and overflow. The helper records four navigation long tasks (`51–56ms`) and CLS maximum `0.10177890755781512`; neither result has a stable production owner, so the performance gate remains `NEEDS_EVIDENCE`.
- Final Wave 3 headed recheck after the Warehouse state-reservation repair: the same five-desktop 45-probe/604-GET/zero-mutation gate records CLS maximum `0.09845798199929733`, now within the `<=0.1` target. It still records eight navigation long tasks (`51–78ms`) on Warehouse/Admin with no component/function owner, so only the CLS portion is resolved.

## Confirmed gaps

| ID | Scope | Verdict | Evidence | Root cause |
|---|---|---|---|---|
| UX-01 | Reports › Biến động giá › Theo dòng nhập | RESOLVED | `ReportsPricePanel` now renders a focusable `Xem đề xuất` control with an accessible owner-specific label and `aria-controls` link to the existing warning-detail region. Five-desktop measurement records no wrapping or clipping. | The narrow cell no longer contains a wrapped instructional pseudo-action. |
| UX-02 | Reports › Biến động giá › Theo dòng nhập | RESOLVED | The existing labelled search control is exercised with the server-bound debounced `searchKeyword` before pagination; the warning action opens the existing detail path. | Discovery can constrain the price list before a user navigates pagination. |
| UX-03 | Warehouse and Approvals | PARTIAL | The Approvals owner-local scrollable queue viewport keeps the document strip geometry invariant for loading, 20-record, and empty states; headed CLS is `0.000040`–`0.000113` at all five desktop viewports. Warehouse production preview still records one `53ms` navigation task at `1920×1080`; Chrome DevTools records a `123ms` demand-tab interaction (94ms processing, 26ms presentation) but no source function or component owner. | Approvals is resolved. Warehouse remains `NEEDS_EVIDENCE`; do not alter its production UI without a lowest owner. |
| UX-04 | Whole project | GAP in assurance | The measurement suite now activates every initially permitted protected-route tab at all five desktop viewports and records actual geometry/focus/error/request results. Dialog and loading/empty/error/permission fixture coverage is still incomplete; tab owners that remount during activation are explicitly `NEEDS_EVIDENCE`. | The gate now proves route-default plus tab geometry, but not complete dialog/state coverage. |
| UX-05 | Control-surface regression coverage | NEEDS_EVIDENCE | Reports now uses the `Báo cáo vận hành` shell title and its non-empty price fixture; the Reports controls pass. Purchasing remains non-empty-state unproven; the isolated Warehouse stock control returns to the local login page before the named table region can be observed. | Reports fixture/title drift is resolved in test scope. Purchasing/Warehouse remain read-only fixture/auth evidence gaps; do not change production owners until their intended route state is proven. |
| UX-06 | Reports › Chất lượng dữ liệu | RESOLVED | The current control-surface fixture makes `data-quality` ready with an array payload; the view-model now uses `(totalIssues ?? 0).toString()`. | The context-strip count safely falls back to zero instead of crashing on an incomplete ready payload. |

## Required next audit matrix

The tab portion is now executable: every initially enabled tab is activated at all five desktop viewports with a fresh locator. A tab unmounted by a parent transition is recorded as `NEEDS_EVIDENCE`, never retried through a stale locator. Next, for each dialog owner, open only a non-mutating/read-only instance where available; otherwise classify `NEEDS_EVIDENCE`, not PASS. Exercise loading, empty, error and permission states from existing fixtures. Record one structured result per surface as PASS, GAP, NOT_APPLICABLE, or NEEDS_EVIDENCE.

Warehouse receipt lifecycle loading, empty and error are now covered at all five desktop viewports with read-only fixtures. The loading response holds its measured reservation; an empty `200` or error `503` settles with `aria-busy=false`, shows the explicit state, and produces no write request. The panel no longer reserves `48rem` after a read has settled. Permission coverage stays open.

## Interaction evidence collected

- Dialog group: 3 safely closable checks now pass (weekly-menu import/edit and approval decision). Each asserts `aria-modal`, preserves document client width while open, and restores focus to its trigger on close. Meal-order confirmation remains a mutation-boundary path, so it is not promoted as a read-only dialog PASS.
- Table/control group: 2/6 passed; Reports wide-table and Weekly Menu matrix local-scroll checks passed. Four failures are UX-05 and must be diagnosed as current fixture/state drift before any assertion is updated.

### UX-05 classification

| Failed check | Classification | Evidence | Required follow-up |
|---|---|---|---|
| Route/control heading for Reports | PASS | `MainLayout.tsx` intentionally renders `Báo cáo vận hành`; the control test now asserts that shell title. | No production change. |
| Reports mobile filter and price-table check | PASS | `stubWorkflowReports` supplies a non-empty price-table row before geometry is read. | No production change. |
| Purchasing table local-scroll check | NEEDS_EVIDENCE | The composed Phase 09 workbench fixture does not yet produce the intended workbench state under the control harness. | Reconcile fixture/auth route setup before changing `PurchaseServiceDateWorkbench.tsx`. |
| Warehouse local-scroll check | NEEDS_EVIDENCE | The control targets the `TableViewport` named region (`Bảng tồn kho hiện tại trong kho`), but the isolated run returns to the local login page before it is observed. | Reconcile the read-only auth/fixture route state before changing `WarehousePage.tsx`; do not turn this into a production component change. |

## Wave 2 trace disposition

The corrective helper records layout-shift source rectangles and action intervals. The Approvals queue now owns a bounded scrollable viewport, so loading, populated, and empty queue states retain the same primary/strip geometry; the focused delayed-query regression exercises a representative 20-record page and empty state. The final five-viewport headed run keeps every Approvals CLS sample below `0.1`; this is a DOM/performance result, not a screenshot judgment. Warehouse remains `NEEDS_EVIDENCE`: its CLS/task sources vary, the Long Task API has no component stack, and a Chrome DevTools tab-interaction profile observes `123ms` INP without a source function. The DevTools network tree identifies Vite development-module loading and parallel API responses, which are diagnostic context rather than production ownership. Reports work remains independently authorized.

## Wave 3 Reports disposition

UX-01 and UX-02 are closed by the owner-local `ReportsPricePanel` repair and deterministic fixture evidence. The final Wave 2 runtime manifest closes Approvals only; Warehouse remains unauthorized for a production change.

## Planning constraint

Do not implement the above gaps from this baseline. After the interaction matrix is complete, group only evidence-backed GAPs by shared owner into one implementation phase with at most three waves.
