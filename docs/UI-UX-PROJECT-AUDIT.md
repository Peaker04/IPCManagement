# UI/UX Project Audit

Updated: 2026-08-12
Status: the read-only five-desktop matrix is verified for protected tabs, the Warehouse permission boundary, three safe dialogs, and Warehouse lifecycle states. Warehouse/Admin navigation performance remains `NEEDS_EVIDENCE` because no production owner is attributable.

## Scope and evidence

The audit covers the nine protected routes, five desktop viewports, table/tab/modal source inventory, and read-only headed runtime. Screenshots are reviewer evidence only; verdicts use DOM/runtime/source evidence.

| Surface | Inventory | Coverage now | Verdict |
|---|---:|---|---|
| Protected routes | 9 | 5 desktop viewports = 45 route probes plus their permitted tab transitions | PASS |
| Table owners | 35 files | global-overflow/control gate + source inventory | PARTIAL |
| Tab/view-switcher owners | 10 files | each permitted tab is activated through its ARIA `tab → tabpanel → nested tablist` seam at all five desktop viewports | PASS |
| Dialog/modal owners | 24 files | Weekly Menu import/editor and Approval decision dialogs are measured at all five desktop viewports; mutation-bound dialogs remain explicitly excluded | PARTIAL |
| Loading/empty/error/permission states | route-specific | Warehouse loading, empty, error, and direct forbidden route fixtures are measured at all five desktop viewports; unrelated mutation-bound states remain excluded | PARTIAL |

## Measured baseline

- `NODE_OPTIONS=--max-old-space-size=4096 npm run test:ui-measurements -w frontend -- --workers=1`: 35/35 passed. Each five-desktop JSON report contains route/owner/state/viewport records with DOM geometry, focus, console/page errors, and non-read request capture. The test process requires this explicit heap limit in the current Windows environment; without it a worker can terminate with `Zone Allocation failed` before an assertion runs.
- The tab traversal now follows each tab's public ARIA ownership chain (`tab → aria-controls tabpanel → nested tablist`) and waits for a fresh locator to expose `aria-selected=true`. All 48 interaction records per protected-route viewport are `PASS`; no stale-locator remount disposition remains.
- Warehouse permission coverage uses a procurement-only fixture with no `warehouse.read`: direct navigation renders named `/403` content and hides the Warehouse sidebar link at all five desktop viewports. This is a read-only `RoleGuard` boundary check, not a real authorization change.
- Safe dialog coverage now runs at all five desktop viewports for `WeeklyMenuImportDialog`, `WeeklyScheduleEditorDialog`, and `ApprovalPage`: accessible name, `aria-modal`, focus containment, unchanged document client width, focus return, and zero non-GET API request all pass. Meal-order confirmation and other confirm dialogs remain `NEEDS_EVIDENCE` because their confirmation route crosses a mutation boundary.
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
| UX-04 | Whole project | PARTIAL | The 35-case matrix passes across all five desktops: all permitted tabs, the Warehouse forbidden route, three safe dialogs, and Warehouse loading/empty/error. Mutation-bound dialogs and unrelated state fixtures are explicitly excluded rather than converted to synthetic PASS. | The remaining scope is an evidence limitation, not a proven layout/control defect. |
| UX-05 | Control-surface regression coverage | RESOLVED | The current control-surface suite passes `25/25`. Purchasing renders its populated `Dòng nguyên liệu của ngày phục vụ đang chọn` table and Warehouse renders `Bảng tồn kho hiện tại trong kho`; both retain local scroll at the mobile viewport. | The defect was fixture drift: missing read-only inventory-return/amendment responses and an obsolete per-service-date production-plan fixture, not a production UI defect. |
| UX-06 | Reports › Chất lượng dữ liệu | RESOLVED | The current control-surface fixture makes `data-quality` ready with an array payload; the view-model now uses `(totalIssues ?? 0).toString()`. | The context-strip count safely falls back to zero instead of crashing on an incomplete ready payload. |

## Required next audit matrix

The executable portion is complete: every permitted protected-route tab uses a fresh ARIA-seam locator at all five desktop viewports, and the safe dialog/fixture states above have measured rows. A dialog that cannot open without crossing a mutation boundary remains `NEEDS_EVIDENCE`, never a synthetic PASS. Any future state expansion must preserve this read-only boundary.

Warehouse receipt lifecycle loading, empty and error are covered at all five desktop viewports with read-only fixtures. The loading response holds its measured reservation; an empty `200` or error `503` settles with `aria-busy=false`, shows the explicit state, and produces no write request. The direct Warehouse permission fixture is also covered at all five viewports.

## Interaction evidence collected

- Dialog group: the three safely closable dialogs pass at all five desktop viewports (15 measured rows). Each asserts `aria-modal`, focus containment, preserved document client width, focus restoration, and zero non-GET request. Meal-order confirmation remains a mutation-boundary path, so it is not promoted as a read-only dialog PASS.
- Table/control group: all six current checks pass. Purchasing and Warehouse now receive shape-correct read-only fixtures, so their named mobile table regions are measured rather than falling through to login/proxy state.

### UX-05 classification

| Failed check | Classification | Evidence | Required follow-up |
|---|---|---|---|
| Route/control heading for Reports | PASS | `MainLayout.tsx` intentionally renders `Báo cáo vận hành`; the control test now asserts that shell title. | No production change. |
| Reports mobile filter and price-table check | PASS | `stubWorkflowReports` supplies a non-empty price-table row before geometry is read. | No production change. |
| Purchasing table local-scroll check | PASS | The Phase 09 fixture renders a populated `Dòng nguyên liệu của ngày phục vụ đang chọn` table; its `900px` table scrolls locally at `390px`. | No production change. |
| Warehouse local-scroll check | PASS | The shape-correct auth/read fixtures render `Bảng tồn kho hiện tại trong kho`; its `720px` table scrolls locally at `390px`. | No production change. |

## Wave 2 trace disposition

The corrective helper records layout-shift source rectangles and action intervals. The Approvals queue now owns a bounded scrollable viewport, so loading, populated, and empty queue states retain the same primary/strip geometry; the focused delayed-query regression exercises a representative 20-record page and empty state. The final five-viewport headed run keeps every Approvals CLS sample below `0.1`; this is a DOM/performance result, not a screenshot judgment. Warehouse remains `NEEDS_EVIDENCE`: its CLS/task sources vary, the Long Task API has no component stack, and a Chrome DevTools tab-interaction profile observes `123ms` INP without a source function. The DevTools network tree identifies Vite development-module loading and parallel API responses, which are diagnostic context rather than production ownership. Reports work remains independently authorized.

## Wave 3 Reports disposition

UX-01 and UX-02 are closed by the owner-local `ReportsPricePanel` repair and deterministic fixture evidence. The final Wave 2 runtime manifest closes Approvals only; Warehouse remains unauthorized for a production change.

## Planning constraint

Do not implement the above gaps from this baseline. After the interaction matrix is complete, group only evidence-backed GAPs by shared owner into one implementation phase with at most three waves.
