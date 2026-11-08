# Kế Hoạch Thực Thi: Chuẩn Hóa Toàn Diện 15 Bề Mặt MRX, Khôi Phục Nhập Thực Đơn & Kiểm Thử E2E Mutation Cô Lập
*(MRX Full-Matrix Conformance, Weekly Menu Import Restoration & Isolated E2E Mutation Implementation Plan)*

- **Mã kế hoạch**: `PLAN-MRX-2026-10-23-FULL-E2E`
- **Phiên bản**: `3.0.0 (Master Execution Plan)`
- **Đặc tả kiến trúc tham chiếu**: `docs/superpowers/specs/2026-10-23-mrx-full-e2e-mutation-conformance-design.md`
- **Phương pháp**: TDD + Khóa Chặt Nguyên Tắc Từng Wave + Headed E2E Mutation Test + Quy trình Xử lý Ảnh Chuẩn Chuyên gia FE.

---

## 1. Hệ Thống Rào Chắn Khóa Nguyên Tắc Cốt Lõi (Overarching Invariants)

Mọi dòng code, thao tác kiểm thử và tài liệu trong kế hoạch này phải vượt qua 5 rào chắn bất biến:
1. **Khóa An Toàn Cơ Sở Dữ Liệu (`DOM-MODE-1`)**: Tuyệt đối không chạy bất kỳ test ghi (mutation) nào trực tiếp trên database chính `ipcmanagement`. Mọi thao tác kiểm thử mutation E2E phải diễn ra trên database sandbox cô lập `ipc_mrx_e2e_sandbox` và được dọn dẹp (DROP) sạch sẽ 100% sau khi hoàn thành.
2. **Khóa Ranh Giới Bếp Trưởng (Pure Read-Only)**: Màn hình Bếp trưởng `/chef?view=mrx-cooking` tuyệt đối không có bất kỳ nút mutation hay xác nhận nào. Bếp trưởng chỉ xem và xuất phiếu nấu.
3. **Khóa Nguồn Thực Đơn Tuần (Source Prerequisite)**: Phải có tính năng "Nhập thực đơn Excel" trên `/weekly-menu` thì Điều phối viên mới có dữ liệu thực đơn để lập lô MRX.
4. **Khóa Chống AI Slop (`SLOP-1` đến `SLOP-5`)**: Cấm mã mồ côi, cấm stub bù nhìn, cấm test tự biên tự diễn (không mock component dưới test), cấm fallback dữ liệu ảo trong API clients, và không tin tưởng output CLI của test runner nếu chưa kiểm chứng trực quan bằng mắt.
5. **Khóa Quy Trình Xử Lý Ảnh Chuẩn Chuyên Gia FE**: Ảnh chụp kiểm chứng phải chạy trên Chromium Headed (1440x900 HiDPI 2x), kiểm tra 3-Zone Bounding Box, OCR quét sạch UUID/ngày ISO/raw enum, và phân tích công thái học WCAG 2.2 AA.

---

## 2. Các Làn Thực Thi Chi Tiết (Execution Waves with Locked Invariants)

```
[WAVE 1: Khôi phục Nhập Thực Đơn Tuần] ──> [WAVE 2: Sửa Dead End & Bug Kho MRX]
                   │                                        │
                   ▼                                        ▼
[WAVE 3: Tháp Điều Khiển & Nhãn Chốt Tuần] ─> [WAVE 4: Khóa Bếp Trưởng & In A4]
                   │                                        │
                   ▼                                        ▼
[WAVE 5: E2E Mutation Test Trên Sandbox] ───> [WAVE 6: Xử Lý Ảnh Chuẩn Chuyên Gia]
```

---

### WAVE 1: Khôi Phục Tính Năng "Nhập Thực Đơn Tuần" & Tải Mẫu Excel
*Mục tiêu: Đảm bảo có thực đơn tuần được nhập vào hệ thống thì mới có khách hàng và số liệu để lập lô MRX.*

#### 🔒 Khóa Nguyên Tắc Wave 1
- **Khóa Nguồn Thực Đơn**: Kế thừa có chọn lọc tính năng `Upload` thực đơn từ FE cũ (`SchedulePage.tsx`). Phải kết nối đúng các endpoint backend thật: `weekly-menu/import/preview`, `weekly-menu/import/commit`, và `weekly-menu/import/template`.
- **Khóa 3-Zone & Impeccable Kit**: Form modal nhập thực đơn phải dùng `<Modal>` có focus trap chuẩn WCAG 2.2 AA, các nút bấm dùng `<Button>`, không dùng thẻ HTML tự chế ngoài Design Kit.
- **Khóa State F5**: Trên `/weekly-menu?view=mrx-batch`, khi F5 phải tự động gọi `getBatchPage` để khôi phục lô hiện có, không được xóa trắng `batch` về `null`.

#### 📋 Danh Sách Task Thực Thi Wave 1
- [ ] **Task 1.1**: Tạo component `<WeeklyMenuImportModal.tsx>` tại `frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx`:
  - Form gồm: Chọn khách hàng, chọn tuần bắt đầu (`<VietnameseDateInput>`), input chọn file Excel (`.xlsx`).
  - Nút "Tải file mẫu Excel" tải file mẫu từ `GET /api/sample-data/weekly-menu/import/template`.
  - Nút "Xem trước phân tích" gọi `previewWeeklyMenuImport` và hiển thị tóm tắt cơ cấu món ăn theo ca.
  - Nút "Xác nhận lưu thực đơn" gọi `commitWeeklyMenuImport` và kích hoạt callback làm mới dữ liệu.
- [ ] **Task 1.2**: Tích hợp nút "Nhập thực đơn Excel" vào WorkspaceHeader của `WeeklyMenuPage.tsx` (view schedule) và `MrxBatchWorkbench.tsx`.
- [ ] **Task 1.3**: Sửa lỗi mất state khi F5 trong `MrxBatchWorkbench.tsx`:
  - Trong `loadSource`, thêm lệnh gọi `mrxApi.getBatchPage({ customerId, weekStartDate, pageSize: 1 })`. Nếu tìm thấy lô, set vào state `batch` để khôi phục đúng trạng thái lô hiện có (`DRAFT`, `READY`, `TRANSFERRED`).
- [ ] **Task 1.4**: Sửa bẫy 403 khi Điều phối viên chuyển kho trong `MrxBatchWorkbench.tsx`:
  - Sau khi `transferToWarehouse` thành công, loại bỏ lệnh `navigate('/warehouse...')`. Cập nhật badge thành `Đã chuyển Kho`, hiển thị thông báo thành công màu xanh lá.
- [ ] **Task 1.5**: Viết unit test trong `WeeklyMenu.test.tsx` xác minh việc mở modal nhập thực đơn, tải mẫu, và khôi phục state lô khi F5.

#### 🚪 Cổng Thoát Bắt Buộc Wave 1 (Exit Gate)
1. `npm test -- WeeklyMenu.test.tsx` PASS 100%.
2. Trên màn hình thực đơn tuần có nút "Nhập thực đơn Excel" mở modal tải file mượt mà.
3. Điều phối viên bấm chuyển kho không bị văng 403, F5 trang không bị mất trạng thái lô.

---

### WAVE 2: Khắc Phục Màn Hình Chết & Sửa Bug Xuất Kho MRX
*Mục tiêu: Đảm bảo Thủ kho có thể chủ động tác nghiệp từ menu Sidebar và xuất kho phối hợp không bị lỗi ngày rỗng.*

#### 🔒 Khóa Nguyên Tắc Wave 2
- **Khóa Tránh Điểm Nghẽn Luồng (No Dead Ends)**: Mở menu lá `/warehouse?view=mrx-daily` từ Sidebar bắt buộc phải có dropdown chọn Lô và chọn Ngày để Thủ kho bắt đầu ca làm việc, cấm render nhánh rỗng chết báo thiếu ID.
- **Khóa Tính Toàn Vẹn Tham Số**: Hàm `submitCoordinatedIssue` bắt buộc truyền `activeDate` thay vì prop rỗng `serviceDate`.
- **Khóa Chuẩn Hóa DataGrid**: Chuyển toàn bộ các thẻ HTML `<table>` trần trong `MrxDailyIssueWorkbench.tsx` và `MrxMultiCustomerPreparationWorkbench.tsx` sang `<DataGrid>`.

#### 📋 Danh Sách Task Thực Thi Wave 2
- [ ] **Task 2.1**: Tái cấu trúc `MrxDailyIssueWorkbench.tsx`:
  - Bổ sung thanh WorkspaceHeader có Dropdown chọn Lô đang mở (`TRANSFERRED` / `IN_PROGRESS`) và Dropdown chọn Ngày ca trong tuần.
  - Sửa nút "Chuẩn bị phối hợp" điều hướng chính xác sang `/warehouse?view=mrx-preparation&date=...`.
  - Thay thế thẻ `<table>` trần bằng `<DataGrid>` với cột số lượng dùng `<Num tabular-nums>` và ô nhập số thực xuất có viền cảnh báo rõ ràng.
- [ ] **Task 2.2**: Cập nhật `WarehousePage.tsx`:
  - Khi `view === 'mrx-daily'`, nếu thiếu `batchId` hoặc `date`, không render màn hình rỗng chết mà hiển thị `MrxDailyIssueWorkbench` ở chế độ chọn lô ban đầu.
- [ ] **Task 2.3**: Sửa bug xuất kho phối hợp trong `MrxMultiCustomerPreparationWorkbench.tsx`:
  - Sửa `submitCoordinatedIssue` sử dụng `activeDate` thay cho `serviceDate`.
  - Chuyển đổi bảng tổng hợp phân bổ nguyên liệu sang `<DataGrid>`.
  - Đảm bảo nút "Xác nhận xuất phối hợp" hiển thị màu xám mờ disabled khi có 0 lô được chọn.
- [ ] **Task 2.4**: Viết unit test trong `Warehouse.test.tsx` xác minh việc chọn lô/ngày trên header và submit xuất kho phối hợp với đúng `activeDate`.

#### 🚪 Cổng Thoát Bắt Buộc Wave 2 (Exit Gate)
1. `npm test -- Warehouse.test.tsx` PASS 100%.
2. Nhấp menu lá "Định lượng xuất theo ngày" trên Sidebar không còn bị văng lỗi rỗng.
3. Xuất kho phối hợp gửi đúng ngày, nhận mã `preparationGroupId` thành công từ backend.

---

### WAVE 3: Chuẩn Hóa Tháp Điều Khiển, Báo Cáo MRX & Đổi Nhãn Chốt Tuần
*Mục tiêu: Loại bỏ hoàn toàn lỗi 403 trên Tháp điều khiển của Quản lý, mở menu Báo cáo ở MRX, và chuẩn hóa nhãn chốt sổ tuần.*

#### 🔒 Khóa Nguyên Tắc Wave 3
- **Khóa An Toàn Phân Quyền (RBAC Safety)**: Quản lý không có quyền kho hay quyền nguồn thì không được đẩy sang trang kho hay trang nguồn. Bấm Thẻ 1 mở drawer tóm tắt; Thẻ 3 chuyển sang tab Lịch sử giao dịch kho.
- **Khóa Chuẩn Xác Thuật Ngữ Nghiệp Vụ**: Đổi nút "Chốt đối soát ca" thành **"Chốt đối soát tuần"**, vì thao tác này khóa vĩnh viễn toàn bộ lô tuần của khách hàng.
- **Khóa Mở Menu Báo Cáo MRX**: 3 lá con của `/reports` phải mở cho `MATERIAL_RECONCILIATION`.
- **Khóa Ẩn UUID Thô**: Backend `ReconciliationReportsService.cs` join bảng `Users` để hiển thị `FullName` người chốt trong danh bạ hoàn tất.

#### 📋 Danh Sách Task Thực Thi Wave 3
- [ ] **Task 3.1**: Sửa `ReconciliationQueueCards.tsx`:
  - Thẻ 1 (Đổi nguồn chờ duyệt): Nếu là Quản lý, mở modal tóm tắt danh sách yêu cầu đổi nguồn chỉ-xem.
  - Thẻ 3 (Hàng đợi bù/trả): Điều hướng sang `/reconciliation?view=transactions` để xem chứng từ giao dịch kho.
- [ ] **Task 3.2**: Sửa `ReconciliationPage.tsx`:
  - Đổi nhãn nút từ "Chốt đối soát ca" thành "Chốt đối soát tuần".
  - Bổ sung bảng tóm tắt số liệu tuần trong Modal xác nhận hoàn tất trước khi chốt.
- [ ] **Task 3.3**: Cập nhật `routeRegistry.ts`:
  - Thêm `MATERIAL_RECONCILIATION` vào 3 lá con: `reports.demand`, `reports.prices`, `reports.stock`.
- [ ] **Task 3.4**: Cập nhật Backend `ReconciliationReportsService.cs`:
  - Join bảng `Users` theo `CompletedBy` để trả về họ tên thật của người dùng thay vì GUID.
- [ ] **Task 3.5**: Viết unit test trong `Reconciliation.test.tsx` và `Reports.test.tsx` xác minh Tháp điều khiển không gây 403 và menu Báo cáo hiển thị đầy đủ trong chế độ MRX.

#### 🚪 Cổng Thoát Bắt Buộc Wave 3 (Exit Gate)
1. `npm test -- Reconciliation.test.tsx` và `Reports.test.tsx` PASS 100%.
2. Quản lý bấm cả 5 thẻ trên Tháp điều khiển không bao giờ bị văng 403 Forbidden.
3. Menu Báo cáo vận hành xuất hiện đầy đủ 3 mục con trên Sidebar ở chế độ MRX.
4. Danh bạ hoàn tất hiển thị tên người chốt rõ ràng, không còn UUID thô.

---

### WAVE 4: Khóa Ranh Giới Bếp Trưởng (Pure Read-Only) & Xuất In A4
*Mục tiêu: Đảm bảo Bếp trưởng chỉ xem và xuất phiếu nấu, không can thiệp vào luồng vật tư E2E, có nút in ấn A4.*

#### 🔒 Khóa Nguyên Tắc Wave 4
- **Khóa Ranh Giới Bếp Trưởng (Zero Mutation)**: Tuyệt đối không thêm bất kỳ nút ký nhận, xác nhận hay hoàn tất ca nào trên trạm Bếp trưởng.
- **Khóa Công Thái Học & In Ấn**: Bổ sung nút "In phiếu nấu" hỗ trợ CSS `@media print` căn chỉnh vừa vặn trên khổ giấy A4, tự động ẩn sidebar và header.
- **Khóa Ưu Tiên Lô Đang Nấu**: Tự động chọn lô có trạng thái `IN_PROGRESS` gần nhất.

#### 📋 Danh Sách Task Thực Thi Wave 4
- [ ] **Task 4.1**: Cập nhật `MrxCookingWorkbench.tsx`:
  - Bổ sung nút "In phiếu nấu" cạnh nút "Tải Excel", gọi `window.print()`.
  - Thêm CSS `@media print` vào `index.css` để tối ưu hóa trang in A4 cho phiếu nấu ăn theo món.
  - Sửa logic chọn lô mặc định: Lọc ưu tiên lô có `status === 'IN_PROGRESS'` trước khi fallback về lô đầu tiên.
- [ ] **Task 4.2**: Viết unit test trong `Chef.test.tsx` xác minh việc kích hoạt in ấn và ưu tiên chọn lô đang nấu.

#### 🚪 Cổng Thoát Bắt Buộc Wave 4 (Exit Gate)
1. `npm test -- Chef.test.tsx` PASS 100%.
2. Màn hình Bếp trưởng hiển thị đúng lô đang diễn ra trong tuần, có nút in A4 sạch đẹp, zero nút mutation.

---

### WAVE 5: Thiết Lập Database Sandbox & Viết Bộ E2E Mutation Test
*Mục tiêu: Xây dựng bộ test Playwright E2E chạy thực tế chuỗi mutation từ Chặng 1 đến Chặng 8 trên database cô lập, tự động dọn dẹp sạch sẽ.*

#### 🔒 Khóa Nguyên Tắc Wave 5
- **Khóa Cô Lập Database Tuyệt Đối**: Toàn bộ thao tác ghi dữ liệu của kịch bản E2E phải chạy trên database `ipc_mrx_e2e_sandbox`, không đụng vào `ipcmanagement`.
- **Khóa Tự Động Cleanup (Auto-Teardown)**: Hook `afterAll` bắt buộc xóa bỏ database sandbox, kiểm tra tính toàn vẹn của database chính.
- **Khóa Trình Duyệt Thật (Zero-Trust)**: Kiểm thử trên Chromium thật với các tài khoản thật (`dieuphoi`, `thukho`, `beptruong`, `quanly`, `admin`).

#### 📋 Danh Sách Task Thực Thi Wave 5
- [ ] **Task 5.1**: Tạo script khởi tạo và dọn dẹp database sandbox `scripts/manage-e2e-sandbox-db.ps1`:
  - Hàm `New-E2ESandboxDatabase`: Tạo database `ipc_mrx_e2e_sandbox` nhân bản từ template sạch.
  - Hàm `Remove-E2ESandboxDatabase`: Thực hiện `DROP DATABASE IF EXISTS ipc_mrx_e2e_sandbox`.
- [ ] **Task 5.2**: Viết kịch bản Playwright E2E Mutation `frontend/tests/browser/mrx-e2e-mutation-lifecycle.spec.ts`:
  - Test đầy đủ chuỗi 8 chặng: Nhập thực đơn Excel $\rightarrow$ Lập lô MRX $\rightarrow$ Đóng băng $\rightarrow$ Chuyển kho $\rightarrow$ Xuất kho phối hợp $\rightarrow$ Bếp trưởng xem phiếu nấu $\rightarrow$ Sửa suất ca $\rightarrow$ Cân thực tế cửa kho $\rightarrow$ Lập biên bản giải trình chênh lệch $\rightarrow$ Chốt sổ tuần $\rightarrow$ Xác nhận lô xuất hiện trong danh bạ hoàn tất.
  - Hook `test.afterAll`: Tự động gọi dọn dẹp database sandbox.
- [ ] **Task 5.3**: Chạy thử nghiệm kịch bản E2E Mutation và xác nhận dọn dẹp dữ liệu thành công.

#### 🚪 Cổng Thoát Bắt Buộc Wave 5 (Exit Gate)
1. Bộ test E2E Mutation chạy hoàn tất từ đầu đến cuối không có lỗi.
2. Database test sandbox được dọn dẹp sạch sẽ 100%, database chính `ipcmanagement` nguyên vẹn.

---

### WAVE 6: Chụp Ảnh Headed & Quy Trình Xử Lý Ảnh Chuẩn Chuyên Gia FE
*Mục tiêu: Chạy E2E Headed, chụp ảnh màn hình kiểm chứng trực quan và đánh giá theo quy trình 5 bước của Chuyên gia FE.*

#### 🔒 Khóa Nguyên Tắc Wave 6
- **Khóa Chuẩn Khung Chụp**: Viewport 1440x900 HiDPI 2x, chế độ Headed Browser, ổn định font chữ trước khi chụp.
- **Khóa Kiểm Tra Hình Học & OCR**: Header 56px, Subbar 44px, dòng 36-40px; quét sạch 100% UUID thô, ngày ISO và raw enum.
- **Khóa Thẩm Định Công Thái Học**: Tỷ lệ tương phản WCAG 2.2 AA $\ge 4.5:1$, căn phải `tabular-nums`.

#### 📋 Danh Sách Task Thực Thi Wave 6
- [ ] **Task 6.1**: Viết kịch bản chụp ảnh Headed chuyên nghiệp `scripts/capture-mrx-headed-audit.mjs`:
  - Khởi động Chromium với `headless: false`, viewport `1440x900`, `deviceScaleFactor: 2`.
  - Tự động đi qua toàn bộ 15 bề mặt và các modal tác nghiệp.
  - Chụp ảnh chất lượng cao lưu vào `.artifacts/audit-screenshots/e2e-headed/`.
- [ ] **Task 6.2**: Viết script phân tích ảnh tự động `scripts/analyze-audit-screenshots.mjs`:
  - Quét bounding box của Header và Subbar.
  - Quét DOM/OCR tìm kiếm chuỗi cấm (UUID thô, ngày ISO `yyyy-mm-dd`, enum `COMPLETED`, `IN_PROGRESS`).
  - Xuất báo cáo đánh giá kỹ thuật `VISUAL-AUDIT-REPORT.md`.
- [ ] **Task 6.3**: Chạy `npm run verify` toàn diện: Xác nhận 1,406 Backend tests, toàn bộ Frontend unit tests, lint clean, depcruise clean, strict architecture gate clean.
- [ ] **Task 6.4**: Cập nhật `.planning/WORK.md` và đưa trạng thái về `IDLE`.

#### 🚪 Cổng Thoát Cuối Cùng Wave 6 (Final Milestone Exit Gate)
1. `npm run verify` PASS 100%.
2. Kịch bản E2E Mutation Test trên Sandbox PASS 100% và đã dọn dẹp sạch sẽ.
3. Bộ ảnh chụp Headed được phân tích đạt chuẩn 100% theo quy trình Chuyên gia FE (zero UUID, zero ngày ISO, 3-Zone chuẩn 56px/44px, CLS $\le$ 0.05).
4. Báo cáo đánh giá hình ảnh được xuất bản đầy đủ.

---

### Kính Mời Bạn Đọc & Phê Duyệt

Tôi đã hoàn tất việc soạn thảo:
1. **Design Specification v3.0.0**: `docs/superpowers/specs/2026-10-23-mrx-full-e2e-mutation-conformance-design.md`
2. **Implementation Plan v3.0.0**: `docs/superpowers/plans/2026-10-23-mrx-full-e2e-mutation-conformance-plan.md`

Tôi đang **tạm dừng hoàn toàn** để bạn đọc, xem xét và phê duyệt bản thiết kế và kế hoạch chi tiết này trước khi bước vào thực thi!
