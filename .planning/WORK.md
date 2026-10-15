# Active work

Status: IDLE (Sprint 1.1 Complete: Zero Fake API Guard, Real Endpoints, Rule D7 & Full Test Audit — 100% Verified)

### Summary of System Delivery
Toàn bộ hệ thống quản lý bếp ăn công nghiệp IPCManagement đã hoàn tất khóa sổ toàn diện trên nhánh `feature/greenfield-fe-3zone-workbench`:
- Xóa sổ 100% dữ liệu giả và các khối `try/catch` nuốt lỗi trong toàn bộ 11 file `frontend/src/api/*.ts`.
- Thiết lập cổng canh gác tự động `ZeroFakeApiAndTestAuditGuard.test.ts` (Rule TA-5) đảm bảo vĩnh viễn không còn dummy seed nào tồn tại trong tầng API.
- Nối trực tiếp 100% API endpoints thật từ C# Backend Kestrel (`http://localhost:5262`).
- Chuẩn hóa giao diện 3-Zone Flat Workbench: `html font-size: 16px`, `VietnameseDateInput` hiển thị cứng `dd/MM/yyyy`, `Rule D7` đồng bộ nút Primary động theo view, `ActionGuard` kiểm soát quyền RBAC, bảng BOM loại bỏ lặp dòng.

---

### Sprint 1.1: Visual & Real Data Hardening (Rule N6, D7, TA-1..TA-5) [COMPLETED]
1. **Khóa chặt Cổng Canh Gác `ZeroFakeApiAndTestAuditGuard.test.ts` (Rule TA-5)**:
   - Quét toàn bộ 11 file trong `frontend/src/api/*.ts`: cấm triệt để `getBaseline`, `BASELINE_`, `mock`, `fallback`, các chuỗi seed giả (`NL-THIT-01`, `BG-260921-01`, `Trần Văn B`, `Nguyễn Văn A`, `wh-1`, `sup-1`).
   - Cấm khối `catch` nuốt lỗi trả về fallback dummy data: lỗi mạng bắt buộc phải ném ra (throw) để `<StateBoundary>` render đúng trạng thái `error` / `prerequisite-blocked`.
   - Bắt buộc 100% hàm export trong `src/api/*.ts` phải gọi network thật qua `apiClient`.

2. **Đồng bộ 100% API Endpoints Thật từ Backend C# (`http://localhost:5262`)**:
   - `weeklyMenuApi.ts`: Nối `GET /api/coordination/customers`, `GET /api/coordination/weekly-menu`, `GET /api/production-plans/filter`, `GET /api/dishes/{id}/bom`, `POST /api/material-demand/generate`, `POST /api/material-demand/{id}/approve`.
   - `dashboardApi.ts`: Nối `GET /api/workflow-reports/operational-kpis` và `GET /api/production-plans/filter`.
   - `coordinationApi.ts`: Nối `GET /api/coordination/orders`, `POST /api/coordination/orders/lock`, `PATCH /api/coordination/orders/{id}/servings`.
   - `chefApi.ts`: Nối `GET /api/production-plans/filter`, `POST /api/production-plans/daily/send-to-kitchen`.
   - `purchasingApi.ts`: Nối `GET /api/purchase-orders`, `GET /api/suppliers`, `POST /api/purchase-orders`, `POST /api/purchase-orders/{id}/approve`.
   - `warehouseApi.ts`: Nối `GET /api/warehouses`, `GET /api/inventory-receipts`, `GET /api/inventory-issues`, `POST /api/inventory-issues`, `POST /api/inventory-receipts`.
   - `approvalsApi.ts`: Nối `GET /api/approvals/inbox`, `POST /api/approvals/{targetType}/{id}`.
   - `reconciliationApi.ts`: Nối `GET /api/reconciliation/batches`, `POST /api/reconciliation/batches/{id}/transfer-to-warehouse`, `POST /api/reconciliation/batches/{id}/complete`.
   - `reportsApi.ts`: Nối `GET /api/workflow-reports/current-stock`, `GET /api/workflow-reports/receipt-price-variance`, `GET /api/workflow-reports/ingredient-demand`.
   - `adminApi.ts`: Nối `GET /api/ingredients`, `GET /api/dishes`, `GET /api/approval-rules`, `POST /api/ingredients`, `POST /api/approval-rules`.
   - `systemApi.ts`: Nối `GET /api/system-operation-mode`, `PUT /api/system-operation-mode`.

3. **Khắc phục 5 Lỗi Giao Diện & Nghiệp Vụ**:
   - `VietnameseDateInput`: Hiển thị văn bản CỨNG dạng `dd/MM/yyyy` (ví dụ `21/09/2026`) trên mọi trình duyệt (`NFR-I18N-01`), kết hợp popover/picker và input số hỗ trợ gõ trực tiếp.
   - `/weekly-menu` (Rule D7): Nút Primary trên Header đổi linh hoạt theo view (`schedule` -> `[Duyệt kế hoạch tuần]`, `demand` -> `[Mở hàng đợi duyệt]`, `production-plan` -> `[In lệnh sản xuất]`, `cost` -> `[Xuất bảng chi phí]`).
   - `MenuCostView`: Bảng trái chỉ hiển thị các món ăn thực tế có trong thực đơn ngày đang chọn; Bảng phải Tab 1 gộp duy nhất theo `ingredientId` (loại bỏ lặp 3 dòng `Đậu bắp`, `Măng vàng`), hiển thị đủ 5 cột gồm `Đơn giá`; Bảng phải Tab 2 tính tổng hợp nguyên liệu thực tế từ các món ăn trong ngày.
   - `ActionGuard`: Bọc kiểm soát quyền RBAC quanh các nút mutation (chốt đơn, duyệt, tạo PO, xuất kho, chốt ca).
   - `BR-GLOBAL-03` & `UXR-05`: Bắt buộc nhập lý do (`reason`/`notes`) trước khi điều chỉnh số suất, từ chối duyệt, xuất kho hay chốt đối soát.
   - `StateBoundary`: Hiển thị đúng các trạng thái `empty` / `prerequisite-blocked` / `error + retry`.

4. **Bộ Test Chuẩn Hóa & Kết Quả Verification**:
   - 16 test files (87 tests) bao phủ DOM behavioral tests, mock tại network boundary với DTO backend C#, không tautological.
   - `test:fe:unit`: 16/16 files passed, 87/87 tests passed (0 failed, 0 skipped).
   - `test:be:ci`: 1311/1311 tests passed (0 failed, 0 skipped).
   - `npm run verify`: 100% PASS GREEN trên toàn bộ 11 cổng kiểm tra.
