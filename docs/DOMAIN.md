# IPC Management làm gì?

IPC Management điều phối bữa ăn công nghiệp từ thực đơn và số suất đến nguyên liệu, mua hàng, kho và bếp. Mục tiêu không chỉ là lưu chứng từ: hệ thống phải cho thấy mỗi việc đang ở đâu, ai được hành động tiếp và tồn kho thay đổi từ nguồn nào.

## Bốn vai trò vận hành

| Vai trò | Trách nhiệm chính | Bàn giao cho |
|---|---|---|
| Điều phối | Chọn khách hàng/tuần, chốt số suất theo ngày và ca, kích hoạt nhu cầu nguyên liệu. | Thu mua và Kho qua demand đã đủ điều kiện. |
| Thu mua | Xử lý phần thiếu, chọn báo giá/nhà cung cấp, lập đề xuất và đơn mua sau phê duyệt. | Kho qua purchase order và lịch nhận. |
| Kho | Nhận hàng, ghi stock movement, theo dõi current-stock snapshot, lập phiếu xuất theo nhu cầu và xử lý cấp bổ sung. | Bếp qua inventory issue/source-line. |
| Bếp | Xem kế hoạch sản xuất, kiểm đếm và xác nhận phiếu xuất; khai báo thiếu, dư, trả hoặc hao hụt. | Khép workflow hoặc tạo vòng bổ sung mới. |

Admin và Manager là lớp quản trị/phê duyệt xuyên luồng: quản lý master data, permission và các quyết định cần separation of duties. Họ không thay thế bốn owner vận hành bên trên.

### Thay đổi thực đơn đã khóa

Một thay đổi thực đơn đã gửi phải giữ snapshot impact tại lúc tạo. Luồng chuẩn là **Điều phối tạo → Manager hậu kiểm → Admin thực thi**; ba thao tác dùng ba danh tính khác nhau. Khi đã có PO, nhập hoặc xuất kho, thay đổi chuyển sang đối soát append-only và không được regeneration trực tiếp. Admin vẫn có break-glass cho yêu cầu chưa phát sinh chứng từ vật lý, nhưng phải nêu lý do; hành động đó ghi audit `BreakGlassExecute` để hậu kiểm.

## Luồng lõi

```text
Thực đơn + số suất đã chốt
  → nhu cầu theo ngày
  → Kho cấp phần có sẵn
  → phần thiếu / yêu cầu bổ sung
  → Thu mua chọn nhà cung cấp và xin duyệt
  → purchase order
  → Kho nhập hàng và ghi movement
  → Kho cấp phần còn lại
  → Bếp kiểm đếm, xác nhận hoặc ghi chênh lệch
  → workflow terminal hoặc mở vòng bổ sung/trả kho
```

Mỗi bước phải giữ ID dòng nguồn. UI có thể gộp dòng để dễ đọc, nhưng nhận hàng, xuất kho, ký nhận và audit luôn thao tác trên chứng từ/source-line thật. Contract grain chi tiết nằm ở [DATA-GRAIN-MATRIX.md](DATA-GRAIN-MATRIX.md).

## Customer, tier và week

- **Customer** là đơn vị được phục vụ. Cùng một món có thể có scope/BOM/quy tắc khác nhau theo khách hàng.
- **Tier** là bậc đơn giá áp dụng cho menu của một customer trong một tuần. Tier tham gia lookup BOM và cost; không được trộn nhiều tier trong cùng scope customer/week.
- **Week** là work object lập kế hoạch. Menu được nhìn theo tuần, nhưng demand, cấp kho và xác nhận Bếp vẫn có grain ngày/ca; màn nhiều ngày phải hiển thị ngày.

## Trạng thái và quyền

Action chỉ xuất hiện khi role có permission và object ở đúng state. UI phải hiển thị lý do bị chặn; backend vẫn là nơi enforce cuối cùng. Phê duyệt, nhận hàng, xuất kho và xác nhận Bếp là các transition có audit, không phải các nút “đánh dấu xong” cục bộ trên frontend.

## Thuật ngữ phải dùng nhất quán

| Thuật ngữ | Nghĩa trong IPC |
|---|---|
| **Grain** | Mức chi tiết mà một dòng đại diện: ngày/ca, tổng tuần, snapshot, source-line hay movement. Hai dòng cùng tên chưa chắc trùng grain. |
| **Lane** | Database/môi trường cô lập dùng cho một luồng test. Lane không được reset hay nạp lại chỉ để làm test xanh. |
| **Source-line** | ID dòng chứng từ gốc mà action nghiệp vụ tác động. Tên nguyên liệu chỉ là nhãn hiển thị, không thay thế source-line ID. |
| **Movement** | Bút toán bất biến ghi một lần thay đổi tồn kho, có loại, số lượng, tham chiếu nguồn và người thao tác. |
| **Supplemental** | Vòng cấp bổ sung khi Bếp thiếu so với phiếu đã nhận; có thể được Kho cấp tiếp hoặc chuyển Thu mua. |
| **Signoff** | Xác nhận có danh tính và audit rằng người nhận đã kiểm đếm/kết thúc trách nhiệm ở một transition. |
| **Protected fingerprint** | Dấu vân checksum/identity của artifact hoặc dữ liệu cần bảo toàn; thay đổi phải bị gate phát hiện. |
| **Sanitizer** | Luồng dọn dữ liệu có allowlist, precondition, audit và rollback; không đồng nghĩa seed/reset. |
| **Quick-completion** | Nhánh hoàn tất nhanh chỉ hợp lệ khi precondition nghiệp vụ chứng minh không còn bước vật lý hay chứng từ bắt buộc. |
