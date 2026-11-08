# Kế Hoạch Triển Khai Chi Tiết: Loại Bỏ Hoàn Toàn Anti-Pattern Route Suspense Skeleton & Chuẩn Hóa Kiến Trúc SPA Eager Loading

> **Mã kế hoạch:** `PLAN-ERADICATE-ROUTE-SUSPENSE-SKELETON-20261026-LOCKED`  
> **Căn cứ đặc tả:** `docs/superpowers/specs/2026-10-26-eradicate-router-suspense-skeleton-and-enforce-eager-spa-spec.md`  
> **Phương thức thực hiện:** NATIVE INLINE EXECUTION (Thực thi trực tiếp, kiểm chứng bằng trình duyệt Chrome thật và F12 DevTools).

---

### Task 1: Gọt Bỏ Toàn Bộ `React.lazy()` và `<Suspense>` Từng Route Trong `App.tsx`
- **Mục tiêu**: Đưa 12 trang nghiệp vụ về Eager Static Import, triệt tiêu tận gốc nguyên nhân kích hoạt `WorkbenchSkeleton` toàn trang khi bấm menu Sidebar.
- **Thực hiện**:
  1. Mở `frontend/src/App.tsx`:
  2. Xóa 12 dòng `const ... = lazy(...)`. Thay bằng:
     ```tsx
     import { DashboardPage } from './features/dashboard/DashboardPage';
     import { WeeklyMenuPage } from './features/weekly-menu/WeeklyMenuPage';
     import { MealOrdersPage } from './features/coordination/MealOrdersPage';
     import { ChefDashboardPage } from './features/chef/ChefDashboardPage';
     import { PurchasingPage } from './features/purchasing/PurchasingPage';
     import { WarehousePage } from './features/warehouse/WarehousePage';
     import { ApprovalPage } from './features/approvals/ApprovalPage';
     import { ReconciliationPage } from './features/reconciliation/ReconciliationPage';
     import { ReportsPage } from './features/reports/ReportsPage';
     import { AdminDataPage } from './features/admin/AdminDataPage';
     import { ApprovalRulesPage } from './features/admin/ApprovalRulesPage';
     import { AdvancedSettingsPage } from './features/admin/AdvancedSettingsPage';
     ```
  3. Gỡ bỏ toàn bộ 12 khối `<Suspense fallback={<WorkbenchLoadingFallback />}>` bọc quanh từng thẻ `<Route>`.
  4. Giữ lại `WorkbenchLoadingFallback` ở đúng 1 vị trí duy nhất trong `RootLandingRoute` khi `operationalModeVersion === null`.
  5. Đảm bảo file `App.tsx` < 180 dòng.
- **Xác minh**: Chạy unit test kiểm tra App renders đầy đủ không có lỗi import.

---

### Task 2: Nâng Cấp Điều Hướng Sidebar Bằng `startTransition` Trong `AppShell.tsx`
- **Mục tiêu**: Tận dụng cơ chế Concurrent Navigation của React 18, bảo đảm màn hình cũ được giữ nguyên mượt mà cho đến khi màn hình mới commit xong, hoán đổi tức thì trong 0ms.
- **Thực hiện**:
  1. Mở `frontend/src/components/workbench/AppShell.tsx`:
  2. Bọc hàm `navigate(to)` bên trong `startTransition`:
     ```tsx
     import { startTransition, ... } from 'react';
     ...
     const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, to: string) => {
       if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
       if (typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarCollapsed(true);
       if (!requestNavigation(() => startTransition(() => navigate(to)))) event.preventDefault();
     };
     ```
  3. Đảm bảo file `AppShell.tsx` < 410 dòng.
- **Xác minh**: Chạy test kiểm tra điều hướng Sidebar.

---

### Task 3: Kiểm Soát Giới Hạn Kiến Trúc (< 600 Dòng)
- **Mục tiêu**: Đảm bảo 100% file tuân thủ trần kiến trúc nghiêm ngặt.
- **Thực hiện**:
  - Chạy `wc -l` xác nhận `App.tsx` và `AppShell.tsx`.

---

### Task 4: Kiểm Thử Thực Tế F12 DevTools & Đo Đạc Tốc Độ Chuyển Trang (0ms Revisit)
- **Mục tiêu**: Chứng minh bằng số liệu thực nghiệm:
  - Khi người dùng bấm chuyển qua lại giữa các menu trên Sidebar: **KHÔNG CÒN BẤT KỲ SKELETON FLASH NÀO**.
  - Không có lỗi F12 Console.
- **Thực hiện**:
  - Chạy `node scripts/f12-dev-tools-audit.mjs` và `node scripts/expert-fe-deep-audit.mjs`.

---

### Task 5: Chạy Toàn Bộ 5 Cổng Pre-Commit Kiểm Toán Doanh Nghiệp
- **Mục tiêu**: Đảm bảo 100% test suites (23 files, 227+ tests) PASS và Vite build thành công sạch sẽ.
- **Thực hiện**:
  - Chạy `npm run precommit:verify`.

---

Bắt đầu thực thi trực tiếp từ Task 1 ngay sau đây.
