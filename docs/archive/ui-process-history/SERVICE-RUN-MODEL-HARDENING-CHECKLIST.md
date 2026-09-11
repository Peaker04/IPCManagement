# Checklist hardening mô hình Ca phục vụ

> **HISTORICAL / NO EXECUTION AUTHORITY.** Trạng thái trong file phản ánh thời điểm tạo. Dùng `MEMORY.md`, `docs/README.md` và phase hiện hành để quyết định công việc.


> Mục tiêu: khóa các bất biến còn hở sau closeout đầu tiên, đồng bộ aggregate/API/database/UI và chỉ đóng khi có regression + headed E2E trên `ipc_e2e_template`.

## Quyết định mô hình đã áp dụng

- [x] Xác nhận giao suất có outcome độc quyền: `PENDING → CONFIRMED | WAIVED`; không thể có cả hai.
- [x] Ghi lại số suất sau outcome phải hủy outcome cũ, yêu cầu lý do và audit; ca quay về chờ xác nhận.
- [x] Chênh lệch suất phục vụ là một đối tượng đối soát riêng với chênh lệch vật tư; chênh lệch suất cần quyết định Manager/Coordinator trước close.
- [x] `serviceConfirmationPolicy` được thực thi: `WAIVABLE` cho phép waive, `REQUIRED` chỉ cho phép confirm.
- [x] `ServiceRun.Status` không còn là lifecycle source-of-truth; lifecycle được suy diễn từ evidence và `ClosedAt` là terminal marker.
- [x] Báo cáo closed run dùng snapshot chứng từ/chi phí tại close; correction hậu kiểm hiển thị là delta, không sửa snapshot.

## Backend và database

- [x] Bổ sung evidence riêng cho quyết định chênh lệch suất và blocker lifecycle tương ứng.
- [x] Enforce exclusivity confirm/waive trong service và database constraint; xử lý idempotency an toàn.
- [x] Thêm migration additive cho model mới, policy constraint và dùng `ClosedAt` thay status cache; cập nhật EF snapshot/tool evidence.
- [x] Đổi snapshot close sang operational snapshot versioned; legacy snapshot fallback được đánh dấu rõ.
- [x] Giới hạn page projection theo page khi không lọc status; status filter vẫn dùng lifecycle derived.

## API và frontend

- [x] Regenerate OpenAPI/schema, cập nhật typed hooks và UI state/action từ token backend.
- [x] Chef phân biệt “cần quyết định chênh lệch suất”, “chờ xác nhận”, “đã xác nhận” và “đã miễn”; không render action xung đột.
- [x] Reports ghi rõ `Chi phí mua ước tính`/`Chi phí mua thực nhận`, hiển thị snapshot close hay legacy fallback.
- [x] Warehouse/Purchasing chỉ hiển thị blocker thuộc chứng từ nguồn của họ; không suy diễn lifecycle riêng.

## Kiểm chứng và closeout

- [x] Regression backend bao phủ lifecycle conflict/serving variance; command guards, policy và snapshot được xác minh qua E2E.
- [x] Unit/frontend kiểm tra control độc quyền và labels accessibility qua typed build/lint.
- [x] Headed E2E FE → API → DB → reload: serving variance + resolve + waive, close snapshot và Reports.
- [x] Build, lint, API contract, migration check, `git diff --check`, GitNexus final detect và docs/evidence/memory/history đồng bộ.
