# Design — Canonical Presentation Contract & UI Rules Matrix

Read only the relevant section, then actual source/primitives and rendered tests. [DOMAIN](DOMAIN.md) owns language/status/grain; bounded contracts own feature permissions/readiness. [ENGINEERING](ENGINEERING.md) owns browser/performance verification. This owner defines presentation grammar and stable rule IDs, not task state, specimen history or runtime certification.

## 1. Authority, Principles & Scoped Pre-Code Gate

- **Priority Hierarchy**: Data safety → Accessibility → Layout stability → Performance → Visual consistency → Aesthetics.
- **Quiet Operational Philosophy**: Flat cool-slate surfaces, hairline boundaries, precise food-service logistics. Semantic role tokens distinguish primary navy from informational blue and critical warning/danger. Routine states stay quiet neutral.
- **Decision Resolution — Density (T8 CLOSED & LOCKED)**:
  - System-wide default is **Operational Compact Density** (data row height `36px–40px`, inline edit row `44px`, `<Num>` with `tabular-nums` mandatory).
  - Density customization via `TablePreferencesControl` must map strictly to CSS tokens, never breaking `T7` (sticky header/frozen column) or `D6` (minimum `12px` font size).
- **Scoped Pre-Code Design Gate**:
  Before modifying any `.tsx` or `.css`, the author must declare in `.planning/WORK.md`:
  1. Route & single primary work object (`OperationalFrame` or `SplitWorkbench`).
  2. Server Mode: `DEFAULT` vs `MATERIAL_RECONCILIATION` (`DOM-MODE-1`).
  3. RBAC Guards: Route, Navigation, and Action levels (`RoleGuard`, `ActionGuard`, `ActionAvailability`).
  4. 6 Mandatory UI States: `loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`.
  5. UI Primitives (`components/ui/*`) & Composites (`components/common/*`) used.
  6. Compliance pledges: `D6` (>=12px), `D7` (1 primary), `T7` (frozen header/col), `T8` (compact density), `M1.2` (1 blocking modal), `N6` (nested sidebar v2).

---

## 2. User Experience Requirements (UXR)

| Requirement ID | Title | Canonical Specification (MUST) | Prohibited Anti-Pattern (NEVER) |
|---|---|---|---|
| `UXR-01` | Single Primary Work Object | Mỗi route chỉ sở hữu đúng 1 Primary Work Object (`OperationalFrame` hoặc `SplitWorkbench`). Toàn bộ toolbar, telemetry strip, và workspace nằm trong 1 cây layout duy nhất. | Không lồng ghép nhiều khung làm việc cạnh tranh; cấm đặt 2 table container độc lập ở cấp trang mà không qua SplitWorkbench. |
| `UXR-02` | Transparent Blocker Evidence | Khi một thao tác bị chặn (chưa đến lượt, thiếu điều kiện, sai vai trò), hệ thống phải hiển thị lý do rõ ràng qua `ServiceRunBlockerPanel` hoặc `ActionAvailability` tooltip. | Cấm để nút bấm bị disabled câm lặng (silent disabled) mà không giải thích nguyên nhân hoặc cách khắc phục. |
| `UXR-03` | Dirty Draft Protection | Khi người dùng đã nhập liệu hoặc thay đổi trạng thái lưới chưa lưu, việc rời trang, đổi tab `?view=`, hoặc đóng overlay phải kích hoạt cảnh báo mất dữ liệu. | Cấm hủy bỏ form hoặc dữ liệu đang soạn thảo một cách âm thầm khi người dùng bấm nhầm tab hoặc backdrop. |
| `UXR-04` | Vietnamese Domain Microcopy | 100% nhãn giao diện, trạng thái, tiêu đề cột phải dùng tiếng Việt chuyên ngành chuẩn hóa theo `DOM-LANG-1` (Thực đơn, KHSX, Phiếu xuất, Đối soát, v.v.). | Không hiển thị mã enum tiếng Anh, thuật ngữ kỹ thuật (UUID, Raw ID, null), hoặc văn phong tự do của lập trình viên. |
| `UXR-05` | Destructive & Terminal Guards | Các thao tác xóa, từ chối phê duyệt, hoặc chuyển trạng thái sang chốt sổ bất biến (`Approved`, `Posted`, `Locked`) bắt buộc phải xác nhận qua `ConfirmDialog`. | Cấm thực hiện các thao tác phá hủy hoặc chốt sổ bất biến chỉ với 1 click chuột trực tiếp mà không có bước xác nhận an toàn. |

---

## 3. UI Non-Functional Requirements (NFR-UI)

| Requirement ID | Title | Canonical Specification (MUST) | Prohibited Anti-Pattern (NEVER) |
|---|---|---|---|
| `NFR-UI-01` | Table Scalability & Viewport | Các bảng dữ liệu vượt quá 50 dòng bắt buộc phải bọc trong `TableViewport` (`T7`) kết hợp với phân trang server (`PaginationBar` hoặc `CursorPaginationBar`). | Cấm render toàn bộ tập dữ liệu hàng nghìn dòng vào DOM gây lag giật hoặc tràn màn hình ngang không có thanh cuộn cố định. |
| `NFR-UI-02` | Triple-Layer RBAC Defense | Kiểm soát phân quyền 3 lớp: (1) Route (`ProtectedRoute`/`RoleGuard`), (2) Navigation (`routeRegistry` visibility), (3) Action (`ActionGuard`/`ActionAvailability`). | Cấm chỉ ẩn nút bấm trên giao diện mà không có guard ở component và xác thực quyền ở backend API. |
| `NFR-UI-03` | Strict Formatting Primitives | 100% trường ngày tháng dùng `VietnameseDateInput` (`dd/MM/yyyy`), số lượng/tiền tệ dùng `<Num>`, mã định danh/code dùng `<IdentifierText>`. | Cấm hiển thị định dạng ngày ISO (`yyyy-MM-dd`), số trần không có đơn vị/phẩy ngăn cách, hoặc mã dài không thể sao chép. |
| `NFR-UI-04` | Accessibility WCAG 2.2 AA | Đạt tỷ lệ tương phản văn bản >= 4.5:1, nút điều khiển >= 3:1; hỗ trợ đầy đủ phím Tab/Enter/Esc; vượt qua 100% bộ `*.contract.test.tsx`. | Cấm chỉ dùng màu sắc để biểu thị trạng thái (color-only indicator); cấm outline: none trên các phần tử tương tác đang nhận focus. |
| `NFR-UI-05` | Motion & Micro-Interactions | Mọi hiệu ứng chuyển động thời gian <= 150ms; tôn trọng cấu hình hệ thống `prefers-reduced-motion`; không gây giật dịch chuyển bố cục (CLS <= 0.1). | Cấm các hiệu ứng hoạt họa kéo dài, loading spinner toàn trang không cần thiết, hoặc layout shifting khi dữ liệu bất đồng bộ trả về. |

---

## 4. Foundations, Typography & Color Rules Matrix

| Rule ID | Category | Canonical Specification (MUST) | Prohibited Anti-Pattern (NEVER) |
|---|---|---|---|
| `D1` | Design System | Toàn bộ giao diện sử dụng thống nhất hệ thống token từ `frontend/src/styles/index.css`. | Không tạo token hoặc CSS cục bộ bên ngoài `index.css`; cấm dùng redesign tokens đã deprecated. |
| `D2` | Token Layers | Kiến trúc token 3 tầng: Primitive (slate ramp) → Semantic (`--ipc-primary`, `--ipc-color-surface`) → Component. | Không tham chiếu trực tiếp mã hex hoặc giá trị raw bên trong style inline hoặc component TSX. |
| `D3` | Semantic Naming | Tên token phản ánh mục đích sử dụng ngữ nghĩa (vd: `--ipc-color-border-subtle`, `--ipc-danger-soft`). | Không đặt tên token theo màu sắc vật lý tùy tiện (vd: `--blue-sky`, `--red-dark`). |
| `D4` | Color Linting | Mọi giá trị màu sắc phải xuất phát từ CSS variables chuẩn và vượt qua bộ kiểm tra lint. | Không sử dụng hardcoded `#hex`, `rgb()`, `hsl()` trong component CSS/TSX. |
| `D5` | Functional Color | Màu sắc mang tính chất cảnh báo và chỉ thị trạng thái nghiệp vụ; diện mạo chung giữ tông trung tính mát (cool-slate). | Không dùng màu sắc sặc sỡ để trang trí landing-page trong môi trường vận hành công nghiệp. |
| `D6` | Typography Scale | Cỡ chữ dữ liệu bảng tối thiểu `12px`; phân cấp tiêu đề chặt chẽ `18px / 16px / 14px`; font Inter Variable hỗ trợ đầy đủ dấu tiếng Việt. | Cấm cỡ chữ <12px gây mất khả năng đọc; cấm `line-height: 1.0` làm cụt dấu tiếng Việt (mũ, móc, thanh điệu). |
| `D7` | Action Hierarchy | Mỗi ngữ cảnh/vùng làm việc chỉ có duy nhất 1 Primary Action button; các hành động khác là Secondary/Outline/Ghost. | Cấm đặt 2 nút Primary cạnh nhau gây phân vân thao tác cho người vận hành. |
| `D8` | Neutral Baseline | Bề mặt nền và thẻ mặc định giữ màu trung tính slate-50/100, viền hairline 1px slate-200. | Cấm đổ bóng đậm (heavy box-shadow) hoặc bo góc hình viên thuốc (pill) trên bảng dữ liệu. |
| `D9` | Icon Grammar | 100% icons dùng bộ Lucide chuẩn hóa stroke 2px, viewBox 24px, kích thước 16px (control) / 18-20px (navigation). | Không import icon PNG/SVG từ bên ngoài (Flaticon); cấm biến dạng tỉ lệ icon. |
| `P1–P3` | Core UX | Ngôn từ tiếng Việt nghiệp vụ chuẩn; hiển thị sự thật hệ thống minh bạch; ý nghĩa nhãn nhất quán. | Không dùng thuật ngữ lập trình thay thế tên chứng từ; không đánh đố người vận hành. |
| `P4–P7` | Interaction | Hiển thị danh sách phân cấp tiến trình; cung cấp lối thoát an toàn và xác nhận thao tác; chặn trước dữ liệu không hợp lệ. | Cấm form không bắt lỗi trước khi submit; cấm thao tác không thể quay lui mà không có cảnh báo. |
| `P8–P9` | Readiness | Nhanh chóng làm nổi bật điểm nghẽn và hành động tiếp theo; lập hồ sơ thiết kế Pre-Code Gate trước khi code. | Cấm sửa code giao diện tùy tiện khi chưa xác định 6 trạng thái và primary work object. |
| `L1–L3` | Labels & Codes | Tên dễ đọc hiển thị trước, mã chứng từ hiển thị phụ kèm chức năng sao chép; ẩn UUID/hash mặc định. | Cấm hiển thị chuỗi định danh dài ngoằng làm tiêu đề chính của hàng bảng. |
| `L4–L6` | Enums & Numbers | Enum tập trung tại từ điển; số lượng đi liền đơn vị tính; toàn bộ số dùng font `tabular-nums` căn phải. | Cấm số lượng trần không đơn vị; cấm số liệu bị xô lệch cột khi thay đổi giá trị. |
| `L7–L12` | Localization | Cung cấp nút copy mã; vòng đời thể hiện bước tiếp theo; múi giờ chuẩn `Asia/Ho_Chi_Minh`. | Cấm hiển thị thời gian UTC thuần không qua bộ định dạng ngày giờ Việt Nam. |
| `S0–S2` | Status Badges | Phân biệt rõ: Badge đếm số, Lozenge trạng thái, Tag phân loại; tối đa 2 badge/hàng; tuân thủ bảng màu DOMAIN. | Cấm dùng badge làm nút điều hướng; cấm hiển thị hàng loạt 4–5 badge màu sắc trên một dòng. |

---

## 5. Table & Data Grid Rules Matrix

| Rule ID | Category | Canonical Specification (MUST) | Prohibited Anti-Pattern (NEVER) |
|---|---|---|---|
| `T1` | Alignment | Số lượng, tiền tệ, tỷ lệ %, số đếm BẮT BUỘC căn phải và dùng `<Num>`; văn bản căn trái; ngày/trạng thái có thể căn giữa nếu có quy định. | Cấm căn trái số liệu tài chính/định mức làm sai lệch trực quan khi so sánh độ lớn. |
| `T2` | Header Sync | Tiêu đề cột (`<th>`) phải có căn lề đồng bộ tuyệt đối với ô dữ liệu (`<td>`) bên dưới. | Cấm tiêu đề cột căn giữa trong khi số liệu bên dưới căn phải. |
| `T3` | Tabular Figures | Mọi ký tự số thay đổi linh hoạt phải kích hoạt tính năng font `tabular-nums` để bề ngang chữ số đồng đều. | Cấm dùng font số tỷ lệ (proportional digits) làm giật layout cột khi cập nhật dữ liệu. |
| `T4` | Header Units | Đơn vị tính chung (vd: `(kg)`, `(VNĐ)`, `(suất)`) phải đặt ngay trên tiêu đề cột thay vì lặp lại trên từng dòng. | Cấm nối chuỗi đơn vị vào từng ô số liệu làm mất khả năng căn phải số học. |
| `T5` | Row Separator | Sử dụng đường viền phân tách hàng tinh tế 1px (`--ipc-color-border-subtle`), không dùng viền dọc kẻ ô đậm. | Cấm kẻ lưới ca-rô đậm đặc (heavy grid) gây rối mắt trong danh sách dữ liệu dài. |
| `T6` | Vertical Align | Căn giữa theo chiều dọc (`align-middle`) cho các dòng chuẩn; căn trên (`align-top`) cho các dòng có nội dung đa dòng dài. | Cấm căn dưới (`align-bottom`) làm các trường thông tin bị lệch chân khó theo dõi. |
| `T7` | Horizontal Freeze | Bảng có thanh cuộn ngang BẮT BUỘC phải cố định tiêu đề (`sticky header`) và cố định cột định danh đầu tiên (`frozen column`). | Cấm để người dùng cuộn ngang mà mất dấu tiêu đề cột hoặc mất cột tên món/nguyên liệu. |
| `T8` | Density Policy (LOCKED) | **Chốt cứng Operational Compact Density**: Chiều cao dòng `36px–40px` (dòng thường) và `44px` (dòng có ô nhập liệu inline). Tùy chỉnh mật độ qua `TablePreferencesControl` phải ánh xạ qua token chuẩn, không phá vỡ `T7` và `D6`. | Cấm chiều cao dòng phình to lãng phí không gian hiển thị (>50px cho bảng dữ liệu vận hành); cấm phá vỡ `T7` khi đổi mật độ. |
| `T9–T10` | Sorting | Mặc định sắp xếp theo trường có ý nghĩa vận hành (ngày, độ ưu tiên); biểu tượng sort ổn định hình học không nhảy giật. | Cấm sắp xếp mặc định theo khóa chính vô nghĩa (ID tự tăng ngầm); cấm mất trạng thái sort khi đổi trang. |
| `T11–T12` | Columns & Actions | Ưu tiên bảng 5–7 cột quyết định và mở rộng chi tiết (master-detail) thay vì hiển thị hàng chục cột kéo dài vô tận. | Cấm nhồi nhét >15 cột trên bảng phẳng buộc người dùng cuộn ngang liên tục để đọc 1 dòng. |
| `T13–T16` | Pagination | Dữ liệu lớn bắt buộc phân trang server hoặc ảo hóa; thanh công cụ lọc có số lượng kết quả; có nút xóa bộ lọc rõ ràng. | Cấm tải trước toàn bộ cơ sở dữ liệu về client; cấm ẩn thông tin số lượng trang/tổng số bản ghi. |

---

## 6. Modals, Drawers & Forms Rules Matrix

| Rule ID | Category | Canonical Specification (MUST) | Prohibited Anti-Pattern (NEVER) |
|---|---|---|---|
| `M1.1` | Modal Purpose | Modal chỉ dùng cho tác vụ chặn thực sự cần tập trung ngắn hạn; chi tiết kéo dài phải dùng SplitWorkbench hoặc route riêng. | Cấm lạm dụng popup modal cho toàn bộ màn hình nghiệp vụ chính. |
| `M1.2` | Single Overlay | Chỉ cho phép tối đa 1 lớp overlay/dialog chặn tại một thời điểm; xác nhận hủy thao tác thực hiện qua dialog con lồng an toàn hoặc thanh thế. | Cấm xếp chồng 3–4 lớp popup modal đè lên nhau gây mất phương hướng cho người dùng. |
| `M2.1–M2.7` | Dialog Scroller | Modal có kích thước theo chuẩn (`sm`, `md`, `lg`, `xl`); header và footer cố định; chỉ có 1 vùng cuộn duy nhất trong thân (`DialogBody`). | Cấm thanh cuộn xuất hiện ở cả lớp ngoài lẫn bên trong modal gây hiện tượng "cuộn lồng cuộn". |
| `M2.8–M2.16` | Focus & Cleanup | Tự động bẫy focus trong modal, hỗ trợ phím Esc để đóng (có kiểm tra dirty draft); giải phóng triệt để DOM portal khi đóng. | Cấm để rò rỉ focus ra nền sau modal; cấm kẹt lớp backdrop phủ mờ màn hình sau khi đóng modal. |
| `M3.1–M3.16` | Modal Lifecycle | Mount modal theo yêu cầu (on-demand); hủy bỏ các request/timer khi modal đóng; hiệu ứng mở <= 150ms. | Cấm fetch dữ liệu chi tiết cho toàn bộ các dòng trước khi người dùng bấm mở modal. |
| `I1–I4` | Field Labels | Nhãn trường luôn hiển thị rõ ràng bên ngoài ô nhập (placeholder không thay thế label); báo lỗi ngay cạnh trường sau `onBlur`. | Cấm chỉ dựa vào placeholder làm nhãn; cấm giấu thông báo lỗi chỉ trong popup toast thoáng qua. |
| `I5–I8` | Input Hygiene | Trường số tự động định dạng và có bước nhảy/đơn vị; bảo toàn bản nháp khi mất kết nối mạng tạm thời. | Cấm chấp nhận ký tự chữ trong ô số; cấm xóa sạch dữ liệu form khi có một lỗi xác thực nhỏ. |
| `I9–I10` | Spacing & Flow | Bố cục nhãn → ô nhập → mô tả/lỗi theo khoảng cách token chuẩn; SectionPanel quản lý padding tập trung. | Cấm khoảng cách giữa các ô nhập liệu không đồng đều hoặc nhảy dòng lung tung khi có lỗi hiển thị. |

---

## 7. Navigation, Layout, Query & Performance Rules Matrix

| Rule ID | Category | Canonical Specification (MUST) | Prohibited Anti-Pattern (NEVER) |
|---|---|---|---|
| `N1–N5` | Work Navigation | Điều hướng bám sát đối tượng công việc; breadcrumb phản ánh chính xác vị trí; URL phản ánh view state (`?view=<key>`). | Cấm chuyển view trên trang mà không đồng bộ URL làm mất trạng thái khi người dùng F5 tải lại trang. |
| `N6` | Nested Sidebar Authority | Sidebar v2 (nhóm accordion + liên kết lá) là thẩm quyền điều hướng duy nhất khi route có >1 view con; tab bar nội bộ trang cũ bị bãi bỏ. | Cấm duy trì song song cả tab bar trong trang lẫn menu lá sidebar cho cùng một đích đến. |
| `N7` | Disclosure Accessibility | Nút mở nhóm trong sidebar là thẻ `button[type=button]` với `aria-expanded`; liên kết lá dùng thẻ `a` với `aria-current="page"`. | Cấm dùng thẻ `div` click sự kiện tùy tiện để điều hướng mà không có thuộc tính trợ năng ARIA. |
| `N8` | Unified Preference | Tùy chọn ẩn hiện tab lá được đồng bộ với URL resolver; tab bị ẩn không thể truy cập qua link ngầm hay deep link. | Cấm để người dùng truy cập được view mà quyền hạn hoặc cấu hình hiển thị đã tắt. |
| `C1–C6` | Layout Stability | Khung placeholder/skeleton phải khớp kích thước với dữ liệu thật; số liệu bảng dùng tabular-nums để không giật layout. | Cấm CLS (Cumulative Layout Shift) > 0.1; cấm nhảy giật kích thước bảng khi dữ liệu tải xong. |
| `C7–C12` | Surface Ownership | Mỗi trạng thái hiển thị chỉ có 1 bề mặt giải thích duy nhất; không tạo các khung trống rỗng nhân tạo. | Cấm nhân đôi thông báo rỗng hoặc để vùng trắng vô nghĩa chiếm trọn màn hình. |
| `F1–F6` | Performance Targets | P75 LCP <= 2.5s, INP <= 200ms; debounce tìm kiếm 250–300ms kèm hủy request cũ (`AbortController`). | Cấm gửi request API liên tục sau từng phím gõ mà không có debounce. |
| `F12–F22` | Query Hygiene | Tách bạch dữ liệu máy chủ và tính toán phái sinh; tạm dừng polling khi tab bị ẩn hoặc đang chỉnh sửa dữ liệu. | Cấm cơ chế refetch tự động ghi đè làm mất dữ liệu người dùng đang nhập dở trên form. |
| `E1–E8` | 6 UI States | Thể hiện tường minh 6 trạng thái: Đang tải, Trống, Lỗi, Từ chối quyền, Một phần, Đối soát ghi; thông báo lỗi kèm hướng xử lý. | Cấm hiển thị màn hình trắng trơn (blank canvas) hoặc nuốt lỗi âm thầm khi API thất bại. |
| `A1–A4` | Accessibility | Đảm bảo đầy đủ phím điều hướng Tab, Shift+Tab, Enter, Escape; độ tương phản đạt WCAG 2.2 AA; có aria-live cho cập nhật động. | Cấm bẫy phím (keyboard trap) ngoài modal; cấm vô hiệu hóa chuột mà không chặn phím tương ứng. |
| `V1–V10` | Visual Hierarchy | Bố cục theo thứ tự: Tiêu đề/Ngữ cảnh → Bộ lọc/Lệnh → Trạng thái/Khung làm việc chính; không dùng flex-grow vô nghĩa. | Cấm nút thao tác chính bị trôi dạt xuống cuối trang hoặc bị che khuất bởi các thanh nổi. |
