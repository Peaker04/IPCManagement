---
title: IPCManagement UI/UX Philosophy and Application Rules
status: adopted-contract
scope: frontend
owner: IPCManagement
last_reviewed: 2026-08-12
---

# Triết lý UI/UX của IPCManagement

Đây là đầu mối rule dành cho người thiết kế, xây dựng hoặc review giao diện IPCManagement. Mục tiêu là
**thiết kế theo tác vụ và vai trò**: mục đích nghiệp vụ → actor/data scope → thao tác/chuyển trạng thái →
người nhận việc tiếp → composition → bằng chứng. Áp dụng cho tạo, sửa và loại bỏ UI, không chỉ styling.
Tài liệu định tuyến tới contract hiện hành, không phải visual audit hoặc chứng nhận component đã tuân thủ.

## 1. Nguồn sự thật và cách dùng

| Khi cần quyết định | Đọc trước | Kết quả cần giữ |
|---|---|---|
| Nguyên tắc UI/UX đầy đủ và mã rule | [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md) | Áp dụng `MUST`, `SHOULD`, `MAY`; ghi rule ID khi thay đổi |
| Design brief/Definition of Ready, actor–action matrix, floorplan và geometry | [`DESIGN.md`](DESIGN.md), §7 rồi §2–5 | Khóa mục đích, quyền/scope, flow/handoff, recovery và composition trước JSX |
| Component, token và pattern đang có | [`frontend/docs/ipc-design-tokens.md`](../frontend/docs/ipc-design-tokens.md) | Dùng primitive/token hiện có trước khi tạo class hoặc variant mới |
| Quyết định render đã được duyệt | [`UI-CONFORMANCE-MATRIX.md`](UI-CONFORMANCE-MATRIX.md) | Không tự thêm spacing, pixel, golden hoặc quota chưa có nguồn |
| State, action, permission và grain nghiệp vụ | [`DOMAIN.md`](DOMAIN.md), [`DATA-GRAIN-MATRIX.md`](DATA-GRAIN-MATRIX.md) | Không làm sai trạng thái, quyền hoặc mức chi tiết của dữ liệu |
| UI có dữ liệu đi qua FE–API–DB | [`UI-UX-FE-BE-DATABASE-STANDARDIZATION.md`](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md) | Giữ chuỗi control → API → DB → reload |
| Cách chứng minh UI đúng | [`UI-UX-MEASUREMENT-PROTOCOL.md`](UI-UX-MEASUREMENT-PROTOCOL.md) | Dùng test/DOM/API/focus/performance evidence, không kết luận từ screenshot đơn lẻ |
| Quy trình audit, sửa và handoff UI/UX | [`UI-UX-EXECUTION-HARNESS.md`](UI-UX-EXECUTION-HARNESS.md) | Phân loại task, sửa đúng owner, giữ evidence và resume session an toàn |

### 1.1. Đầu mối tra cứu rule cho tạo, sửa và xóa UI

“Gom rule” ở đây là **một đầu mối tra cứu, mỗi rule giữ một owner**, không chép toàn bộ contract vào một file.
Dùng bảng sau trước khi chọn component hoặc styling. Đây là inventory các yêu cầu đã có, không phải bộ rule mới.

| Câu hỏi cần trả lời | Nhóm rule / nguồn sở hữu | Nội dung cần đối chiếu |
|---|---|---|
| Màn hình/control tồn tại để làm gì? Hỗ trợ quyết định nào? | `P1`, `P2`, `P8`, `N1`, `N5`; [DOMAIN](DOMAIN.md); [chuẩn FE–BE–DB §4.2](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md) | Primary task, work object, thông tin cần để ra quyết định; không thêm field chỉ vì API có |
| Ai làm, ai xem, ai nhận việc tiếp theo? | [DOMAIN — vai trò, trạng thái và quyền](DOMAIN.md); [chuẩn FE–BE–DB §4.3, §5.3](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md) | Role/permission, scope dữ liệu, state hợp lệ, phân tách trách nhiệm; backend enforce cuối cùng |
| Mode có cho phép workflow này không? | [DESIGN §8.1](DESIGN.md); [contract MRX](domain/material-reconciliation.md) khi thuộc mode đó | Route/tab/query/action capability; không dùng luồng DEFAULT làm bước tiếp theo của MRX |
| Bấm rồi đi đâu, thay đổi gì, ai tiếp nhận? | `P2`, `L9`, `N2`–`N4`, `V7`; [chuẩn FE–BE–DB §3–4](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md) | Navigation hay mutation, object đích, transition, feedback, reload và next action đúng authority |
| Tạo/sửa/xóa có mất dữ liệu hoặc phá lịch sử không? | `P5`, `P7`, `M2.3`, `M2.9`, `E5`, `I8`; domain contract | Phân biệt bỏ UI với xóa record; phân biệt delete/cancel/deactivate/compensating action; không tự cấp quyền xóa hoặc undo |
| Một hàng/số đại diện cho điều gì? | [DATA-GRAIN-MATRIX](DATA-GRAIN-MATRIX.md); `L5`, `L6`, `T3` | Grain, đơn vị, kỳ dữ liệu, source-line, aggregate chỉ để trình bày; không double-count |
| Tên gọi và trạng thái có thống nhất giữa màn hình? | [GLOSSARY](GLOSSARY.md); `P3`, `L1`–`L12`, `S`; [conformance PF-01/PF-02](UI-CONFORMANCE-MATRIX.md) | Vocabulary, primary lifecycle, action set và thông tin bắt buộc theo cùng logical state |
| Bố cục và bề mặt tương tác nào phù hợp? | [DESIGN §2–7](DESIGN.md); `V1`–`V10`, `M1`, `D7`, `T12` | Floorplan, adjacency, geometry role, một state/một surface, một primary action, dialog/drawer/page |
| Dùng lại component/token nào? | [conformance PB-01..PB-18](UI-CONFORMANCE-MATRIX.md); `D1`–`D9`; [CSS entry](../frontend/src/styles/index.css) | Owner hiện hành trước page-local CSS; token reference phải được đối chiếu conformance và source |
| Loading/empty/error/forbidden và refetch khác nhau thế nào? | `E`, `F12`–`F24`, `C`, `I`; [DESIGN §8.2](DESIGN.md) | State honesty, stale-data, field errors, giữ draft/focus/scroll, concurrency và recovery |
| Bảng/form/keyboard/responsive có dùng được không? | `T`, `I`, `M2`, `A`, `V10`; [Front-End Checklist adapter](FRONT-END-CHECKLIST-INTEGRATION.md) | Semantics, labels, focus, target, contrast, overflow cục bộ và continuity; external corpus không tự mở scope |
| Chứng minh đúng bằng gì, ai giữ trạng thái công việc? | `Q`; [execution harness](UI-UX-EXECUTION-HARNESS.md); [measurement protocol](UI-UX-MEASUREMENT-PROTOCOL.md); [Lean delivery](harness/DELIVERY.md) | GSD là state owner; oracle theo claim, regression đúng seam; mutation nối FE → API → DB → reload |
| Gặp lỗi chưa có rule, làm sao không lặp lại? | `Q0`; [execution harness §4.1](UI-UX-EXECUTION-HARNESS.md) | Tự xác minh và bổ sung/mở rộng rule kỹ thuật cùng regression trong task; rule có rồi thì sửa enforcement, không nhân bản rule; quyết định nghiệp vụ/quyền mới phải hỏi owner |

Các mã `P/D/L/S/T/M/C/F/E/I/A/N/V/Q` trỏ về [bộ rule normative](DASHBOARD-UI-RULES.md).
Đọc đầy đủ mục sở hữu trước khi áp dụng; bảng này không thay nội dung hoặc mức `MUST/SHOULD/MAY` của nguồn.

### 1.2. Phân biệt nguồn hiện hành, lịch sử và điểm chưa thống nhất

- [PA state/action/permission audit](PA-STATE-ACTION-PERMISSION-AUDIT.md) là snapshot điều tra và đầu mối
  tới policy/registry, **không phải ma trận quyền hiện hành**. Không copy role/permission từ report cũ để cấp quyền.
- [UI conformance matrix](UI-CONFORMANCE-MATRIX.md) giữ các quyết định được duyệt trong phạm vi của nó;
  `UNRESOLVED` không cho phép agent tự đặt pixel, quota hoặc quyền mới. Kết quả PASS lịch sử không chứng minh HEAD mới.
- Table owner theo conformance `PB-08`: `TableViewport`/`PaginatedTableFrame`; `DataTableShell` đã retired.
  Không tạo lại component/API cũ từ ví dụ lịch sử.
- `C1/C10` phân biệt initial skeleton, refreshing và purposeful empty theo `V4`–`V6`; không diễn giải chống
  CLS thành permission giữ canvas trống, row giả hoặc page-size capacity.
- Decision table **permission/mode/prerequisite/validation/pending/stale** thuộc chuẩn FE–BE–DB §4.3.
  Không gom mọi nguyên nhân thành một boolean “disabled”; rule `I4` không cấp quyền submit mutation trái phép.
- Nếu hai nguồn vẫn đưa ra quyết định khác nhau cho cùng case, ghi rõ cả hai nguồn và phần bị chặn,
  xin owner decision trước implementation tại phần đó. Không sửa rule theo bug hoặc im lặng chọn nguồn tiện nhất.

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
- Mỗi route phải khóa floorplan theo [`DESIGN.md`](DESIGN.md): scope control không được trôi khỏi heading/content,
  async boundary bọc control phải compact, và prerequisite/empty chỉ có một explanatory surface.
- Khoảng trắng chỉ hợp lệ khi biểu đạt hierarchy hoặc giữ chỗ đúng kích thước content sắp xuất hiện. Panel trắng
  lớn do `min-height`, `flex-grow` hoặc boundary generic là defect, không phải “layout ổn định”.
- Progressive disclosure là mặc định: danh sách giữ các trường quyết định, chi tiết mở ở vùng giữ nguyên
  ngữ cảnh như drawer, row expansion hoặc trang riêng.

### 2.2. Trạng thái phải trung thực

- Tách rõ `uninitialized`, `loading`, `ready`, `refreshing`, `empty`, `forbidden` và `error`.
- Loading lần đầu dùng `QueryView`/`QueryViewBoundary`; refreshing giữ dữ liệu cũ và chỉ báo đang cập nhật.
- `403` không được biến thành danh sách rỗng; lỗi query không được biến thành số 0 hoặc bảng trống giả.
- Empty state phải nói vùng này là gì, vì sao đang trống và người dùng làm gì tiếp theo.
- Mọi mutation phải trả feedback thành công/thất bại; thao tác bị chặn phải nêu lý do có thể hiểu được.

### 2.3. Quyền và hành động

- Permission/data scope và mode quyết định actor có được truy cập workflow/dữ liệu/action hay không; state
  quyết định action còn hợp lệ. Phân biệt hidden, forbidden, disabled có lý do, validation và pending theo
  [decision table FE–BE–DB §4.3](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md); không ẩn business blocker như thiếu quyền.
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
- Overflow ngang cấp document phải bằng không. Bảng rộng cuộn trong `TableViewport`/`PaginatedTableFrame`, có
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
| Table geometry/overflow | `frontend/src/components/common/TableViewport.tsx`, `PaginatedTableFrame.tsx`, `PaginationBar.tsx` | Scroll cục bộ, pagination/cursor đúng owner, không tải toàn bộ collection |
| Status and feedback | `StatusBadge.tsx`, `InlineAlert.tsx`, `QueryErrorAlert.tsx`, `EmptyState.tsx` | Chọn primitive theo semantics; không tạo badge/alert page-local tương đương |
| Token và responsive | `frontend/src/styles/index.css`, [`ipc-design-tokens.md`](../frontend/docs/ipc-design-tokens.md) | Mở rộng token/primitive trước khi vá CSS tại một page |
| Verification | `frontend/tests`, `test-results/ui-audit-*.json`, `.artifacts/` | Test/DOM/API/focus/performance là bằng chứng; screenshot chỉ hỗ trợ review |

## 4. Áp dụng khi tạo, sửa hoặc loại bỏ UI

Quy trình execution chỉ có một owner: [UI-UX-EXECUTION-HARNESS](UI-UX-EXECUTION-HARNESS.md).
Các bước dưới là bản chỉ đường, không checklist/task state thứ hai.

1. Khóa brief, actor–action–transition matrix và walkthrough theo [DESIGN §7](DESIGN.md), áp dụng `P9`.
   Tự đọc nguồn đã có; chỉ hỏi quyết định chưa rõ. Với delta nhỏ, link contract không đổi thay vì viết lại brief.
2. Vẽ floorplan ngắn và gán geometry role cho từng async boundary theo [`DESIGN.md`](DESIGN.md); xác nhận
   one-state/one-surface và heading/control/content adjacency.
3. Tìm rule ID trong [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md) và owner thấp nhất trong bảng trên.
4. Kiểm tra primitive/token/formatter/query boundary hiện có; không tạo variant song song khi seam chung đã tồn tại.
5. Sửa ở tầng thấp nhất có thể: token → primitive → hook/formatter → layout → feature page.
6. Thêm hoặc cập nhật regression test tại seam gây lỗi. Phân loại mỗi kết quả là `PASS`, `FAIL`,
   `NOT_APPLICABLE`, `NEEDS_EVIDENCE` hoặc `UNRESOLVED`.
7. Với UI read-only, chạy gate DOM/source/focus và composition geometry phù hợp. Với mutation hoặc dữ liệu
   nghiệp vụ, chứng minh thêm control → API → DB → rendered reload.
8. Chạy `git diff --check`, secret/stub scan và cập nhật tài liệu liên quan trong cùng thay đổi. Finding chưa có
   rule hoặc tái diễn bắt buộc qua `Q0` và vòng phản hồi execution harness §4.1; không chỉ lưu bài học trong chat.

## 5. Thứ tự ưu tiên khi có xung đột

**An toàn dữ liệu → Accessibility → Ổn định layout → Hiệu năng → Nhất quán thị giác → Thẩm mỹ.**

Một ngoại lệ cần được ghi rõ lý do, phạm vi, owner và cách kiểm chứng; “màn hình này đặc biệt” không đủ để
phá contract.
