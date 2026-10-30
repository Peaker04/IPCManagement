# Kế Hoạch Triển Khai: Đồng Bộ Kiến Trúc 14 Canonical Routes & Cây Điều Hướng Sidebar Đa Cấp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi Sidebar mất active và lỗi màn hình hiển thị sai chế độ (render Default trong mode MRX tại `/weekly-menu`), thiết lập cơ chế chuẩn hóa URL tự động và đồng bộ trạng thái Active trên toàn bộ 14 Canonical Routes.

**Architecture:** Áp dụng mô hình 4 trụ cột chuẩn hóa điều hướng: (1) Canonical Leaf Resolver tự động chuyển hướng các URL gốc mồ côi sang Leaf của mode tương ứng; (2) Semantic Subview Matching trong `AppShell.tsx` nhận diện active dựa trên tham số `view` mà không bị ảnh hưởng bởi các query params vận hành phụ (`date`, `customerId`, `page`); (3) Strict Mode Isolation (`DOM-MODE-1`) bảo đảm cấm tuyệt đối rò rỉ Component/API Default vào chế độ MRX; (4) Bộ kiểm thử hợp đồng tự động bảo chứng toàn bộ cây điều hướng.

**Tech Stack:** React 19, React Router v7, Tailwind CSS, Lucide React, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-25-canonical-routes-and-nested-nav-sync-spec.md`

## Global Constraints

- Tuân thủ tuyệt đối nguyên tắc cách ly chế độ `DOM-MODE-1`: Chế độ `MATERIAL_RECONCILIATION` không bao giờ gọi API hoặc render component của `DEFAULT`.
- Kỷ luật giới hạn kích thước file (`check-architecture-growth.mjs`): Không có file Frontend nào được vượt quá 600 dòng.
- Mọi bài kiểm thử mới phải viết vào file riêng: `frontend/src/__tests__/RouteNavigationIntegrity.test.tsx` (dưới 1500 dòng).
- Giữ nguyên 0 lỗi build (`tsc -b && vite build`) và 0 vi phạm forbidden patterns (`window.alert` / `window.confirm`).

## Review Focus

1. Khi người dùng đang ở chế độ `Đối soát MRX` và truy cập `/weekly-menu` (không có query), hệ thống bắt buộc tự động chuyển hướng sang `/weekly-menu?view=mrx-batch`, render `MrxBatchWorkbench` và tô màu Active cho mục con "Chuẩn bị lô đối soát".
2. Khi URL có thêm các tham số vận hành phụ như `?view=mrx-batch&customerId=DAV&weekStartDate=2026-10-19`, mục con trên Sidebar vẫn phải giữ nguyên màu nền Active (nền đen chữ trắng).
3. Khi ở chế độ `DEFAULT`, truy cập `/weekly-menu` render bình thường `DefaultWeeklyMenuPage` với 4 leaves Default.
4. Khi truy cập các route gốc khác như `/warehouse`, `/chef`, URL tự động chuẩn hóa về view tương ứng của chế độ hiện hành.
5. Trang `/forbidden` hiển thị rõ ràng nguyên nhân lỗi do chế độ vận hành và có nút chuyển chế độ cho Admin.

---

### Task 1: Chuẩn hóa Thuật toán Semantic Subview Matching trong `AppShell.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/AppShell.tsx:120-135`
- Test: `frontend/src/__tests__/AppShell.test.tsx`

- [ ] **Bước 1.1**: Mở file `frontend/src/components/workbench/AppShell.tsx`, tìm hàm `isCurrentSubview`.
- [ ] **Bước 1.2**: Thay thế thuật toán so sánh chuỗi thô bằng thuật toán Semantic Matching:
  ```tsx
  const isCurrentSubview = (subviewUrl: string) => {
    const [targetPath, targetQueryString = ''] = subviewUrl.split('?');
    if (location.pathname !== targetPath) return false;

    const currentParams = new URLSearchParams(location.search);
    const targetParams = new URLSearchParams(targetQueryString);

    const targetView = targetParams.get('view');
    const currentView = currentParams.get('view');

    // Nếu mục tiêu có chỉ định tham số view cụ thể
    if (targetView) {
      return currentView === targetView;
    }

    // Nếu mục tiêu là leaf gốc không có query view (view mặc định)
    return !currentView;
  };
  ```
- [ ] **Bước 1.3**: Kiểm tra lại dòng code, đảm bảo `AppShell.tsx` vẫn duy trì dưới 360 dòng (ngưỡng an toàn < 600 dòng).
- [ ] **Bước 1.4**: Chạy kiểm thử đơn vị của AppShell:
  ```bash
  npm --prefix frontend run test:unit -- src/__tests__/AppShell.test.tsx
  ```
  Xác nhận tất cả test case của AppShell đều PASS.

---

### Task 2: Chuẩn hóa Phân luồng Tự động trong `WeeklyMenuPage.tsx` (Khắc phục Lỗi Screenshot)

**Files:**
- Modify: `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx:1-45`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [ ] **Bước 2.1**: Mở file `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx`.
- [ ] **Bước 2.2**: Bổ sung import `Navigate` từ `react-router-dom` và `useAuth` từ `../../store/useAuth`.
- [ ] **Bước 2.3**: Triển khai cơ chế Canonical Redirect bảo vệ chế độ MRX:
  ```tsx
  export function WeeklyMenuPage() {
    const { operationalMode } = useAuth();
    const [searchParams] = useSearchParams();
    const view = searchParams.get('view');

    // Bất biến DOM-MODE-1: Nếu đang ở chế độ MRX mà URL chưa có ?view=mrx-batch,
    // tự động chuyển hướng ngay sang /weekly-menu?view=mrx-batch (giữ nguyên các query khác nếu có)
    if (operationalMode === 'MATERIAL_RECONCILIATION') {
      if (view !== 'mrx-batch') {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('view', 'mrx-batch');
        return <Navigate to={`/weekly-menu?${nextParams.toString()}`} replace />;
      }
      return <MrxBatchWorkbench />;
    }

    // Ở chế độ DEFAULT:
    return <DefaultWeeklyMenuPage />;
  }
  ```
- [ ] **Bước 2.4**: Kiểm tra số dòng code của `WeeklyMenuPage.tsx`, đảm bảo duy trì dưới 300 dòng (< 600 dòng).
- [ ] **Bước 2.5**: Chạy kiểm thử đơn vị của WeeklyMenu:
  ```bash
  npm --prefix frontend run test:unit -- src/__tests__/WeeklyMenu.test.tsx
  ```
  Xác nhận tất cả 16/16 test case đều PASS.

---

### Task 3: Chuẩn hóa Điều hướng & Thông số Vận hành cho `/warehouse` và `/chef`

**Files:**
- Modify: `frontend/src/features/warehouse/WarehousePage.tsx:25-45`
- Modify: `frontend/src/features/chef/ChefDashboardPage.tsx:35-50`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`

- [ ] **Bước 3.1**: Kiểm tra `WarehousePage.tsx`:
  - Khi `operationalMode === 'MATERIAL_RECONCILIATION'` và `!view`: chuyển hướng chuẩn xác sang `/warehouse?view=mrx-daily` (replace).
  - Đảm bảo khi chuyển hướng, bảo lưu tham số ngày `date` hoặc `batchId` nếu người dùng đã truyền trên URL.
- [ ] **Bước 3.2**: Kiểm tra `ChefDashboardPage.tsx`:
  - Khi `operationalMode === 'MATERIAL_RECONCILIATION'` và `!view`: chuyển hướng chuẩn xác sang `/chef?view=mrx-cooking` (replace).
- [ ] **Bước 3.3**: Chạy kiểm thử đơn vị cho Warehouse và Chef:
  ```bash
  npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx src/__tests__/Chef.test.tsx
  ```
  Xác nhận 30/30 test case đều PASS.

---

### Task 4: Chuẩn hóa Trạng thái Active cho Toàn bộ 5 Tabs tại `/reconciliation`

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/routes/routeRegistry.ts:75-85`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Bước 4.1**: Trong `routeRegistry.ts`, kiểm tra các leaves của route `/reconciliation`:
  - `reconciliation.lines`: `to: '/reconciliation'` (hoặc `?view=lines`)
  - `reconciliation.variances`: `to: '/reconciliation?view=variances'`
  - `reconciliation.transactions`: `to: '/reconciliation?view=transactions'`
  - `reconciliation.audit`: `to: '/reconciliation?view=audit'`
  - `reconciliation.completed`: `to: '/reconciliation?view=completed'`
- [ ] **Bước 4.2**: Trong `AppShell.tsx`, nhờ thuật toán Semantic Matching ở Task 1:
  - Khi URL là `/reconciliation` (không có view), tự động khớp với leaf `reconciliation.lines`.
  - Khi URL là `/reconciliation?view=variances&batchId=...`, tự động khớp chính xác với leaf `reconciliation.variances` mà không bị mất màu Active.
- [ ] **Bước 4.3**: Chạy kiểm thử đơn vị của Reconciliation:
  ```bash
  npm --prefix frontend run test:unit -- src/__tests__/Reconciliation.test.tsx
  ```
  Xác nhận 18/18 test case đều PASS.

---

### Task 5: Xây dựng Bộ Kiểm thử Hợp đồng Toàn diện `RouteNavigationIntegrity.test.tsx`

**Files:**
- Create: `frontend/src/__tests__/RouteNavigationIntegrity.test.tsx`

- [ ] **Bước 5.1**: Tạo mới file `frontend/src/__tests__/RouteNavigationIntegrity.test.tsx` kiểm tra tự động 6 kịch bản hợp đồng cốt lõi:
  1. *Kịch bản 1 (Sửa lỗi Screenshot)*: Khi mode là `MATERIAL_RECONCILIATION`, truy cập `/weekly-menu` tự động chuyển hướng sang `/weekly-menu?view=mrx-batch`, render `Chuẩn bị lô đối soát` (không render Default).
  2. *Kịch bản 2 (Active Leaf với Query Params)*: Khi URL là `/weekly-menu?view=mrx-batch&customerId=DAV&weekStartDate=2026-10-19`, leaf "Chuẩn bị lô đối soát" trên Sidebar có class Active (nền đen `bg-slate-900 text-white`).
  3. *Kịch bản 3 (Default Mode Navigation)*: Khi mode là `DEFAULT`, truy cập `/weekly-menu` render đúng `Thực đơn & KHSX tuần` (4 leaves Default).
  4. *Kịch bản 4 (Warehouse MRX Normalization)*: Khi mode là `MATERIAL_RECONCILIATION`, truy cập `/warehouse` tự động chuyển hướng sang `/warehouse?view=mrx-daily`.
  5. *Kịch bản 5 (Chef MRX Normalization)*: Khi mode là `MATERIAL_RECONCILIATION`, truy cập `/chef` tự động chuyển hướng sang `/chef?view=mrx-cooking`.
  6. *Kịch bản 6 (Reconciliation Subviews Active)*: Khi truy cập từng tab `/reconciliation?view=variances`, leaf tương ứng trên Sidebar kích hoạt Active chính xác.
- [ ] **Bước 5.2**: Chạy kiểm thử riêng file test mới:
  ```bash
  npm --prefix frontend run test:unit -- src/__tests__/RouteNavigationIntegrity.test.tsx --reporter=verbose
  ```
  Xác nhận 6/6 test case mới đều PASS.

---

### Task 6: Chạy Toàn Bộ Cổng Kiểm Định Tự Động Tiền-Commit (`npm run precommit:verify`)

**Files:**
- Check: Toàn bộ codebase và các cổng Gate A -> Gate E

- [ ] **Bước 6.1**: Chạy lệnh kiểm tra tổng thể từ thư mục gốc:
  ```bash
  npm run precommit:verify
  ```
- [ ] **Bước 6.2**: Xác nhận:
  - Gate A: Toàn bộ physical modules & barrel exports đều PASS.
  - Gate B: 0 lệnh `window.alert` / `window.confirm`.
  - Gate C: 0 file FE > 600 dòng, 0 file test > 1500 dòng.
  - Gate D: Production build (`tsc -b && vite build`) thành công 100% với 0 lỗi.
  - Gate E: Toàn bộ 22 file test (hơn 219 test cases) đều PASS.
- [ ] **Bước 6.3**: Chạy `git status --short` kiểm tra danh sách file sạch sẽ, sẵn sàng commit.
