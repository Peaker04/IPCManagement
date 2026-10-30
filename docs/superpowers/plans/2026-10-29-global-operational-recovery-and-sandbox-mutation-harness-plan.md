# Kế Hoạch Triển Khai: Khung Phục Hồi Vận Hành Toàn Diện (Global Operational Recovery) & Harness Kiểm Thử Mutation Cô Lập Worst-Case Trên 14 Routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Native execution as explicitly requested by user). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng khung phục hồi vận hành dùng chung (Zero Dead-Ends, Form Mutation State Preservation, thanh lọc icon rác) trên toàn bộ 14 routes và bộ harness kiểm thử kịch bản xấu nhất (Worst-Case Coverage) kèm tự động dọn dẹp sạch sẽ (Auto-cleanup) trên Sandbox Database.

**Architecture:** Áp dụng Hook-Driven Resilience Protocol (`useOperationalRecovery` & `executeSafeMutation`), mở rộng `StateBoundary` để cung cấp các Action giải cứu (`onResetFilters`, `onCreatePrerequisite`, `onRetry`), thay thế triệt để icon `Inbox` bằng icons nghiệp vụ, và xây dựng kịch bản kiểm thử worst-case tự động dọn dẹp `scripts/run-universal-worst-case-lifecycle-harness.mjs` chạy độc quyền trên Sandbox cổng 5263.

**Tech Stack:** React 19, TypeScript, Lucide Icons, Vite, TailwindCSS (semantic tokens), Vitest, Playwright, .NET 9 Web API, MySQL (Sandbox DB `ipc_mrx_e2e_sandbox`).

**Spec:** `docs/superpowers/specs/2026-10-29-global-operational-recovery-and-sandbox-mutation-harness-spec.md`

## Global Constraints
- `DOM-MODE-1`: Cách ly tuyệt đối chế độ vận hành `DEFAULT != MATERIAL_RECONCILIATION`. Không trộn lẫn workflow, queries hoặc audit logs.
- `No Destructive Operations on Main DB`: Tuyệt đối không xóa, sửa, hoặc tạo bản ghi rác trên CSDL chính `ipcmanagement`. Mọi tác vụ mutation test chỉ chạy trên `ipc_mrx_e2e_sandbox` (cổng 5263).
- `TA-1 đến TA-5`: Không dùng fake API, mock DTO giả trong production paths. Kết nối trực tiếp với backend C# thật.
- `Tree Architecture Limits`: Giới hạn cứng 0 tệp FE > 600 dòng; các sub-tree branch và modal phải $\le 350$ dòng.
- `Single Styling Authority`: Duy nhất một tệp định kiểu `frontend/src/styles/index.css`. Cấm ad-hoc inline styles hoặc màu tùy tiện.
- `UI Presentation Rules`: Rule D6 (Cỡ chữ $\ge 12$px), Rule D7 (Tối đa 1 primary button trên WorkspaceHeader), Rule T7 (sticky headers), Rule T8 (compact density 36–40px).

## Review Focus
1. **Mất dữ liệu form khi submit thất bại**: Người dùng điền lý do từ chối hoặc số lượng điều chỉnh, API trả về 400 hoặc 500; form phải giữ nguyên 100% dữ liệu đã nhập, không tự động đóng hoặc xóa trắng form.
2. **Xung đột khóa đồng thời (Optimistic Concurrency 409)**: Hai người dùng cùng thao tác trên 1 bản ghi; người thứ hai phải nhận được thông báo xung đột rõ ràng kèm nút nạp lại bản mới nhất mà không mất nội dung vừa gõ.
3. **Ngõ cụt khi tìm kiếm hoặc lọc không có kết quả (`filter-empty`)**: Bảng rỗng không được để người dùng kẹt mà bắt buộc phải có nút `[Xóa bộ lọc (Reset Filters)]` đưa bộ lọc về mặc định ngay lập tức.
4. **Ngõ cụt khi thiếu dữ liệu tiên quyết (`prerequisite-blocked`)**: Màn hình chưa có khách hàng, chưa có thực đơn hoặc chưa có nguyên liệu phải có nút dẫn đường trực tiếp sang trang tạo dữ liệu tiên quyết tương ứng.
5. **Rò rỉ dữ liệu test sau khi chạy kiểm thử**: Kịch bản worst-case harness phải có bước Teardown Assertion khẳng định 100% các bản ghi test được dọn dẹp sạch sẽ (0 bản ghi rác còn tồn đọng).

---

## Danh Sách Nhiệm Vụ (Tasks)

### Task 1: Xây Dựng Hook Phục Hồi Vận Hành `useOperationalRecovery.ts` & Safe Mutation Helper

**Files:**
- Create: `frontend/src/hooks/useOperationalRecovery.ts`
- Create: `frontend/src/__tests__/useOperationalRecovery.test.tsx`

**Interfaces:**
- Consumes: `serverStateCache` từ `frontend/src/store/serverStateCache.ts`, `ApiError` từ `frontend/src/api/client.ts`, `formatters` từ `frontend/src/utils/formatters.ts`.
- Produces: `useOperationalRecovery<TData, TFilter>()` và helper `executeSafeMutation<TPayload, TResult>()`.

- [ ] **Step 1: Viết test kiểm thử các kịch bản của `useOperationalRecovery`**
  - Test 1: Khởi tạo với SWR cache hit, tự động nạp cache ngay trong 0ms.
  - Test 2: Tự động tính toán `emptyScenario = 'filter-empty'` khi dữ liệu rỗng và bộ lọc khác mặc định, cung cấp hàm `handleResetFilters`.
  - Test 3: `executeSafeMutation` giữ nguyên payload/dữ liệu form khi mutation thất bại (không reset), kích hoạt `mutationError` và nhận diện lỗi 409 Concurrency.

- [ ] **Step 2: Chạy test để xác nhận test fail do chưa có code**
  - Chạy: `npx vitest run frontend/src/__tests__/useOperationalRecovery.test.tsx`
  - Kết quả mong đợi: FAIL với "Cannot find module '...useOperationalRecovery'".

- [ ] **Step 3: Triển khai `useOperationalRecovery.ts`**
  - Cung cấp state: `data`, `isLoading`, `isFetching`, `error`, `mutationError`, `isSubmitting`.
  - Cung cấp actions: `handleResetFilters`, `handleRetry`, `executeSafeMutation`.
  - Tự động map HTTP error status qua `formatters.ts` sang tiếng Việt con người.

- [ ] **Step 4: Chạy lại test để xác nhận PASS**
  - Chạy: `npx vitest run frontend/src/__tests__/useOperationalRecovery.test.tsx`
  - Kết quả mong đợi: PASS 100%.

- [ ] **Step 5: Kiểm tra kích thước tệp và commit**
  - Xác nhận file $\le 250$ dòng.

---

### Task 2: Mở Rộng `StateBoundary.tsx` Cho Zero Dead-Ends & Thanh Lọc Contextual Icons

**Files:**
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Modify: `frontend/src/__tests__/Primitives.test.tsx`

**Interfaces:**
- Consumes: `useOperationalRecovery` props (`onResetFilters`, `prerequisiteRoute`, `prerequisiteLabel`, `onCreatePrerequisite`).
- Produces: `StateBoundaryProps` hỗ trợ `onResetFilters`, `onNavigatePrerequisite`, và các contextual icons nghiệp vụ (`FileCheck`, `Truck`, `FileSpreadsheet`, `UtensilsCrossed`).

- [ ] **Step 1: Viết test mở rộng trong `Primitives.test.tsx`**
  - Test render `StateBoundary` với `emptyScenario="filter-empty"`: kiểm tra nút "Xóa bộ lọc (Reset Filters)" hiển thị và gọi `onResetFilters` khi click.
  - Test render `StateBoundary` với `emptyScenario="prerequisite-blocked"`: kiểm tra nút điều hướng tiên quyết hiển thị.

- [ ] **Step 2: Chạy test để xác nhận fail**
  - Chạy: `npx vitest run frontend/src/__tests__/Primitives.test.tsx`

- [ ] **Step 3: Cập nhật `StateBoundary.tsx`**
  - Thêm props `onResetFilters?: () => void`, `prerequisiteRoute?: string`, `prerequisiteLabel?: string`, `onCreatePrerequisite?: () => void`.
  - Trong nhánh `filter-empty`: render nút `Button variant="outline"` gọi `onResetFilters`.
  - Trong nhánh `prerequisite-blocked`: render nút `Button variant="primary"` điều hướng tới `prerequisiteRoute` hoặc gọi `onCreatePrerequisite`.
  - Bổ sung contextual icons: `FileCheck`, `Truck`, `FileSpreadsheet`, `UtensilsCrossed`, triệt để không fallback về `Inbox`.

- [ ] **Step 4: Chạy lại test để xác nhận PASS**
  - Chạy: `npx vitest run frontend/src/__tests__/Primitives.test.tsx`
  - Kết quả: PASS 100%.

---

### Task 3: Chuẩn Hóa Phân Hệ Điều Phối & Duyệt (`/meal-orders` & `/approvals`)

**Files:**
- Modify: `frontend/src/features/coordination/MealOrdersPage.tsx`
- Modify: `frontend/src/features/approvals/ApprovalPage.tsx`
- Test: `frontend/src/__tests__/CoordinationMealOrders.test.tsx` (hoặc test tương ứng)

**Interfaces:**
- Consumes: `useOperationalRecovery`, `StateBoundary` 2.0.
- Produces: Trang `/meal-orders` và `/approvals` không có ngõ cụt, không dùng icon `Inbox`, bảo toàn lý do từ chối khi submit lỗi.

- [ ] **Step 1: Viết test kiểm tra bảo toàn lý do từ chối trong `ApprovalPage`**
  - Giả lập submit từ chối gặp lỗi 500 hoặc 409 $\rightarrow$ khẳng định modal không đóng, ô nhập `decisionReason` giữ nguyên chuỗi người dùng đã nhập, hiển thị thông báo lỗi thân thiện.

- [ ] **Step 2: Cập nhật `ApprovalPage.tsx`**
  - Xóa bỏ import `Inbox` từ `lucide-react`, thay bằng `FileCheck`.
  - Sử dụng `executeSafeMutation` trong `handleExecuteDecision`: khi API ném lỗi, không xóa `decisionReason`, không đóng `confirmAction` modal mà hiển thị `InlineBanner variant="danger"` ngay trong modal để người dùng sửa hoặc thử lại.
  - Khi danh sách duyệt rỗng do bộ lọc loại hồ sơ: hiển thị `emptyScenario="filter-empty"` với nút `[Xem tất cả hồ sơ]` (reset filter sang `ALL`).

- [ ] **Step 3: Cập nhật `MealOrdersPage.tsx`**
  - Khi chưa có khách hàng: hiển thị `emptyScenario="prerequisite-blocked"` với nút `[Đi đến quản lý Khách hàng & Hợp đồng]` chuyển sang `/admin-data?view=customers`.
  - Khi ca ăn chưa có đơn đặt: hiển thị `emptyScenario="filter-empty"` với nút chuyển sang ca khác hoặc reset bộ lọc.
  - Sử dụng `executeSafeMutation` trong `handleLock`: khi chốt đơn lỗi, giữ nguyên dữ liệu trên giao diện và hiển thị lỗi cụ thể.

- [ ] **Step 4: Chạy test xác nhận PASS**
  - Chạy: `npm run test:fast` hoặc vitest trên các file liên quan.

---

### Task 4: Chuẩn Hóa Phân Hệ Thu Mua, Kho & Bếp (`/purchasing`, `/warehouse`, `/chef`)

**Files:**
- Modify: `frontend/src/features/purchasing/PurchasingPage.tsx`
- Modify: `frontend/src/features/warehouse/WarehousePage.tsx`
- Modify: `frontend/src/features/chef/ChefDashboardPage.tsx`

**Interfaces:**
- Consumes: `StateBoundary`, `useOperationalRecovery`.
- Produces: Trang `/purchasing`, `/warehouse`, `/chef` (nhánh DEFAULT) zero dead-ends, zero icon `Inbox`.

- [ ] **Step 1: Cập nhật `PurchasingPage.tsx`**
  - Xóa bỏ import `Inbox` từ `lucide-react`, thay bằng `Truck` và `ShoppingCart`.
  - Khi bộ lọc NCC hoặc trạng thái PO không có kết quả: hiển thị `emptyScenario="filter-empty"` với nút `[Xóa bộ lọc (Xem tất cả PO)]` đặt lại `selectedSupplierId = 'ALL'` và `statusFilter = 'ALL'`.
  - Trong modal hủy PO: nếu gọi `cancelPurchaseOrder` thất bại, không đóng modal, giữ nguyên form và hiển thị cảnh báo đỏ thân thiện.

- [ ] **Step 2: Cập nhật `WarehousePage.tsx` (nhánh DEFAULT: issues, receipts, stock)**
  - Tích hợp `StateBoundary` với `onResetFilters` trên các DataGrid khi tìm kiếm mã phiếu hoặc mã nguyên liệu không có kết quả.
  - Khi chưa có phiếu xuất/nhập: hiển thị nút CTA `[Tạo phiếu xuất kho mới]` hoặc `[Tạo phiếu nhập kho mới]`.

- [ ] **Step 3: Cập nhật `ChefDashboardPage.tsx` (nhánh DEFAULT: plans, issues)**
  - Khi ngày được chọn không có kế hoạch sản xuất: hiển thị `emptyScenario="filter-empty"` với nút chuyển về ngày hôm nay (`todayInBusinessTimezone()`) hoặc nút chuyển sang trang Lập kế hoạch thực đơn (`/weekly-menu`).

- [ ] **Step 4: Chạy test kiểm chứng**
  - Chạy vitest trên các phân hệ liên quan để xác nhận không có hồi quy.

---

### Task 5: Chuẩn Hóa Báo Cáo, Quản Trị Dữ Liệu & Thiết Lập (`/reports`, `/admin-data`, `/settings/approval-rules`)

**Files:**
- Modify: `frontend/src/features/reports/ReportsPage.tsx`
- Modify: `frontend/src/features/admin/branches/AdminCatalogBranch.tsx`
- Modify: `frontend/src/features/admin/branches/AdminBomBranch.tsx`
- Modify: `frontend/src/features/admin/branches/AdminCustomersBranch.tsx`
- Modify: `frontend/src/features/admin/ApprovalRulesPage.tsx`

**Interfaces:**
- Consumes: `StateBoundary`, `SearchableCombobox`.
- Produces: Zero dead-ends trên các trang báo cáo và danh mục master data.

- [ ] **Step 1: Cập nhật `ReportsPage.tsx`**
  - Thay icon generic bằng `FileSpreadsheet` và `TrendingUp`.
  - Khi chọn khoảng ngày hoặc nguyên liệu không có số liệu: hiển thị `emptyScenario="filter-empty"` kèm nút `[Đặt lại bộ lọc báo cáo]` (chuyển về 30 ngày gần nhất, xóa mã lọc).

- [ ] **Step 2: Cập nhật `AdminCatalogBranch.tsx`, `AdminBomBranch.tsx`, `AdminCustomersBranch.tsx`**
  - Khi tìm kiếm theo tên/mã nguyên liệu, món ăn, BOM hoặc khách hàng trả về 0 dòng: DataGrid hiển thị `emptyScenario="filter-empty"` kèm nút `[Xóa từ khóa tìm kiếm]`.
  - Trong `AdminCustomersBranch.tsx`: khi chưa có khách hàng nào, hiển thị CTA `[Tạo khách hàng mới]` mở `CreateCustomerModal`.
  - Trong `AdminBomBranch.tsx`: khi bộ lọc "Món thiếu BOM" trả về 0 dòng (đã đủ 100%), hiển thị huy hiệu xanh chúc mừng và nút `[Xem tất cả món]`.

- [ ] **Step 3: Cập nhật `ApprovalRulesPage.tsx`**
  - Khi danh sách quy tắc rỗng: hiển thị `emptyScenario="empty-first-use"` kèm nút CTA `[Thiết lập quy tắc phê duyệt đầu tiên]`.

- [ ] **Step 4: Chạy test suite `AdminData.test.tsx` và `AdminBomBranch.test.tsx`**
  - Chạy: `npx vitest run frontend/src/__tests__/AdminData.test.tsx frontend/src/__tests__/AdminBomBranch.test.tsx`
  - Kết quả: PASS 100%.

---

### Task 6: Xây Dựng Harness Kiểm Thử Mutation Cô Lập Worst-Case Kèm Tự Động Cleanup

**Files:**
- Create: `scripts/run-universal-worst-case-lifecycle-harness.mjs`

**Interfaces:**
- Consumes: Backend API trên cổng Sandbox `http://127.0.0.1:5263` (`ipc_mrx_e2e_sandbox`).
- Produces: Báo cáo `.artifacts/worst-case-harness/WORST-CASE-REPORT.json` khẳng định 5 worst-case phases đều PASS và số lượng bản ghi rác sau cleanup là `0`.

- [ ] **Step 1: Viết khung kịch bản `run-universal-worst-case-lifecycle-harness.mjs`**
  - Khởi tạo kết nối tới cổng Sandbox 5263. Khẳng định DB sandbox biệt lập với CSDL chính.
  - Định nghĩa 5 Phases:
    - Phase 1 (Zero Data & Prerequisite Tolerance): Kiểm tra toàn bộ 14 routes khi DB rỗng không ném 500, trả về DTO rỗng có cấu trúc.
    - Phase 2 (Negative & Boundary Values): Gửi số lượng âm (`-10`), đơn giá âm (`-50000`), chuỗi ký tự rác $\rightarrow$ khẳng định BE trả về 400 Bad Request, không bao giờ 500.
    - Phase 3 (Optimistic Concurrency 409 Lock): Giả lập 2 request cùng sửa 1 bản ghi với cùng version gốc $\rightarrow$ request thứ 2 phải nhận HTTP 409 Conflict.
    - Phase 4 (Form Preservation on Rejection): Giả lập thao tác từ chối hoặc hủy với payload lỗi $\rightarrow$ kiểm tra API phản hồi lỗi và client giữ nguyên context.
    - Phase 5 (Auto-Cleanup & Teardown Verification): Gọi hàm xóa dọn toàn bộ các bản ghi test vừa sinh ra, truy vấn đếm trực tiếp trên database $\rightarrow$ khẳng định số bản ghi rác = 0.

- [ ] **Step 2: Chạy kịch bản trên môi trường sandbox**
  - Chạy: `node scripts/run-universal-worst-case-lifecycle-harness.mjs`
  - Kiểm tra toàn bộ 5 phases đều đạt PASS.

---

### Task 7: Toàn Diện Xác Minh & Nghiệm Thu Chất Lượng (Full Verification & Sign-off)

- [ ] **Step 1: Chạy Pre-commit Quality Gate A–E**
  - Chạy: `npm run precommit:verify`
  - Khẳng định 5 gates đều PASS: Export đầy đủ, không forbidden patterns, 0 file > 600 dòng, TypeScript 0 lỗi, 100% Vitest tests PASS.

- [ ] **Step 2: Chạy Playwright Browser Matrix**
  - Chạy: `npx playwright test`
  - Khẳng định 63/63 tests PASS trên Chromium, 0 lỗi D6 (<12px), 0 lỗi D7.

- [ ] **Step 3: Chạy Backend .NET 9 Tests**
  - Chạy: `dotnet test backend/IPCManagement.slnx`
  - Khẳng định 1.370/1.370 tests PASS.

- [ ] **Step 4: Cập nhật `.planning/WORK.md` và `docs/handoff/HANDOFF.md`**
  - Ghi nhận trạng thái hoàn thành toàn diện cho toàn bộ 14 routes.
