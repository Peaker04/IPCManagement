# Đặc Tả Kỹ Thuật: Chuẩn Hóa Toàn Diện 15 Bề Mặt MRX, Khôi Phục Nhập Thực Đơn & Kiểm Thử E2E Mutation Cô Lập
*(MRX Full-Matrix Conformance, Weekly Menu Import Restoration & Isolated E2E Mutation Specification)*

- **Mã tài liệu**: `SPEC-MRX-2026-10-23-FULL-E2E`
- **Phiên bản**: `3.0.0 (Master Production & E2E Mutation Edition)`
- **Trạng thái**: Đã phê duyệt phương hướng (Chờ duyệt Spec & Plan trước khi thực thi)
- **Chủ quyền tài liệu**: `docs/DOMAIN.md`, `docs/DESIGN.md`, `docs/UI-KIT.md`, `AGENTS.md`
- **Tài liệu tham chiếu FE cũ**: `D:\ki7\PRN222 Doanh Nghiệp\IPCManagement-fe-legacy-backup`

---

## 1. Tầm Nhìn Kiến Trúc & 4 Trụ Cột Nâng Cấp Cốt Lõi

Cuộc audit thực tế toàn diện trên 15 bề mặt tác nghiệp MRX đã làm sáng tỏ 4 nguyên lý vận hành sống còn:

### Trụ Cột 1: Khởi Tạo Nguồn Thực Đơn Tuần (Source Prerequisite Authority)
* **Thực tế nghiệp vụ**: Không thể có Lô đối soát (`ReconciliationBatch`) hay Khách hàng trong danh sách nếu hệ thống chưa có Thực đơn tuần được nhập và phê duyệt (`MenuVersion`).
* **Giải pháp**: Khôi phục có chọn lọc tính năng **"Nhập thực đơn Excel"** và **"Tải file mẫu"** từ FE cũ (`planning/schedule/SchedulePage.tsx`) đưa vào `/weekly-menu` (schedule view), tuân thủ 100% chuẩn 3-Zone và kết nối trực tiếp các endpoint backend đã sẵn sàng:
  - `POST /api/sample-data/weekly-menu/import/preview`
  - `POST /api/sample-data/weekly-menu/import/commit`
  - `GET /api/sample-data/weekly-menu/import/template`

### Trụ Cột 2: Khóa Tuyệt Đối Ranh Giới Bếp Trưởng (Head Chef Pure Read-Only Invariant)
* **Bất biến vai trò**: Bếp trưởng **CHỈ XEM VÀ XUẤT PHIẾU NẤU**, tuyệt đối **KHÔNG XÁC NHẬN, KHÔNG KÝ NHẬN, KHÔNG HOÀN TẤT CA, KHÔNG CAN THIỆP VÀO BẤT KỲ KHÂU MUTATION NÀO CỦA WORKFLOW E2E**.
* **Trách nhiệm vật tư**: Toàn bộ thao tác giao nhận, cân đếm thực tế cửa kho thuộc quyền **Thủ kho**; giải trình và chốt sổ thuộc quyền **Quản lý**. Màn hình `/chef?view=mrx-cooking` chỉ cung cấp: Card per Dish, tải CSV, tải Excel, và in ấn khổ giấy A4 sạch đẹp.

### Trụ Cột 3: Bãi Bỏ Điểm Nghẽn Luồng (Dead Ends) & Bẫy Điều Hướng 403 (RBAC Traps)
* Sửa lỗi Tháp điều khiển: Quản lý bấm Thẻ 1 (Đổi nguồn) mở drawer xem tóm tắt, Thẻ 3 (Bù/trả) chuyển sang tab Lịch sử giao dịch kho, loại bỏ hoàn toàn lỗi 403 Forbidden.
* Sửa lỗi Điều phối chuyển kho: Bấm "Chuyển sang Kho" cập nhật badge `Đã chuyển Kho` tại chỗ, cấm tự động navigate sang Kho làm văng 403.
* Sửa lỗi màn hình xuất kho theo ngày: Bổ sung dropdown chọn Lô và chọn Ngày, xóa bỏ nhánh màn hình rỗng chết khi truy cập từ Sidebar.
* Sửa bug gửi ngày rỗng trong xuất kho phối hợp: Truyền state `activeDate` thay cho prop rỗng.
* Chuẩn hóa từ vựng: Đổi nút "Chốt đối soát ca" thành **"Chốt đối soát tuần"**.

### Trụ Cột 4: Kiểm Thử E2E Mutation Thực Tế Trên Database Cô Lập (Isolated Test DB & Auto-Cleanup)
* **An toàn dữ liệu tuyệt đối (`DOM-MODE-1` & Hard Safety Invariants)**: Không chạy bất kỳ test ghi (mutation) nào trên database chính `ipcmanagement`.
* Thiết lập database test riêng biệt `ipc_mrx_e2e_mutation_sandbox` nhân bản từ cấu trúc sạch.
* Thực thi tự động kịch bản Playwright Chromium thao tác thật (click, type, submit) từ Chặng 1 đến Chặng 8.
* Tự động xóa sạch (`DROP DATABASE`) sau khi test hoàn tất. Chỉ khi toàn bộ luồng E2E mutation chạy mượt mà mới nghiệm thu áp dụng vào môi trường chính.

---

## 2. Quy Trình Xử Lý Ảnh Chuẩn Chuyên Gia FE (Professional Visual Audit Pipeline)

Để đảm bảo ảnh chụp màn hình kiểm chứng không phải là "ảnh chụp cho có", hệ thống thiết lập **Quy trình 5 Bước Xử lý & Đánh giá Ảnh Chuẩn Chuyên gia Frontend**:

```
[1. Chuẩn hóa Khung Chụp] ──> [2. Quét Hình học & OCR] ──> [3. So sánh Pixel Diffing] ──> [4. Thẩm định Công thái học] ──> [5. Đóng gói Artifacts]
    1440x900 HiDPI (2x)          Kiểm tra Header 56px,        SSIM (Structural Similarity)    Tỷ lệ tương phản WCAG 2.2      Lưu ảnh + metadata JSON
    Vô hiệu hóa animation        Subbar 44px, quét UUID       Phát hiện Layout Shift (CLS)    Độ đậm font, phân cấp thị giác  (.artifacts/audit-screenshots)
```

### Bước 1: Chuẩn hóa Khung Chụp (Normalized Capture Envelope)
- Viewport cố định: `width: 1440px, height: 900px, deviceScaleFactor: 2` (chuẩn Retina sắc nét).
- Chế độ chụp Headed Browser: Chạy trình duyệt Chromium có hiển thị cửa sổ thật để GPU render đúng pixel font chữ và bóng đổ hairline.
- Ổn định phông chữ & DOM: Chờ `document.fonts.ready` và dừng toàn bộ hiệu ứng nhấp nháy (`animations: 'disabled'`) trước khi chụp để ảnh không bị mờ do frame chuyển động.

### Bước 2: Quét Hình Học Bố Cục & OCR Dữ Liệu Tự Động (Structural & Data Scan)
- **Rà soát 3-Zone Bounding Box**:
  - Zone 1 (`header.h-14`): Chiều cao phải đạt $56 \pm 1\text{px}$.
  - Zone 2 (`div.h-11`): Chiều cao phải đạt $44 \pm 1\text{px}$.
  - Dòng DataGrid: Chiều cao đạt $36\text{px} - 40\text{px}$ (chuẩn Rule `T8`).
- **OCR Quét Chuỗi Cấm**:
  - Tự động quét vùng text của ảnh: Phát hiện nếu còn sót chuỗi GUID thô (dạng `xxxxxxxx-xxxx-xxxx...`), ngày ISO `yyyy-mm-dd`, hoặc raw enum tiếng Anh (`COMPLETED`, `IN_PROGRESS`, `DRAFT`). Nếu phát sinh $\rightarrow$ Đánh FAIL ngay lập tức.

### Bước 3: So Sánh Điểm Ảnh & Độ Tương Đồng Cấu Trúc (SSIM / Pixel Diffing)
- Sử dụng thuật toán so khớp Structural Similarity Index (SSIM) đối chiếu với khung chuẩn.
- Đánh dấu vùng đỏ (Red Diff Mask) nếu phát hiện chuyển view gây nhảy giật layout (Layout Shift) vượt ngưỡng $\text{CLS} > 0.05$.

### Bước 4: Thẩm Định Công Thái Học & Trải Nghiệm (Cognitive Ergonomics Audit)
- Kiểm tra độ tương phản màu sắc chữ trên nền: Tỷ lệ tương phản tối thiểu $4.5:1$ (chuẩn WCAG 2.2 AA).
- Kiểm tra căn lề số học: 100% cột số lượng và số tiền phải căn phải với font `tabular-nums` và phân cách hàng nghìn.
- Kiểm tra trạng thái rỗng (Empty State): Phải có minh họa thanh lịch, tiêu đề nghiệp vụ rõ ràng và nút hướng dẫn hành động kế tiếp.

### Bước 5: Đóng Gói Hồ Sơ Kiểm Chứng (Standardized Artifact Packaging)
- Lưu ảnh chất lượng cao vào `.artifacts/audit-screenshots/e2e-mutation/`.
- Kèm file sidecar `metadata.json` ghi lại: Mã route, chế độ vận hành, vai trò người dùng, độ phân giải, kết quả kiểm tra hình học và mã commit Git tương ứng.

---

## 3. Đặc Tả Chi Tiết Từng Phân Hệ & Khắc Phục Khiếm Khuyết

### 3.1. Phân Hệ Thực Đơn Tuần (`/weekly-menu`)
1. **Khôi phục "Nhập thực đơn Excel" trên Schedule View (`/weekly-menu`)**:
   - Vị trí: Đặt tại Zone 1 Action bar cạnh nút "Làm mới".
   - Component: `<WeeklyMenuImportModal>`
     - Form: Chọn Khách hàng (dropdown), Chọn Tuần bắt đầu (`<VietnameseDateInput>`), Chọn file `.xlsx`.
     - Nút "Tải file mẫu Excel": Kích hoạt tải về file mẫu chuẩn từ backend `GET /api/sample-data/weekly-menu/import/template`.
     - Nút "Xem trước phân tích": Gọi `previewWeeklyMenuImportAsync`, hiển thị layout món theo ca, kiểm tra lỗi BOM.
     - Nút "Xác nhận lưu thực đơn": Gọi `commitWeeklyMenuImportAsync`, đóng modal, tự động nạp lại ma trận thực đơn tuần.
2. **Khôi phục State và Khắc phục Bẫy 403 trên `/weekly-menu?view=mrx-batch`**:
   - Trong `loadSource`: Tự động gọi `mrxApi.getBatchPage({ customerId, weekStartDate, pageSize: 1 })`. Nếu đã có lô, nạp ngay vào state `batch` $\rightarrow$ Khôi phục nút bấm "Đóng băng lô" hoặc "Chuyển sang Kho" tương ứng với trạng thái lô hiện có.
   - Khi bấm "Chuyển sang Kho" (`transferToWarehouse`): Loại bỏ lệnh `navigate('/warehouse...')`. Cập nhật badge tại chỗ thành `Đã chuyển Kho` (`TRANSFERRED`), hiển thị banner xanh lá: *"Đã bàn giao lô đối soát sang Kho nguyên liệu thành công"*, giữ nguyên Điều phối viên ở màn hình hiện tại.

### 3.2. Phân Hệ Kho Nguyên Liệu (`/warehouse`)
1. **Khắc phục Màn hình Xuất kho theo ngày (`/warehouse?view=mrx-daily`)**:
   - Bổ sung thanh chọn ngữ cảnh trên Header: Dropdown chọn Lô đang mở (`TRANSFERRED` / `IN_PROGRESS`) và Dropdown chọn Ngày/Ca phục vụ trong tuần.
   - Chuyển đổi bảng xuất kho thẻ `<table>` trần sang `<DataGrid>` chuẩn mực, các ô nhập số lượng thực tế có format số học rõ ràng.
   - Sửa nút "Chuẩn bị phối hợp": Điều hướng chính xác sang `/warehouse?view=mrx-preparation&date=...`.
2. **Khắc phục Xuất kho phối hợp (`/warehouse?view=mrx-preparation`)**:
   - Trong `submitCoordinatedIssue`: Đổi biến truyền vào thành `serviceDate: activeDate` (lấy ngày đang chọn trên màn hình).
   - Chuyển đổi bảng tổng hợp phân bổ nguyên liệu sang `<DataGrid>`.
   - Cập nhật nút "Xác nhận xuất phối hợp": Disable và chuyển màu xám mờ rõ ràng khi có 0 lô được chọn.

### 3.3. Phân Hệ Bếp Trưởng (`/chef?view=mrx-cooking`)
1. **Khóa Bất Biến Chỉ-Xem (Pure Read-Only)**:
   - Tuyệt đối không bổ sung bất kỳ nút mutation nào. Bếp trưởng chỉ xem thông tin để chế biến.
2. **Bổ sung Nút In Phiếu Nấu Khổ A4**:
   - Vị trí: Đặt cạnh nút "Tải Excel".
   - Tương tác: Kích hoạt `window.print()` với CSS `@media print` tối ưu hóa: Ẩn sidebar, ẩn header hệ thống, căn chỉnh Card món ăn vừa vặn trên trang A4.
3. **Ưu tiên Chọn Lô Đang Vận Hành**:
   - Tự động chọn lô có trạng thái `IN_PROGRESS` gần nhất thay vì chọn ngẫu nhiên lô đầu tiên trong mảng.

### 3.4. Phân Hệ Đối Soát Nguyên Liệu (`/reconciliation`)
1. **Khắc phục Bẫy 403 trên Tháp Điều Khiển**:
   - Bấm Thẻ 1 (Đổi nguồn chờ duyệt): Nếu là Quản lý, mở Modal/Drawer tóm tắt danh sách yêu cầu đổi nguồn (chế độ chỉ-xem) thay vì đẩy sang trang của Điều phối.
   - Bấm Thẻ 3 (Hàng đợi bù/trả): Chuyển hướng sang `/reconciliation?view=transactions` (Lịch sử giao dịch kho) để theo dõi.
2. **Chuẩn hóa Tên Nút Chốt Sổ**:
   - Đổi nhãn nút từ "Chốt đối soát ca" thành **"Chốt đối soát tuần"**.
   - Modal xác nhận: Bổ sung bảng tóm tắt số liệu tuần (Tổng số món, Tổng lượng xuất, Tổng chênh lệch, Xác nhận 100% dòng đã được giải trình).
3. **Danh Bạ Hoàn Tất (`view=completed`)**:
   - Backend `ReconciliationReportsService.cs`: Thực hiện join với bảng `Users` để trả về `FullName` của người chốt thay vì chuỗi GUID thô.

### 3.5. Phân Hệ Báo Cáo Vận Hành (`/reports`)
1. **Mở Quyền 3 Lá Con Trong Chế Độ MRX**:
   - Cập nhật `routeRegistry.ts`: Thêm `MATERIAL_RECONCILIATION` vào cả 3 lá con: `reports.demand`, `reports.prices`, `reports.stock`.
   - Đảm bảo menu "Báo cáo vận hành" luôn hiển thị đầy đủ trên Sidebar v2 khi ở chế độ MRX.

---

## 4. Thiết Kế Kịch Bản Kiểm Thử E2E Mutation Cô Lập (Playwright Spec Contract)

### 4.1. Quy Trình Database Sandbox
1. **Trước khi chạy test (`beforeAll`)**:
   - Thực thi script PowerShell / SQL: Nhân bản database sạch:
     `CREATE DATABASE ipc_mrx_e2e_sandbox;`
     `mysqldump -u root -p123456789 ipc_e2e_template | mysql -u root -p123456789 ipc_mrx_e2e_sandbox;`
   - Khởi động instance backend tạm thời hoặc trỏ test context vào database sandbox.
2. **Chạy kịch bản Playwright Headed E2E**:
   - Trình duyệt Chromium mở cửa sổ thật (`headless: false`).
   - Tác viên `dieuphoi` đăng nhập $\rightarrow$ Nhập thực đơn Excel $\rightarrow$ Lập lô MRX $\rightarrow$ Đóng băng $\rightarrow$ Chuyển kho.
   - Tác viên `thukho` đăng nhập $\rightarrow$ Xuất kho phối hợp $\rightarrow$ Xử lý chênh lệch cửa kho (nhập số cân thực tế + chọn chip lý do).
   - Tác viên `beptruong` đăng nhập $\rightarrow$ Kiểm tra phiếu nấu Card per Dish $\rightarrow$ Xuất Excel.
   - Tác viên `quanly` đăng nhập $\rightarrow$ Xem Tháp điều khiển $\rightarrow$ Lọc dòng chênh lệch $\rightarrow$ Lập biên bản giải trình với chip lý do $\rightarrow$ Chốt sổ đối soát tuần.
   - Xác nhận lô xuất hiện trong Danh bạ hoàn tất.
3. **Dọn dẹp sạch sẽ sau test (`afterAll`)**:
   - Thực thi lệnh: `DROP DATABASE IF EXISTS ipc_mrx_e2e_sandbox;`
   - Xác minh database chính `ipcmanagement` hoàn toàn nguyên vẹn, zero bản ghi rác.
