# Kế Hoạch Triển Khai: Tinh Chỉnh UX Ma Trận Thực Đơn, Mở Rộng Modal & Chuẩn Hóa Responsive Toàn Diện Phân Hệ MRX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Native execution as explicitly requested by user). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giải quyết triệt để 8 hạng mục khiếm khuyết giao diện và trải nghiệm người dùng trong phân hệ MRX: sửa lỗi gãy nhãn "Kỳ thời gian", sắp xếp lô ngày mới nhất lên đầu trên Dashboard, gom ma trận gọn gàng theo 2 ca (xóa hàng số suất ca thừa), mở rộng modal ma trận món lên `maxWidth="4xl"`, chống tràn nút Subbar trên các màn hình nhỏ (< 1440px), xóa thanh 5 badge rác trên `/reconciliation`, và tích hợp nút tải Excel các món thiếu BOM (`TemplateType='missing'`).

**Architecture:** Tái sử dụng triệt để các helper/seam hiện có trong UI Kit (Modal maxWidth, Tabs primitive, TelemetrySubbar, WeeklyScheduleView), bảo đảm nguyên lý thiết kế `impeccable` (Operate mode: không nhồi nhét, typography thoáng đãng, không tràn mép, phân cấp thông tin rõ ràng), và kiểm chứng tự động qua bộ ảnh chụp 5 kích thước responsive với dữ liệu đầy đủ.

**Tech Stack:** React 19, TypeScript, Lucide Icons, Vite, TailwindCSS (semantic tokens), Vitest, Playwright, .NET 9 Web API, MySQL (Sandbox DB `ipc_mrx_e2e_sandbox`).

**Spec:** Bảng phân tích thiết kế 8 hạng mục tại hội thoại trước (`2026-10-29-mrx-ux-matrix-and-responsive-hardening`).

## Global Constraints
- `DOM-MODE-1`: Chế độ vận hành `MATERIAL_RECONCILIATION`. Không làm ảnh hưởng đến luồng `DEFAULT`.
- `No Destructive Operations on Main DB`: Mọi mutation test và dữ liệu thử nghiệm chỉ chạy trên `ipc_mrx_e2e_sandbox` (cổng 5263). CSDL chính `ipcmanagement` luôn sạch sẽ.
- `Tree Architecture Limits`: Giới hạn cứng 0 tệp FE > 600 dòng; các sub-tree branch và modal phải $\le 350$ dòng.
- `Single Styling Authority`: Duy nhất một tệp định kiểu `frontend/src/styles/index.css`. Cấm ad-hoc inline styles hoặc màu tùy tiện.
- `UI Presentation Rules`: Rule D6 (Cỡ chữ $\ge 12$px), Rule D7 (Tối đa 1 primary button trên WorkspaceHeader), Rule T7 (sticky headers), Rule T8 (compact density 36–40px).

## Review Focus
1. **Lỗi gãy nhãn văn bản ("Kỳ thời \n gian:")**: Thẻ span thiếu `whitespace-nowrap shrink-0` khiến chữ bị bẻ dòng xấu xí trên màn hình nhỏ.
2. **Thông tin thừa trong ngoặc ở Tab**: Các tab chứa thông tin rườm rà `(Thứ Hai — Chủ Nhật)`, `(67 mặt hàng)`, `(12 ca)` phải được tinh giản theo tiêu chuẩn `impeccable`.
3. **Phân mảnh 4 khối menu và thừa hàng số suất**: Gom ma trận tuần thành 2 ca chuẩn `MENU CA SÁNG` và `MENU CA CHIỀU`; loại bỏ hàng `Số suất ăn ca` để tăng không gian hiển thị món.
4. **Modal ma trận món bị bóp nghẹt**: Modal kích thước nhỏ gây cắt cụt tên món (`Thịt heo kho sả r...`) và nguyên liệu BOM; mở rộng sang `maxWidth="4xl"` với độ rộng cột thoáng đãng.
5. **Tràn nút Subbar ở responsive nhỏ (< 1440px)**: 4 nút công cụ và 8 tab ngày ở Kho bị đẩy tràn mép màn hình; tổ chức lại gọn gàng với menu dropdown `[Thao tác khác ▾]` và nhãn ngày co giãn thích ứng.

---

## Danh Sách Nhiệm Vụ (Tasks)

### Task 1: Sửa Lỗi Gãy Nhãn "Kỳ Thời Gian" & Sắp Xếp Lô Ngày Mới Nhất Lên Đầu Trên Dashboard

**Files:**
- Modify: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`
- Test: `frontend/src/__tests__/ReconciliationDashboard.test.tsx` (hoặc test tương ứng)

- [ ] **Step 1: Viết test kiểm tra sắp xếp lô ngày giảm dần**
  - Khẳng định danh sách `filteredBatches` luôn được sắp xếp theo `weekStartDate` giảm dần (ví dụ: `21/09/2026` đứng trước `14/09/2026` bất kể thuộc khách hàng nào).

- [ ] **Step 2: Cập nhật `ReconciliationDashboardPage.tsx`**
  - Dòng 234: Đổi `<span className="text-xs font-semibold text-slate-700">Kỳ thời gian:</span>` thành `<span className="text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">Kỳ thời gian:</span>`.
  - Trong `filteredBatches` useMemo: Bổ sung `.sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())`.

- [ ] **Step 3: Chạy test kiểm chứng**
  - Chạy: `npm run test:unit -w frontend -- src/__tests__/FullMrxModernizationSmoke.test.tsx`
  - Kết quả mong đợi: PASS.

---

### Task 2: Xóa Bỏ Thanh Badge 5 Chỉ Số Rác Khỏi Toàn Trang Đối Soát (`/reconciliation`)

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Remove usage: `frontend/src/features/reconciliation/ReconciliationQueueCards.tsx`

- [ ] **Step 1: Cập nhật `ReconciliationPage.tsx`**
  - Xóa bỏ import và render `<ReconciliationQueueCards ... />` (dòng 98).
  - Giải phóng 48px chiều cao cho bảng rà soát chênh lệch.

- [ ] **Step 2: Chạy test `Reconciliation.test.tsx`**
  - Chạy: `npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx`
  - Kết quả mong đợi: PASS 19/19 tests.

---

### Task 3: Tinh Giản Tên Tab & Tái Cấu Trúc Ma Trận Thực Đơn 2 Ca, Xóa Hàng Số Suất Ca Thừa

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchPreviewSection.tsx`
- Modify: `frontend/src/features/weekly-menu/views/WeeklyScheduleView.tsx`

- [ ] **Step 1: Tinh giản tên 3 Tabs trong `MrxBatchPreviewSection.tsx`**
  - Đổi nhãn tab thành ngắn gọn, thanh thoát:
    - Tab 1: `Thực đơn tuần`
    - Tab 2: `Định lượng nguyên liệu`
    - Tab 3: `Kế hoạch theo ca`

- [ ] **Step 2: Gom nhóm ma trận theo 2 ca chuẩn trong `MrxBatchPreviewSection.tsx`**
  - Trong hàm `buildWeeklyMenuDataFromPreview`:
    - Gom `sectionTitle` thành đúng 2 nhóm chính: `MENU CA SÁNG` và `MENU CA CHIỀU`.
    - Phân loại món chuẩn xác: `Món mặn chính 1`, `Món mặn chính 2`, `Món xào`, `Món canh`, `Tráng miệng / Trái cây`.

- [ ] **Step 3: Xóa bỏ hàng `Số suất ăn ca` trong `WeeklyScheduleView.tsx`**
  - Xóa bỏ khối `<tr>` rendered "Số suất ăn ca" ở thead (dòng 95–115).

- [ ] **Step 4: Chạy test `WeeklyMenu.test.tsx`**
  - Chạy: `npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx`
  - Kết quả mong đợi: PASS 18/18 tests.

---

### Task 4: Nâng Cấp Modal Ma Trận Món Ăn Từng Ca Lên `maxWidth="4xl"`, Chống Cắt Xén Chữ

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxShiftDishesModal.tsx`

- [ ] **Step 1: Mở rộng kích thước Modal trong `MrxShiftDishesModal.tsx`**
  - Đặt `maxWidth="4xl"` cho component `Modal`.
  - Phân bổ lại tỷ lệ các cột DataGrid:
    - STT: 6% (center)
    - Phân loại món: 15% (badge)
    - Mã món: 15% (IdentifierText)
    - Tên món ăn trong ca: 34% (font-semibold, không truncate)
    - Định mức BOM cấu thành: 30% (danh sách nguyên liệu hiển thị thoải mái, font rõ ràng)

- [ ] **Step 2: Kiểm tra kích thước tệp**
  - Đảm bảo `MrxShiftDishesModal.tsx` $\le 160$ dòng.

---

### Task 5: Tái Thiết Kế Responsive Chống Tràn Nút Subbar Tại `MrxBatchWorkbench.tsx` và `MrxDailyDateTabsBranch.tsx`

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/branches/MrxDailyDateTabsBranch.tsx`

- [ ] **Step 1: Tối ưu thanh công cụ Subbar trong `MrxBatchWorkbench.tsx`**
  - Giữ lại 2 nút hành động trực tiếp thường dùng nhất: `[Chỉnh sửa lịch tuần]` và `[Món ăn trong lô]`.
  - Trên màn hình nhỏ (< 1440px), gom các nút phụ (`Nhập thực đơn Excel`, `Điều chỉnh nguồn`) vào dropdown gọn gàng `[Thao tác khác ▾]` hoặc hiển thị dạng icon có tooltip để không bao giờ bị cắt cụt.

- [ ] **Step 2: Tối ưu các tab ngày tại Kho trong `MrxDailyDateTabsBranch.tsx`**
  - Trên màn hình < 1440px: Hiển thị nhãn ngày cô đọng `T2`, `T3`, `T4`... thay vì `T2 (14/09)` dài dòng.
  - Đảm bảo khối `Phiên bản: v5 · Mặt hàng ca: X` không bao giờ bị đẩy tràn mép màn hình.

---

### Task 6: Tích Hợp Nút Tải Excel Riêng Cho Các Món Thiếu BOM (`TemplateType='missing'`)

**Files:**
- Modify: `frontend/src/features/admin/DishBomBatchImportModal.tsx`
- Modify: `frontend/src/api/bomApi.ts`

- [ ] **Step 1: Bổ sung phương thức tải file mẫu món thiếu BOM trong `bomApi.ts`**
  - Hỗ trợ gọi `/api/Dishes/bom-template?TemplateType=missing&PriceTier={priceTier}&CustomerId={customerId}`.

- [ ] **Step 2: Cập nhật giao diện `DishBomBatchImportModal.tsx`**
  - Thêm nút bấm chuyên biệt ở footer: **`[Tải file Excel các món thiếu BOM]`** bên cạnh nút `[Tải file mẫu toàn bộ]`.
  - Khi mở từ banner cảnh báo thiếu BOM, nút tải món thiếu BOM được làm nổi bật để người dùng xuất file đúng các món cần bổ sung.

---

### Task 7: Kịch Bản Đo Đạc Responsive 5 Viewports & Verify Sandbox Mutation Có Auto-Cleanup

**Files:**
- Create: `scripts/audit-mrx-matrix-responsive-deep.mjs`

- [ ] **Step 1: Viết script đo đạc Playwright trên 5 kích thước màn hình**
  - `1440x900` (Desktop)
  - `1280x800` (Laptop)
  - `1024x768` (Tablet ngang)
  - `768x1024` (Tablet dọc)
  - `390x844` (Mobile)
  - Kiểm tra khẳng định:
    1. Nhãn "Kỳ thời gian:" hiển thị trọn vẹn, 0 gãy dòng.
    2. Bảng lô Dashboard được sắp xếp ngày mới nhất lên đầu.
    3. Trang `/reconciliation` hoàn toàn sạch bóng thanh 5 badge rác.
    4. Ma trận tuần chia đúng 2 ca (Sáng/Chiều), không còn hàng số suất ăn ca.
    5. Modal ma trận món hiển thị rộng rãi trên `maxWidth="4xl"`, không cụt chữ.
    6. Các nút trên Subbar ở `1280p` và `1024p` không bị tràn hoặc che khuất.
    7. Tải file mẫu món thiếu BOM hoạt động chuẩn xác.
  - Tự động lưu toàn bộ ảnh chụp vào `.artifacts/mrx-deep-responsive-audit/`.

- [ ] **Step 2: Chạy kịch bản và khẳng định PASS 100%**
  - Chạy: `node scripts/audit-mrx-matrix-responsive-deep.mjs`.

---

### Task 8: Toàn Diện Kiểm Tra Chất Lượng & Nghiệm Thu
- [ ] **Step 1: Chạy Pre-commit Quality Gate A–E (`npm run precommit:verify`)**
  - Đạt 100% PASS (0 build errors, 0 growth violations, 252 tests).
- [ ] **Step 2: Chạy Playwright Browser Suite (`npx playwright test`)**
  - Đạt 63/63 tests PASS.
- [ ] **Step 3: Chạy Backend C# Suite (`dotnet test backend/IPCManagement.slnx`)**
  - Đạt 1.370/1.370 tests PASS.
- [ ] **Step 4: Cập nhật `.planning/WORK.md` và `docs/handoff/HANDOFF.md`**
