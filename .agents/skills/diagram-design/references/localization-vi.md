# IPCManagement — Quy chuẩn diagram tiếng Việt

Mở rộng skill [`diagram-design`](../SKILL.md) cho tài liệu bàn giao khách hàng của IPCManagement. Nguồn nghiệp vụ luôn là code/runtime và tài liệu canonical trong dự án; diagram chỉ là góc nhìn hướng dẫn thao tác.

## 1. Kiểu chữ

| Vai trò | Font | Cỡ tối thiểu |
|---|---|---:|
| Tiêu đề | `'Noto Serif', serif` | 22px |
| Node, mô tả và hướng dẫn tiếng Việt | `'Noto Sans', 'Segoe UI', sans-serif` | 12px |
| Nhãn connector | `'Noto Sans', sans-serif` | 11px |
| Trạng thái, route, ID kỹ thuật | `'Geist Mono', monospace` | 11px |

- Nạp font cục bộ bằng `assets/fonts/fonts.css`; chờ `document.fonts.ready` trước khi đo hoặc xuất.
- Không dùng monospace cho câu tiếng Việt.
- SVG nhiều dòng dùng `<tspan>` với `dy="1.4em"`; không co chữ để ép vào hộp.

## 2. Node do nội dung quyết định

- Padding trong node tối thiểu 14px; chữ cách viền tối thiểu 8px.
- Nếu thêm một dòng, tăng chiều cao node và dịch toàn bộ node/connector phía sau.
- Khoảng cách node tối thiểu 24px; khoảng cách giữa các khối case tối thiểu 28px.
- Nội dung hướng dẫn khách hàng dùng động từ đúng nhãn UI thực tế, không dùng enum kỹ thuật thay cho thao tác.

## 3. Connector không chồng chéo

1. Chỉ dùng đường thẳng khi hai đầu cùng trục; còn lại dùng connector vuông góc, góc bo 6–8px.
2. Mỗi connector có attach point riêng; các điểm cùng cạnh cách nhau tối thiểu 12px.
3. Không dùng chung stroke cho nhiều nhánh. Mỗi nhánh quay về có rail riêng, cách rail kế bên tối thiểu 20px.
4. Nhánh chính dùng nét liền; nhánh phục hồi/chờ xử lý dùng nét đứt.
5. Nhãn đặt trên đoạn thẳng giữa hai góc rẽ, có nền che và cách stroke 6–10px.
6. Connector không đi xuyên node không liên quan. Nếu không còn hành lang trống, đổi bố cục thay vì chồng đường.

## 4. Một workflow E2E cho khách hàng

Khi yêu cầu một workflow duy nhất:

- Dùng một trục chính trái → phải, tối đa 7 giai đoạn.
- Các trường hợp nghiệp vụ nằm dưới đúng điểm quyết định, không tách thành diagram riêng.
- Mỗi case phải ghi rõ: điều kiện nhận biết → thao tác người dùng → kết quả/điểm quay lại.
- Phân vai bằng lane hoặc nhãn owner; không ngụ ý một vai trò được thao tác thay vai trò khác.
- Nội dung chế độ `MATERIAL_RECONCILIATION` phải bám `docs/domain/material-reconciliation.md`: Điều phối chuẩn bị và chuyển lô; Thủ kho xuất theo ngày/xuất thêm; Quản lý xử lý chênh lệch và hoàn tất; Bếp trưởng chỉ xem phiếu nấu.

## 5. Zero-collision gate

Diagram chỉ được bàn giao khi:

- Không text/text, text/node, node/node hoặc connector/non-owner-node overlap.
- Không clipping, overflow hoặc chữ tiếng Việt dưới 11px.
- Chạy thành công:

```bash
python .agents/skills/diagram-design/scripts/self_check.py docs/diagrams/<file>.html
python scripts/diagram_tool.py validate docs/diagrams/<file>.html
```

- Xuất PNG/PDF rồi mở PNG kích thước thật để kiểm tra trực quan; validator không thay thế visual review.
