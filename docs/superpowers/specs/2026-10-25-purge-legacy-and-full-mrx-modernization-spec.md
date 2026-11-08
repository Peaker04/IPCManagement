# Đặc Tả Kỹ Thuật Khóa Cứng: Dọn Sạch Code Cũ, Sửa Lỗi Hiển Thị & Hoàn Thiện Trải Nghiệm Người Dùng Toàn Diện Chế Độ MRX

> **Mã đặc tả:** `SPEC-MRX-PURGE-MODERNIZATION-20261025-LOCKED`  
> **Trạng thái:** BẮT BUỘC KHÓA CỨNG (LOCKED & MANDATORY)  
> **Chủ quản thẩm quyền:**  
> - Bất biến phân lập chế độ: `AGENTS.md` (`DOM-MODE-1`) & `docs/DOMAIN.md`  
> - Tiêu chuẩn trải nghiệm người dùng: `docs/DESIGN.md`, `docs/UI-KIT.md`, SAP Fiori 3 & Linear Ergonomic Guidelines  
> **Phạm vi áp dụng:** Toàn bộ 4 trạm nghiệp vụ MRX (`MrxBatchWorkbench`, `MrxDailyIssueWorkbench`, `MrxCookingWorkbench`, `ReconciliationPage`) và các component nền tảng (`VietnameseDateInput`, `WorkspaceHeader`, `StateBoundary`, `ReconciliationReportTables`).

---

## 1. MỤC TIÊU & CÁC BẢN VÁ QUY TẮC BẮT BIẾN KHÓA CỨNG (LOCKED RULES)

### 1.1. Khóa Cứng: Loại Bỏ Hoàn Toàn Dữ Liệu Lịch Sử Gây Nhiễu (`RULE-CLEAN-NOISE-01`)
- **Phát hiện từ ảnh thực tế (`pi-clipboard-7129f99c...`)**: Việc hiển thị hộp màu xanh chứa 5 tuần cũ từ tháng 7, tháng 8, tháng 9 (`draftSources`) ngay giữa màn hình khi người dùng đang làm việc cho tuần hiện tại là ý tưởng thừa thãi, gây nhiễu thông tin nghiêm trọng.
- **Quy tắc khóa cứng**:
  - **XÓA BỎ VĨNH VIỄN** khối hiển thị `draftSources` 5 tuần cũ bên trong Empty State của `MrxBatchWorkbench.tsx`.
  - Khi tuần hiện tại chưa có thực đơn, giao diện chỉ hiển thị thông điệp tối giản, thanh lịch: *"Chưa có nguồn thực đơn đã phát hành cho tuần này"* kèm đúng 1 nút Primary màu đen **"Nhập thực đơn Excel"**. Tuyệt đối không tự tiện lôi dữ liệu cũ ra làm rối mắt người dùng.

### 1.2. Khóa Cứng: Sửa Lỗi Icon và Kích Thước Ô Chọn Ngày (`RULE-DATE-INPUT-01`)
- **Phát hiện từ ảnh thực tế (`pi-clipboard-2e2732a1...`)**: Ô nhập ngày bị ép chiều rộng quá hẹp (`w-32` = 128px), làm chữ số ngày tháng `21/09/2026` đè lấn lên icon lịch, gây cảm giác chữ bị vỡ hoặc icon bị méo.
- **Quy tắc khóa cứng**:
  - Tại `VietnameseDateInput.tsx`, cố định chiều rộng tối thiểu an toàn `min-w-[145px] w-38 sm:w-40`, đệm lề phải `pr-9` để icon lịch luôn nằm độc lập ở mép phải.
  - Các chữ số `dd/MM/yyyy` luôn hiển thị trọn vẹn, căn lề thẳng hàng, không bao giờ bị đè lấn trong bất kỳ trường hợp nào.

### 1.3. Khóa Cứng: Chống Tràn Header & Chấm Dứt Hiện Tượng Trôi Chữ (`RULE-LAYOUT-OVERFLOW-01`)
- **Phát hiện từ ảnh thực tế (`pi-clipboard-c124e5f2...`)**: Do nhồi nhét quá nhiều dropdown trên Header (`h-14` = 56px), badge trạng thái `Chưa chọn lô` bị rớt xuống dòng thứ 2 và trôi lơ lửng đè lên viền trên của ô ngày. Đồng thời, ô chọn lô khi chưa có dữ liệu biến thành một hình chữ nhật rỗng ruột `[          v ]`.
- **Quy tắc khóa cứng**:
  - Trong `ReconciliationPage.tsx`, tái cấu trúc các selector trên Header:
    + Căn chỉnh chiều rộng: Khách hàng `w-44 sm:w-52`, Chọn lô `w-48 sm:w-56`, Ô ngày `w-38`.
    + Đặt `shrink-0` và `whitespace-nowrap` trên từng phần tử để không bao giờ bị rớt dòng trong Header 56px.
  - Khi `batches.length === 0`: Dropdown chọn lô **BẮT BUỘC hiển thị placeholder rõ ràng**: `<option value="">(Chưa có lô đối soát)</option>`, tuyệt đối không để lại ô rỗng ruột.

### 1.4. Khóa Cứng: Triệt Tiêu Vòng Lặp Tải Vô Tận Tại Các Tab Báo Cáo (`RULE-REPORT-LOADING-01`)
- **Phát hiện từ ảnh thực tế (`pi-clipboard-b33ac3e7...`, `351c0515...`, `b5b97ea4...`)**: Khi bạn chuyển sang các tab `Sổ theo dõi chênh lệch` (`?view=variances`), `Lịch sử giao dịch kho` (`?view=transactions`), `Nhật ký kiểm toán` (`?view=audit`) mà chưa chọn lô (`batchId = ''`), màn hình hiện `... Đang tải số liệu báo cáo đối soát...` và **QUAY LOADING VÔ TẬN KHÔNG BAO GIỜ DỪNG LẠI**.
- **Quy tắc khóa cứng**:
  - Tại `useReconciliationReports.ts` & `ReconciliationReportTables.tsx`: Nếu `!batchId` đối với các tab yêu cầu lô (`variances`, `transactions`, `audit`):
    + Biến `isReportLoading` **BẮT BUỘC trả về `false` ngay lập tức**.
    + Hiển thị Empty State giải thích rõ ràng: *"Vui lòng chọn lô đối soát phía trên để xem sổ chênh lệch / lịch sử giao dịch / nhật ký kiểm toán"* kèm nút **"Quay về rà soát dòng ngày"**.
    + Tuyệt đối cấm để icon loading nhấp nháy vô tận khi không có ID đối tượng.

### 1.5. Khóa Cứng: Làm Sạch Tab Quyết Toán Đã Hoàn Tất (`RULE-COMPLETED-VIEW-01`)
- **Phát hiện từ ảnh thực tế (`pi-clipboard-eb84da33...`)**: Khi mở tab `Danh bạ lô hoàn tất` (`?view=completed`), phía trên Subbar vẫn hiển thị thanh đếm số râu ria (`Đổi nguồn: 0, Chờ kho: 0...`) và Stepper tiến trình (`1 Chuẩn bị -> 2 Đóng băng...`) vốn là của một lô đang chạy, gây sai lệch ngữ cảnh.
- **Quy tắc khóa cứng**:
  - Khi ở tab `completed`: Ẩn hoàn toàn Stepper tiến trình và thanh đếm số không liên quan.
  - Hiển thị Subbar tinh gọn: Tiêu đề *"Danh bạ lô đối soát đã hoàn tất & quyết toán"* kèm số lượng tổng các lô đã đóng sổ vĩnh viễn.

### 1.6. Khóa Cứng: Xóa Bỏ Raw Enum Tiếng Anh và Hardcode Thừa Thãi (`RULE-HUMAN-MICROCOPY-01`)
- **Phát hiện từ ảnh thực tế (`pi-clipboard-2e2732a1...`, `283ccb53...`)**:
  - `LEGACY_DAILY_LINEAGE_MISSING` in thô bằng chữ vàng trên màn hình Kho.
  - `KITCHEN_FROZEN_LINEAGE_MISSING` in thô trên màn hình Bếp.
  - Dòng hardcode `Chưa xuất · Bấm "Điền đủ toàn bộ"` vẫn hiện khi `Mặt hàng: 0`.
- **Quy tắc khóa cứng**:
  - Chuyển ngữ 100% các mã lỗi Backend sang tiếng Việt thân thiện, chuẩn văn phong nghiệp vụ:
    + `LEGACY_DAILY_LINEAGE_MISSING` $\rightarrow$ *"Lô đối soát này được tạo từ đợt trước khi áp dụng tính năng phân rã theo ngày."*
    + `KITCHEN_FROZEN_LINEAGE_MISSING` $\rightarrow$ *"Lô đối soát này chưa có phiếu nấu ăn theo ca. Vui lòng chọn lô đối soát khác trong danh sách phía trên."*
  - Khi `lines.length === 0`: Ẩn dòng hardcode `Chưa xuất · Bấm "Điền đủ toàn bộ"` và ẩn danh sách phiếu xuất trống ở đáy màn hình.

---

## 2. MA TRẬN KIỂM SOÁT KIẾN TRÚC & DÒNG CODE VẬT LÝ (< 600 DÒNG)

Toàn bộ các file Frontend được tinh chỉnh bắt buộc tuân thủ nghiêm ngặt giới hạn dòng:
- `MrxBatchWorkbench.tsx`: < 520 dòng (Hiện tại: 522 dòng $\rightarrow$ Sau khi bỏ draftSources: ~495 dòng).
- `ReconciliationPage.tsx`: < 585 dòng (Hiện tại: 589 dòng $\rightarrow$ Sau khi dọn header: ~580 dòng).
- `MrxDailyIssueWorkbench.tsx`: < 590 dòng (Hiện tại: 595 dòng $\rightarrow$ Sau khi dọn enum/hardcode: ~580 dòng).
- `MrxCookingWorkbench.tsx`: < 360 dòng (Hiện tại: 355 dòng).
- `ReconciliationReportTables.tsx`: < 320 dòng (Hiện tại: 298 dòng).
- `VietnameseDateInput.tsx`: < 200 dòng (Hiện tại: 185 dòng).
- File test bảo chứng mới: `frontend/src/__tests__/FullMrxModernizationSmoke.test.tsx` (< 1500 dòng).

---

Bản đặc tả kỹ thuật này là căn cứ tối cao, khóa cứng mọi quy tắc trải nghiệm người dùng và xóa bỏ sạch sẽ mọi sự chồng chéo giữa code cũ và mới.
