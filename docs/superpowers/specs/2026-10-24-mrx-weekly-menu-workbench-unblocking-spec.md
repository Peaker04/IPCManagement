# Đặc Tả Kỹ Thuật: Tinh Chỉnh Phân Hệ Chuẩn Bị Lô Đối Soát MRX & Xóa Bỏ Ngõ Cụt Vận Hành (MRX Weekly Menu Workbench Unblocking Spec)

**Mã phân hệ:** `FR-MENU` / `FR-RECON`  
**Route áp dụng:** `/weekly-menu?view=mrx-batch`  
**Chế độ vận hành:** `MATERIAL_RECONCILIATION` (`DOM-MODE-1`)  
**Tài liệu tham chiếu:** `docs/DOMAIN.md`, `docs/DESIGN.md`, `docs/UI-KIT.md`, `CLAUDE.md`, `AGENTS.md`.  
**Ngày ban hành:** 2026-10-24  
**Trạng thái:** DRAFT CHO USER DUYỆT  

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ

### 1.1. Hiện trạng & Vấn đề phát hiện
Trạm Chuẩn bị lô đối soát (`/weekly-menu?view=mrx-batch`) là trạm cửa ngõ đầu tiên của chu trình MRX. Tại đây, Điều phối viên (`COORDINATOR`) và Quản lý (`ADMIN`/`MANAGER`) kiểm tra thực đơn tuần, đóng băng định lượng và bàn giao sang trạm Kho (`WAREHOUSE`).

Qua kiểm định định lượng và kiểm thử Headed live trên Chromium, trạm này còn 4 ngõ cụt và điểm đứt gãy luồng:
1. **Ngõ cụt chuyển giao trạm Kho (Dead-End 1)**: Sau khi bấm "Chuyển sang Kho", lô chuyển trạng thái sang `TRANSFERRED` / `IN_PROGRESS`. Nút Primary Action biến mất hoàn toàn. Người dùng bị dừng lại mà không có nút điều hướng chuyển tiếp sang trạm Kho để tiếp tục theo dõi xuất kho ca.
2. **Đứt gãy liên tục vòng đời (Dead-End 2)**: Thiếu thanh chỉ dẫn vòng đời liên trạm (Cross-station Lifecycle Strip). Người dùng không nắm được lô đang ở bước nào trong 6 bước MRX (Nguồn $\rightarrow$ Đóng băng $\rightarrow$ Kho $\rightarrow$ Bếp $\rightarrow$ Đối soát $\rightarrow$ Hoàn tất) và ai là người chịu trách nhiệm tiếp theo.
3. **Ngõ cụt khi thực đơn DRAFT (Dead-End 3)**: Khi nguồn thực đơn là DRAFT, hệ thống có nút "Xuất bản thực đơn tuần" nhưng sau khi bấm xuất bản thành công, giao diện không tự động chuyển trạng thái để người dùng đi tiếp bước "Kiểm tra định lượng".
4. **Lối thoát & An toàn thao tác Modal Đổi số suất ca (Dead-End 4)**: Modal điều chỉnh số suất ca (`isChangeOpen`) và modal duyệt của Admin (`reviewRequest`) thiếu cơ chế khôi phục khi gặp lỗi xung đột phiên bản (HTTP 409), thiếu cảnh báo mất bản nháp và thiếu nút quay lại rõ ràng.

### 1.2. Mục tiêu kỹ thuật
- Loại bỏ 100% các ngõ cụt tại trạm `/weekly-menu?view=mrx-batch`, đảm bảo mọi trạng thái của lô đều có **Lối thoát hành động rõ ràng (Clear Forward Action / Next-Step Guidance)**.
- Bổ sung nút CTA chuyển tiếp liên trạm sang Trạm Kho (`/warehouse?view=mrx-daily&batchId={id}`).
- Giữ vững nguyên tắc **Zero Layout Shift (CLS = 0.0000)**, không dùng skeleton khi chuyển khách hàng/tuần, giữ nguyên bảng cũ và làm mờ `opacity-70`.
- Bảo toàn tuyệt đối nguyên tắc cô lập chế độ `DOM-MODE-1`: Tuyệt đối không gọi bất kỳ API nào của chế độ `DEFAULT`.

---

## 2. Đặc Tả Chi Tiết 4 Cải Tiến Trọng Tâm Trên Trạm MRX Batch

### 2.1. Giải pháp 1: Nút CTA Chuyển tiếp Trạm Kho khi Lô đã Bàn giao (`RULE-MRX-NAV-01`)
- **Điều kiện kích hoạt**: Khi lô đối soát ở trạng thái `TRANSFERRED` hoặc `IN_PROGRESS`.
- **Vị trí hiển thị**:
  1. Trên **WorkspaceHeader Actions**: Hiển thị nút Primary CTA có biểu tượng mũi tên:
     `<Button variant="default" onClick={navigateToWarehouse}>Đi đến Trạm Kho nguyên liệu →</Button>`
  2. Trên **Success Banner**: Ngay bên cạnh thông báo "Đã bàn giao lô đối soát sang Kho nguyên liệu thành công", hiển thị nút phụ chuyển tiếp nhanh.
- **Hành vi điều hướng**:
  - Chuyển hướng sang: `/warehouse?view=mrx-daily&batchId=${batch.batchId}`.
  - Mang theo đầy đủ `batchId` và `date` của ngày phục vụ đầu tiên trong tuần.

### 2.2. Giải pháp 2: Thanh Chỉ Dẫn Vòng Đời Lô Liên Trạm (MRX Lifecycle Step Indicator)
- **Vị trí**: Nằm trong `TelemetrySubbar` (Zone 2) hoặc ngay dưới Subbar.
- **Cấu trúc 5 nấc trạng thái trực quan**:
  1. `1. Nguồn thực đơn` (DRAFT / PUBLISHED)
  2. `2. Đóng băng lô` (READY)
  3. `3. Xuất kho ca` (TRANSFERRED / IN_PROGRESS) $\rightarrow$ Trạm Kho
  4. `4. Phiếu nấu` $\rightarrow$ Trạm Bếp
  5. `5. Chốt sổ tuần` (WEEK_COMPLETE / COMPLETED) $\rightarrow$ Bàn điều khiển Giám sát
- **Quy tắc hiển thị**:
  - Mỗi bước hiển thị rõ: Tên bước, Icon trạng thái (Đã xong: xanh lá `CheckCircle`, Đang thực hiện: xanh dương `Clock`, Chưa tới: xám trung tính `Circle`).
  - Bước hiện tại có nhãn vai trò chịu trách nhiệm (vd: `[Thủ kho đang xử lý]`).

### 2.3. Giải pháp 3: Tự động Kích hoạt Bước tiếp theo sau khi Xuất bản Thực đơn
- **Vấn đề**: Hiện tại hàm `publishMenu` gọi API xuất bản và `apiClient('/coordination/meal-quantity-plans/quick-servings')` để hoàn tất số suất, nhưng người dùng phải tự bấm nút tiếp theo.
- **Quy trình cải tiến**:
  1. Khi xuất bản thành công: Tự động gọi `checkQuantities()` (Kiểm tra định lượng).
  2. Giao diện tự động chuyển từ trạng thái hiển thị DRAFT sang trạng thái hiển thị Preview định lượng.
  3. Nút chính tự động đổi thành **"Tạo lô nháp"** (`commitDraft`) với hướng dẫn rõ ràng.

### 2.4. Giải pháp 4: Hoàn thiện Công thái học & Lối thoát cho Modal Đổi Số Suất Ca
- **Modal `isChangeOpen`**:
  - Bổ sung nút "Hủy thay đổi" (`variant="outline"`) cạnh nút "Gửi yêu cầu".
  - Hỗ trợ đóng bằng phím `Escape` và nút `X` góc trên.
  - Khi có lỗi 409 (xung đột phiên bản nguồn do người khác vừa chỉnh sửa), hiển thị thông báo xung đột kèm nút **"Tải lại dữ liệu mới nhất"**.
- **Modal duyệt `reviewRequest` của Admin**:
  - Hiển thị bảng chi tiết so sánh: `Số suất cũ` $\rightarrow$ `Số suất mới` (tô màu xanh nếu tăng, vàng nếu giảm).
  - Nút "Duyệt áp dụng" (Xanh lá) và nút "Từ chối" (Đỏ, yêu cầu bắt buộc nhập lý do từ chối theo `BR-GLOBAL-03`).

---

## 3. Rào Chắn Thiết Kế & An Toàn Kỹ Thuật (Design & Safety Invariants)

- **Nguyên tắc DOM-MODE-1**: 100% request phải đi qua `/api/reconciliation/*`. Cấm tuyệt đối request sang `/api/inventory-issues` hoặc `/api/approvals` của DEFAULT.
- **Quy tắc D6 & D7 (DESIGN.md)**:
  - Font size tối thiểu $\ge 12\text{px}$ cho mọi nhãn và bảng.
  - Thanh Header (Zone 1) chỉ có DUY NHẤT 1 nút Primary (màu slate-900 hoặc xanh đậm). Các nút khác là Outline hoặc Ghost.
- **Quy tắc T7 & T8 (DESIGN.md)**:
  - Header và cột đầu của bảng ma trận đông cứng (Frozen/Sticky).
  - Chiều cao dòng bảng DataGrid từ $36\text{px} - 40\text{px}$.
- **Quy tắc Zero-CLS (RULE-FEEDBACK-01..04)**:
  - Khi người dùng đổi khách hàng hoặc tuần: CẤM gọi `setData(null)`. Giữ nguyên bảng cũ, làm mờ `opacity-70` kèm progress bar trên đỉnh.
  - Đo đạc thực tế sau khi sửa phải đạt $\text{CLS} = 0.0000$.

---

## 4. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

- [ ] **AC-1**: Khi lô ở trạng thái `TRANSFERRED` hoặc `IN_PROGRESS`, nút "Đi đến Trạm Kho nguyên liệu →" xuất hiện trên Header và click chuyển đúng sang `/warehouse?view=mrx-daily&batchId=...`.
- [ ] **AC-2**: Thanh vòng đời liên trạm hiển thị đúng bước hiện tại của lô với nhãn trạm và vai trò tương ứng.
- [ ] **AC-3**: Bấm "Xuất bản thực đơn tuần" thành công thì hệ thống tự động kiểm tra định lượng và hiển thị nút "Tạo lô nháp".
- [ ] **AC-4**: Modal đổi số suất ca có đầy đủ nút Hủy, đóng phím Escape, cảnh báo lý do bắt buộc và xử lý lỗi xung đột 409.
- [ ] **AC-5**: Toàn bộ 166 FE tests pass, strict architecture growth pass, ESLint 0 lỗi.
- [ ] **AC-6**: Kiểm chứng Headed Chromium live đạt 0 lỗi mạng, 0 lỗi console, CLS $\le 0.05$.
