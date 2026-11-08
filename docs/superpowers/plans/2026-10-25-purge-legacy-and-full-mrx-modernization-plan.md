# Kế Hoạch Triển Khai Chi Tiết: Dọn Sạch Toàn Bộ Code Cũ, Sửa Lỗi Hiển Thị & Khóa Cứng Quy Tắc 5 Tầng MRX

> **Mã kế hoạch:** `PLAN-MRX-PURGE-MODERNIZATION-20261025-LOCKED`  
> **Căn cứ đặc tả:** `docs/superpowers/specs/2026-10-25-purge-legacy-and-full-mrx-modernization-spec.md`  
> **Cam kết:** Sửa triệt để mọi lỗi từ 8 ảnh hiện trường, xóa sạch code thừa, không để chồng chéo giữa code mới và cũ, bảo đảm 100% file < 600 dòng.

---

### Task 1: Sửa Lỗi Icon và Kích Thước Ô Chọn Ngày (`VietnameseDateInput.tsx`)
- **Mục tiêu**: Ngăn chặn hoàn toàn việc chữ số ngày tháng `21/09/2026` đè lấn lên icon lịch (khắc phục lỗi ở Ảnh 2).
- **Thực hiện**:
  1. Cập nhật `VietnameseDateInput.tsx`:
     - Tăng chiều rộng input: chuyển từ `w-40` cứng sang `w-38 sm:w-40 min-w-[145px]` với padding `pl-3 pr-9 py-1.5`.
     - Đặt icon `<CalendarDays>` ở vị trí cố định `right-2.5 top-1/2 -translate-y-1/2 pointer-events-none` (trigger bọc ngoài) để icon không bao giờ bị biến dạng hay đè lên số.
     - Đảm bảo font monospace số hiển thị sắc nét, thẳng hàng.
- **Xác minh**: Chạy unit test kiểm tra render ngày `21/09/2026` đầy đủ 10 ký tự, icon không bị chèn ép.

---

### Task 2: Dọn Dẹp Trạm Điều Phối — Xóa Bỏ Cục Ngày Cũ Gây Nhiễu (`MrxBatchWorkbench.tsx`)
- **Mục tiêu**: Xóa vĩnh viễn khối hộp xanh hiển thị 5 tuần cũ (`draftSources`) gây rối mắt (khắc phục lỗi ở Ảnh 1).
- **Thực hiện**:
  1. Mở `MrxBatchWorkbench.tsx`:
     - Xóa hoàn toàn khối render `draftSources` trong `customEmptyContent`.
     - Empty state chỉ hiển thị:
       + Icon lịch biểu thanh lịch.
       + Tiêu đề: *"Chưa có nguồn thực đơn đã phát hành cho tuần này"*.
       + Mô tả: *"Vui lòng nhập thực đơn Excel từ khách hàng hoặc chọn tuần làm việc khác phía trên."*
       + Duy nhất 1 nút Primary màu đen: **"Nhập thực đơn Excel"** (mở modal import).
     - Không hiển thị nút "Kiểm tra định lượng" khi chưa có menu.
     - Khi `!batch`: Thanh trạng thái hiển thị trung thực *"Chưa khởi tạo lô đối soát"*.
  2. Kiểm tra số dòng code: đảm bảo file giảm xuống dưới 500 dòng (< 600 dòng tối đa).
- **Xác minh**: Chạy test kiểm chứng Empty state không còn bất kỳ nút bấm hay danh sách tuần cũ nào gây nhiễu.

---

### Task 3: Dọn Dẹp Trạm Kho — Xóa Raw Enum Tiếng Anh và Hardcode Thừa (`MrxDailyIssueWorkbench.tsx`)
- **Mục tiêu**: Chuyển ngữ mã kỹ thuật sang tiếng Việt thân thiện, xóa dòng text hardcode vô lý khi 0 mặt hàng (khắc phục lỗi ở Ảnh 2).
- **Thực hiện**:
  1. Mở `MrxDailyIssueWorkbench.tsx`:
     - Thay thế dòng thông báo thô `LEGACY_DAILY_LINEAGE_MISSING` bằng banner nghiệp vụ chuẩn tiếng Việt:
       *"Lô đối soát này được tạo từ đợt trước khi áp dụng tính năng phân rã theo ngày. Dữ liệu xuất kho tổng tuần vẫn được lưu trữ đầy đủ trong lịch sử giao dịch."*
     - Tại thanh Subbar: Nếu `items.length === 0`, ẩn hoàn toàn dòng chữ `Chưa xuất · Bấm "Điền đủ toàn bộ" nếu xuất đúng định mức`. Thay bằng: `Chưa có mặt hàng cần xuất trong ngày này`.
     - Ở đáy màn hình: Ẩn danh sách chip `Phiếu xuất đã tạo cho lô:` khi không có dòng xuất kho nào của ngày hiện tại.
  2. Kiểm tra số dòng code: < 585 dòng.
- **Xác minh**: Chạy test với case 0 items và case legacy lineage, kiểm tra hiển thị tiếng Việt rõ ràng.

---

### Task 4: Dọn Dẹp Trạm Bếp — Xóa Raw Enum và Xử Lý Màn Hình Trống (`MrxCookingWorkbench.tsx`)
- **Mục tiêu**: Loại bỏ mã thô `KITCHEN_FROZEN_LINEAGE_MISSING`, hiển thị hướng dẫn nghiệp vụ rõ ràng cho Bếp trưởng (khắc phục lỗi ở Ảnh 3).
- **Thực hiện**:
  1. Mở `MrxCookingWorkbench.tsx`:
     - Thay đổi thông báo trung tâm khi lô không có phiếu nấu ca:
       + Tiêu đề: *"Lô đối soát này chưa có phiếu nấu theo ca"*.
       + Mô tả: *"Lô này được tạo trước khi áp dụng tính năng phiếu nấu ca hoặc chưa phân rã định mức món ăn. Vui lòng chọn lô đối soát khác trong danh sách phía trên."*
     - Khi không có dữ liệu: các nút `Tải CSV`, `Tải Excel`, `In phiếu nấu` hiển thị trạng thái disabled kèm tooltip giải thích nhẹ nhàng.
  2. Kiểm tra số dòng code: < 360 dòng.
- **Xác minh**: Chạy test với lô cũ, bảo đảm thông báo thân thiện xuất hiện đúng.

---

### Task 5: Sửa Dứt Điểm Lỗi Header Vỡ Trôi Chữ & Dropdown Rỗng Ruột (`ReconciliationPage.tsx`)
- **Mục tiêu**: Chống tràn Header, chấm dứt việc chữ "Chưa... lô" đè lên ô ngày; xử lý dropdown rỗng ruột (khắc phục lỗi ở Ảnh 4).
- **Thực hiện**:
  1. Mở `ReconciliationPage.tsx`:
     - Sửa cụm selectors trong `WorkspaceHeader`:
       + Dropdown Khách hàng: `w-44 sm:w-52 shrink-0`.
       + Dropdown Chọn lô: `w-48 sm:w-56 shrink-0`. Khi `batches.length === 0`, render:
         `<option value="">(Chưa có lô đối soát)</option>` và disabled hợp lý, không để lại hình chữ nhật rỗng ruột!
       + Badge trạng thái lô: Tích hợp trực tiếp bên trong ô hoặc đặt ngay cạnh tiêu đề, bảo đảm `shrink-0 whitespace-nowrap`, không bao giờ bị rớt dòng thứ 2 đè lên ô ngày.
     - Xử lý tab Quyết toán (`view === 'completed'`):
       + Ẩn hoàn toàn `ReconciliationLifecycleStrip` (thanh stepper) và thanh đếm số râu ria không liên quan (khắc phục lỗi ở Ảnh 8).
       + Giữ lại bảng danh bạ hoàn tất rộng rãi, sang trọng.
  2. Kiểm tra số dòng code: < 585 dòng.
- **Xác minh**: Chạy test với `batches = []` và `view = 'completed'`, kiểm tra header không rớt dòng và placeholder hiển thị chuẩn.

---

### Task 6: Triệt Tiêu Vòng Lặp Tải Vô Tận Tại Các Tab Báo Cáo (`useReconciliationReports.ts` & `ReconciliationReportTables.tsx`)
- **Mục tiêu**: Khắc phục dứt điểm lỗi xoay loading vĩnh viễn khi chưa chọn lô tại các tab báo cáo (khắc phục lỗi ở Ảnh 5, 6, 7).
- **Thực hiện**:
  1. Mở `useReconciliationReports.ts`:
     - Kiểm tra điều kiện tiên quyết: Nếu `!batchId` (chưa có lô nào được chọn):
       + Đặt ngay lập tức `isReportLoading = false`.
       + Trả về `variances = []`, `transactions = []`, `auditEntries = []`.
       + Tuyệt đối không để `isReportLoading` treo ở trạng thái `true`!
  2. Mở `ReconciliationReportTables.tsx`:
     - Khi `!batchId`: Thay vì hiển thị spinner loading nhấp nháy vô tận, render Empty State giải thích rõ ràng:
       + Icon tệp báo cáo.
       + Tiêu đề: *"Vui lòng chọn lô đối soát để xem báo cáo"*.
       + Mô tả: *"Tuần làm việc hiện tại chưa có lô đối soát được chọn. Hãy chọn lô trong danh sách phía trên hoặc quay lại rà soát dòng ngày."*
       + Nút hành động: **"Quay về rà soát dòng ngày"** (chuyển sang `view=daily`).
  3. Kiểm tra số dòng code: < 320 dòng.
- **Xác minh**: Chạy test chuyển tab khi `batchId = ''`, kiểm chứng màn hình hiển thị Empty State ngay lập tức sau 0ms, không có vòng lặp loading nào.

---

### Task 7: Kiểm Toán Toàn Diện, Chạy Bộ Test Bảo Chứng & Precommit Gate
- **Mục tiêu**: Bảo đảm toàn bộ 5 Tầng kiến trúc ăn khớp tuyệt đối, không có lỗi hồi quy, 100% tests PASS.
- **Thực hiện**:
  1. Cập nhật `frontend/src/__tests__/FullMrxModernizationSmoke.test.tsx` bổ sung các ca kiểm thử:
     - Case 1: Empty state điều phối không có khối tuần cũ `draftSources`.
     - Case 2: Ô ngày `VietnameseDateInput` đủ rộng, không đè lên icon.
     - Case 3: Dropdown lô đối soát hiển thị `(Chưa có lô đối soát)` khi rỗng.
     - Case 4: Các tab báo cáo khi `!batchId` không bao giờ bị kẹt trong loading loop.
     - Case 5: Tab `view=completed` ẩn stepper tiến trình của từng lô.
  2. Chạy toàn bộ bộ kiểm thử tự động:
     - `npm run precommit:verify` (Gates A đến E, kiểm tra 600 dòng kiến trúc, chạy 224+ tests).
  3. Báo cáo bằng chứng khách quan.

---

Bản kế hoạch này sẵn sàng để thực thi ngay lập tức theo từng bước vững chắc.
