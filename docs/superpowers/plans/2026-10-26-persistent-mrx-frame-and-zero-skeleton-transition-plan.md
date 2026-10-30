# Kế Hoạch Triển Khai Chi Tiết: Kiến Trúc Khung Vận Hành Thường Trực & Triệt Tiêu Hoàn Toàn Skeleton Chớp Nháy Khi Chuyển Route Chế Độ MRX

> **Mã kế hoạch:** `PLAN-PERSISTENT-MRX-FRAME-ZERO-SKELETON-20261026-LOCKED`  
> **Căn cứ đặc tả:** `docs/superpowers/specs/2026-10-26-persistent-mrx-frame-and-zero-skeleton-transition-spec.md`  
> **Phương thức thực hiện:** NATIVE INLINE EXECUTION & LIVE BROWSER VERIFICATION (Thực thi trực tiếp, đo kiểm thông số thực tế qua Playwright trên Chrome thật, không mock).

---

### Task 1: Nâng Cấp `StateBoundary.tsx` — Chặn Đứng Việc Bung Skeleton Toàn Trang Khi Điều Hướng
- **Mục tiêu**: Loại bỏ tận gốc phản xạ nhị phân cực đoan của `StateBoundary`: hễ `isLoading` là xóa trắng màn hình và vẽ chiếc skeleton 12 dòng ra đập vào mắt người dùng.
- **Thực hiện**:
  1. Mở `frontend/src/components/workbench/StateBoundary.tsx`:
  2. Tại khối `if (isLoading && !hasExistingData)`:
     - Phân định rõ ràng giữa **Lần đầu mở web (Cold Boot)** vs **Đang điều hướng trong phiên làm việc (In-Session Navigation)**.
     - Khi người dùng đang chuyển giữa các menu:
       + **TUYỆT ĐỐI CẤM** bung bảng `WorkbenchSkeleton` 12 dòng xám xịt.
       + Thay vào đó, giữ nguyên nền phẳng thanh lịch (`bg-white`), hiển thị một thanh tiến trình hairline siêu mỏng 2px ở đỉnh (`h-0.5 w-full bg-slate-900/40 animate-pulse`), giữ cho màn hình hoàn toàn tĩnh lặng, không một tích tắc giật nảy khung hình.
     - `WorkbenchSkeleton` chỉ xuất hiện khi cold boot hoặc khi được yêu cầu tường minh qua prop.
  3. Giữ file strictly < 380 dòng.
- **Xác minh**: Chạy unit test kiểm tra `StateBoundary`.

---

### Task 2: Khóa Chặt Concurrent Navigation Trong `AppShell.tsx`
- **Mục tiêu**: Kích hoạt cơ chế Concurrent Mode của React 18, bảo đảm màn hình cũ được giữ nguyên trên giao diện cho đến khi màn hình mới chuẩn bị xong dữ liệu trong RAM, sau đó hoán đổi trong đúng 1 microtask.
- **Thực hiện**:
  1. Mở `frontend/src/components/workbench/AppShell.tsx`:
  2. Đảm bảo toàn bộ các điểm click điều hướng menu lá và menu cha đều bọc trong `startTransition(() => navigate(to))`.
  3. Giữ file strictly < 390 dòng.
- **Xác minh**: Chạy test kiểm tra `AppShell`.

---

### Task 3: Bảo Toàn Dữ Liệu & Snapshot SWR Trên Cả 4 Trạm MRX
- **Mục tiêu**: Đảm bảo cả 4 trạm nghiệp vụ MRX đều duy trì dữ liệu cũ trong lúc tải dữ liệu mới (`keepPreviousData`), không bao giờ gọi các lệnh xóa trắng state làm sụp đổ layout.
- **Thực hiện**:
  1. Rà soát:
     - `MrxDailyIssueWorkbench.tsx` (< 595 dòng)
     - `ReconciliationPage.tsx` (< 595 dòng)
     - `MrxBatchWorkbench.tsx` (< 535 dòng)
     - `MrxCookingWorkbench.tsx` (< 370 dòng)
  2. Đảm bảo mọi kết quả API (dữ liệu thành công, 404 menu rỗng, 409 lô tương thích) đều được lưu snapshot vào `serverStateCache` để phục vụ chuyển trang trong 0ms.
- **Xác minh**: Chạy test SWR trên các workbench.

---

### Task 4: Kiểm Soát Trần Kiến Trúc (< 600 Dòng)
- **Mục tiêu**: Đảm bảo 100% file tuân thủ trần kiến trúc nghiêm ngặt của dự án.
- **Thực hiện**:
  - Chạy `wc -l` kiểm tra các file đã chỉnh sửa.

---

### Task 5: Kiểm Thử Trực Tiếp Trên Trình Duyệt Web Thật (Zero Mock Parameters)
- **Mục tiêu**: Đo đạc thông số thực tế, chụp ảnh từng frame mili-giây chứng minh không còn Skeleton khi click chuyển menu trên Sidebar:
  - Khung hình Frame +15ms, +35ms, +70ms, +150ms: `Skeleton: false (null)`.
  - F12 Console Errors: 0.
  - F12 Network Failures: 0.
- **Thực hiện**:
  - Chạy `node scripts/test-live-user-click-skeleton.mjs`.
  - Chạy `node scripts/expert-fe-deep-audit.mjs`.

---

### Task 6: Chạy Bộ 5 Cổng Pre-Commit Kiểm Toán Doanh Nghiệp
- **Mục tiêu**: 100% tests PASS (23 test suites, 227+ tests), 0 lỗi typecheck, 0 lỗi build.
- **Thực hiện**:
  - Chạy `npm run precommit:verify`.

---

Bắt đầu thực thi trực tiếp từ Task 1 ngay sau đây.
