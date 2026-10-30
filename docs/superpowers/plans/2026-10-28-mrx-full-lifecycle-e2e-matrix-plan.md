# MRX Full Lifecycle E2E Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng và thực thi bộ kiểm thử E2E ma trận toàn diện cho vòng đời phân hệ Đối soát MRX, bao phủ 4 vai trò liên hoàn (Điều phối viên → Thủ kho → Bếp trưởng → Kế toán/Quản lý), 100% trang MRX, 10/10 modal, toàn bộ nút bấm/thanh công cụ và các kịch bản nghiệp vụ (sửa thực đơn, sửa số suất, chẩn đoán & cấu hình BOM thiếu, chặn xác thực, xuất bổ sung, giải trình 2 chiều, khóa sổ tuần, xuất CSV) trên Sandbox Database độc lập.

**Architecture:** Mở rộng script kiểm thử E2E tự động `scripts/run-mrx-full-path-lifecycle-test.mjs` để điều phối Playwright Chromium chạy qua môi trường Sandbox: nhân bản CSDL MySQL `ipc_mrx_e2e_sandbox`, chạy Backend Kestrel .NET 9 trên cổng 5263 và Frontend Vite trên cổng 5174. Toàn bộ các tương tác trên giao diện (click button, mở/đóng modal, submit form) đều là tương tác thực tế của người dùng qua Playwright DOM locator, không sử dụng mock API hay synthetic data.

**Tech Stack:** Playwright Chromium, Node.js ES Modules, .NET 9 Kestrel Web API, MySQL Server 9.5 (mysqldump & mysql CLI), React 18, Vite.

**Spec:** `docs/superpowers/specs/2026-10-28-mrx-visual-integrity-and-human-language-adapter-spec.md` và biên bản tiếp nhận `docs/handoff/HANDOFF.md`.

## Global Constraints
- `DOM-MODE-1`: Chế độ vận hành `MATERIAL_RECONCILIATION` được bảo toàn nghiêm ngặt; không gọi sang các trang của `DEFAULT`.
- `TA-1 to TA-5`: Tuyệt đối không mock API hoặc fake data trong source code để ép test pass. Chạy trên CSDL Sandbox thật và API thật.
- `No Destructive Operations`: CSDL chính `ipcmanagement` được giữ nguyên 100%; mọi thao tác ghi xóa đều diễn ra trên `ipc_mrx_e2e_sandbox`.
- Dữ liệu tuần thử nghiệm: Tuần bắt đầu `2026-07-20`, khách hàng `AMANN`, mức giá `25.000 ₫`.

## Review Focus
1. Sửa số suất ăn và đổi món trong `WeeklyScheduleEditorModal` phải phản ánh ngay sang KHSX và bảng phân rã định mức trước khi tạo lô.
2. Món thiếu BOM phải bị chặn khi kiểm tra định lượng; sau khi thêm BOM qua endpoint `/api/Dishes/{id}/bom`, việc kiểm tra định lượng phải đạt chuẩn 0 lỗi.
3. Xuất vượt kế hoạch khi không có lý do phải bị chặn (nút `Xác nhận xuất kho` disabled); sau khi nhập lý do, nút phải mở khóa ngay lập tức.
4. Xuất bổ sung trong ca qua `MrxSupplementalIssueModal` phải tạo đúng phiếu `SUPPLEMENTAL_ISSUE` với lý do từ chip preset.
5. Giải trình chênh lệch 2 chiều qua `ReconciliationDispositionModal` phải cho phép khóa sổ tuần với `ReconciliationCompletionModal`.

---

### Task 1: Thiết lập hạ tầng Sandbox Database & Services Runner

**Files:**
- Modify: `scripts/run-mrx-full-path-lifecycle-test.mjs`

**Interfaces:**
- Consumes: MySQL Server local, Backend `IPCManagement.Api`, Frontend Vite
- Produces: Live Kestrel process trên port 5263 kết nối `ipc_mrx_e2e_sandbox`, Vite process trên port 5174

- [ ] **Step 1: Định nghĩa cấu hình cổng và đường dẫn DB Sandbox**
  Đảm bảo script quản lý việc tạo dump từ `ipcmanagement`, tạo DB `ipc_mrx_e2e_sandbox`, dọn dẹp tuần `2026-07-20`.
- [ ] **Step 2: Viết hàm quản lý vòng đời tiến trình Kestrel & Vite**
  Khởi động Backend và Frontend, chờ tín hiệu HTTP 200 trước khi mở Chromium.
- [ ] **Step 3: Định nghĩa hàm dọn dẹp (Teardown) an toàn**
  Đảm bảo khi test kết thúc hoặc gặp lỗi, các tiến trình port 5174/5263 được đóng và database sandbox được xóa sạch.

---

### Task 2: Giai đoạn 1 — Điều phối viên (`dieuphoi`): Sửa thực đơn, Sửa số suất, Chỉnh BOM & Bàn giao

**Files:**
- Modify: `scripts/run-mrx-full-path-lifecycle-test.mjs`

**Interfaces:**
- Consumes: `WeeklyMenuImportModal`, `WeeklyScheduleEditorModal`, `MrxBatchDishesModal`, `MrxSourceChangeModal`, `/api/Dishes/{id}/bom`
- Produces: Lô đối soát mới ở trạng thái `READY_FOR_WAREHOUSE`, bàn giao sang Kho

- [ ] **Step 1: Đăng nhập vai trò `dieuphoi` và thiết lập chế độ MRX**
- [ ] **Step 2: Mở `WeeklyMenuImportModal` và nhập file Excel mẫu 25k**
  Click nút `Nhập thực đơn Excel`, điền khách hàng `AMANN`, tuần `20/07/2026`, đính kèm file template, click `Xem trước`, click `Xác nhận nhập`.
- [ ] **Step 3: Mở `WeeklyScheduleEditorModal` — Tab 1: Cập nhật số suất ca**
  Click nút `Chỉnh sửa lịch tuần`, chọn Tab `1. Cập nhật số suất ca`, tăng số suất Ca 1 Thứ Hai lên `+50` suất, click `Lưu & chốt số suất`.
- [ ] **Step 4: Mở `WeeklyScheduleEditorModal` — Tab 2: Đổi món ăn**
  Click nút `Chỉnh sửa lịch tuần`, chọn Tab `2. Đổi món ăn`, chọn Thứ Ba Ca Sáng, chọn món mới từ dropdown catalog, click `Cập nhật món`.
- [ ] **Step 5: Xuất bản thực đơn tuần**
  Click nút `Xuất bản thực đơn` trên Header, đợi banner thành công.
- [ ] **Step 6: Kiểm tra định lượng & Xử lý BOM thiếu / Chỉnh BOM**
  Điều hướng sang `/weekly-menu?view=mrx-batch`. Click `Kiểm tra định lượng`. Nếu chẩn đoán báo thiếu BOM, gọi API `POST /api/Dishes/{id}/bom` bổ sung BOM, sau đó kiểm tra lại định lượng đạt 0 lỗi chẩn đoán.
- [ ] **Step 7: Kiểm tra 2-Tab Phân rã nguyên liệu & Kế hoạch**
  Click chuyển đổi giữa 2 Tab `Phân rã nguyên liệu định lượng` và `Kế hoạch món & suất theo ca`, kiểm tra tổng suất ăn tuần.
- [ ] **Step 8: Mở `MrxBatchDishesModal` (Món ăn trong lô)**
  Click nút `Món ăn trong lô` trên Header, thử tìm kiếm tên món, click lọc theo `Ca 1 (Sáng)`, `Ca 2 (Chiều)`, `Tất cả`, xem bảng nguyên liệu cấu thành, click `Đóng`.
- [ ] **Step 9: Mở `MrxSourceChangeModal` (Điều chỉnh nguồn)**
  Click nút `Điều chỉnh nguồn`, chọn dòng nguồn, nhập số suất mới, nhập lý do, click `Xem ảnh hưởng`, xác nhận áp dụng thay đổi nguồn.
- [ ] **Step 10: Tạo lô nháp, Đóng băng lô & Chuyển sang Kho**
  Click `Tạo lô nháp` $\rightarrow$ Click `Đóng băng lô` $\rightarrow$ Click `Chuyển sang Kho`. Xác nhận nút CTA Header `Đi đến Trạm Kho nguyên liệu →` xuất hiện.

---

### Task 3: Giai đoạn 2 — Thủ kho (`thukho`): Xuất kho 6 ngày, Chặn xác thực, Xuất bù & Tra cứu phiếu

**Files:**
- Modify: `scripts/run-mrx-full-path-lifecycle-test.mjs`

**Interfaces:**
- Consumes: `/warehouse?view=mrx-daily`, `MrxSupplementalIssueModal`, `ReconciliationIssueDetailModal`
- Produces: 6 ngày trong tuần đều có phiếu xuất kho, phiếu xuất bổ sung, và bản ghi trong tab Lịch sử phiếu

- [ ] **Step 1: Đăng nhập vai trò `thukho` và điều hướng đến lô vừa tạo**
- [ ] **Step 2: Kiểm tra chế độ xem Cả tuần (Tổng hợp)**
  Click nút `Cả tuần (Tổng hợp)`, kiểm tra thông báo "Chế độ xem tổng hợp tuần (Chỉ đọc)".
- [ ] **Step 3: Xuất kho ngày Thứ Hai (T2) — Kiểm chứng Chặn Xác Thực**
  Click Tab `T2`, click `Điền đủ toàn bộ`. Nhập tăng số lượng dòng 1 nhưng để trống lý do chênh lệch $\rightarrow$ Xác nhận nút `Xác nhận xuất kho` BỊ KHÓA (disabled).
- [ ] **Step 4: Mở khóa xuất kho và ghi nhận xuất thiếu**
  Nhập lý do xuất vượt vào dòng 1. Giảm số lượng dòng 2 (Bếp tiết kiệm). Xác nhận nút `Xác nhận xuất kho` ĐƯỢC MỞ KHÓA $\rightarrow$ Click `Xác nhận xuất kho`.
- [ ] **Step 5: Mở `MrxSupplementalIssueModal` (Xuất bổ sung ca)**
  Click nút `Xuất bổ sung ca`, nhập số lượng bù, click chip lý do `Phát sinh suất ăn đột xuất`, click `Xác nhận xuất bổ sung` $\rightarrow$ Xác nhận phiếu xuất bổ sung được ghi nhận.
- [ ] **Step 6: Hoàn tất xuất kho các ngày còn lại (T3 đến T7)**
  Lần lượt duyệt qua các tab `T3`, `T4`, `T5`, `T6`, `T7`, click `Điền đủ toàn bộ`, áp dụng chênh lệch xen kẽ, click `Xác nhận xuất kho`.
- [ ] **Step 7: Tra cứu tab Lịch sử phiếu tại Kho & Mở `ReconciliationIssueDetailModal`**
  Click Tab `Lịch sử phiếu` tại trạm Kho, kiểm tra bảng phiếu đã ký, click vào mã phiếu mở `ReconciliationIssueDetailModal`, kiểm tra thông tin phiếu và đóng modal.
- [ ] **Step 8: Kiểm tra các trạm Kho bổ trợ**
  Điều hướng sang `/warehouse?view=mrx-preparation` và `/warehouse?view=mrx-issues`, xác nhận hiển thị mượt mà không lỗi.

---

### Task 4: Giai đoạn 3 — Bếp trưởng (`beptruong`): Phiếu nấu ca & Khử trùng thông tin

**Files:**
- Modify: `scripts/run-mrx-full-path-lifecycle-test.mjs`

**Interfaces:**
- Consumes: `/chef?view=mrx-cooking`
- Produces: Kiểm chứng lọc ca và không rò rỉ đơn giá

- [ ] **Step 1: Đăng nhập vai trò `beptruong` và điều hướng đến trạm Bếp**
- [ ] **Step 2: Thao tác bộ lọc ca**
  Chọn lọc `Ca 1 (Sáng)`, `Ca 2 (Chiều)`, `Tất cả` $\rightarrow$ Xác nhận danh sách phiếu nấu lọc chính xác.
- [ ] **Step 3: Kiểm chứng khử trùng thông tin bảo mật**
  Quét toàn bộ văn bản trang Bếp: khẳng định 100% không chứa ký tự tiền tệ (`₫`, `VNĐ`), không chứa từ khóa `đơn giá` và tên nhà cung cấp.

---

### Task 5: Giai đoạn 4 — Kế toán / Quản lý (`quanly`): Dashboard, Đối soát dòng, Giải trình 2 chiều & Khóa sổ

**Files:**
- Modify: `scripts/run-mrx-full-path-lifecycle-test.mjs`

**Interfaces:**
- Consumes: `/` (Dashboard đối soát), `/reconciliation`, `ReconciliationLineDetailModal`, `ReconciliationDispositionModal`, `ReconciliationCompletionModal`, 4 Sổ đối soát
- Produces: Lô đối soát tuần hoàn tất (`COMPLETED`), file xuất CSV, bản ghi kiểm toán

- [ ] **Step 1: Đăng nhập vai trò `quanly` và kiểm tra Dashboard đối soát (`/`)**
  Truy cập `/`, kiểm tra 4 KPI cards và danh sách lô đối soát.
- [ ] **Step 2: Điều hướng đến trạm Đối soát dòng (`/reconciliation`)**
  Chọn khách hàng và lô đối soát.
- [ ] **Step 3: Mở `ReconciliationLineDetailModal` (Chi tiết dòng đối soát)**
  Click vào tên nguyên liệu hoặc nút `Xem chi tiết`, kiểm tra nhu cầu BOM đã khóa và danh sách phiếu xuất, đóng modal.
- [ ] **Step 4: Mở `ReconciliationDispositionModal` (Giải trình chênh lệch 2 chiều)**
  Duyệt qua các ngày có sai lệch (`2026-07-20`, `2026-07-22`, `2026-07-24`), click `Xử lý chênh lệch`, chọn `ACCEPTED_VARIANCE`, nhập lý do giải trình 2 chiều, click `Lưu hướng xử lý`.
- [ ] **Step 5: Kiểm chứng trạng thái `WEEK_COMPLETE`**
  Tải lại tổng hợp tuần, xác nhận huy hiệu `Đủ điều kiện hoàn tất tuần` xuất hiện và nút `Chốt đối soát tuần` chuyển sang ENABLED.
- [ ] **Step 6: Mở `ReconciliationCompletionModal` & Khóa sổ đối soát tuần**
  Click nút `Chốt đối soát tuần`, xác nhận thông tin, click `Xác nhận khóa chốt tuần` $\rightarrow$ Xác nhận trạng thái lô chuyển sang `COMPLETED` ("Hoàn tất").
- [ ] **Step 7: Xuất báo cáo đối soát CSV**
  Click nút `Xuất CSV` trên Subbar, kiểm tra xuất báo cáo thành công.
- [ ] **Step 8: Kiểm tra 4 Sổ theo dõi đối soát**
  Lần lượt truy cập:
  - `/reconciliation?view=variances` (Sổ theo dõi chênh lệch)
  - `/reconciliation?view=transactions` (Lịch sử giao dịch kho)
  - `/reconciliation?view=audit` (Nhật ký kiểm toán đối soát)
  - `/reconciliation?view=completed` (Danh bạ lô đối soát đã hoàn tất: xác nhận lô vừa chốt tuần có mặt trong danh sách).

---

### Task 6: Thực thi & Kiểm chứng Toàn diện

**Files:**
- Output: `.artifacts/audit-screenshots/mrx-full-path/MRX-FULL-PATH-REPORT.json`
- Output: 8 ảnh chụp màn hình kiểm chứng các mốc quan trọng

- [ ] **Step 1: Chạy kịch bản tự động hóa**
  Run: `node scripts/run-mrx-full-path-lifecycle-test.mjs`
  Expected: Toàn bộ các Phase PASS 100%, không phát sinh lỗi ngoại lệ.
- [ ] **Step 2: Đọc báo cáo kết quả và xác minh bằng chứng**
  Kiểm tra file `MRX-FULL-PATH-REPORT.json` và kho ảnh chụp artifacts.
