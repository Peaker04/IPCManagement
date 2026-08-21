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
- [ ] Xuất source-owner inventory cho toàn bộ route, tab, table, dialog, drawer và action surface. Hiện mới có inventory test-owned (`15/15` focused pass), chưa đủ project-wide owner closure.
- [x] Chốt viewport matrix hiện hành: `1920×1080`, `1440×900`, `1366×768`, `1365×900`, `1280×900`.
- [x] Chốt actor/permission và runtime/DB lane từ `MEMORY.md`; không ghi password vào artifact.

## Gate 1 — Route-owned capability islands

### Boundary contract

- [ ] Định nghĩa route shell/capability boundary bằng source hiện hành.
- [ ] Mỗi capability có `load`, fallback, error boundary và owner rõ ràng.
- [ ] Capability chỉ lazy-load phần thực sự route-owned; không lazy hóa primitive nhỏ máy móc.
- [ ] Preload chỉ chạy sau intent hoặc theo route policy đã đo.
- [ ] Endpoint được inject trước prefetch/query hook sử dụng endpoint đó.
- [ ] Không có import vòng hoặc duplicate runtime/API trong manifest.

### Pilot: Coordination

- [ ] Đo baseline route closure và asset closure của Coordination.
- [ ] Tách các capability đủ điều kiện: order table, detail dialog, action/exception surface.
- [ ] Giữ nguyên query args, endpoint names, cache tags và action eligibility.
- [ ] Regression test loading/empty/error/permission/refetch/action.
- [ ] Headed browser test đủ 5 viewport, tab, filter, pagination, detail và keyboard path.
- [ ] Route closure sau sửa giảm thật và không làm route khác tăng ngoài ngưỡng chấp nhận.
- [ ] Clean build, lint, dependency-cruiser và route-budget verification pass.

### Pilot: Approval

- [ ] Đo baseline route closure và asset closure của Approval.
- [ ] Tách queue/detail/history capability theo owner thực tế.
- [ ] Giữ nguyên approval state, permission, mutation và invalidation behavior.
- [ ] Regression test action eligibility, mutation loading/success/error và retry.
- [ ] Headed browser test đủ 5 viewport, queue, detail, dialog, keyboard và focus return.
- [ ] Route closure sau sửa giảm thật và không làm shared chunk tăng ngược.
- [ ] Clean build, lint, dependency-cruiser và route-budget verification pass.

### Rollout còn lại

- [ ] Warehouse capability island pass.
- [ ] Admin Data capability island pass.
- [ ] Dashboard capability island pass.
- [ ] Reports capability island pass.
- [ ] Chef capability island pass.
- [ ] Weekly Menu capability island pass.
- [ ] Purchasing capability island pass.
- [ ] Approval Rules/Advanced Settings capability island pass.
- [ ] Tất cả route đạt threshold hiện hành trong cùng một clean build.

## Gate 2 — Controlled lazy confirmation seam

- [ ] Xác định toàn bộ consumer của confirmation surface từ source inventory.
- [ ] Tạo một wrapper lazy có fallback geometry ổn định.
- [ ] Wrapper không thay đổi public mutation contract.
- [ ] Dialog có `role=dialog`, `aria-modal`, `aria-labelledby`, portal và một instance cấp trang.
- [ ] Có focus trap và focus restoration về trigger.
- [ ] Kiểm tra `Esc`, backdrop, nút đóng, `Enter`, loading và lỗi mutation.
- [ ] Kiểm tra form dirty không đóng nhầm và không mất dữ liệu.
- [ ] Kiểm tra nền không bị layout shift, scrollbar không làm đổi chiều rộng.
- [ ] Khung skeleton đầu tiên dưới 100ms trong production build.
- [ ] Dữ liệu chi tiết chỉ fetch khi mở; request bị hủy khi đóng nếu còn bay.
- [ ] Tất cả consumer cũ có regression hoặc được disposition rõ ràng.
- [ ] Clean manifest chứng minh dialog runtime được loại khỏi route không sử dụng.

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

- [ ] Focused tests của từng changed seam pass.
- [ ] Full frontend unit suite pass với worker phù hợp.
- [ ] Frontend build pass.
- [ ] Frontend lint pass.
- [ ] Dependency-cruiser pass.
- [ ] Backend build/test pass nếu UI flow phụ thuộc contract backend.
- [ ] Route-budget checker pass trên clean build.
- [ ] UI measurement suite pass hoặc mọi ngoại lệ có verdict rõ ràng.
- [ ] `git diff --check` pass.
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
- [ ] Gate 0 — baseline mới cho checklist này (đã hoàn tất build/manifest/viewport; còn thiếu source-owner inventory project-wide).
- [ ] Gate 1 — capability island implementation.
- [ ] Gate 2 — controlled lazy confirmation seam.
- [ ] Gate 3 — project-wide UI/UX inventory.
- [ ] Gate 4 — copy/vocabulary audit.
- [ ] Gate 5 — table/action-column audit.
- [ ] Gate 6 — headed browser evidence.
- [ ] Gate 7 — regression và closeout.
