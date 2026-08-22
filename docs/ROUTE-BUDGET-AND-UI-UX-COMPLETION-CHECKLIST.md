---
title: Route Budget and Project-wide UI/UX Completion Checklist
status: in-progress
owner: GSD
scope: frontend route performance, UI/UX evidence and acceptance
last_updated: 2026-08-22
---

# Route Budget và UI/UX — Checklist hoàn thành

## Quy tắc dừng

- Không đánh dấu `[x]` từ source review hoặc screenshot đơn lẻ.
- Mỗi mục phải có test, metric, DOM/runtime JSON hoặc artifact tái lập được.
- `NEEDS_EVIDENCE`, `UNRESOLVED`, `FAIL` và `GAP` không được coi là hoàn thành.
- Không đổi route-budget threshold, không dùng `manualChunks`, không tạo RTK Query API slice thứ hai.
- Giữ một `apiSlice`, reducer, middleware, endpoint names, cache identity và invalidation contract.
- Không ghi credential, token, connection string hoặc dữ liệu cá nhân vào artifact/log/docs.
- Chỉ kết thúc checklist khi toàn bộ mục bắt buộc đều `[x]`, full verification pass và worktree được kiểm tra.

## Evidence contract

Mỗi finding phải ghi đủ:

- Rule ID;
- route/tab/component owner thấp nhất;
- viewport và actor/permission;
- action source-line hoặc thao tác cụ thể;
- DOM geometry trước/sau;
- `scrollWidth/clientWidth`, wrapping, clipping và overflow;
- focus trước/sau, accessible name và keyboard path;
- request/response sau action nếu có query hoặc mutation;
- console/page/failed-request record;
- CLS/long-task/INP record khi liên quan;
- verdict: `PASS`, `FAIL`, `GAP`, `NEEDS_EVIDENCE`, `UNRESOLVED` hoặc `NOT_APPLICABLE`;
- artifact path và hash được đăng ký trong `docs/EVIDENCE-INDEX.md`.

## Gate 0 — Scope và baseline

- [x] Xác nhận branch, `git status --short --branch` và giữ nguyên thay đổi ngoài scope.
- [x] Đọc `AGENTS.md`, `MEMORY.md`, `docs/UI-UX-EXECUTION-HARNESS.md`, `docs/DASHBOARD-UI-RULES.md`.
- [x] Ghi clean-build route-budget baseline từ manifest mới; baseline nằm trong `.artifacts/route-budget-gate0-baseline.log`.
- [x] Xuất manifest closure từng route, phân loại entry/shared/route-only/API/CSS; baseline manifest được tạo bởi clean build hiện tại.
- [x] Source-owner inventory project-wide được count-lock từ production source, không đếm runtime instance: `14` route, `54` presentation owner, `50` table, `34` dialog, `7` switcher, `0` drawer, `64` action owner / `224` button action.
- [x] Chốt viewport matrix hiện hành: `1920×1080`, `1440×900`, `1366×768`, `1365×900`, `1280×900`.
- [x] Chốt actor/permission và runtime/DB lane từ `MEMORY.md`; không ghi password vào artifact.

## Gate 1 — Route-owned capability islands

### Boundary contract

- [x] Route shell/capability boundary được materialize bằng source hiện hành tại từng route owner; không tạo shell/API slice thứ hai.
- [x] Mỗi accepted capability có dynamic `load`, fallback ổn định và route/feature owner rõ ràng; error/data boundary vẫn ở owner hiện hành.
- [x] Capability chỉ lazy-load phần thực sự route-owned; shared `TableViewport` chỉ lazy-load control tùy chỉnh khi bảng opt-in preferences, không lazy hóa primitive bảng/query.
- [x] Preload chỉ chạy sau intent hoặc route policy đã đo; main shell không idle-preload toàn bộ route.
- [x] Endpoint được inject trước prefetch/query hook sử dụng endpoint đó; workflow API boundary giữ `0` runtime/type-only consumer ngoài contract.
- [x] Không có import vòng hoặc duplicate runtime/API trong manifest; dependency-cruiser `425 modules / 1601 dependencies / 0 violations`.

### Pilot: Coordination

- [x] Đo baseline route closure và asset closure của Coordination: `232.59 KiB`.
- [x] Tách capability route-owned: `ActionToolbar` và `OrderTable` lazy-load dưới Suspense; detail dialog vẫn do OrderTable ownership quản lý.
- [x] Giữ nguyên query args, endpoint names, cache tags và action eligibility; workflow API boundary vẫn `0` runtime consumer.
- [x] Regression Coordination: `6 files / 50 tests PASS`; build và lint PASS.
- [x] Headed browser test đủ 5 viewport cho protected-route overflow/action contract: `5/5 PASS`.
- [x] Route closure giảm thật: `232.59 → 227.28 KiB` (`-5.31 KiB`); không route nào khác tăng quá mức baseline đo được.
- [x] Clean route-budget verification PASS: Coordination `174.11 / 196.00 KiB` sau lazy `HeaderInfo` và direct leaf imports.

### Pilot: Approval

- [x] Đo baseline route closure và asset closure của Approval: `236.88 KiB`.
- [x] Tách capability route-owned có kiểm soát: `MenuAmendmentReconciliation` lazy-load dưới Suspense; queue/detail/history query panels vẫn synchronous để giữ state contract.
- [x] Giữ nguyên approval state, permission, mutation và invalidation behavior.
- [x] Regression Approval: `18/18 PASS`; full frontend sau pilot `157 files / 888 tests PASS`.
- [x] Headed browser protected-route/action matrix: `5/5 viewport PASS`; không overflow/action regression.
- [x] Route closure giảm thật: `236.88 → 235.68 KiB` (`-1.20 KiB`); shared common floor không tăng.
- [x] Clean route-budget verification PASS: Approval `193.34 / 202.00 KiB` sau lazy search field và controlled decision dialog.

### Rollout còn lại

- [x] Warehouse capability island PASS — demand/exceptions/receipt lifecycle/receipt dialogs/blocker lazy-load; route `255.71 / 257.00 KiB`, headed matrix `35/35`.
- [x] Admin Data capability island PASS — panel imports are gated by first activation and visited panels remain mounted; route `199.00 / 259.00 KiB`, state regression `6/6`, headed matrix `35/35`.
- [x] Dashboard capability island pass — shared TablePreferences seam đưa route về `190.50 / 199.00 KiB`.
- [x] Reports capability island PASS — filters, price, data-quality, service-run và legacy-lineage capabilities lazy-load; route `239.36 / 252.00 KiB`, permission/state regressions `19/19`.
- [x] Chef capability island PASS — shift/production/service-run/receipt/documents capabilities lazy-load; route `200.23 / 263.00 KiB`, focused `10/10`, headed `5/5`, full `157/888`.
- [x] Weekly Menu capability island PASS — readiness, import/editor dialogs and route-owned sections lazy-load; route `274.55 / 275.00 KiB`, focused weekly/report regressions `140/140`.
- [x] Purchasing capability island PASS — supplemental, quotation và workflow guide lazy-load; route `254.91 / 255.00 KiB`, focused/page regressions pass.
- [x] Approval Rules/Advanced Settings capability island pass — Approval Rules `238.83 / 241.00 KiB`; Advanced Settings vẫn route lazy riêng ngoài budget matrix.
- [x] Tất cả route đạt threshold hiện hành trong cùng một clean build; route-budget `10/10 PASS`, thresholds/accounting không đổi.

## Gate 2 — Controlled lazy confirmation seam

- [x] Xác định toàn bộ consumer của confirmation surface từ source inventory; project inventory hiện `54 owners / 34 dialogs`.
- [x] Tạo controlled lazy `ApprovalDecisionDialog` với overlay fallback và route-owned state.
- [x] Wrapper không thay đổi public mutation contract; Approval mutation regression `10/10 PASS`.
- [x] Dialog giữ production primitive với `role=dialog`, `aria-modal`, labelled content và portal.
- [x] Headed safe-dialog matrix xác nhận focus containment/return tại đủ 5 viewport.
- [x] Dedicated dialog regression khóa `Esc`, backdrop, nút giữ, `Enter` trên submit, loading veto, mutation error và retry.
- [x] Dirty rejection reason được giữ nguyên khi render mutation error; submit không chạy trước explicit confirmation.
- [x] Headed safe-dialog matrix `35/35` xác nhận focus containment/return, zero overflow và nền không đổi chiều rộng.
- [x] Lazy fallback là overlay đồng bộ trong render đầu; production headed matrix không ghi nhận blank document/escaped action.
- [x] `NOT_APPLICABLE` — decision detail nằm trong route-owned state, không có request chi tiết riêng cần fetch/cancel khi mở/đóng.
- [x] Consumer disposition: seam chỉ áp dụng Approval decision owner; confirmation consumer còn lại giữ primitive/contract cũ và source inventory, không migration máy móc.
- [x] Clean manifest tách `ApprovalDecisionDialog` thành dynamic asset route-owned; route không sử dụng không có static import tới owner này.

## Gate 3 — Project-wide UI/UX inventory

### Route/state matrix

- [ ] Dashboard: first-load/loading/ready/empty/error/refresh/action.
- [ ] Weekly Menu: toàn bộ tab, import, demand, production, purchasing, schedule.
- [ ] Coordination: order list, filter, detail, action, error, empty.
- [ ] Approval: queue, detail, decision dialog, mutation states.
- [ ] Purchasing: workflow, supplemental, quotation, service date, error/empty.
- [ ] Warehouse: stock, demand, receipt, exception, permission, long content.
- [ ] Chef: production, receipt, documents, excess material, action states.
- [ ] Reports: tất cả report tabs, filters, tables, detail/warning actions.
- [ ] Admin Data: BOM, contracts, cleanup, inventory, statistics, audit, employees.
- [ ] Approval Rules và Advanced Settings: list, form, confirmation, permission.
- [ ] Mỗi route/state được đo tại đủ 5 viewport hoặc có disposition `NEEDS_EVIDENCE`.

### Layout và interaction

- [ ] Không có overlap khi idle.
- [ ] Không có overlap sau filter, pagination, tab switch, refetch, modal open/close.
- [ ] Không có horizontal overflow ngoài vùng table được phép cuộn.
- [ ] Focus không bị sticky header/footer/table/action column che.
- [ ] Hover-only action có keyboard equivalent.
- [ ] Button/action tối thiểu 24×24 CSS px.
- [ ] Loading skeleton giữ nguyên geometry với ready state.
- [ ] Empty/error/permission state không bị đánh đồng.
- [ ] Refresh giữ dữ liệu cũ, không trắng màn hình và không reload document.
- [ ] Mutation không để response cũ ghi đè trạng thái mới.
- [ ] Tab ẩn, modal mở, input focus và multi-select đều pause refresh đúng contract.
- [ ] CLS sau thao tác `≤ 0.1` và mọi long task vượt ngưỡng có owner hoặc disposition.

## Gate 4 — Copy, vocabulary và semantic display

- [ ] Quét toàn bộ visible text và accessible name trên tất cả route/tab.
- [ ] Không còn enum/backend value/technical jargon lộ ra user surface.
- [ ] Label/action dùng thuật ngữ trong `docs/GLOSSARY.md`.
- [ ] Câu dài được rút gọn nhưng giữ nguyên nghĩa nghiệp vụ.
- [ ] Empty/error message trả lời: đây là gì, vì sao trống/lỗi, bước tiếp theo.
- [ ] Tên hiển thị đứng trước mã; mã kỹ thuật không đứng một mình.
- [ ] Số, tiền, phần trăm, ngày giờ dùng formatter tập trung và có đơn vị.
- [ ] Status dùng vocabulary và tone tập trung; không dùng màu là tín hiệu duy nhất.
- [ ] Accessible name không bị rút gọn đến mức mất nghĩa.
- [ ] Copy regression test khóa các nhãn đã sửa.
- [ ] Đã kiểm tra copy trong modal, table, tooltip, toast, error và mobile width.

## Gate 5 — Table và cột xử lý

- [ ] Inventory toàn bộ table owner, không đếm lặp runtime instance.
- [ ] Header căn cùng chiều với dữ liệu.
- [ ] Text căn trái; số định lượng căn phải; không căn giữa tùy tiện.
- [ ] Số dùng `tabular-nums`.
- [ ] Status cell có min-width/height ổn định và không wrap sai.
- [ ] Cột định danh giữ được tên trước mã.
- [ ] Cột xử lý có width theo action label dài nhất.
- [ ] Action label ngắn, mô tả động từ cụ thể và không bị cắt mất nghĩa.
- [ ] Khi thiếu chiều rộng, action dùng nhóm/overflow có keyboard path, không đè lên cột khác.
- [ ] Hover, focus, disabled, loading và success state của action đều được đo.
- [ ] Horizontal scroll giữ sticky header và cột định danh.
- [ ] Bảng dài dùng server pagination hoặc virtualization đúng contract.
- [ ] Filter chip, clear-all, result count và pagination không làm xê dịch layout bất ngờ.
- [ ] Bằng chứng DOM chứng minh không overlap ở nội dung ngắn và dài.

## Gate 6 — Browser evidence thật

- [ ] Dùng Chrome headed, persistent profile riêng do run tạo.
- [ ] Vào URL ứng dụng thật, không chỉ mở tab trắng hoặc kiểm tra API riêng.
- [ ] Mỗi run có run-id mới và manifest riêng.
- [ ] Sau mỗi navigation/DOM change lấy locator/snapshot mới.
- [ ] Lưu screenshot cuối run cho reviewer.
- [ ] Lưu DOM/geometry JSON authoritative.
- [ ] Lưu request sau action và response status.
- [ ] Lưu console/page error và failed request.
- [ ] Lưu focus/keyboard evidence cho modal, table action và tabs.
- [ ] Lưu CLS/long-task/performance record khi gate liên quan.
- [ ] Đọc toàn bộ JSON và đối chiếu với verdict trước khi báo cáo.
- [ ] Không dùng screenshot riêng làm oracle PASS/FAIL.
- [ ] Không teardown process không do run hiện tại tạo.
- [ ] Đăng ký hash artifact trong `docs/EVIDENCE-INDEX.md`.

## Gate 7 — Regression và closeout

- [x] Focused tests của từng changed seam pass; shared TableViewport/table contracts `15/15`, full frontend `157/888`.
- [x] Full frontend unit suite pass với worker phù hợp: `157 files / 888 tests PASS` với `--maxWorkers=4` sau Coordination pilot.
- [x] Frontend build pass sau Coordination pilot.
- [x] Frontend lint pass sau Coordination pilot.
- [x] Dependency-cruiser pass: `425 modules / 1601 dependencies / 0 violations`.
- [ ] Backend build/test pass nếu UI flow phụ thuộc contract backend.
- [x] Route-budget checker PASS `10/10` trên clean production build; thresholds và accounting không đổi.
- [x] UI measurement suite pass: headed matrix `35/35 PASS` sau shared TablePreferences seam.
- [x] `git diff --check` pass.
- [ ] Secret/stub scan pass.
- [ ] Không còn staged/untracked artifact ngoài scope.
- [ ] Cập nhật `MEMORY.md` chỉ với trạng thái hiện hành/gate hiện tại.
- [ ] Append việc đã đóng sang `HISTORY.md`.
- [ ] Cập nhật `docs/EVIDENCE-INDEX.md` cho artifact mới.
- [ ] Review final diff theo từng commit atomic.
- [ ] Xác nhận branch/remote/CI sau push.

## Definition of Done

Checklist chỉ được đóng khi:

- tất cả mục bắt buộc ở trên là `[x]`;
- không còn `FAIL`, `GAP`, `NEEDS_EVIDENCE` hoặc `UNRESOLVED` trong phạm vi đã tuyên bố;
- route-budget đạt threshold hiện hành;
- UI evidence đã được đọc từ DOM/runtime JSON, request, focus và performance record;
- full regression/build/lint/hygiene pass;
- evidence index, `MEMORY.md` và `HISTORY.md` đã đồng bộ;
- worktree clean và commit/remote status đã xác nhận.

## Trạng thái hiện tại

- [x] Quyết định kiến trúc: Route-owned capability islands + controlled lazy confirmation seam.
- [x] Quyết định UI/UX: evidence-first audit bằng DOM/runtime/interaction, không dùng screenshot đơn lẻ.
- [x] Gate 0 — baseline, clean manifest, viewport matrix và project-wide source-owner inventory hoàn tất.
- [x] Gate 1 — capability island implementation; clean build route-budget `10/10 PASS`.
- [x] Gate 2 — controlled lazy confirmation seam; keyboard/loading/error/dirty-state regressions và consumer disposition hoàn tất.
- [ ] Gate 3 — project-wide UI/UX inventory.
- [ ] Gate 4 — copy/vocabulary audit.
- [ ] Gate 5 — table/action-column audit.
- [ ] Gate 6 — headed browser evidence.
- [ ] Gate 7 — regression và closeout.
