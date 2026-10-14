# Implementation Plan: Tái cấu trúc & Đổi mới 4 Không gian Tác nghiệp /weekly-menu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi và tinh gọn phân hệ `/weekly-menu` từ 6 trang phân mảnh, trùng lặp thành **4 Không gian Tác nghiệp Chuẩn mực (Universal Operational Workspaces)** bám sát 100% dữ liệu Backend C# & Redux Models:
1. **Ma trận thực đơn tuần (`schedule`)**: Giữ nguyên vẹn độc lập, chỉ hiển thị thuần túy tên món trong từng ô ma trận.
2. **Kế hoạch sản xuất bếp (`production-plan`)**: Bảng KHSX xuất xưởng cho Bếp sau khi thực đơn xuất bản.
3. **Tiến độ & Bàn giao nguyên liệu (`handover`)**: Hợp nhất Nhu cầu + Bàn giao thành 1 luồng 5 cột chuẩn (loại bỏ cột Tiếp theo chéo role, bảo toàn RBAC).
4. **Giá vốn & Định mức BOM (`cost`)**: Hợp nhất Giá vốn ngày + Bóc tách BOM món thành bố cục **Master - Detail (Split View)**, xóa bỏ hoàn toàn dropdown chọn món cũ.

**Architecture:**
- **Floorplan 6 tầng đồng bộ:** Header 48px ➔ Sub-toolbar 40px ➔ Compact Metadata Strip (1 dòng) ➔ TableViewport cố định min-height ➔ Flush Pagination Footer ➔ Centralized State Controller (`QueryViewBoundary`).
- **Data & Contract Ground Truth:** Map trực tiếp các DTO từ `WeeklyMenuImportResult`, `WeeklyProductionPlanDto`, `usePurchaseSummary`, `useMaterialDemand`, `useMenuCost`, `useDishMaterials`.
- **CSS Clean-up:** Dùng toàn diện Design Tokens `--ipc-*`, font Inter Variable, `tabular-nums`, icon vector Lucide SVG monochrome, loại bỏ sạch sành sanh AI-slop.

**Tech Stack:** React 19, TypeScript, Redux Toolkit / RTK Query, Tailwind CSS, Lucide Icons, Vitest, Playwright.

**Spec:** `docs/DESIGN.md`, `docs/UI-KIT.md`, `docs/domain/weekly-menu.md`, và Ma trận 24 Trụ cột UI/UX.

---

## Global Constraints
- Không làm thay đổi logic tính toán tài chính của Backend (BOM arithmetic, đơn giá, số suất, công thức giá vốn).
- Giữ nguyên ranh giới phân quyền RBAC: Màn hình tuần không có các nút điều hướng chéo quyền sang Kho hay Thu mua.
- Mọi thao tác cuộn, chuyển tab hoặc phân trang đều bắt buộc dùng `focus({ preventScroll: true })`.
- Mọi bảng dữ liệu khi loading đều hiển thị `TableSkeleton` tương ứng với số cột thực tế.
- Ma trận thực đơn tuần chỉ hiển thị thuần túy tên món ăn trong từng ô (`formatDishName(cell.dishName)`).

---

## Tasks

### Task 1: Tinh chỉnh Ma trận Thực đơn Tuần (`ImportedLayoutMatrix.tsx` & `WeeklyScheduleWorkspace.tsx`)

**Files:**
- Modify: `frontend/src/features/projects/components/ImportedLayoutMatrix.tsx`
- Modify: `frontend/src/features/projects/weekly-menu/schedule/WeeklyScheduleWorkspace.tsx`
- Test: `frontend/src/features/projects/components/ImportedLayoutMatrix.test.tsx`
- Test: `frontend/src/features/projects/weekly-menu/schedule/WeeklyScheduleWorkspace.test.tsx`

**Interfaces:**
- Đảm bảo trong từng ô ma trận chỉ hiển thị tên món ăn sạch sẽ (`<span className="font-semibold text-slate-900">{formatDishName(cell.dishName)}</span>`).
- Header chuẩn 48px (`.ipc-section-header`) với icon `<CalendarDays size={18}>`, tiêu đề `"Kế hoạch thực đơn tuần"`, các nút Nhập Excel, Sửa thực đơn, Xuất bản tuần.
- Readiness strip (`WeeklyMenuReadiness`) hiển thị 4 bước đồng bộ.

- [ ] **Step 1: Viết test kiểm tra ô ma trận chỉ render tên món ăn, không kèm các chuỗi định lượng phụ.**
- [ ] **Step 2: Chạy test để xác nhận baseline.**
- [ ] **Step 3: Cập nhật `ImportedLayoutMatrix.tsx` và `WeeklyScheduleWorkspace.tsx` chuẩn hóa layout và typography.**
- [ ] **Step 4: Chạy test xác nhận PASS.**

---

### Task 2: Chuẩn hóa Kế hoạch Sản xuất Bếp (`ProductionPlanSection.tsx`)

**Files:**
- Modify: `frontend/src/features/projects/weekly-menu/production-plan/ProductionPlanSection.tsx`
- Test: `frontend/src/features/projects/weekly-menu/production-plan/productionPlanErrorState.test.tsx`

**Interfaces:**
- Header 48px với icon `<ClipboardList size={18}>`.
- Toolbar gọn 40px với bộ chọn ngày hoặc cả tuần.
- Compact Metadata Strip (1 dòng): Tổng suất ngày, các ca, mã KHSX.
- TableViewport 4 cột chuẩn: `Ca`, `Mã KHSX ca`, `Món ăn xuất xưởng`, `Số suất kế hoạch` (căn phải `tabular-nums`).
- TableSkeleton 4 cột chuẩn khi loading.

- [ ] **Step 1: Chuẩn hóa component `ProductionPlanSection.tsx` theo Floorplan 6 tầng.**
- [ ] **Step 2: Chạy test `productionPlanErrorState.test.tsx` xác nhận PASS.**

---

### Task 3: Hợp nhất Tiến độ & Bàn giao Nguyên liệu (`PurchaseSummarySection.tsx` & `MaterialDemandSection.tsx`)

**Files:**
- Modify: `frontend/src/features/projects/weekly-menu/purchasing/PurchaseSummarySection.tsx`
- Modify: `frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx`
- Test: `frontend/src/features/projects/weekly-menu/purchasing/PurchaseSummarySection.feedback.test.tsx`
- Test: `frontend/src/features/projects/weekly-menu/purchasing/PurchaseSummarySection.handoff.test.tsx`

**Interfaces:**
- **Loại bỏ cột "Tiếp theo / nextAction"** (bảo toàn nguyên tắc RBAC, không thao tác chéo role).
- Bảng bàn giao 5 cột chuẩn:
  1. `Ngày` (10%)
  2. `Nguyên liệu / Nguồn món` (32%)
  3. `Cần (BOM)` (18%, căn phải `tabular-nums`)
  4. `Bàn giao kho (Đã xuất / Chưa xuất)` (24%, căn phải `tabular-nums`)
  5. `Trạng thái` (16%, căn giữa với `StatusBadge`)
- Filter-empty: Khi tìm kiếm không có kết quả, hiển thị thông báo kèm nút "Xóa tìm kiếm".
- Flush footer pagination với `isPending` và `preventScroll`.

- [ ] **Step 1: Viết test xác nhận bảng không còn cột `nextAction` và hiển thị đúng 5 cột.**
- [ ] **Step 2: Cập nhật `PurchaseSummarySection.tsx` loại bỏ cột nextAction, đưa về 5 cột chuẩn.**
- [ ] **Step 3: Chạy toàn bộ test purchasing và demand để xác nhận PASS.**

---

### Task 4: Xây dựng Master - Detail Split View cho Giá vốn & Định mức BOM (`MenuCostSection.tsx`)

**Files:**
- Modify: `frontend/src/features/projects/weekly-menu/cost/MenuCostSection.tsx`
- Modify: `frontend/src/features/projects/weekly-menu/dish-materials/DishMaterialsSection.tsx`
- Test: `frontend/src/features/projects/weekly-menu/cost/useMenuCost.test.ts`
- Test: `frontend/src/features/projects/weekly-menu/dish-materials/useDishMaterials.test.ts`

**Interfaces:**
- Hợp nhất 2 màn hình Giá vốn + Phân tích món thành 1 cấu trúc Split View (Master-Detail):
  - **Master Pane (52%):** Bảng danh sách món ăn trong ngày (Ca, Món, Suất, Đơn giá vốn, Thành tiền, Cột Food Cost % có thanh đo trực quan). Dòng đang chọn được highlight.
  - **Detail Pane (48%):** Click chọn món bên trái ➔ Mở ngay bảng chi tiết định lượng thành phần BOM của món đó (Nguyên liệu, ĐVT, Định lượng/suất 6 chữ số thập phân, Đơn giá NCC, Thành tiền/khay) + Tóm tắt lợi nhuận gộp ước tính trên 1 suất ăn.
  - Loại bỏ hoàn toàn dropdown chọn món vụng về của trang cũ!

- [ ] **Step 1: Viết test cho component Master-Detail Split View.**
- [ ] **Step 2: Hiện thực hóa cấu trúc Split View trong `MenuCostSection.tsx`.**
- [ ] **Step 3: Chạy test xác nhận PASS.**

---

### Task 5: Đồng bộ Hóa Navigation Shell & URL Deep-links (`WeeklyMenuViewContent.tsx`, `WeeklyMenuNavigation.tsx`)

**Files:**
- Modify: `frontend/src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx`
- Modify: `frontend/src/features/projects/weekly-menu/shell/WeeklyMenuNavigation.tsx`
- Modify: `frontend/src/routes/routeRegistry.ts`
- Test: `frontend/src/routes/routeRegistry.test.ts`
- Test: `frontend/src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.test.tsx`

**Interfaces:**
- Hỗ trợ đầy đủ 4 view chuẩn: `schedule`, `production-plan`, `handover`, `cost`.
- Giữ alias tự động điều hướng cho các view cũ (`demand` ➔ `handover`, `purchase-summary` ➔ `handover`, `dish-materials` ➔ `cost`) để các URL deep-link cũ không bao giờ bị 404.

- [ ] **Step 1: Cập nhật routeRegistry và mapping views.**
- [ ] **Step 2: Chạy test routeRegistry và navigation.**

---

### Task 6: Kiểm thử & Nghiệm thu Toàn diện (Verification & Quality Gates)

- [ ] **Step 1: Chạy `npm run lint:fe`** (đảm bảo 0 lỗi lint).
- [ ] **Step 2: Chạy `npm run build:fe`** (đảm bảo biên dịch TypeScript và Vite build thành công).
- [ ] **Step 3: Chạy `npm run depcruise:fe`** (đảm bảo 0 vi phạm dependency).
- [ ] **Step 4: Chạy toàn bộ Vitest test suites liên quan đến `/weekly-menu`**.
- [ ] **Step 5: Chạy Playwright visual regression tests (`cd frontend && npx playwright test tests/browser/pagination-visual.spec.ts`)**.
