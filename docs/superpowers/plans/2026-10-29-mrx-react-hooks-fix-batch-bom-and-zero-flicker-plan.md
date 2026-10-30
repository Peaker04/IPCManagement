# Kế Hoạch Triển Khai: Khắc Phục React Hooks, Nhập BOM Hàng Loạt & Triệt Tiêu Chớp Nháy Giao Diện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giải quyết dứt điểm 4 vấn đề kỹ thuật và nghiệp vụ: (1) Sửa lỗi vi phạm React Hooks trên `AdminDataPage.tsx`, triệt tiêu 100% hiện tượng nổ trắng màn hình; (2) Xây dựng Modal Nhập BOM Hàng Loạt bằng Excel (`DishBomBatchImportModal.tsx`) kết nối bộ API có sẵn của C# backend theo 3 mốc giá (25k/30k/34k); (3) Triệt tiêu hiện tượng chớp nháy màn hình khi đổi dropdown khách hàng bằng cơ chế SWR Stale-While-Revalidate; (4) Khóa chặt an toàn dữ liệu, tuyệt đối không ghi dữ liệu test vào CSDL chính `ipcmanagement`.

**Architecture:**
- Tách `AdminCatalogBranch.tsx` độc lập cho tab `ingredients`/`dishes`, đưa `AdminDataPage.tsx` thành Page Router sạch không chứa early returns trước hooks.
- Thêm `DishBomBatchImportModal.tsx` ($\le 300$ dòng) tích hợp `/api/Dishes/bom-template`, `bom-import/preview`, `bom-import/commit`.
- Cập nhật `useMrxBatchWorkspace.ts` giữ lại state cũ (`hasExistingData = true`, `isFetching = true`) trong lúc tải khách hàng mới, ngăn `StateBoundary` hủy bỏ DOM bảng.
- Bảo toàn giới hạn kiến trúc cây: 0 tệp FE > 600 dòng, tất cả tệp mới $\le 300$ dòng.

**Tech Stack:** React 18, TypeScript, Tailwind CSS semantic tokens, Lucide icons, Vitest, Playwright, .NET 9 Kestrel API, MySQL Server.

## Global Constraints
- `DOM-MODE-1`: Master data Khách hàng và BOM dùng chung, workflow vận hành MRX được cô lập tuyệt đối.
- `TA-1 đến TA-5`: Không mock API trong mã sản phẩm; gọi API backend C# thật.
- `No Destructive Operations on Main DB`: Mọi kiểm thử ghi dữ liệu chỉ được chạy trên `ipc_mrx_e2e_sandbox`.
- `Rule D6`: Cỡ chữ nhỏ nhất $\ge 12$px (`text-xs`).
- `Rule D7`: Tối đa 1 nút chính trên WorkspaceHeader.

## Review Focus
1. Truy cập `/admin-data?view=bom` và `/admin-data?view=customers` phải mở mượt mà, ZERO lỗi `Rendered fewer hooks than expected`.
2. Đổi khách hàng trên dropdown trạm MRX Batch không được giật chớp layout hoặc xóa trắng màn hình.
3. Modal `DishBomBatchImportModal` phải tải được file mẫu BOM Excel theo đúng mốc giá (25k/30k/34k) và phạm vi đang chọn.
4. Nạp file Excel BOM vào modal phải hiển thị bảng xem trước (số món, số dòng hợp lệ, lỗi nếu có) và commit hàng loạt thành công.
5. CSDL chính `ipcmanagement` hoàn toàn sạch sẽ, không có bất kỳ bản ghi test nào.

---

### Task 1: Tái Cấu Trúc `AdminDataPage.tsx` & Tách `AdminCatalogBranch.tsx` (Triệt Tiêu Lỗi React Hooks)

**Files:**
- Create: `frontend/src/features/admin/branches/AdminCatalogBranch.tsx`
- Modify: `frontend/src/features/admin/AdminDataPage.tsx`
- Test: `frontend/src/__tests__/AdminData.test.tsx`

**Interfaces:**
- Consumes: `adminApi.getIngredients`, `adminApi.getDishes`
- Produces: `AdminCatalogBranchProps { activeView: 'ingredients' | 'dishes' }`

- [ ] **Step 1: Viết test chuyển đổi giữa các view trong `AdminData.test.tsx` mà không gây crash**
- [ ] **Step 2: Chạy test để xác nhận test RED hoặc xác nhận lỗi hook cũ**
- [ ] **Step 3: Cài đặt `frontend/src/features/admin/branches/AdminCatalogBranch.tsx` (dưới 260 dòng)**
  - Chuyển `useWorkbenchQuery` của danh mục nguyên liệu và món ăn vào trong component này.
  - Quản lý state tìm kiếm và phân trang nội bộ của catalog.
  - Render DataGrid nguyên liệu hoặc món ăn.
- [ ] **Step 4: Rút gọn `AdminDataPage.tsx` thành Page Router thuần túy (dưới 100 dòng)**
  - Chỉ gọi `useUrlWorkbenchState`.
  - Render sạch:
    + `view === 'bom'`: `<AdminBomBranch />`
    + `view === 'customers'`: `<AdminCustomersBranch />`
    + `view === 'dishes'`: `<AdminCatalogBranch activeView="dishes" />`
    + mặc định: `<AdminCatalogBranch activeView="ingredients" />`
  - Không còn bất kỳ hook nào bị đặt sau `return` điều kiện!
- [ ] **Step 5: Chạy test để xác nhận test GREEN: `npm run test:fe:unit -- src/__tests__/AdminData.test.tsx`**

---

### Task 2: Cài Đặt API Client Cho Nhập BOM Hàng Loạt Bằng Excel

**Files:**
- Modify: `frontend/src/api/bomApi.ts`
- Test: `frontend/src/__tests__/BomApi.test.ts`

**Interfaces:**
- Consumes: Endpoint `/api/Dishes/bom-template`, `/api/Dishes/bom-import/preview`, `/api/Dishes/bom-import/commit`
- Produces:
  ```typescript
  export interface BomImportPreviewResult {
    canCommit: boolean;
    totalRows: number;
    validRows: number;
    errorCount: number;
    dishesCovered: number;
    issues: Array<{ message: string; severity: string; rowNumber?: number }>;
  }
  ```

- [ ] **Step 1: Viết test cho các hàm import BOM trong `BomApi.test.ts`**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Bổ sung các phương thức vào `bomApi.ts`**
  - `getBomTemplateUrl(priceTier, customerId?, templateType?)`: trả về URL tải mẫu Excel.
  - `previewBomImport(formData)`: gọi `POST /Dishes/bom-import/preview`.
  - `commitBomImport(formData)`: gọi `POST /Dishes/bom-import/commit`.
- [ ] **Step 4: Chạy test để xác nhận test GREEN**

---

### Task 3: Xây Dựng Modal Nhập BOM Hàng Loạt Bằng Excel (`DishBomBatchImportModal.tsx`)

**Files:**
- Create: `frontend/src/features/admin/DishBomBatchImportModal.tsx`
- Modify: `frontend/src/features/admin/branches/AdminBomBranch.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/DishBomBatchImportModal.test.tsx`

**Interfaces:**
- Consumes: `bomApi`, `downloadAuthenticatedFile`
- Produces: Modal layout `max-w-4xl`, chọn 3 tier giá chuẩn (25k/30k/34k), nút tải mẫu, preview phân tích và commit hàng loạt.

- [ ] **Step 1: Viết test component cho `DishBomBatchImportModal`**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cài đặt `DishBomBatchImportModal.tsx` (dưới 280 dòng)**
  - Thanh chọn 3 mốc giá cố định: **`[25.000 ₫]` · `[30.000 ₫]` · `[34.000 ₫]`**.
  - Dropdown phạm vi: `Dùng chung (Global)` hoặc theo khách hàng cụ thể.
  - Nút `[Tải file mẫu Excel BOM]` tự động gắn đúng tier giá và khách hàng.
  - Form upload file `.xlsx` $\rightarrow$ Nút `[Xem trước phân tích]`.
  - Bảng kết quả phân tích: Tổng dòng, Dòng hợp lệ, Số món được phủ BOM, Danh sách cảnh báo/lỗi.
  - Nút `[Xác nhận nhập BOM hàng loạt]`.
- [ ] **Step 4: Tích hợp nút `[Nhập BOM Excel]` vào `AdminBomBranch.tsx` và banner chẩn đoán thiếu BOM ở `MrxBatchWorkbench.tsx`**
- [ ] **Step 5: Chạy test để xác nhận test GREEN**

---

### Task 4: Triệt Tiêu Chớp Nháy Màn Hình Khi Đổi Dropdown Khách Hàng (SWR Data Retention)

**Files:**
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `serverStateCache`, SWR retention
- Produces: Mượt mà 60fps khi đổi khách hàng, giữ nguyên khung bảng cũ trong lúc nạp khách hàng mới, chỉ quay spinner subbar nhẹ.

- [ ] **Step 1: Viết test kiểm tra tính bền vững của DOM table khi đổi khách hàng**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cập nhật `useMrxBatchWorkspace.ts`**
  - Không xóa trắng `preview` về null khi đổi khách hàng nếu đã có dữ liệu cũ; giữ lại dữ liệu cũ với cờ `isFetching = true`.
  - Cập nhật state nhẹ nhàng khi dữ liệu mới về.
- [ ] **Step 4: Chạy test để xác nhận test GREEN**

---

### Task 5: Kiểm Thử Toàn Diện & Nghiệm Thu Tuyệt Đối An Toàn

**Files:**
- Test files: Vitest, Playwright, Backend C#, Sandbox E2E runner

- [ ] **Step 1: Chạy `npm run precommit:verify` (Gate A–E)**
  Xác nhận 0 lỗi React Hooks, 0 tệp > 600 dòng, build Vite thành công, 100% tests PASS.
- [ ] **Step 2: Chạy `npx playwright test`**
  Xác nhận 63/63 browser tests PASS.
- [ ] **Step 3: Chạy nghiệm thu Sandbox DB**
  Xác nhận chạy trên `ipc_mrx_e2e_sandbox`, CSDL chính `ipcmanagement` hoàn toàn sạch sẽ.
