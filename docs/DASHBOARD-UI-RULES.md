---
title: UI/UX & Performance Rules — Web Dashboard
status: planning-input
scope: frontend
owner: GSD
last_reviewed: 2026-08-11
---

# UI/UX & Performance Rules — Web Dashboard

> Bộ quy tắc chuẩn hoá cho ứng dụng dashboard quản trị / vận hành (admin, ERP, MES, back-office).
> Đây là **rule chung áp cho toàn hệ thống**, không phải bản audit của một màn hình hay một ảnh chụp cụ thể.
> Nguồn: Nielsen Norman Group, Core Web Vitals (web.dev), WCAG 2.2, IBM Carbon, Atlassian Design System, Shopify Polaris, SAP Fiori, ISA-101 High-Performance HMI.

---

## 0. Cách dùng tài liệu này

### 0.1 Phạm vi

Áp dụng cho **toàn bộ** route, màn hình, layout và component dùng chung của ứng dụng. Không có ngoại lệ theo từng màn hình.

### 0.2 Quy ước mức độ

| Mức | Ý nghĩa |
| --- | --- |
| **MUST** | Vi phạm là lỗi. Chặn merge. |
| **SHOULD** | Mặc định phải theo. Làm khác phải ghi lý do trong PR. |
| **MAY** | Tuỳ chọn, dùng khi có lợi. |

### 0.3 Chỉ dẫn bắt buộc khi thực thi (dành cho AI agent và dev)

1. Mọi ví dụ trong tài liệu là **placeholder generic**. MUST NOT coi chúng là mô tả một màn hình có thật, và MUST NOT chỉ sửa đúng chỗ trùng với ví dụ.
2. Khi nhận yêu cầu dạng "sửa màn hình X": MUST quét toàn bộ codebase để tìm **mọi** nơi vi phạm cùng rule đó, liệt kê danh sách, rồi mới sửa. Sửa một màn hình rồi dừng là không đạt.
3. MUST sửa ở **tầng thấp nhất có thể**, theo thứ tự: design token → primitive component → shared hook/formatter/util → layout → màn hình. Cấm vá cục bộ trong file màn hình nếu nguyên nhân nằm ở component dùng chung.
4. MUST NOT tạo biến thể song song (`BadgeV2`, `TableNew`, `ModalCustom`, `*.old.tsx`). Sửa hoặc mở rộng component gốc.
5. Mỗi thay đổi MUST ghi ID rule đang áp trong mô tả PR/commit, ví dụ `C3`, `M3.2`.
6. Khi hai rule mâu thuẫn, ưu tiên theo thứ tự: **An toàn dữ liệu > Accessibility > Ổn định layout > Hiệu năng > Nhất quán thị giác > Thẩm mỹ**.
7. Rule nào không kiểm chứng được bằng lint, test hoặc checklist thì MUST NOT được coi là đã hoàn thành.

### 0.4 Vị trí lưu trữ canonical trong worktree này

Tài liệu này là **planning input**, không phải bằng chứng rằng code hiện tại đã tuân thủ. GSD Core MUST audit
source, test và runtime hiện hành trước khi chuyển bất kỳ rule nào thành task triển khai.

| Artifact | Vị trí canonical | Trạng thái/gate khi audit |
| --- | --- | --- |
| Bộ rule làm đầu vào audit | `docs/DASHBOARD-UI-RULES.md` | File này là bản duy nhất; MUST NOT copy sang `.docs/` hoặc `.planning/` |
| Triết lý UI và quy ước điều hướng | `docs/UI-PHILOSOPHY.md` | Tạo hoặc cập nhật qua workflow docs của GSD nếu audit xác nhận còn thiếu |
| Token màu, khoảng cách và typography | `frontend/src/styles/index.css` | Giữ tại CSS entry hiện hành; chỉ tách module token khi plan chứng minh seam rõ ràng |
| Từ điển nhãn trạng thái/workflow | `frontend/src/lib/workflowConfig.ts` | Mở rộng nguồn hiện có; MUST NOT tạo một từ điển song song |
| Formatter số, tiền, ngày giờ, đơn vị và phần trăm | `frontend/src/lib/formatters.ts` | Mở rộng nguồn hiện có; formatter đặc thù domain chỉ được giữ khi audit nêu rõ ownership |
| Từ điển thuật ngữ nghiệp vụ | `docs/GLOSSARY.md` | Tạo hoặc cập nhật qua workflow docs của GSD nếu audit xác nhận còn thiếu |
| Artifact phase, plan và verification | `.planning/phases/<phase>/` | Chỉ GSD tạo và quản lý; tài liệu này không tự tạo state planning |
| Evidence runtime/visual | `.artifacts/<run>/` | Chỉ lưu output có thể tái tạo; hash authoritative được đăng ký tại `docs/EVIDENCE-INDEX.md` |

Quy tắc lưu trữ:

1. `.docs/` là vùng ignored của worktree, MUST NOT dùng cho tài liệu cần audit, review hoặc commit.
2. `docs/` giữ source-of-truth lâu dài; `.planning/` chỉ giữ state và artifact do workflow GSD sinh ra;
   `.artifacts/` chỉ giữ evidence/runtime output.
3. MUST NOT nhân bản toàn bộ rule vào `UI-PHILOSOPHY.md`, `GLOSSARY.md`, plan hoặc checklist. Các file đó
   liên kết về rule ID trong tài liệu này để tránh nhiều nguồn sự thật.
4. Đường dẫn trong plan phải được kiểm chứng lại với source hiện hành. Nếu code đã đổi vị trí, plan cập nhật
   canonical path trong cùng thay đổi docs thay vì tạo file tương đương ở đường dẫn cũ.

### 0.5 Contract audit → plan cho GSD Core

Khi áp dụng tài liệu này cho IPCManagement, GSD Core thực hiện theo thứ tự:

1. Audit toàn bộ rule với source/test/runtime hiện hành và phân loại `PASS`, `GAP`, `NOT_APPLICABLE` hoặc
   `NEEDS_EVIDENCE`; ví dụ generic trong tài liệu không được dùng làm bằng chứng.
2. Gộp các `GAP` theo **shared seam/root cause** (token, primitive, shared formatter/hook, layout, route),
   không tạo task hoặc phase riêng cho từng rule ID, component hay màn hình.
3. Chỉ đưa `GAP` có bằng chứng và acceptance test kiểm chứng được vào plan. Mục chưa đủ evidence phải nằm
   trong audit backlog, không được biến thành implementation task mang tính phỏng đoán.
4. Mặc định tạo **một phase triển khai, tối đa ba wave**:
   - **Wave 1 — contract/foundation:** test hoặc checker, token, vocabulary và formatter dùng chung.
   - **Wave 2 — shared UI seams:** primitive, hook, layout và component dùng chung.
   - **Wave 3 — rollout/verification:** callsite còn lại, regression, headed browser và evidence closeout.
5. Chỉ tách thêm phase khi audit chứng minh có milestone độc lập, dependency tuần tự không thể tránh, trust/data
   boundary khác nhau hoặc authority blocker. Số lượng rule, route hay file lớn tự nó không phải lý do tách phase.
6. Trong một wave, nhóm việc độc lập thành task song song nhưng giữ số plan tối thiểu cần thiết. Audit, research,
   verification và closeout là gate của phase, không được biến thành các phase triển khai riêng chỉ để tăng số bước.
7. Plan phải ghi rõ rule ID, source owner thấp nhất cần sửa, acceptance test, phạm vi deferred và điều kiện dừng;
   MUST NOT mở rộng sang backend/business behavior nếu audit UI không chứng minh dependency đó.

---

## P. Nguyên tắc nền tảng

- **P1 (MUST)** Giao diện nói ngôn ngữ người dùng, không nói ngôn ngữ hệ thống. Cấm để thuật ngữ nội bộ, tên bảng, tên enum, tên cột DB lộ ra UI.
- **P2 (MUST)** Trạng thái hệ thống luôn hiển thị: đang làm gì, xong chưa, kết quả ra sao, ai chịu trách nhiệm bước tiếp theo.
- **P3 (MUST)** Nhất quán tuyệt đối: cùng một khái niệm phải có cùng tên gọi, cùng màu, cùng vị trí, cùng hành vi ở mọi màn hình.
- **P4 (MUST)** Progressive disclosure: cấp danh sách chỉ hiển thị 5–7 trường quyết định; phần còn lại nằm ở lớp chi tiết. Nhồi mọi cột vào bảng chính là lỗi thiết kế, không phải tính năng.
- **P5 (MUST)** Người dùng luôn có đường thoát: huỷ, quay lại, hoàn tác. Thao tác phá huỷ MUST có xác nhận hoặc undo.
- **P6 (SHOULD)** Ưu tiên hiệu suất thao tác của người dùng thành thạo hơn vẻ đẹp: phím tắt, thao tác hàng loạt, ghi nhớ bộ lọc, giữ tay trong vùng làm việc.
- **P7 (MUST)** Phòng lỗi trước khi báo lỗi: chặn giá trị không hợp lệ tại nguồn, gợi ý giá trị hợp lệ, mặc định thông minh.
- **P8 (SHOULD)** Mọi màn hình phải trả lời được trong 2 giây: *cái gì đang bất thường* và *tôi cần làm gì tiếp theo*.

---

## D. Design system & token

- **D1 (MUST)** Chọn **một** design system làm nguồn sự thật. Cấm trộn nhiều thư viện UI trong cùng ứng dụng.
- **D2 (MUST)** Ba tầng token: `primitive` (giá trị thô) → `semantic` (vai trò: `text.default`, `surface.raised`, `status.warning`) → `component` (`badge.warning.bg`). Component chỉ được tham chiếu tầng **semantic**.
- **D3 (MUST)** Đặt tên token theo **vai trò**, không theo diện mạo. Dùng `--color-text-muted`, không dùng `--gray-600`.
- **D4 (MUST)** Cấm màu hardcode (hex/rgb/hsl) trong file component. MUST có lint rule chặn.
- **D5 (MUST)** Màu ngữ nghĩa là tài nguyên khan hiếm. Khi đỏ đã mang nghĩa "lỗi", cấm dùng đỏ để trang trí.
- **D6 (MUST)** Thang khoảng cách 4/8px; thang typography tối đa 6 bậc; thang bo góc tối đa 3 bậc; thang đổ bóng tối đa 3 bậc.
- **D7 (MUST)** Một vùng ngữ cảnh chỉ có **một** nút primary. Các hành động còn lại là secondary hoặc tertiary.
- **D8 (SHOULD)** Với dashboard vận hành công nghiệp (ISA-101 / High-Performance HMI): nền và trạng thái bình thường dùng **thang xám**; màu chỉ dành cho **bất thường**; đỏ chỉ xuất hiện khi có sự cố; xanh lá dùng tiết chế. Khi mọi hàng đều có màu, khả năng phát hiện bất thường bằng mắt bị triệt tiêu.
- **D9 (MUST)** Icon dùng một bộ duy nhất, một stroke-width, một kích thước base. Cấm trộn bộ icon.

---

## L. Ngôn ngữ & dữ liệu hiển thị (chống "code hoá")

- **L1 (MUST)** **Tên trước, mã sau.** Mỗi bản ghi có một nhãn chính con người đọc được (đậm, cỡ chuẩn); mã kỹ thuật là dòng phụ (cỡ nhỏ, màu mờ, `tabular-nums`). Mã MUST NOT đứng một mình ở cột định danh chính.
- **L2 (MUST)** UUID, hash, khoá kỹ thuật, id nội bộ MUST NOT hiển thị mặc định. Chúng chỉ xuất hiện trong panel chi tiết hoặc sau nút sao chép mã.
- **L3 (MUST)** Mã có cấu trúc phải được **giải mã thành thông tin**. Nếu mã chứa ngày, đối tác, ca, loại chứng từ thì hiển thị các thông tin đó; mã giữ vai trò phụ chú.
  - Mẫu chung: `<LOẠI>-<ĐỐI TÁC>-<YYYYMMDD>-<CA>` → **"<Tên loại chứng từ> <dd/mm/yyyy> — <Tên đối tác> · <Tên ca>"**
- **L4 (MUST)** Mọi enum backend MUST đi qua **một** từ điển nhãn tập trung. Cấm map rải rác trong component. Cấm render giá trị enum thô ra UI.
- **L5 (MUST)** Mọi số, tiền, phần trăm, ngày giờ MUST đi qua formatter tập trung. Cấm mỗi màn hình tự định dạng — quy ước dấu phân cách khác nhau giữa các màn hình là nguyên nhân mất niềm tin vào dữ liệu nhanh nhất.
- **L6 (MUST)** Số luôn đi kèm đơn vị. Đơn vị đặt ở header cột nếu cả cột cùng đơn vị; đặt cạnh số nếu đơn vị thay đổi theo hàng.
- **L7 (MUST)** Mọi mã hiển thị MUST có nút sao chép.
- **L8 (MUST)** Tìm kiếm phải khớp cả nhãn lẫn mã, và highlight phần khớp.
- **L9 (MUST)** Vòng đời nghiệp vụ hiển thị bằng stepper có nhãn nghiệp vụ, nêu rõ: bước hiện tại, người chịu trách nhiệm, việc kế tiếp, nút để làm việc đó. Cấm hiển thị chuỗi trạng thái kỹ thuật thô.
- **L10 (MUST)** Viết tắt lần đầu xuất hiện phải có dạng đầy đủ hoặc tooltip giải nghĩa.
- **L11 (MUST)** Nhãn cột, nhãn field, nhãn nút dùng đúng từ ngữ trong `docs/GLOSSARY.md`. Cấm dịch máy hoặc tự chế biến thể.
- **L12 (SHOULD)** Ngày giờ hiển thị theo múi giờ người dùng, có nhãn tương đối khi hữu ích, và giữ giá trị tuyệt đối trong tooltip.

---

## S. Trạng thái, badge, tag

### S0. Phân biệt ba thành phần thường bị dùng lẫn

| Thành phần | Chỉ dùng cho | Không dùng cho |
| --- | --- | --- |
| **Badge** | Giá trị **số** (đếm, tally) | Trạng thái bằng chữ |
| **Lozenge / Status pill** | **Trạng thái vòng đời** của một đối tượng | Nhãn tự do, link điều hướng |
| **Tag / Chip** | **Phân loại, lọc, nhãn do người dùng tạo** (chọn hoặc gỡ được) | Trạng thái vòng đời hệ thống |

### S1. Rule sử dụng

- **S1.1 (MUST)** Từ vựng trạng thái là **enum đóng**, khai báo ở một chỗ, dùng chung toàn app. Cấm mỗi màn hình tự nghĩ nhãn riêng.
- **S1.2 (MUST)** Nhãn trạng thái dùng **một từ**; chỉ dùng hai từ khi buộc phải mô tả trạng thái phức hợp.
- **S1.3 (MUST)** Một trạng thái ↔ một token màu ngữ nghĩa, nhất quán tuyệt đối trên mọi màn hình.
- **S1.4 (MUST)** Màu MUST NOT là phương tiện truyền tin duy nhất. Mỗi trạng thái phải có nhãn chữ, hoặc icon có hình dạng khác biệt, hoặc nhãn cho screen reader.
- **S1.5 (MUST)** Tối đa **2** badge/tag trên một hàng hoặc một đối tượng ở cấp danh sách. Nhiều hơn thì gom thành `+N` mở popover.
- **S1.6 (MUST)** Badge MUST NOT là link điều hướng và MUST NOT kiêm nhiều chức năng.
- **S1.7 (MUST)** Nhãn dài thì cắt bằng ellipsis kèm tooltip. MUST NOT xuống dòng. Nhãn nên dưới 20 ký tự.
- **S1.8 (MUST)** Chỉ có 3 size (nhỏ / mặc định / lớn). Trong ô bảng dùng nhỏ hoặc mặc định; size lớn chỉ dành cho trạng thái chính ở đầu trang.
- **S1.9 (MUST)** Badge canh giữa theo chiều dọc với text cạnh nó; nhóm badge cách nhau 8px.
- **S1.10 (MUST)** Read-only và tương tác phải khác nhau về thị giác: badge trạng thái không viền, không hover; tag bấm được có viền và đổi nền khi hover.
- **S1.11 (MUST)** Badge MUST NOT chứa metadata (mã, số lượng, đơn giá, ngày). Những thứ đó thuộc về cột riêng.
- **S1.12 (MUST)** Khi một đối tượng có nhiều trạng thái cùng lúc, MUST có thang ưu tiên (Lỗi → Cảnh báo → Chờ xử lý → Bình thường) và chỉ hiển thị trạng thái cao nhất ở cấp danh sách.
- **S1.13 (MUST)** Nếu một trạng thái xuất hiện ở gần như mọi hàng thì nó không còn giá trị cảnh báo — chuyển thành bộ lọc hoặc cột, không phải badge màu.

### S2. Ánh xạ ngữ nghĩa sang tone (dùng chung toàn app)

| Ngữ nghĩa | Tone | Dùng cho |
| --- | --- | --- |
| Thành công / hoàn tất | green | Đã duyệt, đã hoàn tất, đã chốt, dữ liệu sẵn sàng |
| Đang diễn ra | blue | Đang xử lý, đang tải, đã gửi đi |
| Cần chú ý / chờ hành động | amber | Chờ duyệt, hoàn tất một phần, cần bổ sung |
| Lỗi / chặn | red | Thất bại, bị từ chối, vượt ngưỡng, thiếu điều kiện |
| Trung tính / chưa bắt đầu | gray | Nháp, chưa mở, không áp dụng |

---

## T. Bảng dữ liệu & danh sách

- **T1 (MUST)** Căn lề theo loại dữ liệu: chữ căn trái; số định lượng (tiền, khối lượng, %, số đếm) căn phải theo dấu thập phân; số định tính (ngày, mã bưu chính, số điện thoại) có thể căn trái. **MUST NOT căn giữa.**
- **T2 (MUST)** Header căn cùng chiều với nội dung cột.
- **T3 (MUST)** Mọi số trong bảng dùng `font-variant-numeric: tabular-nums`.
- **T4 (SHOULD)** Không lặp từ chung trong mọi ô — đưa từ chung lên header.
- **T5 (MUST)** Chọn **một** kiểu phân tách hàng. Đường kẻ ngang 1px màu nhạt là mặc định an toàn. Tránh zebra stripe khi bảng có nhiều state (hover, selected, disabled).
- **T6 (SHOULD)** Chêch lệch chiều cao hàng dưới 3 dòng thì căn giữa theo chiều dọc; trên 3 dòng thì căn trên.
- **T7 (MUST)** Bảng cuộn ngang MUST có header dính và cột định danh đóng băng bên trái.
- **T8 (MUST)** Cho người dùng kiểm soát: ẩn/hiện cột, đổi thứ tự cột, 3 mức mật độ hàng (gọn 40px / thường 48px / thoáng 56px). Kèm **lưu trạng thái** theo tài khoản và **nút khôi phục mặc định**.
- **T9 (MUST)** Sắp xếp mặc định phải có chủ đích: bản ghi mới nhất hoặc bản ghi **cần hành động nhất**. MUST NOT mặc định theo khoá chính.
- **T10 (MUST)** Chỉ báo sắp xếp MUST NOT làm xê dịch canh lề header.
- **T11 (SHOULD)** Hành động dòng bộc lộ khi hover, và MUST có đường vào tương đương bằng bàn phím.
- **T12 (MUST)** Master–detail thay cho bảng nhiều chục cột: bảng chính giữ 5–7 cột quyết định; mở chi tiết trong drawer hoặc hàng mở rộng mà không mất ngữ cảnh danh sách.
- **T13 (MUST)** Tập dữ liệu lớn MUST phân trang hoặc cuộn ảo phía server. MUST NOT tải toàn bộ dataset về client.
- **T14 (MUST)** Bộ lọc đang áp hiển thị dưới dạng chip gỡ được, kèm nút xoá tất cả và tổng số kết quả sau lọc.
- **T15 (SHOULD)** Chọn nhiều hàng thì hiển thị toolbar hành động hàng loạt cố định ở đáy, nêu rõ số lượng đang chọn.
- **T16 (MUST)** Phân trang hiển thị đủ: khoảng đang xem, tổng số bản ghi, cỡ trang đổi được, và đường nhảy tới trang cụ thể khi tổng số trang lớn.

---

## M. Modal, dialog, drawer, overlay

Đây là nơi tập trung phần lớn lỗi hiệu năng và lỗi layout của dashboard, vì modal thường bị mount sẵn hàng loạt và tải dữ liệu nặng ngay khi mở.

### M1. Chọn đúng loại surface

| Tình huống | Dùng | Không dùng |
| --- | --- | --- |
| Xác nhận thao tác phá huỷ, tác vụ ngắn cần chặn luồng | Dialog (modal) | Drawer, trang riêng |
| Xem hoặc sửa chi tiết một bản ghi trong danh sách | Drawer bên phải (master–detail) | Modal |
| Form dài, nhiều bước, nhiều phụ thuộc | Trang riêng có URL | Modal |
| Thông tin bổ trợ ngắn, không chặn | Popover / tooltip | Modal |
| Mở rộng thêm dữ liệu của một hàng | Hàng mở rộng inline | Modal |

- **M1.1 (MUST)** Modal chỉ dùng khi thực sự cần **chặn luồng**. Nếu người dùng cần tham chiếu nội dung nền trong lúc thao tác thì MUST dùng drawer hoặc trang riêng.
- **M1.2 (MUST)** MUST NOT chồng modal lên modal. Tối đa một lớp chặn tại một thời điểm. Cần nhiều bước thì dùng stepper trong cùng một modal, hoặc chuyển sang trang riêng.

### M2. Hiển thị & hành vi

- **M2.1 (MUST)** Kích thước modal theo thang cố định (sm / md / lg / full) kèm `max-height: min(85vh, ...)`. Body cuộn bên trong; header và footer dính. Modal MUST NOT tự giãn theo dữ liệu async.
- **M2.2 (MUST)** Nút hành động nằm ở footer, thứ tự nhất quán toàn app, chỉ một primary. Nhãn nút mô tả hành động cụ thể, MUST NOT dùng "OK".
- **M2.3 (MUST)** Đóng được bằng `Esc`, click backdrop, và nút đóng. Nhưng nếu form có thay đổi chưa lưu thì MUST chặn đóng vô tình và hỏi xác nhận; với form dài, SHOULD tắt đóng bằng backdrop.
- **M2.4 (MUST)** Focus trap trong modal; focus trả về đúng phần tử đã kích hoạt khi đóng; nền được đánh dấu `inert`.
- **M2.5 (MUST)** `role="dialog"` kèm `aria-modal="true"` và `aria-labelledby` trỏ tới tiêu đề modal.
- **M2.6 (MUST)** Khoá cuộn nền MUST NOT gây dịch layout. Dùng `scrollbar-gutter: stable` hoặc bù `padding-right` bằng đúng chiều rộng scrollbar; giữ nguyên vị trí cuộn khi đóng.
- **M2.7 (MUST)** Modal render qua **portal** ở gốc DOM. MUST NOT nằm sâu trong cây bảng hoặc cây hàng, để tránh bị `overflow` cắt, tránh stacking context sai, và tránh kéo theo re-render của bảng.
- **M2.8 (SHOULD)** Autofocus vào phần tử đầu tiên có ý nghĩa (field đầu hoặc nút an toàn nhất). MUST NOT autofocus vào nút phá huỷ.
- **M2.9 (SHOULD)** Ưu tiên **undo** hơn **confirm** cho thao tác có thể hoàn tác; giữ confirm cho thao tác không thể hoàn tác.
- **M2.10 (SHOULD)** Modal quan trọng nên có state trên URL để refresh và nút Back hoạt động đúng; Back đóng modal thay vì rời trang.
- **M2.11 (MUST)** Nội dung trong modal tuân thủ toàn bộ rule `L`, `S`, `T`, `E`, `A` như mọi màn hình khác. Modal không phải vùng miễn trừ.

### M3. Hiệu năng khi hiển thị modal

- **M3.1 (MUST)** Mount theo nhu cầu. MUST NOT render sẵn modal rồi ẩn bằng CSS (`display:none`, `visibility:hidden`, `opacity:0`).
- **M3.2 (MUST)** Modal đặt ở **cấp trang**. MUST NOT đặt bên trong mỗi hàng của bảng. Một instance duy nhất kèm state lưu id đang mở. Đây là nguyên nhân phổ biến nhất khiến trang danh sách phình DOM và chậm.
- **M3.3 (MUST)** Code-split modal nặng (chart, editor, upload, bản đồ, bảng lồng) bằng lazy import kèm fallback skeleton. SHOULD prefetch bundle khi hover hoặc focus vào trigger để mở vẫn tức thì.
- **M3.4 (MUST)** Dữ liệu chi tiết fetch **khi mở**. MUST NOT prefetch cho mọi hàng của danh sách.
- **M3.5 (MUST)** Hiển thị ngay dữ liệu đã có từ danh sách, rồi bổ sung phần còn thiếu khi về (stale-while-revalidate). MUST NOT hiện modal trắng chờ API.
- **M3.6 (MUST)** Khi đóng: huỷ request đang bay bằng `AbortController`, clear timer và interval, huỷ subscription, dispose instance chart/editor, `revokeObjectURL`. Cần giữ nháp thì lưu ra store, MUST NOT giữ cây DOM sống.
- **M3.7 (MUST)** Animation mở/đóng chỉ dùng `transform` và `opacity`, thời lượng 150–250ms, và MUST tôn trọng `prefers-reduced-motion`.
- **M3.8 (SHOULD)** `backdrop-filter: blur()` rất tốn GPU khi nền là bảng lớn. Chỉ dùng khi đã đo, và MUST NOT dùng đồng thời với animation mở.
- **M3.9 (MUST)** Cô lập render: state của modal MUST NOT nằm chung store hoặc context với danh sách nền. Nếu không, mỗi ký tự gõ trong modal sẽ re-render toàn bảng. Dùng state cục bộ hoặc selector hẹp; memo hoá nội dung nền.
- **M3.10 (MUST)** Danh sách dài bên trong modal (chọn bản ghi, chọn vật tư, chọn người) MUST cuộn ảo. Combobox MUST debounce 250–300ms và huỷ request cũ.
- **M3.11 (SHOULD)** Form trong modal dùng state cục bộ theo field, validate `onBlur`. MUST NOT validate toàn form mỗi keystroke.
- **M3.12 (MUST)** Tính toán nặng khi mở (tổng hợp, sắp xếp, parse) MUST NOT chạy đồng bộ trên main thread trong lúc mở. Dùng transition không chặn hoặc web worker.
- **M3.13 (MUST)** Ngân sách mở modal: khung đầu tiên (skeleton) **dưới 100ms**; dữ liệu đầy đủ **dưới 1s**; quá 1s thì skeleton, quá 10s thì thanh tiến trình có phần trăm kèm nút huỷ.
- **M3.14 (MUST)** Modal MUST NOT gây layout shift cho trang nền, và nội dung bên trong MUST có skeleton khớp kích thước thật (xem `C`).
- **M3.15 (SHOULD)** Toast và notification dùng chung một container ở lớp overlay, giới hạn số lượng hiển thị đồng thời, và tự gộp khi trùng loại.

---

## C. Ổn định layout (CLS)

**Ngưỡng bắt buộc: CLS ≤ 0,1 ở phân vị 75.** 0,1–0,25 là cần cải thiện; trên 0,25 là kém.

Layout shift luôn đến từ bốn nguồn: ảnh hoặc embed không khai báo kích thước, nội dung chèn động không được đặt chỗ trước, font web đổi metric, animation chạm thuộc tính gây reflow.

- **C1 (MUST)** Mọi vùng render sau khi fetch (badge, KPI, chip, banner, biểu đồ, avatar) MUST có `min-height`, `min-width` hoặc `aspect-ratio` ngay từ lần layout đầu tiên. MUST NOT để container rỗng cao 0px.
- **C2 (MUST)** Skeleton MUST khớp kích thước thật: cùng số dòng, cùng chiều cao hàng, cùng padding. Skeleton sai kích thước vẫn gây shift, tức là vô nghĩa.
- **C3 (MUST)** Ô trạng thái trong bảng đặt `min-width` bằng nhãn dài nhất của enum, chiều cao cố định theo token, `white-space: nowrap`. Khi chưa có dữ liệu thì render skeleton cùng kích thước, MUST NOT render rỗng.
- **C4 (MUST)** Mọi con số cập nhật động (bộ đếm, đồng hồ, KPI, polling) dùng `tabular-nums`.
- **C5 (MUST)** Đặt `scrollbar-gutter: stable` ở `html` để layout không dịch ngang khi mở modal hoặc khi trang đổi từ có sang không có scrollbar.
- **C6 (MUST)** Toast, banner, cảnh báo MUST NOT chèn vào giữa luồng tài liệu. Đặt ở lớp overlay hoặc trong slot đã đặt chỗ sẵn.
- **C7 (MUST)** Animation chỉ dùng `transform` và `opacity`. MUST NOT animate `top`, `left`, `width`, `height`, `box-shadow`, `filter`.
- **C8 (MUST)** `content-visibility: auto` MUST đi kèm `contain-intrinsic-size`. Thiếu nó, phần ngoài viewport bị coi là cao 0px và thanh cuộn sẽ nhảy.
- **C9 (MUST)** Font fallback MUST khớp metric (`size-adjust`, `ascent-override`, `descent-override`) hoặc preload font chính. `font-display: swap` một mình không chống shift.
- **C10 (MUST)** MUST NOT thu hồi khoảng trống đã đặt chỗ khi API trả về rỗng — giữ placeholder thay vì collapse.
- **C11 (MUST)** Ảnh, iframe, embed MUST khai báo `width`/`height` hoặc `aspect-ratio`.
- **C12 (SHOULD)** Nội dung bổ sung nên nằm phía dưới hoặc yêu cầu tương tác ("Tải thêm"). Shift trong vòng 500ms sau tương tác của người dùng được miễn trừ; tự động chèn khi polling thì không.

### Nền tảng CSS chống shift

```css
html { scrollbar-gutter: stable; }

.num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

.cell-status {
  min-width: 9.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.kpi-card { min-height: 5.5rem; }

.table-body {
  content-visibility: auto;
  contain-intrinsic-size: auto 48px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Cách kiểm chứng

1. Lighthouse — lọc nhóm audit CLS để biết phần tử nào dịch chuyển khi tải trang.
2. DevTools → Performance → track **Layout Shifts** — click từng shift để xem phần tử thủ phạm.
3. Live metrics: thao tác thật (đổi bộ lọc, chuyển tab, mở modal, polling) để bắt CLS phát sinh **sau khi tải** — loại Lighthouse không bắt được và là loại dashboard hay dính nhất.
4. Thu CLS thực địa bằng thư viện `web-vitals` có attribution; xếp ưu tiên theo dữ liệu thay vì cảm tính.

---

## F. Hiệu năng runtime

- **F1 (MUST)** Ngân sách Core Web Vitals: **LCP ≤ 2,5s**, **INP ≤ 200ms**, **CLS ≤ 0,1** ở phân vị 75.
- **F2 (MUST)** Code-split theo route; mỗi module nghiệp vụ là một chunk riêng. Thư viện nặng (chart, editor, xlsx, pdf) MUST lazy-load tại điểm dùng.
- **F3 (MUST)** Danh sách trên 100 hàng MUST cuộn ảo hoặc phân trang phía server.
- **F4 (MUST)** MUST NOT tạo object, array hoặc function literal mới trong props ở mỗi render của danh sách lớn; dùng selector memo hoá và store chuẩn hoá.
- **F5 (MUST)** Ô tìm kiếm và bộ lọc MUST debounce 250–300ms, huỷ request cũ bằng `AbortController`, và chống race condition khi phản hồi về không đúng thứ tự.
- **F6 (MUST)** Polling MUST theo từng widget, có backoff, và MUST dừng khi tab ẩn (`visibilitychange`). MUST NOT polling toàn trang.
- **F7 (MUST)** Cache theo query key với stale-while-revalidate: hiển thị dữ liệu cũ kèm chỉ báo đang làm mới. MUST NOT xoá trắng màn hình mỗi lần refetch.
- **F8 (SHOULD)** Icon dùng SVG inline hoặc sprite; ảnh ngoài viewport dùng `loading="lazy"` nhưng vẫn khai báo kích thước.
- **F9 (MUST)** MUST NOT đọc `offsetWidth` hoặc `getBoundingClientRect` xen kẽ với ghi style trong vòng lặp (layout thrashing).
- **F10 (MUST)** Trước khi tối ưu phải **đo**; PR tối ưu hiệu năng MUST ghi số liệu trước/sau (thời gian render, số lần re-render, kích thước bundle).
- **F11 (SHOULD)** Đặt ngưỡng chặn merge cho kích thước bundle mỗi route trong CI.

---

## E. Trạng thái hệ thống: đang tải, rỗng, lỗi

### Ngưỡng thời gian phản hồi

| Ngưỡng | Cảm nhận | Phản hồi bắt buộc |
| --- | --- | --- |
| 0,1 giây | Tức thì | Không cần gì thêm |
| 1 giây | Có độ trễ nhưng chưa đứt mạch suy nghĩ | Báo hiệu nhẹ: đổi con trỏ, nút vào trạng thái đang xử lý |
| 10 giây | Mất tập trung, người dùng bỏ đi làm việc khác | Thanh tiến trình có phần trăm kèm cách huỷ rõ ràng |

- **E1 (MUST)** MUST NOT hiển thị "không có dữ liệu" trong lúc đang tải. Luồng hợp lệ là **đang tải → có dữ liệu** hoặc **đang tải → rỗng**. Nhảy cóc là lỗi nghiêm trọng: người dùng bỏ đi trước khi dữ liệu về, hoặc mất niềm tin vào hệ thống.
- **E2 (MUST)** Phân biệt **bốn** loại rỗng, mỗi loại một thông điệp và một hành động:
  1. **Chưa có dữ liệu lần đầu** → giải thích khu vực này dùng để làm gì kèm nút tạo mới.
  2. **Lọc hoặc tìm không ra kết quả** → nêu rõ điều kiện đang áp kèm nút xoá bộ lọc.
  3. **Lỗi tải** → nêu rõ lỗi kèm nút thử lại.
  4. **Không đủ quyền** → nêu rõ cần quyền gì và cách xin quyền.
- **E3 (MUST)** Empty state MUST trả lời đủ ba câu hỏi: *đây là gì*, *vì sao đang trống*, *bước tiếp theo là gì* — kèm nút hoặc link đi thẳng vào tác vụ đó. MUST NOT để một vùng trắng trơn.
- **E4 (MUST)** Skeleton cho nội dung có cấu trúc (bảng, card, KPI); spinner chỉ cho nút và tác vụ ngắn rời rạc.
- **E5 (MUST)** Mọi hành động ghi dữ liệu MUST có phản hồi: xác nhận thành công, thông báo lỗi hành động được, và undo với thao tác phá huỷ.
- **E6 (MUST)** Cập nhật nền MUST NOT cướp ngữ cảnh. Hiện chỉ báo "có N cập nhật mới — tải lại" thay vì tự chèn hàng làm bảng nhảy.
- **E7 (MUST)** Thông báo lỗi nêu **chuyện gì xảy ra** và **làm gì tiếp theo**. MUST NOT hiển thị mã lỗi thô hoặc stack trace cho người dùng cuối; mã lỗi để trong phần chi tiết có nút sao chép.
- **E8 (MUST)** Thông báo trạng thái MUST dùng `aria-live` phù hợp.

---

## I. Form & nhập liệu

- **I1 (MUST)** Nhãn field luôn hiển thị. MUST NOT dùng placeholder thay nhãn.
- **I2 (MUST)** Validate khi rời field, không validate trong lúc đang gõ lần đầu; xoá lỗi ngay khi người dùng sửa đúng.
- **I3 (MUST)** Thông báo lỗi đặt sát field, kèm icon và chữ, không chỉ đổi màu.
- **I4 (MUST)** MUST NOT disable nút submit để chặn lỗi. Cho bấm, rồi chỉ ra lỗi và focus vào field đầu tiên bị lỗi.
- **I5 (MUST)** Trường bắt buộc và trường tuỳ chọn phải phân biệt rõ ràng và nhất quán.
- **I6 (MUST)** Input số dùng đúng kiểu bàn phím, đúng đơn vị, đúng bước nhảy, và định dạng lại khi rời field.
- **I7 (SHOULD)** Form dài chia nhóm có tiêu đề; form nhiều bước có stepper hiển thị tiến độ và cho quay lại.
- **I8 (MUST)** Bảo toàn dữ liệu đang nhập khi lỗi mạng hoặc khi đóng nhầm (xem `M2.3`).

---

## A. Accessibility (WCAG 2.2 mức AA)

| Tiêu chí | Yêu cầu | Áp dụng |
| --- | --- | --- |
| 1.4.1 Use of Color | Màu không phải phương tiện truyền tin duy nhất | Badge trạng thái luôn có nhãn chữ hoặc icon riêng biệt |
| 1.4.3 Contrast (Minimum) | Chữ thường ≥ 4,5:1 | Chữ trong badge nhạt và text phụ màu xám là chỗ hay trượt nhất |
| 1.4.11 Non-text Contrast | Thành phần giao diện và trạng thái ≥ 3:1 | Viền input, viền badge, chấm trạng thái, đường kẻ bảng, ranh giới biểu đồ |
| 2.4.7 / 2.4.11 Focus | Chỉ báo focus rõ và không bị che | Header dính, footer dính, toolbar nổi MUST NOT che vòng focus |
| 2.5.8 Target Size | Vùng bấm ≥ 24×24 CSS px hoặc đủ khoảng cách | Icon hành động trong hàng, nút phân trang, nút gỡ chip |
| 4.1.3 Status Messages | Thông báo trạng thái được công nghệ hỗ trợ đọc | Toast, kết quả lọc, cảnh báo dùng `aria-live` |

- **A1 (MUST)** Bảng dữ liệu dùng `table` ngữ nghĩa với `th` có `scope`, không phải div lồng nhau.
- **A2 (MUST)** Mọi tác vụ làm được bằng chuột phải làm được bằng bàn phím, kể cả hành động chỉ hiện khi hover.
- **A3 (MUST)** Thứ tự tab đi theo thứ tự thị giác; không có bẫy focus ngoài modal.
- **A4 (MUST)** Chạy axe hoặc Lighthouse accessibility trong CI với ngưỡng chặn merge.

---

## N. Điều hướng & kiến trúc thông tin

- **N1 (MUST)** Nhóm menu theo **công việc của người dùng**, không theo bảng dữ liệu hay module backend.
- **N2 (MUST)** Vị trí hiện tại luôn rõ: trạng thái active trong sidebar kèm breadcrumb ở màn hình con.
- **N3 (MUST)** Mọi màn hình có thể deep-link. Bộ lọc, tab, trang và modal quan trọng phản ánh trên URL.
- **N4 (MUST)** Nhãn menu dùng đúng từ trong `docs/GLOSSARY.md` và giữ nguyên khi vào màn hình con.
- **N5 (SHOULD)** Trang chủ dashboard trả lời "hôm nay cần làm gì", không phải trưng bày mọi biểu đồ có sẵn.

---

## Q. Definition of Done, đo lường, thứ tự triển khai

### Q1. Checklist review PR

- [ ] Không có mã kỹ thuật nào đứng một mình ở cột hoặc nhãn chính (`L1`, `L2`)
- [ ] Mọi enum backend đi qua từ điển nhãn tập trung (`L4`)
- [ ] Mọi số dùng formatter chung, có `tabular-nums` và có đơn vị (`L5`, `L6`, `T3`)
- [ ] Badge dùng đúng loại, đúng token màu, có nhãn chữ, tối đa 2 trên một hàng (`S1`)
- [ ] Vùng bất đồng bộ có skeleton khớp kích thước; không có container cao 0px (`C1`, `C2`)
- [ ] Không hiển thị "không có dữ liệu" trong lúc đang tải (`E1`)
- [ ] Bốn loại empty state được xử lý riêng, mỗi loại có hành động kế tiếp (`E2`, `E3`)
- [ ] Bảng: căn lề đúng loại dữ liệu, header dính, cột định danh đóng băng, sort mặc định có chủ đích (`T1`, `T7`, `T9`)
- [ ] Modal mount theo nhu cầu, đặt ở cấp trang, code-split nếu nặng, huỷ tài nguyên khi đóng (`M3.1`–`M3.6`)
- [ ] Khoá cuộn nền không gây dịch layout (`M2.6`, `C5`)
- [ ] Vùng bấm ≥ 24×24px; tương phản chữ ≥ 4,5:1; tương phản phi văn bản ≥ 3:1 (`A`)
- [ ] Không có hex hoặc rgb hardcode trong component (`D4`)
- [ ] PR ghi rõ ID rule đã áp (mục `0.3`)

### Q2. Chỉ số theo dõi

| Chỉ số | Mục tiêu | Cách đo |
| --- | --- | --- |
| CLS (p75) | ≤ 0,1 | `web-vitals` kèm Lighthouse CI |
| INP (p75) | ≤ 200ms | `web-vitals` thực địa |
| LCP (p75) | ≤ 2,5s | `web-vitals` kèm Lighthouse CI |
| Thời gian mở modal tới khung đầu | dưới 100ms | Performance panel, đo trên route nặng nhất |
| Vi phạm accessibility nghiêm trọng | 0 | axe-core trong CI |
| Mã kỹ thuật lộ ra cấp danh sách | 0 | Rà soát theo checklist mỗi sprint |
| Thời gian hoàn thành tác vụ chuẩn | Giảm theo từng đợt | Test 5 người dùng thật với 3 kịch bản nghiệp vụ chính |

### Q3. Thứ tự triển khai

1. **Đợt 1 — Nền tảng (không đổi UI nhìn thấy được).** Token ngữ nghĩa, từ điển nhãn, formatter, chuẩn hoá component Badge/Tag/StatusPill/Modal, `scrollbar-gutter` và `tabular-nums` ở layer base, lint chặn màu hardcode.
2. **Đợt 2 — Ổn định và ngôn ngữ.** Áp `C` (đặt chỗ, skeleton, min-width) và `L` (tên trước mã sau) cho toàn bộ bảng, KPI và modal. Đây là đợt tạo khác biệt cảm nhận lớn nhất.
3. **Đợt 3 — Hiệu năng và chiều sâu tương tác.** Áp `M3` và `F` (mount theo nhu cầu, code-split, cuộn ảo, huỷ request), master–detail drawer, quản lý cột, mật độ hàng, 4 loại empty state, stepper vòng đời nghiệp vụ.

---

## Nguồn chuẩn tham chiếu

- **Nielsen Norman Group** — Match Between the System and the Real World; Designing Empty States in Complex Applications; Response Time Limits; Progressive Disclosure; 10 Guidelines for Reporting Errors in Forms; 10 Usability Heuristics
- **web.dev** — Optimize Cumulative Layout Shift; CLS; INP; content-visibility; scrollbar-gutter is Baseline
- **IBM Carbon Design System** — Tag usage; Modal usage
- **Atlassian Design System** — Lozenge; Badge; Modal dialog
- **Shopify Polaris** — Badge; Modal
- **SAP Fiori** — How to Use Semantic Colors
- **Pencil & Paper** — Enterprise Data Table UX Patterns
- **W3C** — WCAG 2.2; Target Size (Minimum); Non-text Contrast; Use of Color
- **ISA** — ANSI/ISA-101.01 High Performance HMI (IEC 63303)
- **MDN** — font-variant-numeric; scrollbar-gutter; content-visibility; inert; AbortController
