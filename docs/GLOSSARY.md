# IPCManagement UI/UX glossary

Đây là từ điển nhãn nghiệp vụ dùng khi viết label, heading, button, tab, status và thông báo trong UI.
Nếu một thuật ngữ chưa có ở đây, đối chiếu [`DOMAIN.md`](DOMAIN.md) và bổ sung trước khi dùng rộng rãi.

## 1. Vai trò và Work Objects
| Thuật ngữ chuẩn | Không dùng thay thế | Nghĩa/ngữ cảnh |
|---|---|---|
| Điều phối | Coordinator ở nhãn người dùng | Vai trò chọn khách hàng/tuần, chốt số suất và kích hoạt nhu cầu |
| Thu mua | Purchasing/Procurement trong nhãn người dùng | Vai trò xử lý thiếu, báo giá, đề xuất và đơn mua |
| Kho | Warehouse trong nhãn người dùng | Vai trò nhận hàng, ghi movement, tồn kho và xuất kho |
| Bếp | Chef/Kitchen trong nhãn người dùng | Vai trò xem kế hoạch, kiểm đếm và xác nhận phiếu xuất |
| Quản lý | Manager trong nhãn người dùng | Vai trò hậu kiểm/phê duyệt theo separation of duties |
| Quản trị viên | Admin trong nhãn người dùng | Vai trò quản trị dữ liệu, quyền và thực thi được phép |
| Thực đơn tuần | Weekly menu | Work object theo customer và week |
| Nhu cầu nguyên liệu | Demand | Lượng nguyên liệu cần theo ngày/ca và scope phục vụ |
| Đề xuất mua hàng | Purchase request | Đề xuất phát sinh từ phần thiếu, chờ xử lý/phê duyệt |
| Đơn mua | Purchase order | Cam kết mua đã được tạo từ quy trình thu mua |
| Phiếu nhập | Receipt | Chứng từ hàng được Kho tiếp nhận và kiểm tra |
| Phiếu xuất | Inventory issue | Chứng từ Kho cấp nguyên liệu cho Bếp |
| Cấp bổ sung | Supplemental | Vòng cấp tiếp khi Bếp thiếu so với phiếu đã nhận |
| Dòng nguồn | Source-line | Dòng chứng từ gốc mà action nghiệp vụ tác động |
| Bút toán tồn kho | Movement | Một lần thay đổi tồn kho bất biến, có nguồn và actor |

## 2. Bản đồ kiến trúc trạng thái theo thực thể (Rule S1.2, S1.7, L4, UI-Q13, T18, T19, D8)
> **Nguyên tắc một cột trạng thái:** Mỗi thực thể có đúng **một máy trạng thái sở hữu cột trạng thái chính** (Primary Owner). Các trạng thái thuộc vòng đời khác được coi là chiều phụ và hiển thị qua phương tiện riêng (header chip, checklist, tiến độ).
> **Chuẩn màu ISA-101 / High-Performance HMI (Rule D8):** Trạng thái bình thường dùng tông trung tính (`neutral`), chỉ dùng màu nhấn cho việc cần làm (`warning`) hoặc lỗi/chặn (`danger`).
> Giá trị thiếu/rỗng MUST NOT nằm trong registry trạng thái, mà hiển thị bằng ký hiệu rỗng thống nhất `—` (Rule T20).

| Thực thể (Entity) | Máy sở hữu cột trạng thái chính | Tập nhãn chuẩn của máy chính | Semantic Tone (ISA-101) | Chiều phụ & Phương thức hiển thị |
|---|---|---|---|---|
| **Thực đơn tuần** (`WeeklyMenu`) | `CREATION_LIFECYCLE` | `Bản nháp`, `Sẵn sàng`, `Hoàn tất` | `Bản nháp`: `neutral`<br>`Sẵn sàng`: `neutral`<br>`Hoàn tất`: `neutral` | `APPROVAL_LIFECYCLE` (`Chờ duyệt`, `Đã duyệt`, `Bị từ chối`) hiển thị qua Badge phê duyệt ở Header |
| **Đề xuất mua hàng** (`PurchaseRequest`) | `APPROVAL_LIFECYCLE` | `Chờ duyệt`, `Đã duyệt`, `Bị từ chối` | `Chờ duyệt`: `warning`<br>`Đã duyệt`: `neutral`<br>`Bị từ chối`: `danger` | `DOCUMENT_LIFECYCLE` (`Đã hủy`) hiển thị qua cờ chứng từ |
| **Đơn mua hàng / PO** (`PurchaseOrder`) | `PURCHASE_ORDER_LIFECYCLE` | `Bản nháp`, `Đã đặt hàng`, `Hoàn tất` | `Bản nháp`: `neutral`<br>`Đã đặt hàng`: `neutral`<br>`Hoàn tất`: `neutral` | `RECEIPT_LIFECYCLE` (`Nhận một phần`) hiển thị ở cột tiến độ giao nhận |
| **Phiếu nhập kho** (`WarehouseReceipt`) | `RECEIPT_LIFECYCLE` | `Nhận một phần`, `Hoàn tất` | `Nhận một phần`: `warning`<br>`Hoàn tất`: `neutral` | `DOCUMENT_LIFECYCLE` (`Đã hủy`) hiển thị qua cờ chứng từ |
| **Phiếu xuất kho** (`WarehouseIssue`) | `INVENTORY_ISSUE_LIFECYCLE` | `Chờ vật tư`, `Đã xuất kho` | `Chờ vật tư`: `warning`<br>`Đã xuất kho`: `neutral` | `DOCUMENT_LIFECYCLE` (`Đã hủy`) hiển thị qua cờ hủy |
| **Nhu cầu ngày–nguyên liệu** (`MaterialDemandItem`) | `PROCUREMENT_LIFECYCLE` | `Chờ vật tư`, `Sẵn sàng`, `Hoàn tất` | `Chờ vật tư`: `warning`<br>`Sẵn sàng`: `neutral`<br>`Hoàn tất`: `neutral` | Mức đáp ứng tồn kho (`Thiếu hàng` / `Đủ`) hiển thị qua chip định lượng |
| **Ca sản xuất bếp** (`ServiceRun`) | `SERVICE_RUN_LIFECYCLE` | `Bản nháp`, `Sẵn sàng`, `Đang mở`, `Bị chặn`, `Hoàn tất` | `Bản nháp`: `neutral`<br>`Sẵn sàng`: `neutral`<br>`Đang mở`: `warning`<br>`Bị chặn`: `danger`<br>`Hoàn tất`: `neutral` | `PRODUCTION_READINESS_LIFECYCLE` (4 track) hiển thị qua bảng checklist mức sẵn sàng |
| **Suất ăn điều phối** (`MealOrderCoordination`) | `COORDINATION_LIFECYCLE` | `Bản nháp`, `Đã xác nhận`, `Hoàn tất` | `Bản nháp`: `neutral`<br>`Đã xác nhận`: `neutral`<br>`Hoàn tất`: `neutral` | Biến động số suất (`Variance`) hiển thị qua chip cảnh báo inline |
| **Báo giá NCC** (`SupplierQuotation`) | `APPROVAL_LIFECYCLE` | `Chờ duyệt`, `Đã duyệt`, `Bị từ chối` | `Chờ duyệt`: `warning`<br>`Đã duyệt`: `neutral`<br>`Bị từ chối`: `danger` | Hiệu lực báo giá hiển thị qua cột ngày hết hạn |
| **Bút toán tồn kho** (`InventoryMovement`) | `FULFILLMENT_LIFECYCLE` | `Hoàn tất` | `Hoàn tất`: `neutral` | Phân loại bút toán (`Nhập`/`Xuất`) hiển thị ở cột loại giao dịch |

## 3. Trạng thái tải & Rỗng (Rule E2, E8)
| Nhãn hiển thị | Loại trạng thái | Ý nghĩa |
|---|---|---|
| **Đang tải...** | Loading | Đang nạp snapshot dữ liệu mới (kèm aria-busy, skeleton giữ chỗ) |
| **Đang cập nhật...** | Refreshing | Đang refetch dữ liệu nền, giữ nguyên snapshot hiển thị |
| **Chưa có dữ liệu** | Empty / Uncreated | Nghiệp vụ thật sự chưa tạo dữ liệu cho phạm vi này |
| **Không tìm thấy kết quả** | Filtered Empty | Có dữ liệu nhưng bộ lọc/tìm kiếm hiện tại không khớp |
| **Không tải được dữ liệu** | Network / Error | Lỗi kết nối hoặc máy chủ (bắt buộc có nút Thử lại) |
| **Không có quyền** | Forbidden | Người dùng không có quyền truy cập phạm vi này |

## 4. Quy tắc dùng thuật ngữ
- Nhãn hiển thị ưu tiên tiếng Việt và ngôn ngữ công việc; enum/API key chỉ dùng trong code hoặc technical detail.
- Một khái niệm dùng một tên, một status label và một tone semantic trên toàn app.
- Không dùng tên bảng, tên cột, UUID, hash hoặc status kỹ thuật làm heading/label chính.
- Khi cần hiển thị mã, đặt tên dễ đọc trước, mã sau và cung cấp thao tác sao chép.
