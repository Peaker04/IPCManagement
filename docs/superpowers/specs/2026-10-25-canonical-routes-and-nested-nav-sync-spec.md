# Đặc Tả Kỹ Thuật: Đồng Bộ Kiến Trúc 14 Canonical Routes & Cây Điều Hướng Sidebar Đa Cấp (Canonical Routes & Nested Sidebar Navigation Synchronization Specification)

> **Mã đặc tả:** `SPEC-NAV-ROUTE-SYNC-20261025`  
> **Trạng thái:** DRAFT CHỜ NGƯỜI DÙNG PHÊ DUYỆT (PENDING USER APPROVAL)  
> **Chủ quản thẩm quyền:**  
> - Bất biến phân lập chế độ: `AGENTS.md` (`DOM-MODE-1`) & `docs/DOMAIN.md`  
> - Cấu trúc 14 Canonical Routes: `frontend/src/routes/routeRegistry.ts` & `docs/DESIGN.md` (N1–N8, N6 Nested Sidebar)  
> - Trải nghiệm trạng thái: `docs/UI-KIT.md`, `StateBoundary.tsx`  
> **Phạm vi áp dụng:** Toàn bộ 14 Canonical Routes, tất cả các sub-view leaves (lá điều hướng con), Sidebar Menu lồng nhau (`AppShell.tsx`), và cơ chế chuẩn hóa URL tự động (Auto-canonicalization) giữa hai chế độ vận hành `DEFAULT` và `MATERIAL_RECONCILIATION`.

---

## 1. BỐI CẢNH & VẤN ĐỀ CẦN GIẢI QUYẾT TRIỆT ĐỂ

### 1.1. Bằng chứng Lỗi Thực tế từ Hiện trường (Screenshot `pi-clipboard-150a00a8-dbac-41b4-ae7a-bcee59958b29.png`)
1. **Lỗi Rò rỉ Chế độ (Mode Contamination / Vi phạm DOM-MODE-1)**:
   - Hệ thống đang chạy ở **Chế độ: Đối soát MRX** (thể hiện rõ ở badge vàng đáy Sidebar).
   - Người dùng truy cập URL gốc `/weekly-menu` (không có query parameter).
   - Màn hình chính bên phải lại render `DefaultWeeklyMenuPage` của **Chế độ Mặc định (DEFAULT)**, hiển thị tiêu đề *"Thực đơn & KHSX tuần"* và gọi các API của Default.
   - Nội dung rơi vào Empty State của Default: *"Chưa có thực đơn cho tuần này"*, làm biến mất hoàn toàn Stepper 5 bước của MRX và các nút chức năng lập lô đối soát.
2. **Lỗi Câm Lặng Trạng thái Active trên Sidebar (Silent Inactive Leaf)**:
   - Dưới mục cha *"Thực đơn tuần"*, mục con duy nhất của MRX là *"Chuẩn bị lô đối soát"* (`to: '/weekly-menu?view=mrx-batch'`).
   - Vì URL hiện tại là `/weekly-menu` (không có `?view=mrx-batch`), thuật toán so sánh `isCurrentSubview` trả về `false`.
   - Kết quả: Mục con có nền trắng trơ trọi, không được tô màu Active (nền đen chữ trắng). Toàn bộ cây Sidebar không có bất kỳ mục nào được kích hoạt, người dùng hoàn toàn mất phương hướng (Lost Wayfinding).
3. **Lỗi Bất nhất Kiến trúc giữa các Router Dispatchers**:
   - `/warehouse` và `/chef` đã có code tự chuyển hướng (`Navigate to mrx-daily` / `mrx-cooking`).
   - `/weekly-menu` lại thiếu cơ chế chuyển hướng, tự ý rớt xuống Default.
   - Các query parameters vận hành (`?date=...`, `?customerId=...`, `?batchId=...`) khi được thêm vào URL làm hỏng logic so sánh chuỗi URL của Sidebar, khiến các mục con đang mở bị mất trạng thái Active.

---

## 2. NGUYÊN TẮC BẤT BIẾN TOÀN CỤC (GLOBAL ARCHITECTURAL INVARIANTS)

1. **Bất biến Phân lập Chế độ Tuyệt đối (`DOM-MODE-1`)**:
   - Khi `operationalMode === 'MATERIAL_RECONCILIATION'`, **CẤM TUYỆT ĐỐI** render bất kỳ Component nào của chế độ DEFAULT và cấm gọi bất kỳ API nào thuộc phạm vi DEFAULT.
   - Mọi URL gốc (Naked Root Route: `/weekly-menu`, `/warehouse`, `/chef`) khi được truy cập ở chế độ MRX **BẮT BUỘC phải tự động Redirect (replace)** sang Leaf con tương ứng của MRX trong 0ms.
2. **Bất biến Duy nhất Nguồn Sự thật URL (Canonical URL as Single Source of Truth)**:
   - Không cho phép tồn tại trạng thái màn hình không phản ánh trên URL. Mọi view/subview đang xem bắt buộc phải có mặt trên URL thông qua query `?view=...`.
3. **Bất biến Nhận diện Active Sidebar Thông minh (Semantic View-Based Active Matching)**:
   - Trạng thái Active của một mục con trên Sidebar chỉ phụ thuộc vào `pathname` và tham số cốt lõi `view`.
   - Các tham số vận hành phụ (`date`, `customerId`, `batchId`, `page`, `pageSize`, `q`, `sortBy`) là state nội bộ của trang, **tuyệt đối không được làm mất trạng thái Active** của mục trên Sidebar.
4. **Bất biến Chống Ngõ Cụt Giao diện (Anti-Dead-End Wayfinding)**:
   - Mọi trạng thái Empty State hoặc 403 Forbidden State bắt buộc phải có nút bấm dẫn hướng hành động (Actionable CTA), không để người dùng kẹt ở màn hình trắng hoặc màn hình thông báo suông.

---

## 3. MA TRẬN 14 CANONICAL ROUTES & QUY TẮC ĐIỀU HƯỚNG CHI TIẾT

| STT | Route Gốc (`path`) | Tên Nghiệp Vụ | Chế Độ Hỗ Trợ | Danh Sách Leaves (`view`) & Component Tương Ứng | Quy Tắc Chuyển Hướng Chuẩn Hóa (Canonical Normalization) |
|:---:|---|---|---|---|---|
| **1** | `/` | **Tổng quan điều hành** | `DEFAULT` (MRX redirect sang trạm vai trò) | - Không có leaves.<br>- Component: `DashboardPage` | - Nếu `mode === 'DEFAULT'`: render `DashboardPage`.<br>- Nếu `mode === 'MATERIAL_RECONCILIATION'`: **Tự động chuyển hướng** về `landingPath` của vai trò (`/weekly-menu?view=mrx-batch`, `/warehouse?view=mrx-daily`, `/chef?view=mrx-cooking`, hoặc `/reconciliation`). |
| **2** | `/weekly-menu` | **Thực đơn tuần** | `DEFAULT` & `MATERIAL_RECONCILIATION` | **DEFAULT**:<br>1. `Kế hoạch tuần` (`/weekly-menu`) -> `WeeklyScheduleView`<br>2. `Bàn giao nguyên liệu` (`?view=demand`) -> `MaterialDemandView`<br>3. `Kế hoạch sản xuất` (`?view=production-plan`) -> `ProductionPlanView`<br>4. `Giá vốn & BOM` (`?view=cost`) -> `MenuCostView`<br>**MRX**:<br>5. `Chuẩn bị lô đối soát` (`?view=mrx-batch`) -> `MrxBatchWorkbench` | - Ở chế độ `DEFAULT`: vào `/weekly-menu` render `WeeklyScheduleView`.<br>- Ở chế độ `MATERIAL_RECONCILIATION`: nếu URL là `/weekly-menu` (thiếu `?view=mrx-batch`), **BẮT BUỘC tự động chuyển hướng sang `/weekly-menu?view=mrx-batch` (replace)**. Cấm render `DefaultWeeklyMenuPage`. |
| **3** | `/meal-orders` | **Điều phối đơn ăn** | `DEFAULT` | - Không có leaves.<br>- Component: `MealOrdersPage` | - Ở chế độ `DEFAULT`: hoạt động bình thường.<br>- Ở chế độ `MRX`: `RoleGuard` chặn và chuyển sang `/forbidden` (giải thích do ranh giới chế độ DOM-MODE-1). |
| **4** | `/approvals` | **Duyệt vận hành** | `DEFAULT` | - Không có leaves.<br>- Component: `ApprovalPage` (SplitView 7/5) | - Ở chế độ `DEFAULT`: hoạt động bình thường, đồng bộ `type` và `selectedId` lên URL.<br>- Ở chế độ `MRX`: `RoleGuard` chuyển sang `/forbidden`. |
| **5** | `/purchasing` | **Thu mua** | `DEFAULT` | - Không có leaves.<br>- Component: `PurchasingPage` (SplitView 7/5) | - Ở chế độ `DEFAULT`: hoạt động bình thường.<br>- Ở chế độ `MRX`: `RoleGuard` chuyển sang `/forbidden`. |
| **6** | `/warehouse` | **Kho nguyên liệu** | `DEFAULT` & `MATERIAL_RECONCILIATION` | **DEFAULT**:<br>1. `Phiếu xuất kho` (`?view=issues`)<br>2. `Phiếu nhập kho` (`?view=receipts`)<br>3. `Tồn kho hiện tại` (`?view=stock`)<br>**MRX**:<br>4. `Định lượng xuất theo ngày` (`?view=mrx-daily`) -> `MrxDailyIssueWorkbench`<br>5. `Chuẩn bị xuất phối hợp` (`?view=mrx-preparation`) -> `MrxMultiCustomerPreparationWorkbench`<br>6. `Thay đổi nguồn chờ xử lý` (`?view=mrx-issues`) -> `MrxSourceDeltaWorkbench` | - Ở chế độ `DEFAULT`: vào `/warehouse` chuyển sang `/warehouse?view=issues`.<br>- Ở chế độ `MATERIAL_RECONCILIATION`: vào `/warehouse` (hoặc view không hợp lệ) **BẮT BUỘC tự động chuyển hướng sang `/warehouse?view=mrx-daily`**. |
| **7** | `/chef` | **Bếp trưởng** | `DEFAULT` & `MATERIAL_RECONCILIATION` | **DEFAULT**:<br>1. `Kế hoạch nấu ca` (`/chef`)<br>2. `Bàn giao nhận trả` (`?view=handover`)<br>**MRX**:<br>3. `Phiếu nấu theo lô` (`?view=mrx-cooking`) -> `MrxCookingWorkbench` | - Ở chế độ `DEFAULT`: render bếp trưởng ca nấu.<br>- Ở chế độ `MATERIAL_RECONCILIATION`: vào `/chef` **BẮT BUỘC tự động chuyển hướng sang `/chef?view=mrx-cooking`**. Giữ nguyên nguyên tắc phiếu nấu đông cứng chỉ đọc. |
| **8** | `/reconciliation` | **Đối soát nguyên liệu** | `MATERIAL_RECONCILIATION` (Độc quyền MRX) | 1. `Rà soát dòng ngày` (`/reconciliation` hoặc `?view=lines`) -> `ReconciliationPage` (bảng đối soát dòng)<br>2. `Sổ theo dõi chênh lệch` (`?view=variances`) -> Sổ chênh lệch<br>3. `Lịch sử giao dịch kho` (`?view=transactions`) -> Thẻ kho<br>4. `Nhật ký kiểm toán` (`?view=audit`) -> Audit trail & Thay đổi nguồn<br>5. `Danh bạ lô hoàn tất` (`?view=completed`) -> Sổ quyết toán | - Luôn luôn hoạt động ở chế độ `MRX`.<br>- Nếu vào `/reconciliation` không có view: mặc định xem tab `lines`. Trạng thái Active trên Sidebar gắn chặt với tab tương ứng.<br>- Tự động tìm kiếm và dẫn hướng nhảy sang lô đối soát gần nhất nếu tuần hiện tại chưa có dữ liệu. |
| **9** | `/reports` | **Báo cáo vận hành** | `DEFAULT` | 1. `Nhu cầu nguyên liệu` (`?view=demand`)<br>2. `Biến động giá mua` (`?view=prices`)<br>3. `Tồn kho vận hành` (`?view=stock`) | - Ở chế độ `DEFAULT`: hoạt động bình thường, vào `/reports` chuyển sang `/reports?view=demand`.<br>- Ở chế độ `MRX`: `RoleGuard` chuyển sang `/forbidden`. |
| **10**| `/admin-data` | **Quản trị dữ liệu** | `SHARED` (Cả 2 chế độ) | 1. `Danh mục nguyên liệu` (`/admin-data` hoặc `?view=ingredients`)<br>2. `Danh mục món ăn` (`?view=dishes`) | - Cả 2 chế độ đều truy cập được.<br>- Đồng bộ `view`, `q`, `page` hai chiều lên URL. |
| **11**| `/settings/approval-rules`| **Quy tắc phê duyệt** | `SHARED` (Admin/Manager) | - Không có leaves.<br>- Component: `ApprovalRulesPage` | - Cả 2 chế độ đều truy cập được nếu có vai trò Quản trị/Quản lý. |
| **12**| `/settings/advanced` | **Cấu hình hệ thống** | `SHARED` (Admin) | 1. `Chế độ vận hành` (`/settings/advanced?view=mode`) -> Chuyển đổi DEFAULT <-> MRX<br>2. `Bộ nhớ đệm` (`?view=cache`) | - Nơi chuyển đổi chế độ vận hành cốt lõi.<br>- Khi đổi chế độ, hệ thống thực hiện State Teardown và chuyển hướng về landing path của chế độ mới. |
| **13**| `/login` | **Xác thực hệ thống** | `PUBLIC` | - Không có leaves.<br>- Component: `LoginPage` | - Không yêu cầu đăng nhập. Khi đã đăng nhập, tự động chuyển về landing path. |
| **14**| `/forbidden` | **Kiểm soát bảo mật & Ranh giới chế độ** | `PUBLIC` (Khi bị chặn) | - Không có leaves.<br>- Component: `ForbiddenPage` | - Phân biệt rõ lỗi 403 do quyền hạn tài khoản vs lỗi 403 do ranh giới cách ly chế độ `DOM-MODE-1`.<br>- Cung cấp nút chuyển chế độ cho Admin và nút quay về bàn điều hành cho nhân viên. |

---

## 4. CHI TIẾT THUẬT TOÁN NHẬN DIỆN ACTIVE SIDEBAR TRONG `AppShell.tsx`

### 4.1. Vấn đề của thuật toán cũ
```tsx
// THUẬT TOÁN CŨ (LỖI):
const isCurrentSubview = (subviewUrl: string) => {
  const [path, query = ''] = subviewUrl.split('?');
  if (location.pathname !== path) return false;
  if (!query) return !location.search;
  return location.search === `?${query}`; // LỖI: So sánh cứng toàn bộ chuỗi query!
};
```
Khi URL có thêm `?view=mrx-batch&customerId=DAV&weekStartDate=2026-10-19`:
`location.search` chứa cả `customerId` và `weekStartDate`, trong khi `subviewUrl` chỉ có `?view=mrx-batch`. Kết quả `location.search === '?view=mrx-batch'` trả về `false` $\rightarrow$ Mất màu Active!

### 4.2. Thuật toán Chuẩn hóa Mới (Semantic Matching)
```tsx
// THUẬT TOÁN MỚI (CHUẨN HOÁ 100%):
const isCurrentSubview = (subviewUrl: string) => {
  const [targetPath, targetQueryString = ''] = subviewUrl.split('?');
  if (location.pathname !== targetPath) return false;

  const currentParams = new URLSearchParams(location.search);
  const targetParams = new URLSearchParams(targetQueryString);

  const targetView = targetParams.get('view');
  const currentView = currentParams.get('view');

  // Trường hợp 1: Mục tiêu có chỉ định tham số view cụ thể
  if (targetView) {
    return currentView === targetView;
  }

  // Trường hợp 2: Mục tiêu là leaf gốc không có query view (ví dụ: view mặc định)
  return !currentView;
};
```
**Ưu điểm**:
- Cho phép người dùng chọn khách hàng, chọn ngày, phân trang, tìm kiếm mà **mục con trên Sidebar vẫn luôn giữ trạng thái Active vững chắc**.
- Tự động nhận diện chính xác kể cả khi các tham số URL đổi thứ tự.

---

## 5. THỰC HIỆN KIỂM SOÁT DÒNG CODE VẬT LÝ (< 600 DÒNG)
Mọi chỉnh sửa trong đợt này bắt buộc tuân thủ trần kích thước file của dự án:
- `AppShell.tsx`: Hiện tại 357 dòng $\rightarrow$ Dự kiến sau khi tối ưu thuật toán: ~355 dòng.
- `WeeklyMenuPage.tsx`: Hiện tại 288 dòng $\rightarrow$ Dự kiến bổ sung redirect mode: ~295 dòng.
- `WarehousePage.tsx`: Hiện tại 470 dòng $\rightarrow$ Giữ nguyên cấu trúc.
- `ReconciliationPage.tsx`: Hiện tại 581 dòng $\rightarrow$ Giữ nguyên trần an toàn.
- `routeRegistry.ts` & `navigationEligibility.ts`: Đã tách biệt module.
- Bài test mới: Viết riêng vào file `frontend/src/__tests__/RouteNavigationIntegrity.test.tsx` (dưới 500 dòng).

---

Bản đặc tả kỹ thuật này đóng vai trò là hợp đồng thiết kế cho toàn bộ hệ thống Routing và Navigation của IPCManagement.  
Mời bạn xem tiếp Kế hoạch triển khai (Plan) chi tiết đi kèm bên dưới!
