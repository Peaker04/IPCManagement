# Kế Hoạch Triển Khai Chi Tiết: Kiến Trúc Bộ Nhớ Đệm SWR Toàn Diện, Triệt Tiêu 100% Skeleton Flash Khi Chuyển Route Chế Độ MRX

> **Mã kế hoạch:** `PLAN-MRX-ZERO-STROBE-SWR-CACHE-20261026-LOCKED`  
> **Căn cứ đặc tả:** `docs/superpowers/specs/2026-10-26-mrx-zero-strobe-swr-cache-architecture-spec.md`  
> **Phương thức thực hiện:** NATIVE INLINE EXECUTION (Thực thi trực tiếp, kiểm chứng bằng chụp ảnh frame-by-frame qua Playwright và F12 DevTools).

---

### Task 1: Nâng Cấp SWR Cache & Dập Tắt Skeleton Flash Tại Trạm Kho (`MrxDailyIssueWorkbench.tsx`)
- **Mục tiêu**: Xóa bỏ hoàn toàn cú chớp Skeleton 15ms khi bấm vào "Định lượng xuất theo ngày" (giải quyết ảnh `action1_frame_15ms.png`).
- **Thực hiện**:
  1. Mở `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`:
  2. Sửa khởi tạo `loading`:
     ```tsx
     const [loading, setLoading] = useState(() => Boolean(activeBatchId && !initialCache));
     ```
  3. Trong hàm `load(targetBatchId, targetDate)`:
     - Tạo khóa động: `const key = `mrx_daily_${targetBatchId}`;`
     - Lưu thành công: `serverStateCache.set(key, { daily: nextDaily, history: nextHistory, isCompatibilityBlocked: false });`
     - Trong khối `catch`: Nếu gặp lỗi 409 (`LEGACY_DAILY_LINEAGE_MISSING`):
       Lưu vào cache: `serverStateCache.set(key, { daily: null, history: null, isCompatibilityBlocked: true, reason: '...' });`
  4. Đọc lại cache khi mount: Nếu `initialCache?.isCompatibilityBlocked`:
     - Khôi phục ngay cờ cảnh báo tương thích mà không cần gọi lại API và **KHÔNG BẬT SKELETON**.
  5. Giữ file strictly < 595 dòng.
- **Xác minh**: Chạy script `test-live-user-click-skeleton.mjs` kiểm tra Frame +15ms: `Skeleton: false`.

---

### Task 2: Nâng Cấp SWR Cache & Dập Tắt Skeleton Flash Tại Trạm Bếp (`MrxCookingWorkbench.tsx`)
- **Mục tiêu**: Xóa bỏ cú chớp Skeleton khi mở "Phiếu nấu theo lô" đối với các lô cũ.
- **Thực hiện**:
  1. Mở `frontend/src/features/chef/MrxCookingWorkbench.tsx`:
  2. Sửa khởi tạo `isLoading`:
     ```tsx
     const [isLoading, setIsLoading] = useState(() => Boolean(batchId && !initialCache));
     ```
  3. Trong `loadCookingData(id)`:
     - Trong khối `catch`: Nếu lỗi 409, lưu vào `serverStateCache.set(`mrx_cooking_${id}`, { isLegacyMissing: true, data: null })`.
  4. Giữ file strictly < 370 dòng.
- **Xác minh**: Chạy test kiểm tra mở Bếp với lô cũ, giao diện hiển thị ngay lập tức trong 0ms.

---

### Task 3: Nâng Cấp SWR Cache & Dập Tắt Skeleton Flash Tại Trạm Lập Lô (`MrxBatchWorkbench.tsx`)
- **Mục tiêu**: Xóa bỏ cú chớp Skeleton khi chuyển sang tuần chưa có thực đơn (404 Not Found).
- **Thực hiện**:
  1. Mở `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`:
  2. Sửa khởi tạo `isLoading`:
     ```tsx
     const [isLoading, setIsLoading] = useState(() => Boolean(customerId && !initialCache));
     ```
  3. Trong hàm `loadSource`:
     - Trong khối `catch`: Nếu API trả về 404, lưu vào `serverStateCache.set(cacheKey, { source: null, batch: null, notFound: true })`.
  4. Giữ file strictly < 530 dòng.
- **Xác minh**: Chạy test kiểm tra chuyển tuần rỗng không bung skeleton.

---

### Task 4: Khóa Chặt Trạm Đối Soát (`ReconciliationPage.tsx`)
- **Mục tiêu**: Đảm bảo khi `!batchId`, `isLoading` khởi tạo bằng `false`, không bung skeleton ở frame 0.
- **Thực hiện**:
  1. Mở `frontend/src/features/reconciliation/ReconciliationPage.tsx`:
  2. Sửa khởi tạo `isLoading`:
     ```tsx
     const [isLoading, setIsLoading] = useState(() => Boolean(batchId && !initialReconCache));
     ```
  3. Giữ file strictly < 595 dòng.
- **Xác minh**: Chạy test kiểm tra mount trang với `batchId = ''`.

---

### Task 5: Kiểm Soát Giới Hạn Kiến Trúc (< 600 Dòng)
- **Mục tiêu**: Đảm bảo 100% file tuân thủ trần kiến trúc nghiêm ngặt.
- **Thực hiện**:
  - Chạy `wc -l` kiểm tra các file đã chỉnh sửa.

---

### Task 6: Kiểm Chứng Trực Tiếp Bằng Kịch Bản Chụp Ảnh Tốc Độ Cao (`test-live-user-click-skeleton.mjs`)
- **Mục tiêu**: Bằng chứng khách quan trên khung hình:
  - Khung hình Frame +15ms phải có: `Skeleton: false (null)`.
  - Không có bất kỳ frame nào xuất hiện Skeleton khi click Sidebar.
- **Thực hiện**:
  - Chạy `node scripts/test-live-user-click-skeleton.mjs`.

---

### Task 7: Chạy Bộ 5 Cổng Pre-Commit Kiểm Toán Doanh Nghiệp
- **Mục tiêu**: 100% tests PASS (23 test suites, 227+ tests).
- **Thực hiện**:
  - Chạy `npm run precommit:verify`.

---

Bắt đầu thực thi trực tiếp từ Task 1 ngay sau đây.
