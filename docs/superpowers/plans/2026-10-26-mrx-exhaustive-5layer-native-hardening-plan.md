# Kế Hoạch Triển Khai Chi Tiết: Cầu Nối Ngữ Cảnh Vận Hành Toàn Cục & Khóa Chặt 5 Tầng Chế Độ MRX

> **Mã kế hoạch:** `PLAN-MRX-WORKSPACE-SCOPE-5LAYER-BRIDGE-20261026-LOCKED`  
> **Căn cứ đặc tả:** `docs/superpowers/specs/2026-10-26-unified-mrx-workspace-scope-and-5layer-bridge-spec.md`  
> **Phương thức thực hiện:** NATIVE INLINE EXECUTION (Thực thi trực tiếp, không dựa trên niềm tin, kiểm chứng bằng chứng thực tế).

---

### Task 1: Xây Dựng `workspaceSessionStore.ts` (Tầng 3 — Client State)
- **Mục tiêu**: Cung cấp nguồn sự thật duy nhất (Single Source of Truth) trong phiên làm việc cho 4 tham số: `activeCustomerId`, `activeDate`, `activeWeekStartDate`, `activeBatchId`.
- **Thực hiện**:
  1. Tạo file `frontend/src/store/workspaceSessionStore.ts`:
     - Khởi tạo từ `sessionStorage` (an toàn khi F5) hoặc giá trị mặc định.
     - Hàm `getScope()` đọc đồng bộ tức thì trong 0ms.
     - Hàm `setScope(partial)` cập nhật và thông báo cho các subscriber.
     - Hook `useWorkspaceSessionScope()` cho phép component lắng nghe thay đổi tự động.
     - Hàm `clearScope()` xóa phiên khi đăng xuất.
  2. Xuất barrel qua `frontend/src/store/index.ts`.
- **Xác minh**: Chạy unit test kiểm tra `getScope()`, `setScope()`, và `clearScope()`.

---

### Task 2: Khóa Cứng Hình Học Bọc Ngoài Ô Ngày (`VietnameseDateInput.tsx`)
- **Mục tiêu**: Ngăn chặn 100% hiện tượng Flexbox co rút thẻ bọc ô ngày từ 160px xuống 85px làm icon lịch đè nát chữ số ngày tháng (Sửa dứt điểm lỗi ở Ảnh 4).
- **Thực hiện**:
  1. Mở `frontend/src/components/ui/vietnamese-date-input.tsx`:
     - Thay đổi thẻ `div` bọc ngoài:
       ```tsx
       <div className="relative inline-flex items-center shrink-0 w-40 min-w-[160px]">
       ```
     - Đảm bảo thuộc tính `shrink-0` và `min-w-[160px]` ngăn chặn trình duyệt co ép thẻ bọc.
  2. Giữ nguyên vị trí trigger icon `absolute right-2.5` và padding `pl-3 pr-9 py-1.5` trên thẻ input.
- **Xác minh**: Kiểm tra kích thước bounding box và visual display của ô ngày trong thanh Header chật chội.

---

### Task 3: Kết Nối Trạm 1 (`MrxBatchWorkbench.tsx`) Vào `WorkspaceSessionStore`
- **Mục tiêu**: Triệt tiêu hoàn toàn cú chớp Skeleton khi bấm menu "Chuẩn bị lô đối soát" trên Sidebar.
- **Thực hiện**:
  1. Mở `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`:
     - Khởi tạo `customerId` và `weekStartDate` ngay tại Render 0 từ `workspaceSessionStore.getScope()`.
     - `cacheKey = mrx_source_${customerId}_${weekStartDate}` tra cứu trúng cache RAM ngay ở frame đầu tiên.
     - Nếu đã có trong cache: `isLoading = false` ngay lập tức $\rightarrow$ **0ms hiển thị, zero skeleton**.
     - Khi người dùng đổi khách hàng hoặc tuần trên Header, gọi `workspaceSessionStore.setScope(...)`.
  2. Giữ file strictly < 520 dòng.
- **Xác minh**: Chạy test kiểm chứng component mount với `customerId` có sẵn từ store, không bung skeleton.

---

### Task 4: Đồng Bộ Chuỗi Lọc Trạm 2 (`MrxDailyIssueWorkbench.tsx`)
- **Mục tiêu**: Bổ sung ô chọn Khách hàng, liên kết chuỗi lọc Khách hàng $\rightarrow$ Ngày $\rightarrow$ Lô đối soát, triệt tiêu việc bốc nhầm lô cũ của khách hàng khác (Sửa lỗi ở Ảnh 3).
- **Thực hiện**:
  1. Mở `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`:
     - Khởi tạo khách hàng và ngày từ `workspaceSessionStore.getScope()`.
     - Bổ sung dropdown chọn Khách hàng vào Header (cạnh ô chọn Lô và Ô ngày).
     - Danh sách lô đối soát được lọc tự động theo đúng khách hàng đang chọn (`activeCustomerId`).
     - Đấu nối SWR cache trên Render 0: `cacheKey = mrx_daily_${activeBatchId}`.
  2. Giữ file strictly < 595 dòng.
- **Xác minh**: Chạy test kiểm chứng Trạm Kho hiển thị đúng khách hàng được truyền từ session store và lọc danh sách lô chuẩn xác.

---

### Task 5: Đồng Bộ Trạm 3 (`MrxCookingWorkbench.tsx`)
- **Mục tiêu**: Kế thừa khách hàng và lô từ `workspaceSessionStore`, lọc danh sách lô nấu theo đúng khách hàng đang thao tác.
- **Thực hiện**:
  1. Mở `frontend/src/features/chef/MrxCookingWorkbench.tsx`:
     - Khởi tạo từ `workspaceSessionStore.getScope()`.
     - Nạp dữ liệu trong 0ms nếu đã có trong `serverStateCache`.
  2. Giữ file strictly < 360 dòng.
- **Xác minh**: Chạy test kiểm chứng Trạm Bếp nạp dữ liệu mượt mà.

---

### Task 6: Đồng Bộ Trạm 4 (`ReconciliationPage.tsx`)
- **Mục tiêu**: Đồng bộ hoàn toàn Khách hàng, Ngày và Lô đối soát với Trạm 1 và Trạm 2, dập tắt skeleton khi chuyển sang trang Đối soát.
- **Thực hiện**:
  1. Mở `frontend/src/features/reconciliation/ReconciliationPage.tsx`:
     - Khởi tạo `customerCode`, `serviceDate`, `batchId` từ `workspaceSessionStore.getScope()`.
     - Tra cứu `serverStateCache` ngay tại Render 0 $\rightarrow$ `isLoading = false` nếu cache hit $\rightarrow$ 0ms render.
     - Khi đổi khách hàng, ngày hoặc lô, gọi `workspaceSessionStore.setScope(...)`.
  2. Giữ file strictly < 595 dòng.
- **Xác minh**: Chạy test kiểm chứng chuyển tab giữa Trạm 1 và Trạm 4 không bị lệch khách hàng hay nhảy ngày.

---

### Task 7: Kiểm Toán Toàn Diện, Chạy Playwright Trình Duyệt Thật & Precommit Gate
- **Mục tiêu**: Xác thực thực tế trên trình duyệt thật 100% các tiêu chí: không chớp skeleton, không đè icon, bộ lọc đồng nhất và không có lỗi hồi quy.
- **Thực hiện**:
  1. Chạy `npm run precommit:verify` (Gates A đến E, 227+ tests unit).
  2. Chạy Playwright kiểm thử chấp nhận người dùng thực tế (`tests/browser/conformance-runtime.spec.ts`).
  3. Chạy Playwright đo đạc định lượng 5 tầng (`node scripts/measure-route-5layers.mjs`).
  4. Ghi nhận nhật ký kiểm toán và báo cáo kết quả.

---

Bắt đầu thực thi trực tiếp từ Task 1 ngay sau đây.
