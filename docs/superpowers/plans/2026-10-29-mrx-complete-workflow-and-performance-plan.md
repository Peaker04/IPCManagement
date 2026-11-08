# Kế Hoạch Triển Khai Toàn Diện: Chuẩn Hóa Vòng Đời MRX, Quản Lý Khách Hàng, Định Mức BOM 3 Mốc Giá & Tối Ưu Hiệu Năng UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai bài bản và triệt để 5 nhóm giải pháp cốt lõi cho phân hệ MRX: (1) Quản lý Khách hàng & Hợp đồng linh hoạt theo tuần (`/admin-data?view=customers`); (2) Mở rộng và nâng cấp `WeeklyMenuImportModal` chuẩn `max-w-5xl`, gắn chặt 3 mốc giá cố định (25k/30k/34k); (3) Chuẩn hóa Định mức BOM 3 mốc giá & 2 tầng phạm vi (Global vs Customer) trong `DishBomEditorModal`; (4) Tối ưu hiệu năng NFR với Searchable Combobox Debounced, triệt tiêu lag dropdown; (5) Bố cục UI 3-Zone phẳng, không che khuất ô ngày, tuân thủ nghiêm ngặt kiến trúc cây sub-tree $\le 350$ dòng và Rule D6, D7, T7, T8.

**Architecture:** 
- Phân rã 4 Tab trên `/admin-data`: `Nguyên liệu` (Tab 1), `Món ăn` (Tab 2), `Định mức BOM` (Tab 3), `Khách hàng & Hợp đồng` (Tab 4) qua các sub-tree branches riêng biệt $\le 300$ dòng.
- Tạo component `SearchableCombobox.tsx` tái sử dụng trong `frontend/src/components/ui/` với debounce 250ms và cửa sổ render giới hạn 15–20 kết quả khớp nhất.
- Nâng cấp `WeeklyMenuImportModal.tsx` lên layout `max-w-5xl`, thay thế ô nhập giá tự do bằng Segmented Buttons 3 mốc giá chuẩn, hiển thị bảng ma trận 7 ngày x các ca.
- Nâng cấp `DishBomEditorModal.tsx` phân tách rõ ràng 3 mốc giá (25k/30k/34k) và 2 phạm vi (`global` / `customer`), đồng bộ với thuật toán `BomSelectionResolver` của C# backend.
- Phân tầng giao diện 3-Zone trên Trạm MRX Batch: Header chỉ giữ Title + Selectors + Nút chính; Subbar giữ các công cụ phụ; màn hình rỗng cung cấp nút CTA và 5 chip tuần có sẵn.

**Tech Stack:** React 18, TypeScript, Tailwind CSS semantic tokens, Lucide icons, Vitest, Playwright, .NET 9 Kestrel API, MySQL Server.

**Spec:** `docs/superpowers/specs/2026-10-28-mrx-schedule-editing-and-bom-management-spec.md` và biên bản brainstorm kiến trúc.

## Global Constraints
- `DOM-MODE-1`: Master data Khách hàng và BOM dùng chung cho cả 2 mode, nhưng toàn bộ workflow và dữ liệu vận hành MRX được cô lập tuyệt đối.
- `TA-1 đến TA-5`: Không mock API trong mã sản phẩm; gọi API backend thật (`/api/coordination/customers/contract`, `/api/Dishes/bom-coverage`, `/api/Dishes/{id}/bom`).
- `Tree Architecture Limits`: Không tệp frontend nào vượt quá 350 dòng (trần cứng 600 dòng).
- `Rule D6`: Cỡ chữ nhỏ nhất $\ge 12$px (`text-xs`).
- `Rule D7`: Tối đa 1 nút chính trên WorkspaceHeader.
- `Rule T7 & T8`: Sticky headers và compact density (36–40px).

## Review Focus
1. Tạo khách hàng mới qua `POST /api/coordination/customers/contract` phải lập tức xuất hiện trong dropdown chọn khách hàng của trạm MRX.
2. `WeeklyMenuImportModal` phải chặn nhập giá tự do, bắt buộc chọn 1 trong 3 mốc giá cố định: 25.000 ₫, 30.000 ₫, 34.000 ₫.
3. `DishBomEditorModal` phải hiển thị đúng dòng định mức tương ứng với mốc giá và phạm vi (dùng chung vs theo khách) đang chọn.
4. Gõ tìm kiếm trong combobox chọn nguyên liệu/món ăn phải phản hồi tức thì (<16ms, 60fps), không gây đơ lag trình duyệt.
5. Header của trạm MRX Batch phải luôn hiển thị đầy đủ ô ngày `VietnameseDateInput`, không bị che khuất ở bất kỳ độ phân giải nào từ 1280p đến 1440p.

---

### Task 1: Xây Dựng Component `SearchableCombobox.tsx` Tối Ưu Hiệu Năng (NFR Performance)

**Files:**
- Create: `frontend/src/components/ui/searchable-combobox.tsx`
- Test: `frontend/src/__tests__/SearchableCombobox.test.tsx`

**Interfaces:**
- Consumes: React 18, Lucide icons, Tailwind tokens
- Produces:
  ```typescript
  export interface ComboboxOption {
    value: string;
    label: string;
    sublabel?: string;
    badge?: string;
  }

  export interface SearchableComboboxProps {
    id?: string;
    'aria-label': string;
    options: ComboboxOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    maxVisibleOptions?: number; // mặc định 15 items
  }
  ```

- [ ] **Step 1: Viết test cho `SearchableCombobox`**
  Assert: render với debounce tìm kiếm, chỉ render tối đa 15 options, bàn phím điều hướng (ArrowDown, ArrowUp, Enter, Escape).
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cài đặt `SearchableCombobox.tsx` (dưới 180 dòng)**
  - Tích hợp ô input tìm kiếm với debounce 200ms.
  - Lọc kết quả theo từ khóa (cả tiếng Việt không dấu và có dấu).
  - Cắt mảng kết quả tối đa `maxVisibleOptions` (mặc định 15) để giữ DOM cực nhẹ.
  - Hỗ trợ đóng mở dropdown, click outside, và phím Escape.
- [ ] **Step 4: Chạy test để xác nhận test GREEN**

---

### Task 2: Quản Lý Khách Hàng & Hợp Đồng Linh Hoạt (`/admin-data?view=customers`)

**Files:**
- Create: `frontend/src/api/customerApi.ts`
- Create: `frontend/src/features/admin/CreateCustomerModal.tsx`
- Create: `frontend/src/features/admin/branches/AdminCustomersBranch.tsx`
- Modify: `frontend/src/features/admin/AdminDataPage.tsx`
- Modify: `frontend/src/routes/routeRegistry.ts` & `workbenchSurfaceRegistry.ts`
- Test: `frontend/src/__tests__/AdminCustomersBranch.test.tsx`

**Interfaces:**
- Consumes: Backend endpoint `GET /api/coordination/customer-contracts` và `POST /api/coordination/customers/contract`
- Produces:
  - Tab `Khách hàng & Hợp đồng` trong `/admin-data`.
  - Danh sách khách hàng kèm trạng thái hợp đồng, mốc giá mặc định, số tuần hoạt động.
  - Modal tạo khách hàng mới: Mã khách (`CustomerCode`), Tên khách (`CustomerName`), Mốc giá mặc định (chọn 25k/30k/34k), ca phục vụ.

- [ ] **Step 1: Cài đặt `frontend/src/api/customerApi.ts` (kết nối API backend thật)**
  `getCustomerContracts()`, `createCustomerContract(payload)`, `updateCustomerContract(id, payload)`.
- [ ] **Step 2: Viết test cho `AdminCustomersBranch` và `CreateCustomerModal`**
- [ ] **Step 3: Chạy test để xác nhận test RED**
- [ ] **Step 4: Cài đặt `CreateCustomerModal.tsx` (dưới 240 dòng)**
  - Form: Mã khách hàng, Tên khách hàng, Segmented Control chọn mốc giá mặc định (**25.000 ₫ · 30.000 ₫ · 34.000 ₫**), chọn ca hoạt động (Ca 1 Sáng / Ca 2 Chiều).
  - Nút `Tạo khách hàng & Kích hoạt hợp đồng`.
- [ ] **Step 5: Cài đặt `AdminCustomersBranch.tsx` (dưới 280 dòng)**
  - Telemetry: Tổng khách hàng, Đang hoạt động, Tạm dừng, Tổng số tuần đã phục vụ.
  - Bảng DataGrid danh sách khách hàng.
  - Nút chính `[+ Thêm khách hàng mới]` mở `CreateCustomerModal`.
- [ ] **Step 6: Tích hợp vào `AdminDataPage.tsx` và đăng ký leaf trong `routeRegistry.ts`**
  Thêm leaf `admin.customers` tại `/admin-data?view=customers`.
- [ ] **Step 7: Chạy test để xác nhận test GREEN**

---

### Task 3: Chuẩn Hóa Định Mức BOM: 3 Mốc Giá Cố Định & 2 Tầng Phạm Vi (Global vs Customer)

**Files:**
- Modify: `frontend/src/features/admin/DishBomEditorModal.tsx`
- Modify: `frontend/src/features/admin/branches/AdminBomBranch.tsx`
- Test: `frontend/src/__tests__/DishBomEditorModal.test.tsx`

**Interfaces:**
- Consumes: `bomApi`, `customerApi`, `SearchableCombobox`
- Produces:
  - 3 Mốc giá cố định: Segmented control **`[25.000 ₫]` · `[30.000 ₫]` · `[34.000 ₫]`**.
  - 2 Tầng phạm vi: Radio button **`Dùng chung toàn hệ thống (Global)`** vs **`Áp dụng riêng cho khách hàng X`**.
  - Dropdown chọn nguyên liệu sử dụng `SearchableCombobox` (không lag DOM).

- [ ] **Step 1: Viết test kiểm tra phân nhóm BOM theo 3 mốc giá và phạm vi khách hàng**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Nâng cấp `DishBomEditorModal.tsx` (kiểm soát dưới 340 dòng)**
  - Bổ sung bộ chọn Mốc giá: 3 nút tab cố định `25.000 ₫`, `30.000 ₫`, `34.000 ₫`.
  - Bổ sung bộ chọn Phạm vi: `Dùng chung (Global)` hoặc chọn khách hàng cụ thể (`AMANN`, `DRAXLMAIER`...).
  - Thay thế dropdown chọn nguyên liệu bằng `SearchableCombobox`.
  - Bảng dòng BOM tự động lọc và hiển thị đúng các nguyên liệu thuộc Mốc giá và Khách hàng đang chọn.
- [ ] **Step 4: Nâng cấp `AdminBomBranch.tsx`**
  - Thêm bộ lọc phụ theo Mốc giá (Tất cả, Tier 25k, Tier 30k, Tier 34k).
- [ ] **Step 5: Chạy test để xác nhận test GREEN**

---

### Task 4: Nâng Cấp `WeeklyMenuImportModal.tsx` Chuẩn `max-w-5xl` & Bảng Phân Tích Trực Quan

**Files:**
- Modify: `frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `WeeklyMenuImportModalProps`, 3 Mốc giá chuẩn (25k/30k/34k)
- Produces: Modal layout rộng rãi `max-w-5xl`, hiển thị đầy đủ thông tin tùy chỉnh, bảng ma trận phân tích ngày/ca, loại bỏ ô nhập giá tự do.

- [ ] **Step 1: Viết test cho `WeeklyMenuImportModal` với layout rộng và chọn 3 mốc giá**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cập nhật `WeeklyMenuImportModal.tsx` (kiểm soát dưới 350 dòng)**
  - Đổi chiều rộng modal thành `max-w-5xl` (hoặc `max-w-6xl` responsive).
  - Thay thế input giá tự do bằng Segmented Buttons: **`[25.000 ₫]` · `[30.000 ₫]` · `[34.000 ₫]`**.
  - Hiển thị thông tin phân tích file: Tên file, Sheet được phát hiện, tổng số dòng quét được, số dòng hợp lệ, số món đã có trong catalog vs món mới.
  - Bảng xem trước ma trận 7 ngày (T2 $\rightarrow$ CN) x các ca (Sáng / Chiều) với nhãn món rõ ràng, không bị co rút chữ.
- [ ] **Step 4: Chạy test để xác nhận test GREEN**

---

### Task 5: Chuẩn Hóa Bố Cục UI 3-Zone & Điều Phối Đa Khách Hàng Trên Trạm MRX Batch

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Modify: `frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx`
- Test: `frontend/src/__tests__/ZeroJitterHeaderGeometry.test.tsx`

**Interfaces:**
- Consumes: 3-Zone Flat Workbench (`WorkspaceHeader`, `TelemetrySubbar`, `StateBoundary`)
- Produces:
  - Header 56px: Title + Dropdown Khách hàng + Ô ngày `VietnameseDateInput` cố định $\ge 170$px + Status Badge + Nút Làm mới + Duy nhất 1 Primary Action (Rule D7).
  - Subbar 44px: Stepper vòng đời + Phiên bản nguồn + Nút công cụ phụ (`Chỉnh sửa lịch tuần`, `Món ăn trong lô`, `Nhập Excel`, `Điều chỉnh nguồn`).
  - Empty state: Nút CTA to bản `[Nhập thực đơn Excel ngay]` + 5 chip tuần có sẵn dữ liệu (`draftSources`).

- [ ] **Step 1: Viết test kiểm tra kích thước Header và không bị che khuất ô ngày ở 1280p**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cập nhật `MrxBatchHeaderBranch.tsx` và `MrxBatchWorkbench.tsx`**
  - Chuyển toàn bộ các nút phụ xuống `TelemetrySubbar.rightActions`.
  - Đảm bảo ô chọn ngày `VietnameseDateInput` luôn có đủ tối thiểu 170px không gian trên Header.
  - Kết nối tính năng chọn nhanh từ các chip tuần trong `draftSources`.
- [ ] **Step 4: Chạy test để xác nhận test GREEN**

---

### Task 6: Kiểm Thử Toàn Diện, Nghiệm Thu E2E Sandbox & Chốt Bằng Chứng

**Files:**
- Modify: `scripts/run-mrx-full-path-lifecycle-test.mjs`
- Modify: `.planning/WORK.md` và `docs/handoff/HANDOFF.md`

- [ ] **Step 1: Cập nhật kịch bản E2E Sandbox**
  - Bổ sung bước kiểm thử tạo khách hàng mới qua `/admin-data?view=customers`.
  - Bổ sung bước kiểm thử cấu hình BOM 3 mốc giá (25k/30k/34k) và phạm vi dùng chung vs theo khách.
  - Bổ sung bước kiểm thử import thực đơn với modal mở rộng `max-w-5xl`.
- [ ] **Step 2: Chạy nghiệm thu E2E Sandbox trên `ipc_mrx_e2e_sandbox`**
  Run: `node scripts/run-mrx-full-path-lifecycle-test.mjs`
  Expected: 100% các giai đoạn đạt PASS.
- [ ] **Step 3: Chạy toàn bộ các cổng kiểm tra chất lượng**
  - `npm run precommit:verify` (Gate A–E: 0 tệp > 600 dòng, build sạch, 100% tests PASS).
  - `npx playwright test` (63/63 tests PASS).
  - `dotnet test backend/IPCManagement.slnx` (1.370/1.370 tests PASS).
- [ ] **Step 4: Cập nhật Task Ledger trong `.planning/WORK.md` và bàn giao `HANDOFF.md`**
