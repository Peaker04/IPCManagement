# Đặc tả Kỹ thuật: Khôi phục Quản lý Định mức BOM, Độ phủ BOM & Tích hợp Sửa Thực đơn/Số suất Tuần trong Phân hệ MRX

## 1. Mục tiêu & Bối cảnh Nghiệp vụ
- **Mã Phân hệ**: `FR-CAT` (Catalog / BOM định mức), `FR-MENU` (Planning & Weekly Schedule), `FR-RECON` (MRX Batch Coordination).
- **Vấn đề cần giải quyết**:
  1. **Mất mục Quản lý Định mức BOM & Xử lý BOM thiếu**: Toàn bộ UI quản trị BOM cũ đã bị xóa trong đợt refactor trước; `/admin-data` chỉ có 2 tab `ingredients` và `dishes`. Người dùng không có cách nào xem độ phủ BOM của catalog món ăn, không thể tra cứu món nào thiếu BOM và không thể thêm/chỉnh sửa dòng BOM cho món, dù Backend C# đã có sẵn bộ API hoàn chỉnh (`/api/Dishes/bom-coverage`, `/api/Dishes/bom-validation`, `/api/Dishes/{id}/bom`).
  2. **Trạm Điều phối MRX (`/weekly-menu?view=mrx-batch`) thiếu giao diện Sửa thực đơn món ăn & Số suất tuần**: Trong chế độ `MATERIAL_RECONCILIATION`, trang `/weekly-menu` thông thường bị chuyển hướng sang trạm MRX. Nhưng tại trạm MRX, giao diện chỉ có nút *Nhập thực đơn Excel*, hoàn toàn thiếu nút mở modal *Chỉnh sửa lịch tuần* để điều chỉnh số suất theo ca và đổi món trước khi đóng băng lô.
  3. **Tắc nghẽn khi gặp món thiếu BOM**: Khi bấm *Kiểm tra định lượng* tại trạm MRX, nếu có món ăn trong tuần chưa có BOM, hệ thống đưa ra chẩn đoán chặn tạo lô nhưng không cung cấp đường dẫn để bổ sung BOM cho món đó ngay tại chỗ.

## 2. Các Bất biến & Ràng buộc Hệ thống (Invariants & Rules)
- **`DOM-MODE-1`**: Cách ly tuyệt đối chế độ vận hành. Master data BOM trong `/admin-data` là dữ liệu dùng chung (`modes: ['DEFAULT', 'MATERIAL_RECONCILIATION']`). Không làm ảnh hưởng đến luồng của `DEFAULT`.
- **`Zero Synthetic Evidence / TA-1 đến TA-5`**: Không mock dữ liệu BOM, không dùng fake API. Sử dụng 100% endpoint backend C# thật:
  - `GET /api/Dishes/bom-coverage`
  - `GET /api/Dishes/{id}/bom`
  - `POST /api/Dishes/{id}/bom`
  - `PUT /api/Dishes/{id}/bom/{bomId}`
  - `DELETE /api/Dishes/{id}/bom/{bomId}`
- **Giới hạn Kiến trúc Cây (Tree Architecture Limits)**:
  - Giới hạn cứng: 0 tệp FE > 600 dòng.
  - Phân rã sub-tree branches: mỗi cành con $\le 350$ dòng.
  - Không tạo token CSS ngoài `frontend/src/styles/index.css`.
  - Không tạo primitive trùng lặp (không dùng BadgeV2, ModalNew).
- **Quy chuẩn UI/UX (`DESIGN.md`)**:
  - `Rule D6`: Cỡ chữ nhỏ nhất $\ge 12$px.
  - `Rule D7`: Tối đa 1 nút hành động chính (Primary Button) trên WorkspaceHeader. Nút *Chỉnh sửa lịch tuần* là nút phụ `variant="outline"`.
  - `Rule T7`: Frozen table headers (`thead.sticky`).
  - `Rule T8`: Compact table row density (36–40px).
  - `Rule M1.2`: Tối đa 1 modal chặn tương tác mở tại một thời điểm.

## 3. Kiến trúc Thành phần Chi tiết

### Phân hệ 1: Quản trị Định mức BOM & Độ phủ BOM tại `/admin-data?view=bom`
- **Tệp mới**: `frontend/src/api/bomApi.ts`
  - Khai báo các hàm gọi API chuẩn:
    - `getBomCoverage()`: Lấy báo cáo độ phủ BOM toàn bộ món ăn (`BomCoverageReportDto`).
    - `getDishBom(dishId)`: Lấy các dòng định mức của món (`DishCatalogBomLineDto[]`).
    - `addDishBomLine(dishId, request)`: Thêm dòng BOM (`CreateDishBomLineRequest`).
    - `updateDishBomLine(dishId, bomId, request)`: Cập nhật định mức dòng BOM (`UpdateDishBomLineRequest`).
    - `closeDishBomLine(dishId, bomId)`: Ngừng áp dụng dòng BOM.
- **Tệp mới**: `frontend/src/features/admin/branches/AdminBomBranch.tsx` ($\le 320$ dòng)
  - Nhận trách nhiệm render nội dung khi `activeView === 'bom'` trong `AdminDataPage.tsx`.
  - Telemetry subbar:
    - Tổng số món ăn trong catalog.
    - Số món đã hoàn tất định mức BOM (Huy hiệu xanh).
    - **Số món thiếu BOM (Huy hiệu cảnh báo đỏ/vàng)**.
    - Tổng số dòng định mức đang áp dụng.
  - Thanh công cụ lọc:
    - Tab lọc: `Tất cả món`, `Món thiếu BOM (Cần bổ sung)`, `Đã đủ định mức`.
    - Ô tìm kiếm món ăn theo mã hoặc tên món.
  - Bảng dữ liệu DataGrid (Columns):
    - Mã món (`<IdentifierText>`).
    - Tên món ăn tiêu chuẩn.
    - Phân loại / Nhóm món.
    - Số dòng BOM cấu thành.
    - Trạng thái BOM (`Badge variant="success"` nếu đủ, `Badge variant="warning"` nếu thiếu BOM).
    - Cột thao tác: Nút bấm `[Chỉnh sửa BOM]` mở modal `DishBomEditorModal`.
- **Tệp mới**: `frontend/src/features/admin/DishBomEditorModal.tsx` ($\le 320$ dòng)
  - Modal chỉnh sửa định mức BOM của một món ăn được chọn.
  - Tiêu đề: `Định mức BOM món: [Tên món] ([Mã món])`.
  - Phần 1 (Bảng dòng BOM hiện có):
    - Mã & Tên nguyên liệu.
    - ĐVT (kg, g, cái...).
    - Định mức / suất (số thập phân 4 chữ số với `<Num>`).
    - Đơn giá tham chiếu.
    - Thao tác: Nút sửa định mức hoặc nút xóa dòng BOM.
  - Phần 2 (Form thêm nguyên liệu mới vào BOM):
    - Combobox chọn nguyên liệu từ catalog (`adminApi.getIngredients`).
    - Input nhập số lượng định mức / suất.
    - Nút bấm `[Thêm vào BOM]` (`POST /api/Dishes/{id}/bom`).
- **Cập nhật `AdminDataPage.tsx`**:
  - Tích hợp tab thứ 3 `bom` (BOM định mức) vào danh sách tab của trang.

### Phân hệ 2: Tích hợp Sửa Thực đơn & Số suất Tuần trong Trạm Điều phối MRX (`MrxBatchWorkbench.tsx`)
- **Cập nhật `MrxBatchHeaderBranch.tsx`**:
  - Khi thực đơn đã được import (`source` tồn tại), hiển thị thêm nút **`Chỉnh sửa lịch tuần`** (`variant="outline"`).
  - Bấm vào mở `WeeklyScheduleEditorModal`.
- **Cập nhật `MrxBatchWorkbench.tsx`**:
  - Quản lý trạng thái `isEditorModalOpen`.
  - Render `WeeklyScheduleEditorModal` khi mở.
  - Khi `onSaveSuccess`, gọi `loadSource(true)` để làm mới nguồn và tái tính toán KHSX tức thì.

### Phân hệ 3: Xử lý Nhanh Món Thiếu BOM tại Trạm MRX Batch
- **Trong `MrxBatchWorkbench.tsx`**:
  - Khi `preview.diagnostics` có cảnh báo món thiếu BOM, hiển thị banner cảnh báo chi tiết.
  - Mỗi dòng cảnh báo có nút **`[Bổ sung BOM]`** mở trực tiếp `DishBomEditorModal` cho món đó.
- **Trong `MrxBatchDishesModal.tsx`**:
  - Tại bảng nguyên liệu cấu thành món đông cứng, bổ sung nút `[Chỉnh sửa BOM]` để xem và điều chỉnh định mức của món trực tiếp.

## 4. Tiêu chí Nghiệm thu (Acceptance Criteria)
1. **AC-1 (Độ phủ BOM trong Admin Data)**:
   - Truy cập `/admin-data?view=bom` hiển thị đầy đủ telemetry 4 chỉ số từ backend `GET /api/Dishes/bom-coverage`.
   - Chọn bộ lọc `Món thiếu BOM` lọc ra chính xác các món có `bomLineCount === 0`.
2. **AC-2 (Thêm/Sửa/Xóa BOM)**:
   - Mở `DishBomEditorModal` trên món thiếu BOM, chọn nguyên liệu và định mức, bấm `Thêm vào BOM` gọi thành công `POST /api/Dishes/{id}/bom`.
   - Dòng BOM mới xuất hiện ngay trong bảng, trạng thái món chuyển sang `Đã có BOM`.
3. **AC-3 (Sửa lịch tuần & số suất trong MRX Batch)**:
   - Tại `/weekly-menu?view=mrx-batch`, bấm nút `Chỉnh sửa lịch tuần` mở `WeeklyScheduleEditorModal`.
   - Sửa số suất ca trong Tab 1 hoặc đổi món trong Tab 2, bấm lưu thành công, dữ liệu làm mới trên MRX Workbench.
4. **AC-4 (Xử lý thiếu BOM tại chỗ trong MRX Batch)**:
   - Khi có cảnh báo thiếu BOM tại MRX Batch, bấm nút bổ sung BOM mở modal thêm nguyên liệu, sau khi thêm bấm `Kiểm tra định lượng` đạt 0 lỗi chẩn đoán.
5. **AC-5 (Bảo toàn Kiến trúc & Không Hồi quy)**:
   - 100% các tệp frontend $\le 350$ dòng, 0 tệp $> 600$ dòng.
   - `npm run precommit:verify` đạt 100% PASS (Gate A–E).
   - `npx playwright test` đạt 63/63 PASS (100%).
   - `dotnet test backend/IPCManagement.slnx` đạt 1.370/1.370 PASS (100%).
   - E2E Lifecycle Matrix trên Sandbox DB đạt 19/19 PASS.
