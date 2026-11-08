# ĐẶC TẢ KỸ THUẬT & THIẾT KẾ KIẾN TRÚC (TECHNICAL SPECIFICATION)
## DỰ ÁN: IPCMANAGEMENT — HỆ THỐNG ĐIỀU HÀNH BẾP ĂN CÔNG NGHIỆP
**Mã tài liệu**: `SPEC-FE-3ZONE-v3.1`  
**Đường dẫn lưu trữ**: `docs/SPEC-GREENFIELD-FE-REBUILD.md`  
**Nhánh áp dụng**: `feature/greenfield-fe-3zone-workbench`  
**Chủ sở hữu kiến trúc**: Project Architect & Design Director  
**Tiêu chuẩn bắt buộc**: `AGENTS.md` (5-Layer Governance) · `docs/DESIGN.md` · `docs/DOMAIN.md` · `docs/UI-KIT.md`

---

## 1. MỤC TIÊU & NGUYÊN TẮC BẤT BIẾN (CORE INVARIANTS)

1. **Nguyên tắc "Zero Fake Data & Zero Error-Swallowing" (`Rule TA-5`)**:
   - Tầng `src/api/*.ts` tuyệt đối không chứa hàm `getBaseline*()`, hằng số seed giả cứng, hoặc các khối `try/catch` nuốt lỗi mạng.
   - Khi API Backend trả về mã lỗi (`400`, `401`, `403`, `404`, `409`, `422`, `500`), hàm trong `src/api/*.ts` bắt buộc phải để lỗi ném ra ngoài (`throw ApiError`) để `<StateBoundary>` ở UI kích hoạt đúng màn hình trạng thái tương ứng (`error` kèm nút `[Thử lại]`, hoặc `empty` / `prerequisite-blocked`).
2. **Nguyên tắc "85% Viewport for Data & Zero Box-in-Box"**:
   - Cấm bọc thẻ lồng thẻ (card-in-card); cấm các hộp KPI cao 120px choán hết diện tích.
   - Khung làm việc bên phải Sidebar là một mặt phẳng liên tục, chia cắt bằng đường kẻ hairline `1px solid var(--border-subtle)`.
   - Bảng dữ liệu chiếm tối thiểu 85% chiều cao khung nhìn (`calc(100dvh - 100px)`) với duy nhất 1 thanh cuộn dọc mượt mà.
3. **Nguyên tắc "Single Primary Action" (`Rule D7`)**:
   - Trên mỗi màn hình/view con chỉ tồn tại **duy nhất 1 nút bấm Primary màu đậm** (`bg-slate-900 text-white`, ưu tiên đặt trên `WorkspaceHeader`). Mọi nút thao tác khác ở `TelemetrySubbar` hoặc trong bảng dữ liệu bắt buộc là `variant="outline"` hoặc `variant="secondary"`.
4. **Nguyên tắc "ERP Scale 100% & Microcopy Chuẩn Việt Nam" (`NFR-I18N-01` & `UXR-04`)**:
   - Khóa root font: `html, body { font-size: 16px; line-height: 1.5; }`.
   - Dòng dữ liệu bảng cao `40px` (`h-10`), cỡ chữ `text-sm` (`14px`); Header cao `56px` (`h-14`), cỡ chữ `text-base` (`16px`). Cấm lạm dụng cỡ chữ < 12px (`Rule D6`).
   - Mọi trường ngày tháng bắt buộc hiển thị chuẩn `dd/MM/yyyy` (ví dụ `21/09/2026`). Cấm hiển thị lịch tiếng Anh của trình duyệt hay dùng emoji hệ điều hành (`📅`).
   - Tiền tệ VND luôn làm tròn số nguyên (`decimals: 0`), không bao giờ có chữ số thập phân lẻ `,492 ₫`.

---

## 2. ĐẶC TẢ TẦNG DỮ LIỆU & TÀI KHOẢN HỆ THỐNG

### 2.1. Chuẩn hóa 6 Tài khoản Người Dùng Chuẩn Database MySQL
Hệ thống sử dụng đúng 6 tài khoản phân quyền đã được định nghĩa trong `AdminEmployeeService.cs` và database thật, loại bỏ vĩnh viễn các tài khoản tự chế (`chef`, `manager`):

| Username | Họ tên hiển thị | Mã vai trò (RoleCode) | Vai trò chức năng trong hệ thống | Thẩm quyền thao tác chính |
|---|---|---|---|---|
| `admin` | Admin User | `ADMIN` | Quản trị viên hệ thống | Toàn quyền cấu hình, phê duyệt vượt hạn mức, quản trị danh mục |
| `quanly` | Quản lý | `QUAN_LY` / `MANAGER` | Quản lý vận hành toàn diện | Duyệt KHSX tuần, duyệt PO, chốt sổ ca, xem báo cáo chi phí |
| `dieuphoi`| Điều phối | `DIEU_PHOI` / `COORDINATOR`| Điều phối viên đơn ăn | Tiếp nhận đơn ăn, chốt số suất ăn ca, yêu cầu điều chỉnh suất |
| `beptruong`| Bếp trưởng | `BEP_TRUONG` / `CHEF` | Bếp trưởng sản xuất | Nhận KHSX ca, ký checklist nhận vật tư, xác nhận nấu hoàn tất |
| `thukho` | Thủ kho | `THU_KHO` / `WAREHOUSE` | Thủ kho nguyên liệu | Nghiệm thu nhập kho từ PO, lập phiếu xuất kho cấp cho bếp |
| `thumua` | Thu mua | `THU_MUA` / `PURCHASER` | Nhân viên mua hàng | Tạo đơn mua hàng PO, quản lý bảng báo giá nhà cung cấp |

*Mật khẩu đồng bộ cho môi trường Development / Demo*: **`Admin@123456`**

---

### 2.2. Ma Trận 11 File API & Endpoints Backend C# Kết Nối Thật (`http://localhost:5262`)

Mọi hàm gọi API trong `frontend/src/api/*.ts` đều sử dụng hàm `apiClient<T>()` kết nối trực tiếp với ASP.NET Core Kestrel Web API qua proxy Vite:

| File API Frontend | Hàm nghiệp vụ | Method | Endpoint C# Backend thật | DTO Phản Hồi & Tham Số |
|---|---|---|---|---|
| **`authApi.ts`** | `login(username, password)` | POST | `/api/auth/login` | `{ accessToken, user }` |
| | `logout()` | POST | `/api/auth/revoke` | Thu hồi token |
| | `getProfile()` | GET | `/api/auth/profile` | `UserInfo` |
| **`systemApi.ts`** | `getOperationalMode()` | GET | `/api/system-operation-mode` | `SystemOperationModeDto` |
| | `setOperationalMode(mode, expectedVersion, reason)` | PUT | `/api/system-operation-mode` | `{ mode, expectedVersion, confirmed, reason }` |
| **`dashboardApi.ts`** | `getDashboardData()` | GET | `/api/workflow-reports/operational-kpis` | `OperationalKpiResponse` (shortage, overdue PO, late receipt...) |
| | | GET | `/api/production-plans/filter` | `RawDashboardPlan[]` (tổng suất ca ngày) |
| **`weeklyMenuApi.ts`** | `getCustomers()` | GET | `/api/coordination/customers` | `CustomerOption[]` (DAV, ANV) |
| | `getWeeklyMenu(customerId, weekStartDate)` | GET | `/api/coordination/weekly-menu` | `RawWeeklyMenuResponse` (120 dòng thực đơn thật) |
| | `getProductionPlans(serviceDate, customerId)` | GET | `/api/production-plans/filter` | `RawProductionPlan[]` |
| | `getDishBom(dishId)` | GET | `/api/dishes/{dishId}/bom` | `RawBomLine[]` (lọc mức giá 25k, gộp `ingredientId`) |
| | `recalculateDemand(customerCode, serviceDate)` | POST | `/api/material-demand/generate` | `{ customerCode, serviceDate }` |
| | `approveDemandQueue(demandId, reason)` | POST | `/api/material-demand/{id}/approve` | `{ reason }` |
| **`coordinationApi.ts`** | `getOrders(serviceDate, shiftName, customerCode)` | GET | `/api/coordination/orders` | `RawCoordinationOrder[]` (chuẩn hóa `MORNING`/`AFTERNOON`) |
| | `lockOrders(serviceDate, shiftName)` | POST | `/api/coordination/orders/lock` | `{ serviceDate, shiftName, scope: 'FULLDAY' }` |
| | `adjustServings(orderId, servings, reason)` | PATCH | `/api/coordination/orders/{id}/servings` | `{ servings, reason }` (bắt buộc `reason` non-empty) |
| **`chefApi.ts`** | `getChefDashboardData(serviceDate, shiftName)` | GET | `/api/production-plans/filter` | Kế hoạch nấu ca |
| | `completeShift(serviceDate, shiftName)` | POST | `/api/production-plans/daily/send-to-kitchen` | `{ serviceDate, shiftName, confirmed: true }` |
| **`purchasingApi.ts`** | `getPurchaseOrders()` | GET | `/api/purchase-orders` | `PurchaseOrderItem[]` (8 đơn PO thật) |
| | `getSuppliers()` | GET | `/api/suppliers` | `SupplierItem[]` (35 nhà cung cấp thật) |
| | `createPurchaseOrder(data)` | POST | `/api/purchase-orders` | `{ supplierId, orderDate, lines }` |
| | `approvePurchaseOrder(id)` | POST | `/api/purchase-orders/{id}/approve` | Phê duyệt đơn mua hàng |
| **`warehouseApi.ts`** | `getWarehouses()` | GET | `/api/warehouses` | `WarehouseItem[]` (7 kho thật) |
| | `getReceipts()` | GET | `/api/inventory-receipts` | `InventoryReceiptItem[]` (20 phiếu nhập thật) |
| | `getIssues()` | GET | `/api/inventory-issues` | `InventoryIssueItem[]` (phiếu xuất thật) |
| | `createIssue(data)` | POST | `/api/inventory-issues` | `{ warehouseId, shiftName, lines }` |
| | `createReceipt(data)` | POST | `/api/inventory-receipts` | `{ warehouseId, supplierId, lines }` |
| **`approvalsApi.ts`** | `getInbox(targetType)` | GET | `/api/approvals/inbox` | `ApprovalInboxItem[]` (16 hồ sơ chờ duyệt thật) |
| | `decide(targetType, id, decision, reason)` | POST | `/api/approvals/{targetType}/{id}` | `{ decision, reason }` (bắt buộc `reason` khi từ chối) |
| **`reconciliationApi.ts`** | `getBatches()` | GET | `/api/reconciliation/batches` | `RawReconciliationBatchDto[]` |
| | `completeReconciliation(batchId, notes)` | POST | `/api/reconciliation/batches/{id}/complete` | `{ notes }` (bắt buộc ghi chú chốt sổ) |
| | `transferToWarehouse(batchId)` | POST | `/api/reconciliation/batches/{id}/transfer-to-warehouse` | Bàn giao số liệu kho |
| **`reportsApi.ts`** | `getCurrentStock()` | GET | `/api/workflow-reports/current-stock` | `CurrentStockReportItem[]` (100 dòng tồn kho thật) |
| | `getPriceVarianceReports()` | GET | `/api/workflow-reports/receipt-price-variance` | `PriceVarianceReportItem[]` (100 dòng biến động giá) |
| | `getMealCostReports()` | GET | `/api/workflow-reports/ingredient-demand` | `MealCostReportItem[]` (tiêu hao thực tế) |
| **`adminApi.ts`** | `getIngredients()` | GET | `/api/ingredients` | `IngredientItem[]` (20 nguyên liệu thật) |
| | `getDishes()` | GET | `/api/dishes` | `DishItem[]` (20 món ăn thật) |
| | `getApprovalRules()` | GET | `/api/approval-rules` | `ApprovalRuleItem[]` |
| | `createIngredient(data)` | POST | `/api/ingredients` | Thêm mới nguyên liệu |
| | `createApprovalRule(data)` | POST | `/api/approval-rules` | Thêm quy tắc duyệt |

---

## 3. ĐẶC TẢ GIAO DIỆN & TƯƠNG TÁC (UI / UX SPECIFICATION)

### 3.1. Sidebar Navigation Chuẩn Cây Phân Cấp (`Rule N6`) & Lucide Icons (`Rule D9`)
- **Kích thước**: Rộng `240px` (`w-60`), có thể thu gọn về `64px` (`w-16`) bằng nút Hamburger toggle (`☰` / `X`).
- **Brand Identity**: Icon Lucide `ChefHat` (kích thước 18px), tiêu đề `IPC System` (`text-sm font-bold`), phụ đề `Điều hành bếp ăn` (`text-xs text-slate-400`).
- **12 Mục Menu Kèm Icon Chuẩn Lucide**:
  1. `Tổng quan`: `LayoutDashboard` (`/`)
  2. `Thực đơn tuần` (Cây phân cấp): `CalendarDays` (`/weekly-menu`)
     - Vạch dẫn hướng dọc: `border-l-2 border-slate-200 ml-5 pl-2.5`
     - 4 mục con lá:
       - `Kế hoạch tuần` (`/weekly-menu`)
       - `Bàn giao nguyên liệu` (`/weekly-menu?view=demand`)
       - `Kế hoạch sản xuất` (`/weekly-menu?view=production-plan`)
       - `Giá vốn & Định mức BOM` (`/weekly-menu?view=cost`)
     - **Bãi bỏ hoàn toàn**: Xóa sạch thanh tab ngang trùng lặp ở đầu trang `/weekly-menu`.
  3. `Điều phối đơn`: `Utensils` (`/meal-orders`)
  4. `Duyệt vận hành`: `ClipboardCheck` (`/approvals`)
  5. `Thu mua`: `ShoppingCart` (`/purchasing`)
  6. `Kho nguyên liệu`: `Warehouse` (`/warehouse`)
  7. `Bếp trưởng`: `ChefHat` (`/chef`)
  8. `Đối soát nguyên liệu`: `Scale` (`/reconciliation`)
  9. `Báo cáo vận hành`: `TrendingUp` (`/reports`)
  10. `Quản trị dữ liệu`: `Database` (`/admin-data`)
  11. `Thiết lập quy trình duyệt`: `Settings` (`/settings/approval-rules`)
  12. `Thiết lập nâng cao`: `SlidersHorizontal` (`/settings/advanced`)
- **Chân Sidebar**:
  - Huy hiệu chế độ vận hành: `Chế độ: Mặc định` hoặc `Chế độ: Đối soát MRX` (`DOM-MODE-1`).
  - Thẻ người dùng: Avatar chữ cái đầu, họ tên thật, role code (`ADMIN`, `CHEF`...).
  - Nút đăng xuất: Icon Lucide `LogOut`.

---

### 3.2. Đặc tả Component `VietnameseDateInput` Chuẩn Tiếng Việt 100% (`NFR-I18N-01`)
- **Vấn đề đã khắc phục**: Loại bỏ hoàn toàn emoji `📅` và thẻ `<input type="date">` trần của trình duyệt (vốn bật ra popup tiếng Anh của Windows).
- **Cấu trúc kỹ thuật**:
  - Tích hợp `@base-ui/react/popover` + icon Lucide `CalendarDays`.
  - Input hiển thị: Trường văn bản có thuộc tính `inputMode="numeric"`, hiển thị cứng dạng `dd/MM/yyyy` (ví dụ `21/09/2026`).
  - Lịch Popover thuần Việt:
    - Tiêu đề tháng: `Tháng M năm YYYY` kèm 2 nút chuyển tháng `ChevronLeft` / `ChevronRight`.
    - Hàng thứ: `['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']`.
    - Lưới 42 ô ngày (font monospace, ngày thuộc tháng khác làm mờ `text-slate-300`, ngày được chọn đánh dấu nền đen `bg-slate-900 text-white`).
    - Nút thao tác nhanh dưới chân lịch: `Hôm nay` (chuyển về ngày hiện tại) và `Đóng`.

---

### 3.3. Đặc tả Bố Cục Bảng Dữ Liệu `DataGrid` & `SplitView` (Khắc phục lỗi Va chạm cột & Cụt chữ)
- **Quy tắc độ rộng cột và chống tràn**:
  - Toàn bộ thẻ tiêu đề cột `<th>` bắt buộc có `whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-600`.
  - Phân bổ độ rộng cột an toàn:
    - Cột Mã chứng từ / PO / KHSX: `min-w-[190px]`, hiển thị mã qua `<IdentifierText>` (class `w-fit inline-flex px-1.5 py-0.5 rounded font-mono text-xs`).
    - Cột Tên món ăn / Nguyên liệu: chiếm độ rộng linh hoạt `min-w-[220px]`.
    - Cột Số lượng: `min-w-[110px]`, căn phải, font `tabular-nums`.
    - Cột Tiền tệ: `min-w-[120px]`, căn phải, font `tabular-nums`, format qua `<Num value={Math.round(val)} format="currency" />`.
    - Cột Trạng thái: `min-w-[95px]`, căn giữa, hiển thị badge màu theo chuẩn `DOM-STATUS-1`.
- **Khung chia đôi `SplitView` (60% Master / 40% Detail)**:
  - Cột trái: Danh sách chứng từ cuộn dọc độc lập.
  - Cột phải: Panel thẩm định/chi tiết phân cách bằng đường kẻ hairline `1px border-l border-slate-200`, cuộn dọc độc lập.
  - Khi một chứng từ chưa có dòng chi tiết (như đơn PO rỗng trong DB): Hiển thị `EmptyState` ("Chứng từ này chưa có dòng nguyên liệu chi tiết"), không để lại màn hình trắng trơn.

---

## 4. ĐẶC TẢ CHI TIẾT NGHIỆP VỤ 14 CANONICAL ROUTES

### 4.1. Route `/` — Bàn Điều Hành Hôm Nay (`FR-DASH`)
- **Zone 1 (`WorkspaceHeader` — 56px)**:
  - Tiêu đề: `Bàn điều hành hôm nay`
  - Ngữ cảnh: `Thứ Hai, 21/09/2026` · Huy hiệu `Ca 1 & Ca 2 đang vận hành`
  - Nút bấm: `[Làm mới]` (Outline) + `[Mở bàn giao ca]` (Primary `bg-slate-900`)
- **Zone 2 (`TelemetrySubbar` — 56px)**:
  - Dải 5 ô chỉ số phẳng (56px) lấy từ `GET /api/workflow-reports/operational-kpis`:
    1. *Suất ăn theo KHSX*: Tổng suất cộng từ các kế hoạch ca ngày.
    2. *Vật tư thiếu hụt*: `kpis.shortageCount` (nền amber nếu > 0).
    3. *Yêu cầu PO quá hạn*: `kpis.overduePurchaseRequestCount` (nền rose nếu > 0).
    4. *Phiếu nhập trễ hạn*: `kpis.lateReceiptCount`.
    5. *Chất lượng dữ liệu*: `kpis.criticalDataQualityCount`.
    - Tương tác: Bấm vào từng ô để lọc trực tiếp bảng việc cần làm bên dưới.
- **Zone 3 (`SplitView`)**:
  - *Cột trái (8 cột)*: Bảng `Việc cần xử lý trước` (4 cột: Nhiệm vụ, Phụ trách, Hạn SLA, Nút Xử lý dẫn link sang trang nghiệp vụ tương ứng).
  - *Cột phải (4 cột)*: Stepper `Tiến độ 4 công đoạn` ca nấu (1. Chốt đơn ăn ➔ 2. KHSX & BOM ➔ 3. Bếp chế biến ➔ 4. Đối soát ca).

---

### 4.2. Route `/weekly-menu` — Thực Đơn & KHSX Tuần (4 Views — `FR-MENU`)
- **Zone 1 (`WorkspaceHeader` — 56px)**:
  - Trái: Tiêu đề `Thực đơn & KHSX tuần` + Khách hàng select (`w-64`) + Tuần date picker (`w-40`) + Pill `Định mức: 25.000 ₫`.
  - Phải: Nút `[Làm mới]` (Outline) + **Nút Primary thích ứng động theo view con (`Rule D7`)**:
    - Ở View `schedule`: `[Duyệt kế hoạch tuần]`
    - Ở View `demand`: `[Mở hàng đợi duyệt]`
    - Ở View `production-plan`: `[In lệnh sản xuất]`
    - Ở View `cost`: `[Xuất bảng chi phí]`
- **Chi tiết 4 Views con**:
  - **View 1 (`Kế hoạch tuần` — `view=schedule`)**:
    - `TelemetrySubbar` (44px): Khách hàng, phạm vi tuần, tổng lượt món, pill trạng thái duyệt.
    - `DataGrid` (flex-1): Ma trận thực đơn phân tách các nhóm thật từ DB (`MENU MẶN CA SÁNG`, `MENU CHAY CA SÁNG`, `MENU MẶN CA CHIỀU`, `MENU CHAY CA CHIỀU`), các dòng `Món chính`, `Phụ 1`, `Rau`, `Canh`, `Tráng miệng` x 6 ngày (Thứ 2 đến Thứ 7). Xóa bỏ hoàn toàn chữ lặp `Suất: 25k BOM: Đạt chuẩn`.
  - **View 2 (`Bàn giao nguyên liệu` — `view=demand`)**:
    - `TelemetrySubbar` (44px): Bộ chuyển ngày nhanh `[<] Thứ Hai 21/09 [>]` + **Segmented Tabs chuyển bảng chính** `[ Nhu cầu nguyên liệu ]` \| `[ KHSX nguồn ]` \| `[ Chứng từ bàn giao ]` (thay thế vĩnh viễn 2 hộp details đáy trang) + Nút `[Tính lại nhu cầu]` (Outline).
    - `DataGrid` (flex-1): Bảng 6 cột (Nguyên liệu, Món sử dụng, Cần, Đã xuất, Chưa xuất, Trạng thái). Dòng đầu hiển thị trọn vẹn, 1 thanh cuộn dọc duy nhất.
  - **View 3 (`Kế hoạch sản xuất` — `view=production-plan`)**:
    - `TelemetrySubbar` (44px): Bộ chuyển ngày + Bộ lọc phạm vi ca + Inline Pills tổng số suất.
    - `DataGrid` (flex-1): Bảng KHSX chi tiết từng món trong ca (Mã KHSX `min-w-[190px]`, Tên món, Ca nấu, Số suất, Ngày phục vụ định dạng `dd/MM/yyyy`, Trạng thái). Xóa bỏ dòng chữ lặp `Draxlmaier Automotive · Định mức 25k`.
  - **View 4 (`Giá vốn & Định mức BOM` — `view=cost`)**:
    - `SplitView` (flex-1):
      - *Bảng trái (7 cột)*: **Danh sách các món ăn thực tế có trong thực đơn của ngày đang chọn** (gồm `Khô gà lá chanh`, `Chả cá sốt cà`, `Bầu xào giá`, `Bầu nấu tôm`, `Thịt heo kho sả ruốc`, `Bún bò chả cua chay`, `Trái cây`), kèm cột Ca, Phân loại, Số suất, Đơn giá vốn, Thành tiền, Food Cost %.
      - *Bảng phải (5 cột)* có 2 Tabs trên cùng:
        - `Tab 1: Định mức BOM món đang chọn`: Lọc theo giá 25k và **gộp duy nhất theo `ingredientId`** (triệt tiêu việc lặp 3 dòng `Đậu bắp`, `Măng vàng`), hiển thị đủ 5 cột gồm `Nguyên liệu` \| `ĐVT` (rộng rãi `w-[20%]` không tràn chữ `Kilogram`) \| `Định mức/suất` \| `Đơn giá` \| `Thành tiền`.
        - `Tab 2: Tổng nguyên liệu ngày`: Tính tổng hợp thực tế nguyên liệu cấu thành từ các món ăn trong ngày, loại bỏ hoàn toàn 10 dòng giả cứng.

---

### 4.3. Route `/meal-orders` — Điều Phối Đơn Ăn (`FR-COORD`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Điều phối đơn ăn` + Chọn khách hàng + Ngày date picker + Nút `[Xuất báo cáo ca]` (Outline) + Nút Primary `[Chốt số lượng suất ăn]`.
- **Zone 2 (`TelemetrySubbar` — 44px)**: Tabs chọn ca `[Ca 1 (Sáng)]` \| `[Ca 2 (Chiều)]` + Inline Pills: `Đăng ký: 1.715 suất` · `Thực tế chốt: 1.703 suất` · `Lệch suất: -12 suất` · `Tỷ lệ: 99.3%`.
- **Zone 3 (`DataGrid` — flex-1)**: Bảng 6 cột (Phân loại suất ăn, Món chính phục vụ, Suất đăng ký, Điều chỉnh, Tổng suất chốt, Thao tác).
- **Quy tắc `BR-GLOBAL-03`**: Modal điều chỉnh suất ăn sau chốt bắt buộc nhập lý do (`reason`) không được để trống mới cho phép lưu.

---

### 4.4. Route `/chef` — Bếp Trưởng & Ca Nấu (`FR-CHEF`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Bếp trưởng & Ca nấu` + Chọn ca + Tên phụ trách + Nút `[Làm mới]` + Nút Primary `[Xác nhận hoàn tất ca nấu]`.
- **Zone 2 (`TelemetrySubbar` — 44px)**: 3 Segmented Tabs: `[Lệnh sản xuất ca]` \| `[Checklist nhận vật tư]` \| `[Đề xuất bổ sung / Trả thừa]` + Inline Pills tiến độ nấu.
- **Zone 3 (`DataGrid` — flex-1)**:
  - Tab 1: Bảng món ăn ca nấu và trạng thái chín.
  - Tab 2: Checklist kiểm tra chất lượng vật tư nhận từ kho có Checkbox tương tác thực tế.
  - Tab 3: Bảng ghi nhận nguyên liệu dư thừa trả về kho hoặc yêu cầu cấp bù khẩn cấp.

---

### 4.5. Route `/purchasing` — Thu Mua & Đề Xuất PO (`FR-PUR`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Thu mua & Đề xuất PO` + Chọn NCC đối tác (35 NCC thật) + Ngày date picker + Nút `[Tạo đơn mua hàng PO]` (Primary).
- **Zone 2 (`TelemetrySubbar` — 44px)**: Tabs lọc trạng thái PO `[Tất cả]` \| `[Dự thảo]` \| `[Đã duyệt]` \| `[Đã nhận hàng]` + Inline Pills: Tổng PO, Tổng giá trị tiền tệ làm tròn số nguyên (`78.524.819 ₫`, 0 số lẻ), Số lượng đối tác.
- **Zone 3 (`SplitView` — flex-1)**:
  - *Cột trái (7 cột)*: Bảng đơn PO với độ rộng cột an toàn (Mã PO `min-w-[210px]`, NCC `min-w-[180px]`, Ngày đặt, Số dòng, Tổng tiền, Trạng thái `min-w-[95px]`). Không va chạm tiêu đề cột.
  - *Cột phải (5 cột)*: Phân rã dòng nguyên liệu của đơn PO đang chọn. Nếu PO rỗng, hiển thị `EmptyState` sạch sẽ.

---

### 4.6. Route `/warehouse` — Kho Nguyên Liệu & Nhập Xuất (`FR-WH`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Kho nguyên liệu & Nhập xuất` + Chọn kho vận hành (7 kho thật) + Ngày date picker + Nút `[Tạo phiếu xuất kho]` (Primary).
- **Zone 2 (`TelemetrySubbar` — 44px)**: 3 Tabs: `[Phiếu xuất kho ca]` \| `[Phiếu nhập kho từ PO]` \| `[Thẻ kho & Tồn hiện tại]`.
- **Zone 3 (`DataGrid` — flex-1)**:
  - Tab 1: Danh sách phiếu xuất kho bàn giao bếp.
  - Tab 2: Danh sách 20 phiếu nhập kho nghiệm thu từ PO.
  - Tab 3: Thẻ kho đối soát tồn đầu ngày, nhập trong ngày, xuất trong ngày, tồn cuối ngày.
- **Quy tắc `BR-GLOBAL-03`**: Modal tạo phiếu xuất kho bắt buộc nhập ghi chú căn cứ xuất kho trước khi tạo.

---

### 4.7. Route `/approvals` — Hàng Đợi Phê Duyệt (`FR-APPR`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Hàng đợi phê duyệt` + Chọn loại yêu cầu + Ngày date picker + Nút `[Phê duyệt yêu cầu đang chọn]` (Primary).
- **Zone 2 (`TelemetrySubbar` — 44px)**: Tabs lọc: `[Tất cả yêu cầu]` \| `[Nhu cầu nguyên liệu]` \| `[Đơn mua hàng PO]` \| `[Phiếu nhập kho]` + Pills đếm hồ sơ chờ duyệt và SLA khẩn.
- **Zone 3 (`SplitView` — flex-1)**:
  - *Cột trái (7 cột)*: Danh sách hồ sơ chờ duyệt (Mã đối tượng `min-w-[190px]`, Tiêu đề, Người gửi, Hạn SLA, Khối lượng/Giá trị, Trạng thái `min-w-[95px]`). Tiêu đề cột `<th>` có `whitespace-nowrap`, không va chạm chữ.
  - *Cột phải (5 cột)*: Thẩm định chi tiết hồ sơ: Mã chứng từ, Hạn SLA, Người lập kèm thời gian format chuẩn Việt Nam (`dd/MM/yyyy HH:mm`), Tổng khối lượng làm tròn 2 số thập phân `<Num>` (`2.558,82 kg`), Danh sách vật tư chỉ hiển thị dòng có số lượng > 0.
  - Thao tác: Hai nút `[Từ chối hồ sơ]` (Outline, bắt buộc nhập lý do từ chối) và `[Phê duyệt hồ sơ]` (Primary).

---

### 4.8. Route `/reconciliation` — Đối Soát Nguyên Liệu (`FR-RECON`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Đối soát nguyên liệu` + Chọn khách hàng + Ngày date picker + Nút `[Chốt đối soát ca]` (Primary).
- **Zone 2 (`TelemetrySubbar` — 44px)**: Tabs `[Bảng sai lệch ca]` \| `[Lịch sử chốt sổ]` + Pills: Mã lô đối soát, Tổng suất chốt, Tỷ lệ hao hụt trung bình %, Chênh lệch giá trị tiền tệ.
- **Zone 3 (`DataGrid` — flex-1)**: Bảng đối chiếu 9 cột chi tiết: Mã NL, Tên NL, ĐVT, Định mức BOM, Xuất thực tế, Bếp sử dụng, Sai lệch (+/-), Hao hụt %, Đánh giá đạt chuẩn.
- **Quy tắc `BR-GLOBAL-03`**: Modal chốt sổ ca bắt buộc nhập ghi chú đối soát trước khi khóa bất biến số liệu.

---

### 4.9. Route `/reports` — Báo Cáo Chi Phí & Hao Hụt (`FR-REP`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Báo cáo chi phí & Hao hụt` + Chọn kỳ báo cáo tháng + Chọn khách hàng + Nút `[Xuất báo cáo Excel]` (Primary).
- **Zone 2 (`TelemetrySubbar` — 44px)**: 3 Tabs: `[Báo cáo chi phí suất ăn]` \| `[Biến động giá mua]` \| `[Tồn kho hiện tại]`.
- **Zone 3 (`DataGrid` — flex-1)**:
  - Tab 1: Phân tích Food Cost % và giá vốn thực tế so với định mức bán 25k từng món.
  - Tab 2: Biến động giá mua thực tế từ phiếu nhập so với giá kế hoạch (100 dòng thật).
  - Tab 3: Tồn kho thực tế tại các kho (100 dòng thật từ `/workflow-reports/current-stock`).

---

### 4.10. Route `/admin-data` — Quản Trị Dữ Liệu & Danh Mục (`FR-CAT`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Quản trị dữ liệu & Danh mục` + Pill đếm số lượng + Nút `[Thêm nguyên liệu mới]` (Primary).
- **Zone 2 (`TelemetrySubbar` — 44px)**: 2 Tabs: `[Danh mục nguyên liệu]` (20 nguyên liệu thật) \| `[Danh mục món ăn tiêu chuẩn]` (20 món ăn thật).
- **Zone 3 (`DataGrid` — flex-1)**: Bảng dữ liệu danh mục chuẩn HACCP, hỗ trợ modal thêm nguyên liệu mới.

---

### 4.11. Route `/settings/approval-rules` — Thiết Lập Quy Trình Duyệt (`FR-ADMIN`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Thiết lập quy trình duyệt` + Nút `[Thêm quy tắc duyệt]` (Primary).
- **Zone 2 (`TelemetrySubbar` — 44px)**: Tabs lọc theo đối tượng `[Tất cả]` \| `[Đơn PO]` \| `[Nhu cầu vật tư]` \| `[Đổi thực đơn]`.
- **Zone 3 (`DataGrid` — flex-1)**: Bảng ma trận quy tắc phân quyền duyệt tự động theo giá trị và hạn thời gian SLA.

---

### 4.12. Route `/settings/advanced` — Cấu Hình Hệ Thống & Vận Hành (`FR-SYS`)
- **Zone 1 (`WorkspaceHeader` — 56px)**: Tiêu đề `Cấu hình hệ thống & Vận hành` + Pill chế độ hiện tại + Nút `[Lưu cấu hình hệ thống]` (Primary).
- **Zone 2 (`TelemetrySubbar` — 44px)**: 3 Tabs: `[Chế độ vận hành (DOM-MODE-1)]` \| `[Bộ nhớ đệm & Phiên làm việc]` \| `[Chẩn đoán kết nối API]`.
- **Zone 3 (`SplitView` — flex-1)**:
  - Cột trái: Tùy chọn chuyển đổi radio giữa `DEFAULT` và `MATERIAL_RECONCILIATION`; Dọn dẹp cache localStorage tiền tố `ipc_v3_*`; Thông số kết nối API Backend Kestrel .NET 9.
  - Cột phải: Khung giải thích nguyên tắc bất biến `DOM-MODE-1` và thông số runtime.

---

## 5. ĐẶC TẢ KIỂM TOÁN CHẤT LƯỢNG & BỘ TEST CANH GÁC (`IPC-TEST-AUDIT`)

### 5.1. Cổng Canh Gác Tự Động `ZeroFakeApiAndTestAuditGuard.test.ts` (`Rule TA-5`)
1. **Kiểm tra 1 (Static AST/Content Scan)**:
   - Quét toàn bộ 11 file trong `frontend/src/api/*.ts`.
   - Khẳng định không có bất kỳ ký tự nào khớp với: `/\bgetBaseline\w*\b/`, `/\bBASELINE_\w*\b/`, `/\bmock\w*\b/i`, `/\bfallback\b/i`, hoặc các chuỗi seed giả (`NL-THIT-01`, `BG-260921-01`, `Trần Văn B`, `Nguyễn Văn A`, `wh-1`, `sup-1`).
2. **Kiểm tra 2 (Anti-Swallowing Catch Scan)**:
   - Khẳng định trong `src/api/*.ts` không có khối `catch` nào chứa `return { ... }` hoặc `return [ ... ]` nhằm nuốt lỗi mạng.
3. **Kiểm tra 3 (Network Invocation Audit)**:
   - Khẳng định 100% các hàm nghiệp vụ export trong `src/api/*.ts` đều thực sự triệu gọi `apiClient()`.

### 5.2. Chuẩn Hóa 16 File Test Unit Hành Vi Thực Chất (`frontend/src/__tests__/*.test.tsx`)
Mọi bài test trong `src/__tests__/` bắt buộc mock ở tầng mạng (`apiClient` / `fetch`) với cấu trúc DTO thật của C# Backend từ `test/fixtures.ts`, bao phủ đủ 4 kịch bản:
1. **Kịch bản 1 — Có dữ liệu (`Success`)**: Khẳng định render đúng dữ liệu, đúng cột, số lượng `<Num>`, mã `<IdentifierText>`, ngày tháng `dd/MM/yyyy`.
2. **Kịch bản 2 — Dữ liệu rỗng / Bị chặn bước trước (`Empty / Prerequisite Blocked`)**: Khi API trả về mảng rỗng `[]` hoặc thiếu điều kiện tiên quyết, `<StateBoundary>` phải hiển thị đúng `EmptyState` và nút hướng dẫn, không để bảng trống rỗng vô nghĩa.
3. **Kịch bản 3 — Lỗi mạng (`Error + Retry`)**: Khi API reject lỗi, `<StateBoundary>` phải hiển thị banner báo lỗi và nút `[Thử lại]`. Bấm vào gọi lại API.
4. **Kịch bản 4 — Phân quyền RBAC & Gửi Mutation (`ActionGuard` + Payload)**: Kiểm chứng tài khoản không đủ quyền thì nút bị ẩn/khóa; tài khoản đủ quyền khi bấm nút submit sẽ gửi đúng endpoint và đúng body JSON xuống `apiClient`.

---

## 6. TIÊU CHÍ NGHIỆM THU HOÀN TOÀN (ACCEPTANCE CRITERIA)

- [ ] File đặc tả kỹ thuật này được lưu trữ chính thức tại `docs/SPEC-GREENFIELD-FE-REBUILD.md`.
- [ ] Cổng canh gác `ZeroFakeApiAndTestAuditGuard.test.ts` PASS 100%, 0 pattern dữ liệu giả trong `src/api/*.ts`.
- [ ] Mọi ô chọn ngày tháng đều hiển thị văn bản định dạng `dd/MM/yyyy` (ví dụ `21/09/2026`) và mở ra Popover lịch tiếng Việt chuẩn `Tháng M năm YYYY`, hàng thứ `T2-CN`, không còn emoji `📅` hay popup tiếng Anh của trình duyệt.
- [ ] Sidebar trái hiển thị đầy đủ 12 Lucide icons chuẩn mực, cây phân cấp `Thực đơn tuần` đóng/mở mượt mà có vạch dẫn hướng dọc, không có thanh tab cấp 1 thừa bên trong trang.
- [ ] Tiêu đề các cột bảng (`<th>`) có `whitespace-nowrap`, không còn hiện tượng va chạm hay đè chữ (`LƯỢNG TRẠNG TH`, `MẶT HÀNG TỔNG TIỀN TRẠNG THÁI`).
- [ ] Toàn bộ chuỗi mã chứng từ, mã PO, mã KHSX được hiển thị trọn vẹn, không bị cắt cụt đuôi `..`.
- [ ] Toàn bộ số tiền VND hiển thị dạng số nguyên tròn (0 chữ số thập phân, ví dụ `78.524.819 ₫`, không có `,492 ₫`).
- [ ] Trang đăng nhập hiển thị đúng 6 tài khoản thật từ MySQL (`admin`, `quanly`, `dieuphoi`, `beptruong`, `thukho`, `thumua`).
- [ ] View `Giá vốn & Định mức BOM` chỉ hiển thị các món ăn thực tế của ngày đang chọn; Tab BOM lọc theo giá 25k và gộp duy nhất theo `ingredientId` (không lặp 3 dòng `Đậu bắp`, `Măng vàng`), hiển thị đủ 5 cột gồm `Đơn giá`.
- [ ] Toàn bộ 16 file test unit trong Vitest (87+ tests) và 1311 bài test Backend CI vượt qua 100% qua lệnh `npm run verify`.
