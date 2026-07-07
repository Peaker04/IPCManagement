# Hướng dẫn tích hợp Frontend và Test: Xác nhận phiếu trả nguyên liệu (MVP-033)

Tài liệu này cung cấp hướng dẫn cho đội Frontend (FE) để tích hợp tính năng Xác nhận phiếu trả nguyên liệu (hoặc báo cáo hao hụt) từ Bếp về Kho (MVP-033). Tính năng này dành cho người dùng có vai trò **Thủ kho (Storekeeper)**.

---

## 1. Tổng quan luồng nghiệp vụ

1. Bếp trưởng tạo phiếu trả nguyên liệu thừa (`ReturnType = "RETURN"`) hoặc phiếu báo cáo hao hụt (`ReturnType = "WASTE"`).
2. Phiếu sau khi tạo sẽ ở trạng thái chờ Thủ kho xác nhận. Ở bước này, số lượng tồn kho **chưa được cộng lại**.
3. **(Bước FE cần làm)**: Thủ kho xem danh sách các phiếu trả chưa được xác nhận.
4. **(Bước FE cần làm)**: Thủ kho kiểm tra thực tế, có quyền chỉnh sửa số lượng thực nhận nếu có chênh lệch, kèm theo ghi chú chênh lệch.
5. **(Bước FE cần làm)**: Thủ kho bấm Xác nhận. Hệ thống sẽ ghi nhận người xác nhận, thời gian, cộng lại số lượng vào Tồn kho (với RETURN) hoặc ghi nhận Hao hụt sản xuất (với WASTE), và lưu vào Audit log.

---

## 2. Các API liên quan

### 2.1. Lấy danh sách phiếu trả chờ xác nhận
Sử dụng API lấy danh sách Inventory Returns với các query parameters để lọc:
- **Endpoint**: `GET /api/inventory-returns`
- **Query Params quan trọng**:
  - `IsReceived=false`: Lọc ra các phiếu **chưa** được xác nhận.
  - `IsReceived=true`: Lọc ra các phiếu **đã** được xác nhận (nếu cần làm màn hình Lịch sử).
  - Các bộ lọc khác nếu có (WarehouseId, ShiftName, Date...).

**Ví dụ Request:**
```http
GET /api/inventory-returns?IsReceived=false&Page=1&Size=20
Authorization: Bearer <Storekeeper_Token>
```

### 2.2. Xác nhận phiếu trả
- **Endpoint**: `POST /api/inventory-returns/{returnId}/confirm-receipt`
- **Method**: `POST`
- **Body (`ConfirmInventoryReturnReceiptDto`)**:

```json
{
  "hasDiscrepancy": true,
  "discrepancyNote": "Nguyên liệu A thực tế chỉ có 2kg thay vì 3kg như bếp báo",
  "adjustedLines": [
    {
      "returnLineId": "guid-của-dòng-trả",
      "newQuantity": 2.0
    }
  ]
}
```

**Mô tả Body:**
- `hasDiscrepancy` (boolean): `true` nếu số lượng thực nhận khác với số bếp báo; `false` nếu khớp hoàn toàn.
- `discrepancyNote` (string): Bắt buộc nếu `hasDiscrepancy` là `true`. Là ghi chú lý do chênh lệch.
- `adjustedLines` (array): Danh sách các dòng có số lượng thay đổi. FE chỉ cần gửi các dòng mà Thủ kho có chỉnh sửa số lượng. Dòng nào không sửa thì không cần gửi vào mảng này.

---

## 3. Hướng dẫn UI Flow cho Frontend

1. **Màn hình Danh sách phiếu trả (Dành cho Thủ kho)**:
   - Gọi `GET /api/inventory-returns?IsReceived=false`.
   - Hiển thị danh sách phiếu (Mã phiếu, ngày, ca, lý do, loại phiếu RETURN/WASTE).
   - Có nút **"Kiểm tra & Xác nhận"** (Review & Confirm) cho mỗi phiếu.

2. **Màn hình/Modal Chi tiết Xác nhận**:
   - Khi bấm "Kiểm tra", hiển thị các dòng nguyên liệu trong phiếu trả.
   - Mỗi dòng có cột **Số lượng Bếp báo** (Read-only) và một ô input **Số lượng Thực nhận** (Có thể edit).
   - Mặc định, `Số lượng Thực nhận` = `Số lượng Bếp báo`.
   - Nếu Thủ kho sửa `Số lượng Thực nhận` khác với số ban đầu:
     - Tự động check vào ô `Có chênh lệch (Has Discrepancy) = true`.
     - Hiện text area yêu cầu nhập **Ghi chú chênh lệch (Discrepancy Note)**.
   - Nút **"Xác nhận đã nhận"** (Confirm Receipt).
   - Khi click Xác nhận, map các thay đổi vào payload `adjustedLines` và gọi API `POST /api/inventory-returns/{returnId}/confirm-receipt`.

3. **Sau khi Xác nhận thành công**:
   - Thông báo "Xác nhận thành công".
   - Loại phiếu đó khỏi danh sách "Chưa xác nhận" (refresh lại list).

---

## 4. Hướng dẫn Test End-to-End (E2E)

Để đảm bảo tính năng chạy đúng, Tester/Frontend Dev cần thực hiện kịch bản test sau:

### Kịch bản 1: Xác nhận Khớp (Không chênh lệch)
1. **[Bếp]**: Bếp trưởng tạo 1 phiếu Return với 5kg Thịt gà.
2. **[Kho]**: Kiểm tra số lượng tồn kho của Thịt gà hiện tại (VD: đang có `100kg`).
3. **[FE/Kho]**: Đăng nhập tk Thủ kho, vào màn danh sách phiếu trả chưa xác nhận, chọn phiếu vừa tạo.
4. **[FE/Kho]**: Bấm Xác nhận (Không sửa số lượng, HasDiscrepancy = false).
5. **[Kết quả mong đợi]**: 
   - API trả về `200 OK`.
   - Tồn kho của Thịt gà tăng lên `105kg` (Check qua DB hoặc màn Tồn kho).
   - Phiếu chuyển trạng thái thành Đã xác nhận (`ReceivedBy` và `ReceivedAt` có dữ liệu).

### Kịch bản 2: Xác nhận Có chênh lệch
1. **[Bếp]**: Bếp trưởng tạo 1 phiếu Return với 10kg Gạo.
2. **[Kho]**: Kiểm tra tồn kho Gạo hiện tại (VD: đang có `50kg`).
3. **[FE/Kho]**: Vào phiếu vừa tạo. Đổi số lượng thực nhận thành `8kg`.
4. **[FE/Kho]**: UI tự động yêu cầu nhập Ghi chú. Nhập "Cân lại chỉ được 8kg".
5. **[FE/Kho]**: Bấm Xác nhận (HasDiscrepancy = true).
6. **[Kết quả mong đợi]**: 
   - API trả về `200 OK`.
   - Tồn kho Gạo tăng thêm 8kg (thành `58kg`), KHÔNG phải 10kg.
   - Trong bảng `Auditlogs` ở DB có ghi nhận lịch sử thay đổi `Quantity` từ 10 xuống 8.

### Kịch bản 3: Xử lý Lỗi Validation
1. **[FE/Kho]**: Cố tình đổi số lượng thành âm (`-2`) hoặc lớn hơn số lượng xuất gốc.
2. **[Kết quả mong đợi]**: API trả về `400 Bad Request` kèm message lỗi (VD: "Quantity cannot be negative"). UI hiển thị lỗi rõ ràng cho người dùng.
3. **[FE/Kho]**: Cố tình đánh dấu `HasDiscrepancy = true` nhưng bỏ trống Ghi chú.
4. **[Kết quả mong đợi]**: API trả về `400 Bad Request` yêu cầu phải có Ghi chú. UI bắt lỗi và thông báo.
