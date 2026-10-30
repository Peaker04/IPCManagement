# MRX Schedule Editing and BOM Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khôi phục toàn diện giao diện Quản lý Định mức BOM, Báo cáo Độ phủ BOM (`/admin-data?view=bom`), Modal chỉnh sửa/bổ sung BOM thiếu (`DishBomEditorModal`), và tích hợp tính năng Chỉnh sửa Lịch tuần & Số suất ca (`WeeklyScheduleEditorModal`) trực tiếp vào Trạm Điều phối MRX (`MrxBatchWorkbench`), tuân thủ 100% kiến trúc cây sub-tree branches $\le 350$ dòng và các quy chuẩn D6, D7, T7, T8.

**Architecture:** 
1. `frontend/src/api/bomApi.ts`: Client API chuẩn gọi các endpoint C# backend có sẵn (`/api/Dishes/bom-coverage`, `/api/Dishes/{id}/bom`).
2. `frontend/src/features/admin/branches/AdminBomBranch.tsx`: Sub-tree branch render tab Định mức & Độ phủ BOM tại `/admin-data?view=bom` với 4 thẻ KPI telemetry, bộ lọc món thiếu BOM, và DataGrid danh mục món.
3. `frontend/src/features/admin/DishBomEditorModal.tsx`: Modal thêm/sửa/xóa dòng định mức BOM của món ăn.
4. `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx` & `MrxBatchHeaderBranch.tsx`: Tích hợp nút và modal `WeeklyScheduleEditorModal`, đồng thời tích hợp nút bổ sung BOM nhanh khi gặp cảnh báo `diagnostics`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS semantic tokens (`index.css`), Lucide icons, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-mrx-schedule-editing-and-bom-management-spec.md`

## Global Constraints
- `DOM-MODE-1`: Master data BOM trong `/admin-data` là dùng chung cho cả `DEFAULT` và `MATERIAL_RECONCILIATION`. Không làm thay đổi luồng của chế độ khác.
- `TA-1 đến TA-5`: Không mock API, gọi trực tiếp API backend thật.
- `Tree Architecture Limits`: Không tệp nào vượt quá 350 dòng (ngưỡng trần cứng là 600 dòng). Tách thành các sub-tree branches chuyên biệt.
- `Rule D6`: Cỡ chữ tối thiểu $\ge 12$px (`text-xs`).
- `Rule D7`: Tối đa 1 nút chính (`variant="default"`) trên Header.
- `Rule T7 & T8`: Frozen sticky headers và compact density (36-40px).

## Review Focus
1. Món thiếu BOM (`bomLineCount === 0`) phải hiển thị huy hiệu cảnh báo vàng/đỏ rõ ràng và cho phép lọc ngay trên thanh công cụ.
2. Thêm dòng BOM trong `DishBomEditorModal` phải gọi API `POST /api/Dishes/{id}/bom` thật và làm mới bảng ngay lập tức.
3. Sửa số suất ca hoặc đổi món trong `WeeklyScheduleEditorModal` tại trạm MRX phải tự động cập nhật bảng phân rã và KHSX.
4. Xử lý món thiếu BOM từ trạm MRX Batch: người dùng bấm bổ sung BOM xong có thể bấm kiểm tra định lượng lại và đạt 0 lỗi.
5. Không làm tăng kích thước bất kỳ tệp frontend nào vượt quá 350 dòng.

---

### Task 1: Khai báo API Client cho BOM và Độ Phủ BOM

**Files:**
- Create: `frontend/src/api/bomApi.ts`
- Modify: `frontend/src/api/index.ts` (nếu có) hoặc xuất khẩu trực tiếp

**Interfaces:**
- Consumes: `apiClient` từ `frontend/src/api/client.ts`
- Produces:
  ```typescript
  export interface BomCoverageDish {
    dishId: string;
    dishCode: string;
    dishName: string;
    dishType?: string;
    dishGroup?: string;
    bomLineCount: number;
    hasBom: boolean;
    status: string;
    statusLabel: string;
  }

  export interface BomCoverageReport {
    generatedAt: string;
    totalDishes: number;
    completeDishes: number;
    missingBomDishes: number;
    totalBomLines: number;
    dishes: BomCoverageDish[];
  }

  export interface DishBomLine {
    bomId: string;
    dishId: string;
    dishCode: string;
    dishName: string;
    ingredientId: string;
    ingredientCode: string;
    ingredientName: string;
    unitId: string;
    unitCode: string;
    unitName: string;
    grossQtyPerServing: number;
    wasteRatePercent: number;
    referencePrice: number;
    bomStatus: string;
  }

  export interface CreateBomLinePayload {
    ingredientId: string;
    grossQtyPerServing: number;
    unitId: string;
    priceTierAmount?: number;
  }
  ```

- [ ] **Step 1: Viết test kiểm tra hợp đồng API trong `frontend/src/__tests__/BomApi.test.ts`**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cài đặt `frontend/src/api/bomApi.ts`**
  Cài đặt các hàm `getBomCoverage()`, `getDishBomLines(dishId)`, `addDishBomLine(dishId, payload)`, `updateDishBomLine(dishId, bomId, payload)`, `closeDishBomLine(dishId, bomId)`.
- [ ] **Step 4: Chạy test để xác nhận test GREEN**
- [ ] **Step 5: Kiểm tra typecheck: `npm run build`**

---

### Task 2: Xây dựng Modal Chỉnh sửa & Bổ sung BOM (`DishBomEditorModal.tsx`)

**Files:**
- Create: `frontend/src/features/admin/DishBomEditorModal.tsx`

**Interfaces:**
- Consumes: `bomApi`, `adminApi`
- Produces:
  ```typescript
  export interface DishBomEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    dish: { dishId: string; dishCode: string; dishName: string } | null;
    onSaved?: () => void;
  }
  ```

- [ ] **Step 1: Viết test component cho `DishBomEditorModal`**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cài đặt `DishBomEditorModal.tsx` (dưới 280 dòng)**
  - Tải danh sách dòng BOM của món qua `bomApi.getDishBomLines(dishId)`.
  - Hiển thị bảng nguyên liệu cấu thành món: Mã NL, Tên NL, ĐVT, Định mức/suất, Đơn giá tham chiếu, Nút xóa dòng.
  - Form thêm nguyên liệu vào BOM: Combobox chọn nguyên liệu từ catalog, Input số lượng định mức/suất, Nút `Thêm vào BOM` (`POST /api/Dishes/{id}/bom`).
  - Nút Đóng.
- [ ] **Step 4: Chạy test để xác nhận test GREEN**

---

### Task 3: Xây dựng Sub-tree Branch Quản trị BOM (`AdminBomBranch.tsx`) & Tích hợp vào `AdminDataPage.tsx`

**Files:**
- Create: `frontend/src/features/admin/branches/AdminBomBranch.tsx`
- Modify: `frontend/src/features/admin/AdminDataPage.tsx`
- Modify: `frontend/src/routes/routeRegistry.ts` (nếu cần bổ sung nav tab)

**Interfaces:**
- Consumes: `bomApi`, `DishBomEditorModal`
- Produces: Sub-tree branch quản trị BOM định mức với 4 KPI telemetry, bộ lọc món thiếu BOM, bảng DataGrid, nút `Chỉnh sửa BOM`.

- [ ] **Step 1: Viết test cho `AdminBomBranch`**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cài đặt `AdminBomBranch.tsx` (dưới 300 dòng)**
  - Tải dữ liệu độ phủ qua `bomApi.getBomCoverage()`.
  - Render thanh Telemetry 4 chỉ số: Tổng số món, Đã đủ BOM, Món thiếu BOM (amber badge), Tổng dòng BOM.
  - Render bộ lọc nhanh: `Tất cả món`, `Món thiếu BOM (Cần bổ sung)`, `Đã đủ định mức`.
  - Render DataGrid với sticky headers (Rule T7) và compact density (Rule T8).
  - Tích hợp `DishBomEditorModal` khi bấm nút `Chỉnh sửa BOM`.
- [ ] **Step 4: Tích hợp vào `AdminDataPage.tsx`**
  - Thêm tab `bom` (`Định mức BOM`) vào bộ chọn tab của trang.
  - Khi `activeView === 'bom'`, render `<AdminBomBranch />`.
- [ ] **Step 5: Chạy test để xác nhận test GREEN**

---

### Task 4: Tích hợp "Chỉnh sửa Lịch tuần & Số suất" vào Trạm Điều phối MRX (`MrxBatchWorkbench.tsx`)

**Files:**
- Modify: `frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`

**Interfaces:**
- Consumes: `WeeklyScheduleEditorModal`
- Produces: Nút `Chỉnh sửa lịch tuần` trên Header trạm MRX, cho phép sửa số suất và đổi món trong chế độ MRX.

- [ ] **Step 1: Viết test kiểm tra sự xuất hiện và mở modal `WeeklyScheduleEditorModal` từ `MrxBatchWorkbench`**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cập nhật `MrxBatchHeaderBranch.tsx`**
  - Khi có thực đơn tuần (`source` khác null), hiển thị nút phụ `Chỉnh sửa lịch tuần` (`variant="outline"`), tuân thủ Rule D7 (chỉ có 1 nút primary).
- [ ] **Step 4: Cập nhật `MrxBatchWorkbench.tsx`**
  - Quản lý state `isEditorModalOpen`.
  - Mount `WeeklyScheduleEditorModal`.
  - Khi `onSaveSuccess`, gọi `loadSource(true)` làm mới toàn bộ nguồn và KHSX.
- [ ] **Step 5: Chạy test để xác nhận test GREEN**

---

### Task 5: Xử lý Nhanh Món Thiếu BOM trực tiếp tại Trạm MRX Batch & Món ăn trong Lô

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Modify: `frontend/src/components/workbench/MrxBatchDishesModal.tsx`

**Interfaces:**
- Consumes: `DishBomEditorModal`
- Produces: Nút bổ sung BOM trực tiếp khi có cảnh báo thiếu BOM tại trạm MRX và trong modal món ăn đông cứng.

- [ ] **Step 1: Viết test cho luồng mở `DishBomEditorModal` từ chẩn đoán MRX Batch**
- [ ] **Step 2: Chạy test để xác nhận test RED**
- [ ] **Step 3: Cập nhật `MrxBatchWorkbench.tsx`**
  - Trong hộp cảnh báo `preview.diagnostics`, khi có cảnh báo món thiếu BOM, hiển thị nút `[Bổ sung BOM]` mở `DishBomEditorModal`.
- [ ] **Step 4: Cập nhật `MrxBatchDishesModal.tsx`**
  - Trong phần chi tiết món ăn đông cứng, hiển thị nút `[Chỉnh sửa BOM]` mở `DishBomEditorModal` để xem và chỉnh sửa nguyên liệu cấu thành.
- [ ] **Step 5: Chạy test để xác nhận test GREEN**

---

### Task 6: Kiểm chứng Toàn diện & Regression Gate

**Files:**
- Modify: `scripts/run-mrx-full-path-lifecycle-test.mjs`
- Output: Báo cáo kiểm thử cập nhật

- [ ] **Step 1: Chạy `npm run precommit:verify` (Gate A–E)**
  Xác nhận 0 tệp > 600 dòng, typecheck PASS, unit tests 100% PASS.
- [ ] **Step 2: Chạy `npx playwright test`**
  Xác nhận 63/63 browser tests PASS.
- [ ] **Step 3: Chạy script E2E Lifecycle Matrix trên Sandbox DB**
  Run: `node scripts/run-mrx-full-path-lifecycle-test.mjs`
  Xác nhận luồng sửa thực đơn, chỉnh BOM thiếu và xuất kho đối soát hoàn tất 100%.
