# Checklist kiểm chứng UI

Dùng file này thay cho câu lệnh "tìm lỗi UI trong ảnh này".

## Vì sao cần checklist

Một tấm ảnh chỉ trả lời được câu hỏi "cái gì đang hiển thị". Nó không bao giờ trả lời được câu hỏi "cái gì đáng lẽ phải hiển thị". Thiếu vế thứ hai thì không có gì để so sánh, nên agent mặc định kết luận hiện trạng là đúng.

Checklist này cung cấp vế thứ hai. Mỗi mục là một mệnh đề có thể đo, không phải một cảm nhận.

## Định dạng bắt buộc của câu trả lời

Agent phải trả về đúng cấu trúc này cho từng mục, không thêm văn xuôi:

```json
[
  {
    "rule": "S1",
    "verdict": "FAIL",
    "measured": "badge 'Chờ phê duyệt cấp 2' rộng 214px, badge 'Mới' rộng 152px, lệch 62px",
    "selector": "td.cell-status > span.badge"
  }
]
```

Quy tắc chấm:

| verdict | Khi nào dùng |
| --- | --- |
| `PASS` | Đã đo được và số đo thoả quy tắc |
| `FAIL` | Đã đo được và số đo vi phạm quy tắc |
| `UNVERIFIABLE` | Không đo được bằng công cụ hiện có |

**Cấm** trả lời định tính: "trông ổn", "có vẻ hơi chật", "đã đẹp hơn", "tôi thấy không có vấn đề gì".

**Cấm** dùng `PASS` khi bằng chứng duy nhất là ảnh chụp màn hình. Trường hợp đó bắt buộc là `UNVERIFIABLE`.

## Cách chạy

1. Mở trang với dữ liệu xấu nhất: thêm `?mock=long` vào URL.
2. Chạy `npm run audit:overflow` để lấy số đo tự động.
3. Đưa agent file `artifacts/overflow-report.json` cộng với checklist này. **Không đưa ảnh.**
4. Yêu cầu agent trả về mảng JSON theo đúng định dạng trên.

---

## L — Ngôn ngữ và dữ liệu

### L1 — Không hiển thị mã hệ thống thô cho người dùng

Cách đo: quét toàn bộ text hiển thị, đối chiếu regex `/^[A-Z]{2,4}-[A-Z0-9-]{6,}$/`.

```js
[...document.querySelectorAll('td, .cell, dd, .value')]
  .map((el) => el.textContent.trim())
  .filter((t) => /^[A-Z]{2,4}-[A-Z0-9-]{6,}$/.test(t))
```

Đạt khi mảng kết quả rỗng, hoặc mọi mã còn lại đều có nhãn người-đọc-được đi kèm.

### L2 — Không lộ tên enum ra giao diện

Cách đo: tìm chuỗi viết hoa toàn phần có gạch dưới, ví dụ `FULLDAY`, `IN_PROGRESS`.

Đạt khi không tìm thấy chuỗi nào khớp `/^[A-Z][A-Z_]{3,}$/` trong vùng nội dung.

### L3 — Không hiển thị chuỗi rỗng thành `null` hoặc `undefined`

Cách đo: tìm literal `"null"`, `"undefined"`, `"NaN"`, `"Invalid Date"` trong text.

Đạt khi không tìm thấy, và ô rỗng hiển thị ký hiệu thay thế thống nhất.

---

## S — Trạng thái và badge

### S1 — Badge có min-width cố định

Cách đo: render badge với ba nhãn dài nhất trong tập trạng thái, so sánh `offsetWidth`.

```js
[...document.querySelectorAll('.badge')].map((el) => el.offsetWidth)
```

Đạt khi mọi badge cùng cột có chiều rộng bằng nhau. Chênh lệch dù chỉ 1px cũng là `FAIL`, vì nó sẽ kéo theo dịch chuyển cột khi dữ liệu đổi.

### S2 — Badge không bọc xuống hai dòng

Cách đo: so `el.scrollHeight` với `el.clientHeight`.

Đạt khi bằng nhau ở cả bốn khung nhìn.

### S3 — Tối đa hai badge trên một dòng

Cách đo: đếm `.badge` trong mỗi `tr`.

Đạt khi mọi dòng đều có không quá 2.

---

## C — Ổn định layout

### C1 — Không có thanh cuộn ngang toàn trang

Cách đo:

```js
document.documentElement.scrollWidth <= window.innerWidth + 1
```

Phải đúng ở cả bốn khung nhìn 1024, 1280, 1440, 1920. Script `audit:overflow` đã kiểm mục này và báo dưới mã `PAGE_H_SCROLL`.

### C2 — CLS dưới 0.1

Cách đo: Chrome DevTools MCP, `performance_start_trace` kèm reload, đọc chỉ số CLS và mục Layout shift culprits.

Đạt khi CLS tại phân vị 75 nhỏ hơn hoặc bằng 0.1.

### C3 — Khung chờ có cùng kích thước với nội dung thật

Cách đo: chụp `getBoundingClientRect()` của vùng chứa lúc đang loading và sau khi có dữ liệu.

Đạt khi chiều cao lệch không quá 2px.

---

## T — Bảng dữ liệu

### T1 — Cột số căn phải và dùng chữ số đều chiều rộng

Cách đo:

```js
const cs = getComputedStyle(cell)
cs.textAlign === 'right' && cs.fontVariantNumeric.includes('tabular-nums')
```

Đạt khi cả hai điều kiện đều đúng với mọi ô chứa số. Thiếu `tabular-nums` thì chữ số sẽ nhảy ngang khi giá trị thay đổi.

### T2 — Chiều cao dòng đồng nhất

Cách đo: lấy `offsetHeight` của mọi `tr`, đếm số giá trị khác nhau.

Đạt khi chỉ có đúng một giá trị, kể cả khi chạy với `?mock=long`.

### T3 — Tiêu đề cột không bị cắt

Cách đo: với mọi `th`, so `scrollWidth` và `clientWidth`.

Đạt khi chính lệch không quá 1px ở khung nhìn nhỏ nhất được hỗ trợ.

### T4 — Bảng trên 100 dòng phải virtualize

Cách đo: nạp `?mock=huge` rồi đếm số `tr` thực sự có trong DOM.

Đạt khi số node nhỏ hơn nhiều so với 10.000, thông thường dưới 100.

---

## M — Modal

### M1 — Mở modal không gây dịch chuyển nền

Cách đo: so `document.body.clientWidth` trước và sau khi mở.

Đạt khi hai giá trị bằng nhau. Đây là lỗi phổ biến nhất: đặt `overflow: hidden` lên body làm thanh cuộn biến mất và toàn trang giật sang phải. Sửa bằng `scrollbar-gutter: stable`.

### M2 — Chỉ một instance modal ở cấp trang

Cách đo:

```js
document.querySelectorAll('[role="dialog"], [data-modal-root]').length
```

Đạt khi kết quả không vượt quá 1, kể cả khi bảng đang có 10.000 dòng. Render modal trong từng dòng là nguyên nhân số một khiến bảng lớn chậy.

### M3 — Khung modal xuất hiện dưới 100ms

Cách đo: Chrome DevTools MCP, ghi trace quanh thao tác click mở modal.

Đạt khi khung hình đầu tiên của modal xuất hiện dưới 100ms, dữ liệu đầy đủ dưới 1 giây.

### M4 — Trả focus khi đóng

Cách đo: ghi lại `document.activeElement` trước khi mở, so lại sau khi đóng.

Đạt khi hai phần tử là một.

### M5 — Nền phía sau bị vô hiệu hoá

Cách đo: kiểm tra vùng nền có thuộc tính `inert` hoặc `aria-hidden="true"` khi modal đang mở.

Đạt khi có, và nhấn Tab không thoát được ra khỏi modal.

---

## F — Hiệu năng

### F1 — INP dưới 200ms

Cách đo: Chrome DevTools MCP, ghi trace trong lúc cuộn bảng và mở modal.

Đạt khi không có tương tác nào vượt 200ms.

### F2 — Không có tác vụ dài trên luồng chính khi cuộn

Cách đo: đọc mục long tasks trong trace.

Đạt khi không có tác vụ nào vượt 50ms.

---

## Mẫu câu lệnh cho agent

Dán nguyên đoạn dưới đây, thay phần trong ngoặc vuông:

```text
Kiểm tra trang [URL]?mock=long theo docs/assertion-checklist.md.

Ràng buộc:
- Chạy npm run audit:overflow trước, đọc artifacts/overflow-report.json.
- Với mục nào không có trong báo cáo, tự đo bằng đoạn JS ghi trong checklist.
- Chỉ trả về mảng JSON đúng định dạng {rule, verdict, measured, selector}.
- Không viết văn xuôi. Không nhận xét thẩm mỹ.
- Mục nào không đo được thì ghi UNVERIFIABLE kèm lý do, tuyệt đối không đoán.

Sau khi có kết quả, dừng lại và chờ tôi duyệt trước khi sửa bất cứ thứ gì.
```

Bước "dừng lại và chờ duyệt" rất đáng giữ. Nó tách giai đoạn chẩn đoán khỏi giai đoạn sửa, ngăn agent vừa đo vừa sửa rồi tự hợp lý hoá những thay đổi nó đã trót làm.
