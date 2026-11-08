# Checklist lifecycle Ca phục vụ

> **HISTORICAL / NO EXECUTION AUTHORITY.** Trạng thái trong file phản ánh thời điểm tạo. Dùng `MEMORY.md`, `docs/README.md` và phase hiện hành để quyết định công việc.


> Trạng thái: hoàn tất; evidence Chrome headed, API và DB cho toàn bộ lifecycle nằm tại `docs/EVIDENCE-INDEX.md`.
> Scope: khép vòng đời vận hành từ kế hoạch đã chốt đến phục vụ và đối soát ca; không bao gồm hóa đơn, công nợ hoặc sổ cái kế toán.

## Định nghĩa chuẩn

- [x] **Ca phục vụ (Service Run)** là work object thực thi có grain `productionPlan + shift`.
- [x] Bốn track độc lập: kế hoạch, vật tư, thực thi phục vụ và đối soát.
- [x] `Bếp đã nhận` là hoàn tất bàn giao vật tư, không đồng nghĩa ca đã hoàn tất.
- [x] Dữ liệu legacy không được suy diễn/backfill; chỉ có thể hiển thị là chưa liên kết.
- [x] Chính sách xác nhận giao suất mặc định là `WAIVABLE`: Manager được miễn xác nhận với lý do có audit.

## Invariant khi đóng ca

- [x] Kế hoạch số suất của ca đã sign-off.
- [x] Không còn BOM/đơn vị bị chặn cho ca.
- [x] Không còn mua/cấp bổ sung/phiếu xuất Bếp chưa ký nhận có liên quan.
- [x] Số suất thực tế đã được ghi nhận.
- [x] Chênh lệch suất, trả kho, hao hụt hoặc nhận thiếu đã có lý do và quyết định cần thiết.
- [x] Đã có xác nhận giao suất, hoặc miễn xác nhận với lý do và actor.
- [x] Snapshot đóng ca ghi lại baseline, thực tế, các chứng từ nguồn và actor; ca đã đóng không bị sửa trực tiếp.

## Backend foundation

- [x] Chốt vocabulary trạng thái và blocker trong một domain module thuần.
- [x] Thêm aggregate `ServiceRun` theo migration additive, unique `planId + shiftName`.
- [x] Tạo read projection tổng hợp trạng thái, blockers và counters từ source-line.
- [x] Tạo commands: mở ca, bắt đầu phục vụ, ghi nhận suất thực tế, resolve variance, xác nhận/miễn giao suất, đóng ca và correction append-only sau close.
- [x] Ghi audit cho mọi transition và giữ close snapshot bất biến.

## Tích hợp chứng từ đang có

- [x] `ProductionPlan` đã gửi Bếp mới đủ điều kiện mở Ca phục vụ; không đổi semantics `SENTTOKITCHEN`.
- [x] Material request, inventory issue, kitchen receipt, return và supplemental cập nhật projection theo source-line.
- [x] Thiếu BOM, thiếu tồn, issue chưa nhận và supplemental mở hiện thành blocker rõ ràng của đúng Ca phục vụ.
- [x] Chứng từ sau close chỉ đi qua adjustment có audit, không rewrite dòng lịch sử.

## UI và báo cáo

- [x] Chef có work object Ca phục vụ với bốn track và action hợp lệ từ backend.
- [x] Warehouse/Purchasing hiển thị Ca phục vụ bị chứng từ của mình chặn từ lifecycle projection chung.
- [x] Badge FE render từ lifecycle projection/backend token, không tự tổng hợp state rời.
- [x] Reports/Audit hiển thị chứng từ, số source-line, chi phí mua ước tính và chi phí thực nhận theo đúng PurchaseRequestLine/ReceiptLine; chưa có receipt hiển thị là chưa phát sinh nhập, không phải `0`.
- [x] Chef truy vấn Ca theo `planId + shiftName`, có retry rõ lỗi và giới hạn danh sách mặc định; FE không tự tính lifecycle.

## Matrix xác minh bắt buộc

- [x] Happy path: đủ BOM/tồn → xuất → Bếp nhận → phục vụ → xác nhận → close.
- [x] Thiếu BOM: bị chặn trước demand hợp lệ.
- [x] Thiếu tồn: mua/nhập/cấp bổ sung rồi trở lại tiến trình đúng. (Đã có full-project lifecycle evidence.)
- [x] Bếp nhận thiếu, trả kho và hao hụt có lý do/duyệt. (Đã có full-project lifecycle evidence.)
- [x] Lệch suất thực tế và miễn xác nhận giao suất.
- [x] Close, reload browser, audit và report đều nhất quán FE → API → DB → FE.
- [x] Adjustment sau close không sửa snapshot lịch sử.
