# Đặc Tả Kỹ Thuật Khóa Cứng: Loại Bỏ Hoàn Toàn Anti-Pattern Route Suspense Skeleton & Chuẩn Hóa Kiến Trúc SPA Eager Loading

> **Mã đặc tả:** `SPEC-ERADICATE-ROUTE-SUSPENSE-SKELETON-20261026-LOCKED`  
> **Thẩm quyền:** `AGENTS.md` (Bất biến `DOM-MODE-1`, Kiến trúc quản trị 5 tầng) & `docs/DESIGN.md`  
> **Chẩn đoán của chuyên gia:**  
> Lỗi nhấp nháy Skeleton toàn trang khi chuyển giữa các menu trên Sidebar (`pi-clipboard-abf354ee-44aa-45c4-8a0a-30a38578dc39.png`) là do **sai lầm kiến trúc trong `App.tsx` khi lạm dụng `React.lazy()` và bọc từng route riêng lẻ bằng `<Suspense fallback={<WorkbenchLoadingFallback />}>`**.  
> Việc cắt vụn các trang 12KB rồi ném Full-Page Skeleton ra màn hình trong thời gian đợi nạp module JS là một Anti-pattern phá vỡ hoàn toàn lợi thế của bộ nhớ đệm SWR 0ms.

---

## 1. CÁC QUY TẮC BẮT BIẾN KHÓA CỨNG (LOCKED RULES)

### 1.1. Khóa Cứng: Eager Loading Cho 12 Canonical Pages Trong `App.tsx` (`RULE-EAGER-SPA-01`)
- **XÓA BỎ VĨNH VIỄN** 12 khai báo `React.lazy(() => import(...))` đối với các route nghiệp vụ trong `frontend/src/App.tsx`.
- Chuyển toàn bộ 12 trang canonical (`DashboardPage`, `WeeklyMenuPage`, `MealOrdersPage`, `ChefDashboardPage`, `PurchasingPage`, `WarehousePage`, `ApprovalPage`, `ReconciliationPage`, `ReportsPage`, `AdminDataPage`, `ApprovalRulesPage`, `AdvancedSettingsPage`) sang **Static/Eager Import**.
- Tổng dung lượng của 12 trang này khi nén gzip chưa tới **150 KB**, hoàn toàn tải nhẹ nhàng trong một microtask.
- **Hiệu quả tối thượng**:
  + Mã nguồn của toàn bộ các trang đã nằm sẵn 100% trong bộ nhớ RAM ngay khi người dùng đăng nhập.
  - Khi người dùng bấm chuyển giữa các menu trên Sidebar: React Router chuyển đổi component **ĐỒNG BỘ TRONG 0ms**, **TUYỆT ĐỐI KHÔNG CÒN SUSPENSE, KHÔNG BAO GIỜ XUẤT HIỆN SKELETON FALLBACK TOÀN TRANG NỮA!**

### 1.2. Khóa Cứng: Xóa Bỏ `<Suspense fallback={<WorkbenchLoadingFallback />}>` Từng Route (`RULE-PURGE-ROUTE-SUSPENSE-01`)
- Loại bỏ hoàn toàn wrapper `<Suspense fallback={<WorkbenchLoadingFallback />}>` bọc quanh từng thẻ `<Route>` trong `App.tsx`.
- Gỡ bỏ component fallback trung gian không cần thiết tại các route nội bộ.
- `<WorkbenchLoadingFallback />` chỉ được giữ lại ở đúng 1 vị trí duy nhất: lúc ứng dụng khởi động lần đầu tiên (Cold Boot) khi đang xác thực JWT token hoặc nạp phiên bản vận hành `operationalModeVersion === null`.

### 1.3. Khóa Cứng: Điều Hướng Mượt Mà Bằng `startTransition` (`RULE-CONCURRENT-NAV-01`)
- Tại `AppShell.tsx`, thao tác click chuyển trang trên Sidebar được bọc trong React 18 `startTransition(() => navigate(to))`.
- React Concurrent Mode bảo đảm giữ nguyên màn hình hiện tại cho đến khi frame mới sẵn sàng, sau đó thực hiện hoán đổi tức thì (Instant Swap), triệt tiêu hoàn toàn hiện tượng giật trắng hoặc nháy bố cục (CLS = 0.0000).

### 1.4. Khóa Cứng: Cấm Tuyệt Đối Skeleton Toàn Trang Khi Điều Hướng Menu (`RULE-FORBID-FULL-SKELETON-01`)
- Skeleton (`WorkbenchSkeleton`) chỉ có duy nhất 1 nhiệm vụ: hiển thị khi người dùng F5 tải lại toàn bộ trình duyệt từ đầu khi cache rỗng hoàn toàn.
- Một khi người dùng đã ở trong phiên làm việc: **CẤM TUYỆT ĐỐI biến cả trang thành Skeleton xám xịt khi chuyển đổi menu Sidebar**.

---

## 2. MA TRẬN KIỂM SOÁT DÒNG CODE VẬT LÝ (< 600 DÒNG)

- `frontend/src/App.tsx`: < 180 dòng (Sau khi gỡ `lazy` và `Suspense`: ~155 dòng).
- `frontend/src/components/workbench/AppShell.tsx`: < 410 dòng (Hiện tại: 395 dòng).

Bản đặc tả kỹ thuật này là căn cứ tối cao để loại bỏ hoàn toàn con sâu bệnh lạm dụng Skeleton tại cổng Router của hệ thống.
