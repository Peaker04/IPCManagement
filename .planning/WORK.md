# Active work

Status: IDLE (Full System 14 Canonical Routes & Architecture Rebuild Complete — 100% Verified)

### Summary of System Delivery
Toàn bộ hệ thống quản lý bếp ăn công nghiệp IPCManagement đã hoàn tất tái cấu trúc sang chuẩn **3-Zone Flat Workbench (Zero AI-Slop)** với 100% 14 canonical routes được triển khai trọn vẹn, kết nối trực tiếp với ASP.NET Core .NET 9 Backend và MySQL.

---

### Sprint 1 & 1.1: Core Architecture, Auth, Dashboard & Weekly Menu [COMPLETED]
- **Cắt đứt 8 mỏ neo cũ & Backup an toàn**: Lưu trữ toàn bộ di sản cũ tại `../IPCManagement-fe-legacy-backup`, reset baseline nợ về 0, gỡ bỏ các dependency cồng kềnh.
- **Root Typography & Scale 100%**: `html, body { font-size: 16px; }` chuẩn ERP, loại bỏ hoàn toàn cảm giác zoom out li ti.
- **Nested Sidebar (`Rule N6`)**: Cây phân cấp mở rộng kèm vạch dẫn hướng `border-l-2 border-slate-200 ml-4 pl-2`, 4 mục con cho `/weekly-menu` + nút Hamburger toggle.
- **Auth (`/login`, `/forbidden`)**: Form đăng nhập phẳng, kết nối thật `/api/auth/login`, cấp phát JWT token, hỗ trợ quick login `admin`, `chef`, `manager`.
- **Dashboard (`/`)**: WorkspaceHeader `56px` + dải 5 ô metric phẳng `56px` (lọc trực tiếp) + SplitView (bảng nhiệm vụ bên trái, stepper tiến độ 4 công đoạn bên phải).
- **Weekly Menu (`/weekly-menu`)**: 4 views dùng chung 1 WorkspaceHeader `56px`, xóa thanh tab trùng lặp ở đầu trang, xóa chữ lặp `Suất: 25.000 ₫ BOM: Đạt chuẩn`, phân rã ma trận thật từ DB (120 dòng cho `DAV - Draxlmaier` tuần 21/09/2026).

---

### Sprint 2: Coordination & Supply Chain Core [COMPLETED]
- **Điều phối đơn ăn (`/meal-orders` — `FR-COORD`)**:
  - `coordinationApi.ts`: Kết nối `/api/coordination/orders?serviceDate=...&shiftName=...`, chốt đơn và điều chỉnh số suất.
  - `MealOrdersPage.tsx`: WorkspaceHeader `56px` (1 nút primary `[Chốt số lượng suất ăn]`) + TelemetrySubbar `44px` (Segmented Tabs ca + pills chênh lệch suất) + DataGrid 6 cột + Modal điều chỉnh số suất sau chốt.
- **Bếp trưởng & Ca nấu (`/chef` — `FR-CHEF`)**:
  - `chefApi.ts`: Kết nối `/api/production-plans/daily` và `/api/production-plans/filter`.
  - `ChefDashboardPage.tsx`: WorkspaceHeader `56px` (1 nút primary `[Xác nhận hoàn tất ca nấu]`) + TelemetrySubbar `44px` (3 Segmented Tabs: Lệnh sản xuất ca, Checklist nhận vật tư có Checkbox tương tác, Đề xuất bổ sung / trả thừa) + DataGrid.
- **Thu mua & PO (`/purchasing` — `FR-PUR`)**:
  - `purchasingApi.ts`: Kết nối `/api/purchase-orders` (8 đơn thật trong DB) và `/api/suppliers` (35 đối tác NCC).
  - `PurchasingPage.tsx`: WorkspaceHeader `56px` + TelemetrySubbar `44px` (lọc trạng thái PO) + SplitView (Master 7 cột PO list | Detail 5 cột dòng vật tư) + Modal tạo đơn PO mới.
- **Kho nguyên liệu & Xuất nhập (`/warehouse` — `FR-WH`)**:
  - `warehouseApi.ts`: Kết nối `/api/warehouses` (7 kho), `/api/inventory-issues`, `/api/inventory-receipts`.
  - `WarehousePage.tsx`: WorkspaceHeader `56px` (1 nút primary `[Tạo phiếu xuất kho]`) + TelemetrySubbar `44px` (3 Tabs: Phiếu xuất, Phiếu nhập, Thẻ kho tồn hiện tại) + DataGrid + Modal tạo phiếu xuất kho.

---

### Sprint 3: Governance, Reconciliation & Operations [COMPLETED]
- **Hàng đợi phê duyệt (`/approvals` — `FR-APPR`)**:
  - `approvalsApi.ts`: Kết nối `/api/approvals/inbox` (16 hồ sơ chờ duyệt thật trong DB) và quyết định phê duyệt `/api/approvals/{type}/{id}`.
  - `ApprovalPage.tsx`: WorkspaceHeader `56px` + TelemetrySubbar `44px` + SplitView (Master 7 cột danh sách yêu cầu | Detail 5 cột thẩm định hồ sơ, danh sách vật tư đính kèm, ghi chú căn cứ và 2 nút Từ chối / Phê duyệt).
- **Đối soát nguyên liệu (`/reconciliation` — `FR-RECON`)**:
  - `reconciliationApi.ts`: Kết nối biên bản đối soát ca, chốt sổ và chuyển kho.
  - `ReconciliationPage.tsx`: WorkspaceHeader `56px` + TelemetrySubbar `44px` + DataGrid 9 cột đối chiếu chi tiết (Định mức BOM, Xuất thực tế, Bếp dùng, Sai lệch, Hao hụt, Đánh giá) + Modal chốt sổ đối soát ca.
- **Báo cáo chi phí & Hao hụt (`/reports` — `FR-REP`)**:
  - `reportsApi.ts`: Kết nối `/api/workflow-reports/current-stock`, chi phí suất ăn và biến động giá.
  - `ReportsPage.tsx`: WorkspaceHeader `56px` + TelemetrySubbar `44px` (3 Tabs: Chi phí suất ăn, Biến động giá mua, Tồn kho hiện tại) + DataGrid.
- **Quản trị dữ liệu & Danh mục (`/admin-data` — `FR-CAT`)**:
  - `adminApi.ts`: Kết nối `/api/ingredients` (20 nguyên liệu) và `/api/dishes` (20 món ăn tiêu chuẩn).
  - `AdminDataPage.tsx`: WorkspaceHeader `56px` + TelemetrySubbar `44px` (Tabs nguyên liệu / món ăn) + DataGrid + Modal thêm nguyên liệu mới.
- **Thiết lập quy trình duyệt (`/settings/approval-rules` — `FR-ADMIN`)**:
  - `ApprovalRulesPage.tsx`: Quản lý ma trận phân quyền duyệt tự động, ngưỡng giá trị và thời hạn SLA + Modal thêm quy tắc.
- **Thiết lập nâng cao & Vận hành (`/settings/advanced` — `FR-SYS`)**:
  - `AdvancedSettingsPage.tsx`: Chuyển đổi chế độ vận hành `DEFAULT` vs `MATERIAL_RECONCILIATION` (`DOM-MODE-1`), quản lý bộ nhớ đệm `ipc_v3_*`, chẩn đoán kết nối API Kestrel.

---

### Test Suite & Verification Results
- **Frontend Test Suite (Vitest + Testing Library)**:
  - 15 test files hoàn chỉnh kiểm thử hành vi DOM thật:
    1. `Primitives.test.tsx` (10 UI Primitives)
    2. `AppShell.test.tsx` (Nested Tree Sidebar Rule N6, Hamburger)
    3. `Auth.test.tsx` (Login, quick auth, 403 Forbidden)
    4. `Dashboard.test.tsx` (Metrics strip, task table, stepper)
    5. `WeeklyMenu.test.tsx` (4 views, 0 details, wide UoM column)
    6. `MealOrders.test.tsx` (Lock orders, adjustments)
    7. `Chef.test.tsx` (Dishes, material checklist, complete modal)
    8. `Purchasing.test.tsx` (PO list, line breakdown, new PO)
    9. `Warehouse.test.tsx` (Issues, receipts, stock cards)
    10. `Approvals.test.tsx` (Queue, decision drawer, approve/reject)
    11. `Reconciliation.test.tsx` (Variance ledger, complete modal)
    12. `Reports.test.tsx` (Meal cost, price variance, stock)
    13. `AdminData.test.tsx` (Ingredients, dishes, new ingredient)
    14. `ApprovalRules.test.tsx` (Rule table, new rule)
    15. `AdvancedSettings.test.tsx` (Mode switch, cache clear)
  - **Kết quả Unit Tests**: **15 passed (15 files), 85 passed (85 tests), 0 failed, 0 skipped**.
- **Backend Test Suite (.NET 9 CI)**:
  - **1311 passed, 0 failed, 0 skipped**.
- **Code Quality & Architecture Gates**:
  - `test:ignore-policy`: PASS
  - `test:frontend-test-taxonomy`: PASS
  - `test:frontend-unit-launcher`: PASS
  - `test:architecture-growth` & `check:architecture-growth`: PASS (0 frontend debt)
  - `build:be`: PASS
  - `lint:fe`: PASS (0 errors, 0 warnings)
  - `depcruise:fe`: PASS (0 violations, 61 modules cruised)
  - `build:fe`: PASS (Production build 377ms)
- **Toàn bộ pipeline `npm run verify`**: **100% PASS GREEN**.
