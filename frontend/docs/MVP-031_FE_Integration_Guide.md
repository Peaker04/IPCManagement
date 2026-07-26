# Hướng dẫn Tích hợp FE - MVP-031: Cảnh báo thiếu tồn (Stock Exception)

Tài liệu này mô tả cách Frontend (FE) tích hợp và xử lý tính năng **Chặn xuất kho vượt tồn và gợi ý mua hàng bổ sung** khi gọi API tạo phiếu xuất kho.

## 1. Tổng quan Luồng xử lý (Workflow)

Khi người dùng (Thủ kho) tạo một phiếu xuất kho (Inventory Issue) dựa trên Yêu cầu nguyên liệu (Material Request), hệ thống sẽ kiểm tra lượng tồn kho khả dụng hiện tại của từng nguyên liệu.
- **Nếu đủ tồn kho:** Phiếu xuất được tạo thành công (HTTP 201 Created).
- **Nếu thiếu tồn kho:** API lập tức **chặn (block)** không cho tạo phiếu xuất, dữ liệu về việc thiếu hụt được ghi log vào hệ thống và API trả về lỗi **HTTP 409 Conflict**.

## 2. Payload Lỗi API trả về

Khi xảy ra lỗi thiếu tồn kho, Backend trả về HTTP `409 Conflict` với cấu trúc JSON như sau:

```json
{
  "success": false,
  "message": "Không đủ tồn kho để tạo phiếu xuất.",
  "data": {
    "materialRequestId": "12345678-1234-1234-1234-123456789012",
    "materialRequestCode": "MR-20260707-ABCD",
    "warehouseId": "87654321-4321-4321-4321-210987654321",
    "warehouseName": "Kho Bếp Chính",
    "issueDate": "2026-07-07",
    "lines": [
      {
        "ingredientId": "...",
        "ingredientName": "Thịt Bò",
        "unitId": "...",
        "unitName": "Kg",
        "requiredQty": 20.0,
        "availableQty": 5.0,
        "missingQty": 15.0
      },
      {
        "ingredientId": "...",
        "ingredientName": "Cà chua",
        "unitId": "...",
        "unitName": "Kg",
        "requiredQty": 10.0,
        "availableQty": 0.0,
        "missingQty": 10.0
      }
    ],
    "suggestedAction": "Vui lòng tạo yêu cầu mua hàng (Purchase Request) bổ sung cho các nguyên liệu bị thiếu."
  }
}
```

### Các trường quan trọng:
- `data.lines`: Mảng chi tiết các nguyên liệu đang thiếu. Chứa thông tin lượng yêu cầu (`requiredQty`), tồn thực tế (`availableQty`) và lượng bị thiếu (`missingQty`).
- `data.suggestedAction`: Câu thông báo gợi ý hướng xử lý (tạo yêu cầu mua hàng) để FE hiển thị lên giao diện.

## 3. Khuyến nghị Tích hợp phía Frontend (FE)

Khi gọi API `POST /api/inventory-issues`, FE nên thực hiện các bước sau trong khối `catch` lỗi:

1. **Kiểm tra mã lỗi:** Nếu `error.response.status === 409`, chứng tỏ đây là lỗi thiếu tồn kho.
2. **Hiển thị thông báo (Modal/Dialog):** Đừng chỉ hiện Toast message ngắn gọn. FE nên bung ra một Modal/Dialog hiển thị rõ:
   - Lý do: "Không đủ tồn kho để tạo phiếu xuất"
   - Danh sách dạng bảng (Table) các nguyên liệu bị thiếu: Tên nguyên liệu, Cần, Hiện có, Thiếu bao nhiêu (lấy từ mảng `data.lines`).
   - Lời khuyên: Hiển thị dòng `data.suggestedAction`.
3. **Điều hướng (Call-to-Action):** Trong Modal, hãy thêm một nút bấm **"Tạo Yêu cầu mua hàng" (Create Purchase Request)**. Nút này khi bấm vào sẽ dẫn người dùng sang màn hình tạo Purchase Request, có thể truyền sẵn params lên URL hoặc Context các nguyên liệu bị thiếu để autofill form mua hàng.

## 4. Cách Test (Manual Testing)

Để kiểm tra xem tính năng này đã hoạt động đúng chưa, bạn có thể thực hiện Test theo các bước sau:

### Bước 1: Chuẩn bị dữ liệu
- **Nguyên liệu X:** Đảm bảo tồn kho (Current Stock) của nguyên liệu X tại kho đang là một con số nhỏ (ví dụ: 10 Kg).
- **Yêu cầu nguyên liệu (Material Request):** Tạo và duyệt một `Material Request` có chứa nguyên liệu X với số lượng cần xuất **lớn hơn** tồn kho (ví dụ: 25 Kg). Đảm bảo Material Request này ở trạng thái có thể xuất (`APPROVED` hoặc `SENTTOWAREHOUSE`).

### Bước 2: Thao tác xuất kho
- Đăng nhập với quyền Thủ kho.
- Mở chức năng **Xuất kho** cho Material Request ở trên.
- Chọn ngày xuất, kho xuất và xác nhận Xuất kho.
- Payload gửi lên `POST /api/inventory-issues` sẽ trông như sau:
  ```json
  {
    "issueDate": "2026-07-07",
    "shiftName": "MORNING",
    "warehouseId": "<Warehouse ID>",
    "materialRequestId": "<Material Request ID>",
    "lines": [
      {
        "ingredientId": "<Ingredient ID>",
        "requestedQty": 25,
        "issuedQty": 25,
        "unitId": "<Unit ID>"
      }
    ]
  }
  ```

### Bước 3: Quan sát kết quả
- **Hệ thống (API):** Trả về HTTP `409 Conflict`.
- **Giao diện:** Hiển thị thông báo lỗi cụ thể (như đã phân tích ở phần Khuyến nghị FE). Bảng thông báo cần nêu rõ: Nguyên liệu X, Yêu cầu: 25, Hiện có: 10, Thiếu: 15.
- **Database (Bảng AuditLog):** Có một bản ghi được sinh ra với `BusinessArea = "StockException"` và `FieldName = "StockShortage"`, lưu lại lịch sử cảnh báo thiếu hụt. (Kiểm tra bằng SQL Server / SQLite DB Browser).

### Bước 4: Test luồng thành công (Regression Test)
- Sau khi có lỗi trên, bạn hãy **thử xuất một phiếu xuất khác** với số lượng yêu cầu <= tồn kho (ví dụ: 5 Kg).
- Lần này hệ thống phải tạo thành công (HTTP 201), lượng tồn giảm tương ứng. Mọi thứ phải hoạt động bình thường, không bị kẹt lỗi cũ. Mảng `suggestedAction` hay `Lines` thiếu hụt sẽ không xuất hiện.
