---
title: IPCManagement UI/UX Philosophy and Application Rules
status: adopted-contract
scope: frontend
owner: IPCManagement
last_reviewed: 2026-08-12
---

# Triết lý UI/UX của IPCManagement

Đây là điểm vào dành cho người xây dựng hoặc review giao diện IPCManagement. Tài liệu này tổng hợp
những nguyên tắc đã được đưa vào kiến trúc và component hiện tại; không phải một visual audit riêng lẻ
và không thay thế bộ rule chi tiết.

## 1. Nguồn sự thật và cách dùng

| Khi cần quyết định | Đọc trước | Kết quả cần giữ |
|---|---|---|
| Nguyên tắc UI/UX đầy đủ và mã rule | [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md) | Áp dụng `MUST`, `SHOULD`, `MAY`; ghi rule ID khi thay đổi |
| Component, token và pattern đang có | [`frontend/docs/ipc-design-tokens.md`](../frontend/docs/ipc-design-tokens.md) | Dùng primitive/token hiện có trước khi tạo class hoặc variant mới |
| Quyết định render đã được duyệt | [`UI-CONFORMANCE-MATRIX.md`](UI-CONFORMANCE-MATRIX.md) | Không tự thêm spacing, pixel, golden hoặc quota chưa có nguồn |
| State, action, permission và grain nghiệp vụ | [`DOMAIN.md`](DOMAIN.md), [`DATA-GRAIN-MATRIX.md`](DATA-GRAIN-MATRIX.md) | Không làm sai trạng thái, quyền hoặc mức chi tiết của dữ liệu |
| UI có dữ liệu đi qua FE–API–DB | [`UI-UX-FE-BE-DATABASE-STANDARDIZATION.md`](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md) | Giữ chuỗi control → API → DB → reload |
| Cách chứng minh UI đúng | [`UI-UX-MEASUREMENT-PROTOCOL.md`](UI-UX-MEASUREMENT-PROTOCOL.md) | Dùng test/DOM/API/focus/performance evidence, không kết luận từ screenshot đơn lẻ |
| Quy trình audit, sửa và handoff UI/UX | [`UI-UX-EXECUTION-HARNESS.md`](UI-UX-EXECUTION-HARNESS.md) | Phân loại task, sửa đúng owner, giữ evidence và resume session an toàn |

`docs/ui-audit-kit/` là nguồn tham khảo đã được chuẩn hóa; không phải nơi chứa config, route, viewport
hay gate riêng của IPCManagement.

### Trạng thái của contract

`adopted-contract` nghĩa là các rule là chuẩn bắt buộc khi tạo hoặc sửa UI. Nó không có nghĩa mọi route
đã được chứng minh tuân thủ mọi rule. Mức tuân thủ của từng concept phải lấy từ source, test và evidence
hiện hành; nếu chưa có bằng chứng thì ghi `NEEDS_EVIDENCE` hoặc `UNRESOLVED`, không tự suy diễn thành `PASS`.

## 2. Nguyên tắc thiết kế cốt lõi

### 2.1. Thiết kế theo công việc vận hành

- Mỗi màn hình phải làm rõ **work object**, phạm vi đang xem, trạng thái hiện tại, người chịu trách nhiệm
  và hành động kế tiếp.
- Điều hướng nhóm theo công việc người dùng, không phơi cấu trúc bảng hoặc tên module backend.
- Dùng `OperationalFrame`, `ViewSwitcher`, `CommandBar`, `ContextStrip` và `SectionPanel` theo đúng vai trò;
  không dựng thêm shell song song cho cùng một loại màn hình.
- Progressive disclosure là mặc định: danh sách giữ các trường quyết định, chi tiết mở ở vùng giữ nguyên
  ngữ cảnh như drawer, row expansion hoặc trang riêng.

### 2.2. Trạng thái phải trung thực

- Tách rõ `uninitialized`, `loading`, `ready`, `refreshing`, `empty`, `forbidden` và `error`.
- Loading lần đầu dùng `QueryView`/`QueryViewBoundary`; refreshing giữ dữ liệu cũ và chỉ báo đang cập nhật.
- `403` không được biến thành danh sách rỗng; lỗi query không được biến thành số 0 hoặc bảng trống giả.
- Empty state phải nói vùng này là gì, vì sao đang trống và người dùng làm gì tiếp theo.
- Mọi mutation phải trả feedback thành công/thất bại; thao tác bị chặn phải nêu lý do có thể hiểu được.

### 2.3. Quyền và hành động

- Control chỉ hiện khi permission và state cho phép; nếu bị ẩn hoặc disabled, UI phải giữ được lý do trong
  ngữ cảnh phù hợp.
- Backend vẫn là nơi enforce cuối cùng. Không coi việc ẩn nút ở FE là authorization.
- Một vùng ngữ cảnh chỉ có một primary action. Nhãn nút phải mô tả hành động cụ thể, không dùng `OK` hoặc
  thuật ngữ kỹ thuật nếu người dùng không cần biết.
- Mutation có tác động nghiệp vụ phải nối được từ control tới request, transition dữ liệu và trạng thái sau reload.

### 2.4. Dữ liệu hiển thị cho con người

- Tên dễ đọc đứng trước; mã kỹ thuật là thông tin phụ và không được là nhãn chính duy nhất.
- Enum, status, số lượng, tiền, phần trăm, ngày giờ và đơn vị đi qua registry/formatter dùng chung.
- Không render UUID, enum thô, tên bảng, tên cột hoặc stack trace cho người dùng cuối.
- Mỗi số phải có đơn vị và giữ đúng grain: ngày/ca, tuần, snapshot, source-line và movement không được gộp
  chỉ để làm bảng nhìn “đẹp” hơn.
- Status dùng chữ và tone semantic; màu không được là kênh thông tin duy nhất.

### 2.5. Layout vận hành và responsive

- Shell, header, tab strip và vùng ngữ cảnh phải ổn định khi fetch/refetch; không để thông báo động chèn vào
  flow làm layout nhảy.
- Overflow ngang cấp document phải bằng không. Bảng rộng cuộn trong `DataTableShell`/`TableViewport`, có
  owner rõ ràng; không dùng `overflow-x: hidden` để che lỗi.
- Control, tab, badge và nhãn tiếng Việt phải wrap hoặc co trong surface của chúng; không cắt mất hành động
  bắt buộc.
- Dùng token trong `frontend/src/styles/index.css`; tránh màu, spacing, typography và shadow hardcode ở
  component.
- UI vận hành ưu tiên mật độ đọc, độ tương phản và phát hiện bất thường; không biến dashboard thành landing page.

### 2.6. Accessibility và interaction

- Mọi control phải có accessible name; icon-only control có `aria-label` hoặc nhãn kề bên.
- Focus phải nhìn thấy, thứ tự tab phải hợp lý, action chỉ xuất hiện khi hover vẫn phải dùng được bằng keyboard.
- Dialog có tên, `aria-modal`, focus containment, focus return và portal; form lỗi đặt cạnh field với liên kết
  `aria-describedby`/`aria-invalid` phù hợp.
- Không dùng màu đơn độc để biểu thị trạng thái; không bỏ outline nếu chưa thay bằng focus ring tương đương.
- Motion chỉ là feedback ngắn và phải tôn trọng `prefers-reduced-motion`.

## 3. Ánh xạ nguyên tắc vào codebase

| Concern | Owner hiện tại | Quy tắc áp dụng |
|---|---|---|
| Query state | `frontend/src/lib/queryView.ts`, `frontend/src/components/common/QueryViewBoundary.tsx` | Không tự tạo state algebra hoặc boundary riêng nếu seam chung đã đủ |
| Status/permission action | `frontend/src/lib/statusPresentation.ts`, `frontend/src/lib/workflowConfig.ts`, `frontend/src/lib/actionEligibility.ts` | Không map enum hoặc eligibility rải rác trong page |
| Số, tiền, ngày, đơn vị | `frontend/src/lib/formatters.ts` | Không dùng local `toFixed`/locale helper cho presentation |
| Route shell/work object | `frontend/src/components/common/OperationalFrame.tsx`, `ViewSwitcher.tsx`, `CommandBar.tsx` | Giữ một shell canon; tab chỉ xuất hiện khi có work-object alternatives |
| Table geometry/overflow | `frontend/src/components/common/DataTableShell.tsx`, `TableViewport.tsx`, `PaginationBar.tsx` | Scroll cục bộ, pagination/cursor đúng owner, không tải toàn bộ collection |
| Status and feedback | `StatusBadge.tsx`, `InlineAlert.tsx`, `QueryErrorAlert.tsx`, `EmptyState.tsx` | Chọn primitive theo semantics; không tạo badge/alert page-local tương đương |
| Token và responsive | `frontend/src/styles/index.css`, [`ipc-design-tokens.md`](../frontend/docs/ipc-design-tokens.md) | Mở rộng token/primitive trước khi vá CSS tại một page |
| Verification | `frontend/tests`, `test-results/ui-audit-*.json`, `.artifacts/` | Test/DOM/API/focus/performance là bằng chứng; screenshot chỉ hỗ trợ review |

## 4. Quy trình khi thêm hoặc sửa UI

1. Xác định work object, grain, state, permission và mutation boundary trước khi viết JSX.
2. Tìm rule ID trong [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md) và owner thấp nhất trong bảng trên.
3. Kiểm tra primitive/token/formatter/query boundary hiện có; không tạo variant song song khi seam chung đã tồn tại.
4. Sửa ở tầng thấp nhất có thể: token → primitive → hook/formatter → layout → feature page.
5. Thêm hoặc cập nhật regression test tại seam gây lỗi. Phân loại mỗi kết quả là `PASS`, `FAIL`,
   `NOT_APPLICABLE`, `NEEDS_EVIDENCE` hoặc `UNRESOLVED`.
6. Với UI read-only, chạy gate DOM/source/focus phù hợp. Với mutation hoặc dữ liệu nghiệp vụ, chứng minh
   thêm control → API → DB → rendered reload.
7. Chạy `git diff --check`, secret/stub scan và cập nhật tài liệu liên quan trong cùng thay đổi.

## 5. Thứ tự ưu tiên khi có xung đột

**An toàn dữ liệu → Accessibility → Ổn định layout → Hiệu năng → Nhất quán thị giác → Thẩm mỹ.**

Một ngoại lệ cần được ghi rõ lý do, phạm vi, owner và cách kiểm chứng; “màn hình này đặc biệt” không đủ để
phá contract.
