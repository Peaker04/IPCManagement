# Kế Hoạch Triển Khai: Chuẩn Hóa Giao Diện Điều Hành Bếp Ăn & Đáp Ứng Đa Màn Hình

> **Quy định bắt buộc:** Tuân thủ triệt để `AGENTS.md`, `docs/DESIGN.md` (D1–D9, T1–T16, M1–M3, N1–N8, E1–E8), `docs/UI-KIT.md`, và các Hard Invariants. Đã được Owner phê duyệt triển khai!

**Mục tiêu:** Chuẩn hóa 100% ngôn ngữ tiếng Việt nghiệp vụ suất ăn công nghiệp (loại bỏ toàn bộ từ ngữ máy móc/kiểm thử như `persisted`, `authoritative`, `backend`), tinh chỉnh bố cục 3-Zone co giãn theo các màn hình tiêu chuẩn (Desktop 1440/1280, Laptop 1024, Tablet 768), hợp nhất nút Primary (Rule D7), phân bổ lại độ rộng cột bảng chống cắt cụt chữ, và chữa lành bẫy trạng thái rỗng/lỗi 409.

**Kiến trúc:** Bám sát triết lý 3-Zone Flat Workbench (`WorkspaceHeader` 56px, `TelemetrySubbar` 44px, `DataGrid/SplitView` 85% khung nhìn), tái sử dụng 100% UI Kit có sẵn (`docs/UI-KIT.md`), hệ thống semantic tokens trong `frontend/src/styles/index.css`, và bảo toàn ranh giới cách ly chế độ `DOM-MODE-1`.

**Công nghệ:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Playwright on Chromium.

**Đặc tả thiết kế (Spec):** `docs/superpowers/specs/2026-10-18-catering-ui-standardization-design.md`

## Ràng Buộc Toàn Cục (Global Constraints)
- **Zero Synthetic Evidence (Rule TA-1 đến TA-5)**: Tuyệt đối không bịa số liệu, không mock hạ thấp quyền hạn.
- **Single Styling Authority (Rule D1)**: Không tạo mã màu inline, không sinh token ngoài `frontend/src/styles/index.css`.
- **Single Primary Action Button (Rule D7)**: Tối đa 1 nút Primary trên mỗi vùng làm việc.
- **Operational Mode Isolation (DOM-MODE-1)**: Không trộn lẫn luồng `DEFAULT` và `MATERIAL_RECONCILIATION`.
- **Vietnamese Domain Microcopy (UXR-04 / DOM-LANG-1)**: 100% tiếng Việt nghiệp vụ chuẩn hóa, cấm tiếng Anh kỹ thuật.

---

### Task 1: Chuẩn Hóa Ngôn Ngữ Tiếng Việt Nghiệp Vụ & Loại Bỏ Jargon Lập Trình (Đồng Bộ Mã & Test)
**Tệp tin can thiệp:**
- Sửa: `frontend/src/features/admin/AdminDataPage.tsx`
- Sửa: `frontend/src/features/coordination/MealOrdersPage.tsx`
- Sửa: `frontend/src/features/admin/ApprovalRulesPage.tsx`
- Sửa: `frontend/src/features/chef/ChefDashboardPage.tsx`
- Sửa: `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx`
- Sửa: `frontend/src/features/reports/ReportsPage.tsx`
- Kiểm thử cập nhật: `frontend/src/__tests__/AdminData.test.tsx`, `frontend/src/__tests__/MealOrders.test.tsx`, `frontend/src/__tests__/ApprovalRules.test.tsx`, `frontend/src/__tests__/Chef.test.tsx`, `frontend/src/__tests__/Reports.test.tsx`, `frontend/tests/browser/live-data-display-audit.spec.ts`

**Nội dung thực hiện:**
- [ ] **Bước 1.1**: Cập nhật `AdminDataPage.tsx`: Thay `persisted` thành `danh mục`, thay `authoritative` thành `chính thức`, thay `emptyDescription` thành *"Chưa có dữ liệu danh mục cho phân hệ này."*.
- [ ] **Bước 1.2**: Cập nhật `MealOrdersPage.tsx`: Thay `Món ăn persisted` thành `Món ăn theo thực đơn ca`, thay `emptyDescription` thành *"Chưa có kế hoạch suất ăn được chốt cho khách hàng, ngày và ca đã chọn."*.
- [ ] **Bước 1.3**: Cập nhật `ApprovalRulesPage.tsx`: Thay `{rules.length} quy tắc persisted` thành `{rules.length} quy tắc phê duyệt hiệu lực`, thay `emptyDescription` thành *"Chưa thiết lập quy tắc phê duyệt cho loại chứng từ này."*.
- [ ] **Bước 1.4**: Cập nhật `ChefDashboardPage.tsx`: Thay `emptyDescription` thành *"Chưa có KHSX được duyệt cho ngày, ca và khách hàng đã chọn."*.
- [ ] **Bước 1.5**: Cập nhật `WeeklyMenuPage.tsx`: Thay `desc` thành *"Chưa có thực đơn được duyệt cho khách hàng và tuần đã chọn."*.
- [ ] **Bước 1.6**: Cập nhật `ReportsPage.tsx`: Thay `{pageInfo.totalCount} dòng authoritative` thành `{pageInfo.totalCount} dòng số liệu`.
- [ ] **Bước 1.7**: Cập nhật đồng bộ các test assertions trong `MealOrders.test.tsx`, `Chef.test.tsx`, `Reports.test.tsx`, và `live-data-display-audit.spec.ts`.
- [ ] **Bước 1.8**: Chạy `npm run test:fe:unit` xác nhận 17 files / 116 tests PASS.

---

### Task 2: Hợp Nhất Nút Primary (Rule D7) & Tối Ưu Cột Quy Mô trong Hàng Đợi Phê Duyệt
**Tệp tin can thiệp:**
- Sửa: `frontend/src/features/approvals/ApprovalPage.tsx`
- Kiểm thử: `frontend/src/__tests__/Approvals.test.tsx`

**Nội dung thực hiện:**
- [ ] **Bước 2.1**: Trong `ApprovalPage.tsx`: Xóa nút Primary `Phê duyệt yêu cầu đang chọn` trên `WorkspaceHeader`, giữ duy nhất nút Outline `Làm mới` và các bộ chọn ngữ cảnh. Nút Primary duy nhất là `Phê duyệt hồ sơ` ở chân Panel chi tiết.
- [ ] **Bước 2.2**: Cân đối độ rộng cột trong `ApprovalPage.tsx`: Cột Mã (16%), Tiêu đề (28%), Người gửi (16%), Hạn SLA (14%), Quy mô (16% min-w-[130px]). Đổi tiêu đề cột thành `Quy mô (kg/₫)` để không bị cắt thành `QUY M...`.
- [ ] **Bước 2.3**: Chuẩn hóa đơn vị tính trong danh sách vật tư đính kèm: đổi `Kilogram` thành `kg`.
- [ ] **Bước 2.4**: Cập nhật test `Approvals.test.tsx`: sửa target click phê duyệt từ `Phê duyệt yêu cầu đang chọn` sang `Phê duyệt hồ sơ` tại Drawer chi tiết.
- [ ] **Bước 2.5**: Chạy `npm run test:fe:unit -- Approvals.test.tsx` xác nhận PASS 4/4.

---

### Task 3: Bổ Sung Cột Trạng Thái PO & Mở Rộng Độ Rộng Cột trong Thu Mua
**Tệp tin can thiệp:**
- Sửa: `frontend/src/features/purchasing/PurchasingPage.tsx`
- Kiểm thử: `frontend/src/__tests__/Purchasing.test.tsx`

**Nội dung thực hiện:**
- [ ] **Bước 3.1**: Trong `PurchasingPage.tsx`: Bổ sung cột `status` vào `columns` của Master DataGrid với tiêu đề `Trạng thái`, width `14%`, hiển thị Badge trạng thái tương ứng (`Dự thảo`, `Đã đặt hàng`, `Nhận một phần`, `Đã nhận đủ`, `Đã hủy`).
- [ ] **Bước 3.2**: Cân đối lại tỷ lệ cột: Mã đơn PO (18%), Nhà cung cấp (24%), Ngày đặt (14%), Mặt hàng (14%), Tổng tiền (16%), Trạng thái (14%). Tổng đúng 100%.
- [ ] **Bước 3.3**: Cập nhật `Purchasing.test.tsx` bổ sung assertion kiểm tra cột Trạng thái hiển thị trên lưới Master.
- [ ] **Bước 3.4**: Chạy `npm run test:fe:unit -- Purchasing.test.tsx` xác nhận PASS.

---

### Task 4: Khắc Phục Vỡ Dòng Badge Header & Bổ Sung CTA Thoát Hiểm trong Kho Vận
**Tệp tin can thiệp:**
- Sửa: `frontend/src/features/warehouse/WarehousePage.tsx`
- Kiểm thử: `frontend/src/__tests__/Warehouse.test.tsx`

**Nội dung thực hiện:**
- [ ] **Bước 4.1**: Trong `WarehousePage.tsx`: Thêm `whitespace-nowrap shrink-0` vào Badge `Kho đang hoạt động` tại `WorkspaceHeader`.
- [ ] **Bước 4.2**: Tại view `stock` khi chưa có dữ liệu tồn kho: Thêm 2 nút CTA liên kết nhanh trong empty state: *"Xem phiếu nhập kho"* (`navigate('/warehouse?view=receipts')`) và *"Xem phiếu xuất kho"* (`navigate('/warehouse?view=issues')`).
- [ ] **Bước 4.3**: Chạy `npm run test:fe:unit -- Warehouse.test.tsx` xác nhận PASS.

---

### Task 5: Chuẩn Hóa Tỷ Lệ Cột & Chống Cắt Cụt Badge trong Danh Mục Nguyên Liệu
**Tệp tin can thiệp:**
- Sửa: `frontend/src/features/admin/AdminDataPage.tsx`
- Sửa: `frontend/src/components/workbench/DataGrid.tsx`
- Kiểm thử: `frontend/src/__tests__/AdminData.test.tsx`

**Nội dung thực hiện:**
- [ ] **Bước 5.1**: Trong `DataGrid.tsx`: Nâng `minWidth` mặc định từ `min-w-[720px]` lên `min-w-[800px]` khi không truyền minWidth, và hỗ trợ `minWidth` trong `ColumnDef`.
- [ ] **Bước 5.2**: Trong `AdminDataPage.tsx`: Phân bổ lại tỷ lệ cột nguyên liệu:
  - Mã: 15%
  - Tên: 27%
  - ĐVT: 8%
  - Kho quản lý: 16%
  - Đơn giá: 14%
  - Loại hàng: 10% (min-w: 90px)
  - Trạng thái: 10% (min-w: 105px)
  - Tổng = 100%. Thêm `whitespace-nowrap` cho cell Badge.
- [ ] **Bước 5.3**: Chạy `npm run test:fe:unit -- AdminData.test.tsx` xác nhận PASS.

---

### Task 6: Tái Cấu Trúc Ánh Xạ Lỗi 409 & Chế Độ Vận Hành trong Đối Soát
**Tệp tin can thiệp:**
- Sửa: `frontend/src/components/workbench/StateBoundary.tsx`
- Sửa: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Kiểm thử: `frontend/src/__tests__/Reconciliation.test.tsx`, `frontend/src/__tests__/Primitives.test.tsx`

**Nội dung thực hiện:**
- [ ] **Bước 6.1**: Nâng cấp `StateBoundary.tsx`: Thêm prop `isModeConflict?: boolean` và `modeConflictMessage?: string`. Khi gặp lỗi chế độ vận hành (DOM-MODE-1), hiển thị thông báo chuyên biệt: *"Phân hệ yêu cầu Chế độ Đối soát (MRX)"*, mô tả *"Hệ thống đang chạy ở Chế độ Mặc định. Vui lòng chuyển sang Chế độ MRX trong phần Thiết lập nâng cao."*, kèm nút CTA *"Chuyển chế độ vận hành"*.
- [ ] **Bước 6.2**: Trong `ReconciliationPage.tsx`: Bắt lỗi 409 từ Backend. Nếu thông điệp lỗi chứa từ khóa chế độ đối chiếu/MRX, gán `isModeConflict={true}` thay vì `isConflict={true}` thông thường.
- [ ] **Bước 6.3**: Chạy `npm run test:fe:unit -- Reconciliation.test.tsx Primitives.test.tsx` xác nhận PASS.

---

### Task 7: Tinh Chỉnh Dải 5 Ô Chỉ Số & Nâng Cấp Tương Phản Empty State trên Dashboard
**Tệp tin can thiệp:**
- Sửa: `frontend/src/features/dashboard/DashboardPage.tsx`
- Sửa: `frontend/src/components/workbench/StateBoundary.tsx`
- Kiểm thử: `frontend/src/__tests__/Dashboard.test.tsx`

**Nội dung thực hiện:**
- [ ] **Bước 7.1**: Trong `DashboardPage.tsx`: Tinh chỉnh bố cục từng ô chỉ số: Dòng 1 nhãn danh mục (`text-xs text-slate-500 font-medium truncate`), Dòng 2 số lượng lớn (`text-base font-bold text-slate-900 font-mono`) kèm nhãn phụ tinh giản; loại bỏ các badge nổi gây đè chữ.
- [ ] **Bước 7.2**: Trong `StateBoundary.tsx`: Nâng cấp icon rỗng mặc định từ khối vuông xám nhạt (`#e2e8f0`) lên icon `Inbox` Lucide với màu sắc trung tính (`text-slate-400`), đạt độ tương phản >= 3:1.
- [ ] **Bước 7.3**: Chạy `npm run test:fe:unit -- Dashboard.test.tsx` xác nhận PASS.

---

### Task 8: Chuẩn Hóa Tổng Tỷ Lệ Cột Bảng Về 100% Cho Các Phân Hệ Còn Lại
**Tệp tin can thiệp:**
- Sửa: `frontend/src/features/coordination/MealOrdersPage.tsx` (từ 106% về 100%)
- Sửa: `frontend/src/features/chef/ChefDashboardPage.tsx` (Plans: từ 110% về 100%; Issues: từ 104% về 100%)
- Sửa: `frontend/src/features/admin/ApprovalRulesPage.tsx` (từ 118% về 100%)
- Kiểm thử: `frontend/src/__tests__/MealOrders.test.tsx`, `frontend/src/__tests__/Chef.test.tsx`, `frontend/src/__tests__/ApprovalRules.test.tsx`

**Nội dung thực hiện:**
- [ ] **Bước 8.1**: Cân đối lại tỷ lệ cột trong `MealOrdersPage.tsx`: Phân loại (20%), Thực đơn (20%), Món ăn ca (28%), Dự kiến (11%), Thực tế (11%), Ca (10%). Tổng = 100%.
- [ ] **Bước 8.2**: Cân đối lại tỷ lệ cột trong `ChefDashboardPage.tsx` (Plans): Mã (16%), Món ăn (30%), Ca (14%), Suất (14%), Ngày (13%), Bàn giao (13%). Tổng = 100%.
- [ ] **Bước 8.3**: Cân đối lại tỷ lệ cột trong `ApprovalRulesPage.tsx`: Mã (16%), Tên quy tắc (26%), Loại chứng từ (18%), Tối thiểu (13%), Tối đa (13%), SLA (8%), Trạng thái (6%). Tổng = 100%.
- [ ] **Bước 8.4**: Chạy toàn bộ test component xác nhận bảng co giãn ổn định, không bị méo mó.

---

### Task 9: Kiểm Thử Toàn Diện & Đánh Giá Trực Quan Cuối Cùng
**Lệnh thực hiện:**
- [ ] **Bước 9.1**: Chạy `npm run test:conformance-contracts` & `npm run check:conformance-contracts` (28/28 PASS).
- [ ] **Bước 9.2**: Chạy `npm run test:fe:unit` (toàn bộ 17 test files / 116+ tests PASS).
- [ ] **Bước 9.3**: Chạy `npm run lint:fe` & `npm run build:fe` & `npm run depcruise:fe`.
- [ ] **Bước 9.4**: Xuất báo cáo nghiệm thu hoàn tất theo quy chế `ipc-ui-review` và `ipc-code-review`.
