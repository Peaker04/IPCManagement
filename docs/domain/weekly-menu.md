# Weekly menu — bounded planning contract

Source/tests own implemented behavior; this owner defines planning arithmetic, source readiness and scoped preview boundaries. Shared grain/lifecycle: [DOMAIN](../DOMAIN.md); presentation: [DESIGN](../DESIGN.md); verification: [ENGINEERING](../ENGINEERING.md). `/weekly-menu` source authoring is shared intentionally by DEFAULT/MRX, but downstream records/commands remain separate.

## Menu, servings and BOM truth

- BOM quantity preserves up to six decimals per serving in its owned unit. Quantity × reference price is multiplied unrounded, then currency total rounded to whole VND; do not round BOM first. Estimated/reference cost is not physical issue, actual purchase or receipt proof.
- Locked shift headcounts split 85% savory/15% vegetarian by contract; unlocked/imported counts apply directly. Compute variant costs separately before daily totals. Servings are shift-grain inputs, never independently duplicated on each dish row.
- Customer/week/tier are shared coordinates. URL/server authority owns restored business scope, never localStorage. Every present schedule menuPrice must be finite/supported and unique; zero/negative/nonfinite/mixed invalid prices block analytical BOM/cost/projected export. Only absent schedule rows permits contract/default fallback. Otherwise valid physical handoff is not blocked by an unrelated analytical tier error.
- BOM lookup retains dish/customer/tier/effective date and source-line/unit identity. Gross per-serving quantity is not consumption, and API does not supply an independent net value; no invented net/loss calculation. Missing BOM is not zero; nonpositive reference prices mean incomplete checking, not free ingredients. Partial missing BOM is excluded explicitly, not presented as complete zero-cost total.

## Excel import, dates and tier admission

- `MenuPriceTierPolicy.SupportedPriceTiers` is the authority (`DishBomPolicy` delegates for existing BOM callers; currently 25000/30000/34000 VND); authorized clients read `GET /api/Dishes/bom-price-tiers`. Missing metadata or an unselected price blocks tier-dependent writes. There is no browser 25k fallback or arbitrary/nearest-tier mapping. Adding a tier requires configured server support and matching BOM.
- Customer creation needs code/name, with an optional note; the customer list/create modal do not assign a fixed price. The importer requires its own explicit supported price per file. Omitted creation price creates no priced contract (never a zero-price placeholder); explicit legacy contract API callers remain supported. Customer-only/status updates change customer metadata/audit only, never create/apply a contract or reprice schedules. Omitted contract-update price preserves the saved value; absent or non-unique supported schedule-derived prices remain unconfigured, never averaged or synthesized. Historical persisted contract facts are not bulk rewritten.
- Import/template week starts are literal ISO Mondays, including historical Mondays, with service days Monday–Saturday; a Sunday import column is a validation error, never silently skipped. Invalid Vietnamese date drafts stay visible and invalidate previews. Ordinary filters and the Gregorian picker do not inherit a future-only/Monday rule. New daily MRX issues/source edits reject Sunday; existing Sunday facts remain explicitly read-only and are not deleted or moved. Daily MRX writes remain within the actual selected batch dates and existing locks.
- One existing modal accepts 1–10 `.xlsx` files, each with an explicit customer/week/tier. MRX has one header entry: Nhập Excel for editable weeks, Nhập thực đơn mới for completed scope. Inside that importer, Tuần đang xem fixes customer/week; Chọn tuần khác permits saved-draft recovery or deliberate Đổi tuần. Switching intent invalidates preview/token/recovery revision, retaining selected file bytes; completed scope never offers current-week reimport. Preview is menu content, not proof of BOM completeness or split servings.
- Chọn lại file của bản nháp dùng SHA-256 nội dung file + khách hàng + mức giá để tra cứu lịch sử DRAFT đã lưu, lọc trước phân trang; không so tên file hay tự lấy tuần mới nhất. Một kết quả tự điền tuần, nhiều kết quả yêu cầu chọn, lỗi đọc không được coi là không có bản nháp. `CreatedAt` là thời điểm nhập, khác `WeekStartDate` là tuần phục vụ. Đổi tuần là chủ ý chọn phạm vi nhập mới, không di chuyển bản nháp cũ; thay file/khách hàng/giá/tuần hủy preview/token và phản hồi cũ không được ghi đè lựa chọn mới. Metadata bản nháp hiển thị tại nhóm trường tuần, không thêm banner toàn form.
- Preview mặc định là ma trận cả tuần: cột ngày, nhóm ca × Mặn/Chay và từng vị trí món thực. Không phân trang cắt ngày ở góc nhìn chính. Chỉ gộp dọc theo anchor/continuation thật và nhóm ngang kề nhau khi cùng DishId/cấu trúc; mọi dòng/ô nguồn vẫn giữ riêng trong chi tiết nguồn (phân trang hiển thị50 ô từ payload file, không phải server query). Bảng nguồn chính MRX không dựng lại bằng edit scope/số suất giả.
- Thiếu số suất tại ngày mở phải được chỉ rõ và focus trước khi rời bước nhập; số 0 được nhập tường minh khác giá trị thiếu. Chuyển sang xem ảnh hưởng thực hiện đúng một yêu cầu preview thật, lỗi giữ nguyên bản nhập; quyền/lý do/duyệt/khóa ngày vẫn do gateway hiện hành kiểm tra.
- One file uses single commit; 2–10 distinct customer/week scopes use the existing atomic batch endpoint, never sequential singles. Editing a file/scope invalidates its token; late responses cannot restore it. Invalid/expired previews block submission. A rejected group retains its inputs for correction/retry.
- MRX groups admit only scopes without a reconciliation batch, with admission repeated under the transaction boundary. A scope with a batch uses the existing single-file role/approval/locked-day path; changing its persisted week tier is explicitly rejected before unchanged classification. No frozen source is repriced.
- Groups save drafts, never auto-publish. Single optional publication is a separate operation: accepted import plus failed publication is “Đã nhập, chưa công bố”, not a reason to recommit. Pending operations block exits. Group results allow choosing exactly one committed scope; closing without a choice preserves the inspected scope. DEFAULT/rollback callers retain refresh semantics.
- Persisted `MenuSchedule.MenuPrice` selects exact-tier, published, effective customer BOM before global BOM. Automated/provider checks do not certify rendered or real-data acceptance on an older running backend.

## MRX inspection and safe navigation

- Thực đơn tuần has three MRX-only leaves: Chuẩn bị lô đối soát (`view=mrx-batch`), Định lượng nguyên liệu (`view=mrx-materials`), Kế hoạch theo ca (`view=mrx-plans`). They retain customer/week, not import action, preview ticket or unrelated batchId. Direct URL/F5 read views require explicit customer/Monday; role/mode/source permission remain guarded. DEFAULT routes are unchanged.
- Authorized GET `api/reconciliation/batches/quantity-import/materials` and `/plans` consume menuVersionId and normal paged search coordinates. They reuse the canonical quantity snapshot/fingerprint and published-menu/completed-plan prerequisites, never allocate commit tickets or save anything. Materials aggregate required canonical quantity by ingredient+canonical-unit before search/count/page; contributor date/dish/source-unit/rate/servings remain separate. Plans page actual quantity-plan lines. Default50 rows, server clamp1–100, stable ordering. The existing POST preview/commit owns mutation admission unchanged.
- Read pages say Nguồn hiện hành · Dự kiến, not frozen evidence. Query identity includes customer/week/menuVersion/view/page/search; old-key responses cannot appear as new scope. Fingerprint revision clears selected detail and returns paging to the beginning. Missing source/prerequisites, read errors/403 and partial BOM diagnostics are not empty success. Known raw shifts and backend cooking labels display Sáng/Chiều; payload/export enums and historical facts do not change.
- Unsaved source values/reason register with the existing dirty-navigation owner; scope/sidebar/back/forward exits require confirmation, pending writes/reconciliation cannot be discarded. Discard resets local state only. Once an apply/submit is acknowledged, a failed authoritative reload blocks resending, preserves context and offers read-only Tải lại nguồn đã lưu; only successful reload clears the reconciliation requirement. This source contract is not evidence of acceptance on an older running server.

## Commands and production boundary

Production navigation/work is owned by actual shell and `/weekly-menu`. Gated planning candidates do not replace it. Current preview is the five-destination hybrid with independently capability-gated local Cost/BOM views; a proposed sidebar taxonomy or accepted drawing is not mounted cutover permission. Do not duplicate the same workspace set in sidebar and page tabs.

Workspace navigation remains available without customer/week, but scoped queries/writes fail closed. One prerequisite surface names/focuses the first missing coordinate: customer first if absent, otherwise real week input. Import/editor/publish/export retain their own explicit permission-gated commands; customer/week/menu/plan checkpoints are not an ambiguous command dropdown.

Daily demand reading never narrows weekly calculation command scope. `Tính nhu cầu tuần` / `Tính lại nhu cầu tuần` targets customer/week; current backend processes one serviceDate + customerId + FULLDAY per request and frontend orchestrates dates. Not atomic week persistence.
- Preflight uses weekly sources/per-date staleness, not only viewed-day completeness.
- Confirmation names week, updateable/read-only dates/reasons and pending serving inputs that existing handlers save/complete first.
- Results report each date's success/failure/unchanged/locked disposition; never claim full-week success for partial outcome or promise unsupported selective retry/rollback.
- Keep date/shift/customer/tier/ingredient/unit grain and physical/projected meaning; remaining-to-issue does not establish purchasing entitlement.

## Demand work-object and source ordering

Demand view reads one selected service day. Day selector, approval, handoff counters, warnings and document rails stay day-scoped. With generated material rows, display the 3 segmented workbench views: Material Demand, Source KHSX, and Handoff Vouchers via clean inline tabs without nested disclosures. Without rows/incomplete shifts, lead with shift editor and useful empty explanation, completion controls above source rows. Without rows/completed shifts, lead with compact calculate state and segmented source view. No universal ordering regardless of readiness.

Material requirements are read-only multi-actor facts; generic cross-role CTA columns do not invent warehouse/purchasing commands. Existing role workbenches own them. Document rail has one Day/Week scope; draft KHSX stays day-only, weekly lists finalized backend documents.

## Scoped sandbox query and interaction contract

Current preview behavior does not certify production cutover or global theme/accessibility:
- Scoped planning-demand-preview-tokens.css binds DESIGN targets without replacing global theme/portal calendar/confirmation interiors. Natural multiline labels grow; quantities stay right aligned/tabular/six-decimal. No arbitrary desktop minimum, clipped values, synthetic rows or fabricated page height; native zoom needs separate evidence.
- Existing StatusBadge owns approval label/tone beside day; query activity never replaces it. Pending/approved/rejected use existing semantic treatment; handoff is plain text with exact mapper label/actor hint, not a redundant badge. No color implies shortage or purchase eligibility. Required quantities are emphasized, physical progress remains precise/uncolored. Missing BOM/error/denial/locked/stale sources retain separate explicit reasons; no new business states are inferred.
- Search/handoff filters are **current fetched page only**, not server-wide search. Inputs respond immediately; nondefault filtering settles after shared 250ms debounce. Clear/day/page changes reset immediately and cannot replay queued old filter. Local filtering issues no request; server paging/query-key isolation remains owned separately.
- Uncached day/page transition may retain committed presentation only explicitly read-only and distinct from requested key. Source failure, denial/error or customer/week change clears it. Initial loading separate; never previous-key `.data` or fake geometry as requested data.
- Same-key refetch locks weekly calculation/serving writes, cancels confirmation and never reopens it automatically. Source/draft state keeps exact date/shift/dish and existing scheduleWorkflow.quickServingInputs/save/complete/permission/readiness owners. Disclosure/navigation does not implicitly query/save.
- Controls remain reachable and real focus/document scroll anchor preserved. Short page can clamp scroll to zero; do not manufacture space to keep pagination fixed. Week conditions have command-adjacent summary and separate full-width disclosure; bounded desktop scrolling/natural low-height flow does not prove every browser/version or zoom.
- One activity marker with accessible requested-target/committed-readonly announcement; reduced motion static. No changing redundant refresh prose or extra page-state line. Approval remains business truth.
- `PaginationBar.preserveFocusWhilePending` opt-in keeps available directions focusable with aria-disabled plus pointer/keyboard activation guard; boundary directions/page-size/jump and other consumers retain native disabled. Completion restores available focus; pending cannot request another page.

### Failure, denial and recovery

Preview recoverable refetch failure (network/timeout/HTTP5xx) may retain read-only content only when all three active-key `currentData` values exist. Mark stale/retry, keep generation/serving/confirmation unavailable. Any 401/403 or missing current-key source suppresses content; never use another day/page/customer/week `.data`. This opt-in does not change the legacy page error contract. Confirmation cancels on lost readiness and does not auto-reopen after retry.

Serving-query errors disclose retry and mark readiness unverified/danger; successful retry clears cached warnings. production.read denial is explicit 403, not “no plan” or active day filters. Authorized valid customer/week with no plans says “Chưa có kế hoạch sản xuất trong tuần đã chọn”, not reselect already-valid coordinates.

Confirmation has one DialogBody primary scroller with title/scope/actions outside. Busy guards veto closing/reentry; focus retargets from disabled child to enabled child/root and returns exact opener. Pending opener restoration must stop on deliberate navigation/focus, another modal, removal/disposal; bounded observer cleanup is not a readiness SLA. Existing nested-confirmation applicability remains OWNER_DECISION_REQUIRED under DESIGN, not authorization to add layers.

Quick-serving feedback uses existing InlineAlert severity/live role, replacement and scope reset. Failed save retains date/shift draft and existing blur/Enter/completion retry owner. Unsaved indicator alone is not failure feedback. Actual control mechanics/source hooks are implementation owners, not a new parallel workflow.

## Template Studio

Default fallback immutable; customer override/source/version explicit. Parsing/preview/diagnostic navigation never persists menu; save explicit, errors block, acknowledged warnings distinct. Diagnostics retain sheet/cell/range; A1 and drag ranges normalize identically with keyboard parity. Sketch widths/themes are not business authority.

## Gated planning candidates

`/__kit/planning/*` entries remain in the same frontend app with DEV/exact-preview-flag, ProtectedRoute, coordination.read, SystemOperationProvider and matching capability checks **before** queries. DEFAULT read-oriented dish-materials/cost/production-plan/purchase-summary entries do not replace production navigation or the schedule/demand candidates; MRX material-demand/meal-order owners are separate.

| Candidate | Truth and exclusions |
|---|---|
| Schedule | Four shift×variant matrices reuse import merge source cells/order |
| Demand | Page-flow projected/history/server suggestion fields additive; SuggestedPurchaseQty is not current stock/entitlement; sources attach to ingredient and commands reuse guards |
| Production | Persisted plans, PlanId/MenuVersion/lifecycle/date/shift/dish; sentToKitchenAt is fact, not a new send action or altered generic status |
| Cost | Existing costModel rounding; per-dish effective BOM × factor follows selected row; incomplete BOM/reference prices explicit |
| Dish materials | One dish/serving/effective gross BOM, reference prices, six decimals; CSV selected dish, no invented net/consumption |
| Handoff | Physical report family only, no analytical catalog/BOM reads; date/customer/tier/ingredient/unit, whole-filter server counters/search/page; metadata cannot invent document-source IDs |

ReadPlanningPreviewPage composes committed customer/week, schedule/contract tier and existing servings/BOM model without import/editor/mutation/hidden Demand queries. Active workspace mounts only its read family; active-key currentData, denial/error precedence and scope reset apply. Analytical BOM date remains active service date or first displayed day, not a new selector.

`Xuất BOM dự kiến` reuses unchanged buildWarehouseCsv projection from real customer code/week/committed rows/servings/effective BOM, never UNKNOWN/hardcoded date. LT/TT legacy columns are projections, not issue/receipt/consumption; disclose provenance and block missing/denied/invalid/no-material sources. It does not create durable handoff. Physical handoff CSV is **current page**, not full-week/BOM; successful physical empty never becomes analytical BOM.

usePurchaseSummary rejects previous-key data on uncached search/page/scope; permitted same-key ready refresh remains fail-closed on denial. This pending behavior is also used by legacy WeeklyMenuPage, not whole-legacy acceptance. Read-only handoff pager can retain same-scope/search navigation metadata—not rows/counters—during pending; search/scope/denial/error clears it and repeat activation remains guarded.

Shared CommandBar/inline ContextStrip/quiet TableViewport variants own scoped surfaces, not global theme adoption. Density stays OWNER_DECISION_REQUIRED. Production cutover requires mounted functional/accessibility/data/performance acceptance and explicit permission; unit/build/parser/screenshots alone do not certify it.
