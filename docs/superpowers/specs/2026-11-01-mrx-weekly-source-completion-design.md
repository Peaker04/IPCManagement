# MRX Weekly Source Completion Workbench — Design

**Date:** 2026-11-01  
**Status:** Awaiting Owner approval  
**Route:** `/weekly-menu?view=mrx-batch`  
**Mode:** `MATERIAL_RECONCILIATION` only

## 1. Intent

Sau khi Điều phối nhập file Excel thực đơn tuần, hệ thống phải luôn hiển thị đúng bốn nhóm món đã nhập và dẫn người dùng hoàn thiện số suất Mặn/Chay theo từng ngày, từng ca trước khi kiểm tra định lượng và tạo lô MRX.

Thiết kế này sửa vấn đề hiện tại: nguồn thực đơn đã được import/xuất bản nhưng vùng làm việc chính bị thay bằng một prerequisite gate trống vì chưa có số suất; đồng thời hai hành động `Chỉnh sửa lịch tuần` và `Điều chỉnh nguồn` cùng sở hữu việc sửa món/số suất trước khi có batch.

## 2. Audience and Job

- **Actor chính:** Điều phối MRX.
- **Bối cảnh:** vừa nhận và import thực đơn tuần của khách hàng; cần kiểm tra món, nhập số suất, xử lý thiếu dữ liệu và tạo nguồn định lượng.
- **Primary job:** hoàn thiện một nguồn tuần có đủ bốn nhóm món và số suất theo ngày/ca để chạy kiểm tra định lượng.
- **Success:** người dùng nhìn thấy ngay menu đã import, biết chính xác ô số suất nào còn thiếu, hoàn thiện bằng bàn phím hoặc chuột, kiểm tra định lượng và đi tiếp mà không phải đoán giữa hai editor.

## 3. Confirmed Business Contract

Excel chỉ sở hữu danh sách món cho bốn nhóm cố định:

1. `MẶN · CA SÁNG`
2. `CHAY · CA SÁNG`
3. `MẶN · CA CHIỀU`
4. `CHAY · CA CHIỀU`

Số suất Mặn/Chay theo từng ngày và từng ca luôn được nhập sau trên web.

Thiết kế không thay đổi:

- Cấu trúc DTO/API, database hoặc audit lineage.
- Quyền, ActionGuard hoặc Backend authorization.
- `DOM-MODE-1`: DEFAULT không dùng chung workflow MRX.
- Cơ chế khóa theo ngày đã xuất kho.
- Preview/apply/approval/concurrency của direct source change.

## 4. Goals

1. Menu vừa import luôn hiển thị, kể cả khi chưa có bất kỳ số suất nào.
2. Thiếu số suất được thể hiện là `partial`, không phải `empty` và không che menu.
3. Một bề mặt duy nhất sở hữu món và số suất trong toàn bộ vòng đời nguồn tuần.
4. Ma trận bám hình học của file Excel để người vận hành đối chiếu nhanh.
5. Một primary action theo đúng bước vòng đời hiện tại.
6. Giữ Quiet Operational, compact density, sticky header/cột đầu và full keyboard operation.
7. Tái sử dụng owner hiện tại; không thêm dependency, styling token hoặc primitive mới.

## 5. Non-goals

- Không xây wizard hoặc route mới.
- Không thay đổi định dạng file Excel.
- Không cho Excel sở hữu số suất.
- Không gộp DEFAULT weekly-menu với MRX.
- Không tự điền số suất, món hoặc BOM giả.
- Không tự động chạy kiểm tra định lượng khi dữ liệu chưa được người dùng xác nhận.
- Không redesign AppShell, navigation hoặc các trạm Warehouse/Chef/Reconciliation.

## 6. Approaches Considered

### A. Unified weekly-source matrix — selected

Hiển thị bốn nhóm món theo chiều dọc, ngày theo chiều ngang. Mỗi nhóm có một hàng `Số suất`; các hàng món nằm ngay bên dưới. Menu luôn đọc được, còn ô số suất có thể nhập tại đúng ngày/ca.

**Trade-off:** ma trận rộng và cần horizontal viewport chuẩn T7, nhưng khớp trực tiếp file nghiệp vụ, giảm context switching và hỗ trợ đối chiếu nhanh.

### B. Three-step wizard — rejected

Tách `Xem menu → Nhập số suất → Kiểm tra` thành ba màn hình tuần tự.

**Trade-off:** tập trung tốt cho người mới nhưng che menu khi nhập số suất, làm đối chiếu khó hơn và đưa một pattern wizard lạ vào workbench ERP hiện tại.

### C. Menu plus readiness side panel — rejected

Menu ở master panel, số suất/trạng thái ở detail panel.

**Trade-off:** readiness rõ nhưng giảm chiều rộng ma trận, tạo hai vùng cạnh tranh và kém phù hợp với bảng tuần sáu ngày.

## 7. Final Design Decision

Chọn **A — Unified weekly-source matrix**, điều chỉnh theo đúng kiến trúc IPCManagement.

### 7.1 Zone 1 — WorkspaceHeader

- Breadcrumb: `Đối soát MRX · Trạm Điều phối`.
- Title trước khi tạo batch: `Hoàn thiện nguồn tuần`.
- Context selectors: khách hàng và tuần bắt đầu hiện có.
- Utility: `Làm mới`.
- Duy nhất một primary action, thay đổi theo lifecycle:
  1. `Lưu & kiểm tra định lượng` khi nguồn còn thiếu/chưa preview.
  2. `Tạo lô nháp` khi preview hợp lệ.
  3. `Đóng băng lô` khi batch DRAFT.
  4. `Chuyển sang Kho` khi batch READY.
  5. Điều hướng tới trạm tiếp theo khi batch đã chuyển/hoàn tất.

Primary action phải dùng ActionGuard hiện có và không được cạnh tranh với utility actions.

### 7.2 Zone 2 — TelemetrySubbar

Bên trái là readiness chain dạng inline pills, không dùng KPI card:

- `Menu 4/4 nhóm`.
- `Thiếu N ô số suất` hoặc `Đã đủ số suất`.
- `BOM chưa kiểm tra`, `BOM có N lỗi`, hoặc `BOM hợp lệ`.
- Trạng thái batch hiện tại hoặc `Lô chưa tạo`.

Bên phải:

- `Nhập lại Excel` — secondary utility, chỉ trước khi nguồn bị khóa bởi lifecycle.
- `Lịch sử nguồn` hoặc yêu cầu chờ duyệt khi actor có quyền.

Không hiển thị song song `Chỉnh sửa lịch tuần` và `Điều chỉnh nguồn`.

### 7.3 Zone 3 — Weekly Source Matrix

Một bảng duy nhất:

- Cột đầu cố định: `Nhóm / Loại món`.
- Các cột ngày: Thứ + `dd/MM`.
- Bốn section divider theo thứ tự canonical.
- Hàng đầu mỗi section: `Số suất`.
- Các hàng sau: slot món từ nguồn import (`Món mặn 1`, `Món mặn 2`, `Rau`, `Canh`, `Tráng miệng`, hoặc slot thực tế do contract cung cấp).
- Các ô có cùng `DishId`, cùng ngày, cùng section và liền kề theo persisted `DisplayOrder` được hiển thị thành một khối semantic bằng `rowspan`; không lặp tên món và không chèn copy giả như `Dùng chung`.
- Parser/persistence hiện lưu mỗi merged continuation thành một `MenuItem` riêng theo `DishSlot`; read state chỉ nhóm trực quan, không xóa hay tạo record.
- Các block dọc giống nhau ở ngày liền kề có thể dùng `colspan` trong read state khi `DishId + slot run + section + lock state` trùng nhau. Edit state luôn tách theo ngày.
- Không cần thêm `RowSpan` vào DB/DTO: frontend dựng run từ các slot liền kề có cùng `DishId`. Không gộp chỉ theo `DishName`.
- Tuyệt đối không gộp xuyên section, ca, variant Mặn/Chay, lock state, hoặc các slot/ngày không liền kề.
- Sticky header và frozen first column.
- Dòng thường 36–40px; dòng có input 44px.
- Số suất dùng tabular figures, căn phải, đơn vị ở header/context thay vì lặp lại.

### 7.4 Read and Edit Modes

Bề mặt là một owner nhưng có hai interaction states:

- **Read state:** menu và số suất hiện tại luôn hiển thị. Ô thiếu có trạng thái amber nhẹ và copy `Chưa nhập`; không dùng màu làm tín hiệu duy nhất.
- **Edit state:** số suất trở thành Input; mỗi persisted slot trở thành SearchableCombobox tại cùng tọa độ. Mọi vertical/horizontal read block mở thành các slot/ngày riêng để phạm vi mutation rõ ràng; không có bulk update ngầm. Không mở modal lịch tuần dài.

Nếu nguồn vừa import và còn thiếu số suất, workbench mở ở completion state phù hợp để nhập số suất nhưng vẫn bảo toàn menu đọc được.

### 7.5 Unified ownership

- Loại bỏ visible legacy action `Chỉnh sửa lịch tuần` khỏi MRX workbench.
- `Điều chỉnh nguồn` không còn là editor cạnh tranh; functionality của nó trở thành edit state của weekly-source matrix.
- Existing `useMrxSourceEdit` tiếp tục sở hữu draft, preview, apply, submit, locking và conflict behavior.
- Existing weekly menu source/preview APIs tiếp tục là server authority.
- `WeeklyScheduleEditorModal` có thể còn phục vụ route DEFAULT nếu có real caller; không được giữ trong MRX chỉ để tương thích test.

## 8. Workflow

### 8.1 First completion after Excel import

1. Import Excel thành công.
2. Modal đóng; workbench refresh nguồn.
3. Zone 3 hiển thị bốn nhóm món ngay lập tức.
4. Readiness báo số ô suất còn thiếu.
5. Người dùng nhập số suất theo ngày/ca.
6. Primary action `Lưu & kiểm tra định lượng`.
7. Hệ thống chạy source-change preview/apply theo authority hiện có, sau đó quantity preview.
8. Nếu BOM hợp lệ: primary action chuyển thành `Tạo lô nháp`.
9. Nếu thiếu BOM: giữ menu/số suất và hiển thị diagnostics cùng recovery action; không thay toàn màn hình.

### 8.2 Later source correction

- Cùng ma trận chuyển sang edit state.
- Ngày đã xuất kho readonly, có lock reason.
- Ngày mở cho phép sửa món/số suất.
- Thay đổi phải đi qua impact review.
- Actor được direct apply hoặc submit for approval theo policy hiện có.
- 409 giữ draft và đưa recovery action; không reload âm thầm.

## 9. State Model

- **Loading:** skeleton matrix giữ đúng 4 section và số cột ngày, không chứa dữ liệu giả.
- **Empty:** chỉ khi thật sự chưa có source; CTA `Nhập thực đơn Excel`.
- **Partial:** có menu nhưng thiếu số suất/BOM; menu vẫn hiển thị, thiếu ở đâu đánh dấu ở đó.
- **Error:** giữ previous-key data nếu hợp lệ, hiển thị InlineBanner/StateBoundary với retry.
- **Permission denied:** matrix readonly; action bị ẩn/disable qua guards và giải thích lý do.
- **Write reconciliation:** 409 giữ draft, nêu dữ liệu đã thay đổi và cung cấp reload/compare action.
- **Locked:** readonly theo ngày với text reason, không chỉ badge màu.

## 10. Responsive and Accessibility

### Desktop

- Hiển thị toàn ma trận trong TableViewport.
- Frozen first column; horizontal scrollbar thuộc table viewport.
- Bốn section có thể collapse, nhưng section đang thiếu dữ liệu mặc định mở.

### Tablet portrait and 200% zoom

- Không biến ma trận thành split panel và không giấu work object.
- Giữ sequential grid-first workflow.
- Header actions dùng compact labels nhưng accessible name đầy đủ.
- Người dùng cuộn ngang trong matrix; document không overflow ngang.

### Keyboard

- Tab đi qua các ô số suất theo thứ tự ngày trong section, rồi sang section tiếp theo.
- Read state dùng một semantic cell cho mỗi grouped block; edit state đi qua từng persisted slot control theo thứ tự canonical và từng ngày.
- Accessible name của khối đọc nêu món, ngày hoặc dải ngày, ca và danh sách slot mà khối đại diện.
- SearchableCombobox giữ Arrow/Enter/Escape behavior hiện có.
- Focus không mất khi collapse section, preview impact hoặc quay lại grid.
- Error/partial summary dùng semantic live feedback thích hợp.

## 11. Component and Owner Impact

Expected primary owners:

- `backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportService.cs` — include merged continuation slots in MRX reimport comparison so analysis matches committed persistence.
- `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportBatchTests.cs` — own merged-cell reimport regression.
- `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- `frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx`
- `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`
- `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts`
- `frontend/src/features/weekly-menu/MrxSourceChangePanel.tsx`
- Existing Weekly Menu/MRX owner tests and permanent G6.

Potential cleanup subject to real-caller inventory:

- MRX usage of `WeeklyScheduleEditorModal`.
- Preview-only menu reconstruction in `MrxBatchPreviewSection` if source matrix becomes the persistent menu owner.

No new primitive, route, dependency, API, database migration or styling token is planned.

## 12. Acceptance Criteria

1. Importing the canonical four-section Excel immediately renders the menu matrix before servings exist.
2. Missing servings produce partial/readiness feedback and do not produce an empty work area.
3. Every day × shift has separate Mặn and Chay serving ownership represented in the correct section.
4. Adjacent persisted slots with the same `DishId` render as one semantic read block; independent or non-adjacent same-name dishes remain separate.
5. Entering dish-edit mode expands every grouped block into its persisted slot/day controls; changing one slot never silently updates another.
6. MRX reimport compares merged continuation slots consistently with committed persistence and does not classify an identical merged workbook as an unsupported structural change.
7. Only one visible edit owner exists for menu and servings.
8. Existing lifecycle actions remain one-primary-action compliant.
9. Existing RBAC, mode guards, source-change approval, day locks, audit revisions and race behavior remain intact.
10. Menu and drafts survive refresh/reload according to current server/cache contracts.
11. Keyboard-only dish and serving edits remain functional: one semantic block while reading, one focus stop per persisted slot/day while editing.
12. Desktop, `768×1024`, effective `720×450`, and supported table overflow preserve task completion.
13. Full repository gates and permanent G6 pass without guardrail suppression or fake fixtures.

## 13. Anti-goals / Failure Conditions

The design fails if any of the following occurs:

- Menu disappears merely because servings are missing.
- Both legacy schedule editor and source editor remain visible in MRX.
- Same-name dishes are merged without matching `DishId`, section, adjacency and lock state.
- A read block silently becomes a multi-slot or multi-day mutation control.
- Reimport drops continuation slots that persistence previously committed.
- A wizard/modal replaces the primary weekly matrix.
- Missing data is auto-filled or fabricated.
- Locked days become editable.
- DEFAULT and MRX workflows share mutation ownership.
- A second primary action competes in the same context.
- Compact/zoom layouts hide the matrix work object.

## 14. Design Review Decision

The current screen is mechanically consistent with project styling (Impeccable detector: zero findings) but fails workflow visibility and ownership: imported menu truth is hidden behind a quantity prerequisite, and two edit actions compete for the same pre-batch data.

The selected matrix design is the smallest complete repair because it reuses the route, workbench hierarchy, existing source-edit authority and canonical Excel geometry. It changes information architecture and composition, not business semantics.
