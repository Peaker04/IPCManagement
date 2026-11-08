# Catalog/Admin Capability Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Catalog and Admin capability conformance slice by disaggregating grouped write capabilities into operation-grain capabilities, aligning `adminApi.ts` and `AdminDataPage.tsx` with authoritative C# `PagedResponseDto<T>` and entity DTO contracts, eliminating synthetic fields (`categoryName`), and enforcing strict read-only protection until authoritative `UnitId` selection and concurrency mechanisms exist in Backend.

**Architecture:** Backend controllers (`IngredientsController`, `DishesController`, `AdminEmployeesController`, `ApprovalRulesController`) already implement authoritative DTOs, soft-delete semantics, and paged query contracts. This plan reconciles the machine inventory (`docs/conformance-contracts.json`) so that every Backend HTTP action maps 1:1 to an operation-grain capability, repairs the Frontend API layer to preserve server pagination metadata, and refactors `AdminDataPage` into view-isolated queries with server pagination and zero unauthorized write surfaces.

**Tech Stack:** TypeScript 5, React 18, React Router v6, Vitest 4, Testing Library, Node.js test runner, Tailwind CSS (semantic tokens only).

**Spec:** `docs/superpowers/specs/2026-10-18-catalog-admin-conformance-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `FR-CAT`: Quản trị danh mục nguyên liệu, món ăn, định mức BOM gốc, quy cách.
  - `FR-ADMIN`: Quản trị nhân viên, phân quyền, quy tắc phê duyệt, cấu hình hệ thống.
  - `BR-GLOBAL-02`: Định mức BOM gốc bất biến.
  - `DOM-MODE-1`: Danh mục dữ liệu nền dùng chung (`SHARED_MASTER_DATA`) tuyệt đối không hòa trộn luồng ghi hoặc logic tồn kho với chế độ đối soát `MATERIAL_RECONCILIATION`.
  - `NFR-UI-01` (Table Scalability): Bắt buộc phân trang server cho tập dữ liệu >20 dòng.
  - `NFR-UI-02` (Triple-Layer RBAC): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard`).
  - `NFR-UI-03` (Formatting Primitives): `<Num format="currency">`, `<IdentifierText>`, `dd/MM/yyyy`.
  - `NFR-UI-04` (WCAG 2.2 AA Accessibility): Tỷ lệ tương phản >= 4.5:1, phím Tab/Enter/Esc, outline focus rõ nét.
  - `NFR-UI-05` (Motion & CLS): Hiệu ứng <= 150ms, `prefers-reduced-motion`, CLS <= 0.1.
  - `UXR-01` (3-Zone Workbench): Header 56px, Telemetry 44px, Data Area.
  - `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt nghiệp vụ chuẩn hóa.
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - Route canonical: `/admin-data` với 2 URL-owned leaf views theo chuẩn `N6`: `?view=ingredients` (mặc định) và `?view=dishes`.
  - Không tạo tabs nội bộ độc lập ngoài URL query; router URL làm chủ trạng thái xem.
  - `QueryViewBoundary` và `StateBoundary` làm chủ 6 trạng thái UI: `loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`.
- **Layer 3 — UI Design & Taste Floor (Impeccable `Operate` Mode · `D1–D9` · `T1–T16` · `M1–M3`)**:
  - **Zone 1 — WorkspaceHeader** (`h-14` / 56px): Tiêu đề "Quản trị dữ liệu & Danh mục", context badge hiển thị số lượng bản ghi persisted thực tế từ máy chủ (`${totalCount} nguyên liệu/món ăn persisted`), action button "Làm mới" (`variant="outline" size="default"`). 0 nút Primary (`D7`).
  - **Zone 2 — TelemetrySubbar** (`h-11` / 44px): Trái: phạm vi đang xem (`Danh mục nguyên liệu thực phẩm` / `Danh mục món ăn tiêu chuẩn`). Phải: telemetry pill hiển thị số dòng dữ liệu authoritative từ metadata phân trang.
  - **Zone 3 — Data Area**: `StateBoundary` bọc `DataGrid` (chiều cao dòng compact 36-40px theo chuẩn `T8`, frozen header theo chuẩn `T7`). Bảng nguyên liệu 7 cột, bảng món ăn 5 cột (`T11–T12`). Số tiền căn phải bằng `<Num>` và font `tabular-nums` (`T1`, `T3`). Phía dưới là thanh điều hướng phân trang `<nav aria-label="Phân trang danh mục">` với các nút nhỏ gọn (`variant="outline" size="xs"`).
  - Không có bất kỳ CSS ad-hoc, inline style hoặc color token nào ngoài `frontend/src/styles/index.css` (`D1–D5`). Tông màu trung tính cool-slate, viền hairline 1px `border-slate-200` (`D8`). Icons Lucide 2px stroke (`D9`).
  - Không mở modal popup xếp chồng (`M1.1–M1.2`).
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - API Client: `frontend/src/api/adminApi.ts` ánh xạ 100% khớp các C# DTOs: `IngredientDto`, `DishDto`, `PagedResponseDto<T>`.
  - Tuyệt đối không chứa dữ liệu giả định (`getBaseline*()`, dummy arrays) hoặc nuốt lỗi (`Rule TA-5`).
  - Phân quyền: Route được bảo vệ bởi `RoleGuard` (chỉ role `ADMIN`).
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build`)**:
  - Bộ kiểm thử hợp đồng máy: `scripts/check-conformance-contracts.test.mjs`, `scripts/extract-backend-action-index.test.mjs`.
  - Bộ kiểm thử API contract: `frontend/src/__tests__/ApiContracts.test.ts`.
  - Bộ kiểm thử Component hành vi: `frontend/src/__tests__/AdminData.test.tsx` (kiểm chứng 4 kịch bản theo `Rule TA-4`).
  - Bộ kiểm thử chống dữ liệu giả: `frontend/src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts`.

---

## 2. Scoped Pre-Code UI Gate Block

```markdown
### Scoped Pre-Code UI Gate Block — Admin Data & Catalog
- Route: /admin-data (N6 URL leaves: ?view=ingredients, ?view=dishes)
- Single Primary Work Object: OperationalFrame (Surfaces: admin.ingredients, admin.dishes)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: Shared master data, never mixed with MRX stock/workflow)
- RBAC Guards: RoleGuard(['ADMIN']) at route level; ActionGuard on writable mutations (no write action exposed currently)
- 6 UI States:
  - loading: WorkbenchSkeleton (kind: table, columns: 7 for ingredients / 5 for dishes, rows: 8, toolbar: true)
  - empty: StateBoundary (emptyTitle: "Chưa có danh mục nguyên liệu/món ăn", emptyDescription: "Backend chưa có dữ liệu persisted cho danh mục này.")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (ApiError status 403 renders distinct permission denied alert)
  - partial: N/A (all rendered columns map to authoritative C# DTO properties)
  - write-reconciliation: N/A (read-only surface, no concurrent write surface active)
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, StateBoundary, DataGrid, Button, Badge, Num, IdentifierText
- Compliance Pledges:
  - D6: Typography >= 12px everywhere (text-xs = 12px, text-sm = 14px)
  - D7: Single primary button policy (0 primary button because read-only; only "Làm mới" outline button)
  - T7: Frozen table header in DataGrid
  - T8: Compact row density (36-40px)
  - M1.2: Zero blocking modals
  - N6: URL-owned leaf views (?view=ingredients | ?view=dishes)
```

---

## 3. C# Backend Source Contracts (Technical Ground Truth)

Mọi cấu trúc dữ liệu Frontend BẮT BUỘC phải đối chiếu từ mã nguồn C# Backend:

### A. `IngredientDto` (`backend/src/IPCManagement.Api/Features/Catalog/Contracts/IngredientDto.cs`)
```csharp
public class IngredientDto
{
    public string  IngredientId   { get; set; } = string.Empty; // GUID string
    public string  IngredientCode { get; set; } = string.Empty; // Mã nguyên liệu (duy nhất)
    public string  IngredientName { get; set; } = string.Empty; // Tên nguyên liệu
    public bool    IsActive       { get; set; }                // Trạng thái hoạt động
    public bool?   IsFreshDaily   { get; set; }                // Cờ hàng tươi sống hàng ngày
    public decimal ReferencePrice { get; set; }                // Đơn giá tham chiếu (VND)
    public string  UnitId         { get; set; } = string.Empty; // GUID string
    public string? UnitName       { get; set; }                // Tên đơn vị tính (kg, lít,...)
    public string  WarehouseId    { get; set; } = string.Empty; // GUID string
    public string? WarehouseName  { get; set; }                // Tên kho quản lý
}
```
*Phát hiện kiểm toán:* C# DTO **hoàn toàn không có trường `categoryName`**. Việc Frontend trước đây hiển thị cột "Nhóm thực phẩm" bằng `categoryName` là dữ liệu giả định/ảo. Phải loại bỏ hoàn toàn trường này và thay thế bằng các trường có thật: `UnitName` ("ĐVT"), `WarehouseName` ("Kho quản lý"), `IsFreshDaily` ("Loại hàng: Tươi sống / Tiêu chuẩn"), `ReferencePrice` ("Đơn giá tham chiếu").

### B. `DishDto` (`backend/src/IPCManagement.Api/Features/Catalog/Contracts/DishDto.cs`)
```csharp
public class DishDto
{
    public string  DishId    { get; set; } = string.Empty; // GUID string
    public string  DishCode  { get; set; } = string.Empty; // Mã món ăn
    public string  DishName  { get; set; } = string.Empty; // Tên món ăn
    public string? DishType  { get; set; }                // Phân loại món (Món chính, Canh,...)
    public string? DishGroup { get; set; }                // Nhóm món
    public bool    IsActive  { get; set; }                // Trạng thái hoạt động
    public string? SourceImportBatch { get; set; }
    public string? SourceFileName { get; set; }
    public string? SourceChecksum { get; set; }
}
```

### C. `PagedResponseDto<T>` (`backend/src/IPCManagement.Api/Shared/Contracts/PagedResponseDto.cs`)
```csharp
public class PagedResponseDto<T>
{
    public IEnumerable<T> Items      { get; set; } = Enumerable.Empty<T>();
    public int            TotalCount { get; set; }
    public int            PageNumber { get; set; }
    public int            PageSize   { get; set; }
    public int            TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool           HasPrev    => PageNumber > 1;
    public bool           HasNext    => PageNumber < TotalPages;
}
```

### D. `PagedRequestDto` (`backend/src/IPCManagement.Api/Shared/Contracts/PagedRequestDto.cs`)
```csharp
public class PagedRequestDto
{
    public int     PageNumber    { get; set; } = 1;
    public int     PageSize      { get; set; } = 20;
    public string? SearchKeyword { get; set; }
    public string? SortBy        { get; set; }
    public bool    SortDesc      { get; set; } = false;
}
```

---

## 4. Global Constraints

- **DOM-MODE-1 Operational Mode Isolation**: Danh mục dữ liệu nền thuộc chế độ `SHARED_MASTER_DATA`. Không được truyền `X-Operational-Mode: MATERIAL_RECONCILIATION` khi truy vấn danh mục Catalog.
- **Rule TA-1 (Backend-Grounded Fixtures Only)**: Mọi dữ liệu test mock bắt buộc phải khớp 100% tên trường, kiểu dữ liệu, cấu trúc lồng nhau từ C# DTO. Cấm tự bịa trường không tồn tại trong backend schema.
- **Rule TA-2 (No Self-Mocking / Tautological Tests)**: Không mock `AdminDataPage`, không mock `StateBoundary`, không mock `DataGrid`. Mock duy nhất là ở ranh giới mạng `fetch`/`apiClient`.
- **Rule TA-3 (Zero Allowlist Padding)**: Không dùng `test.skip`, không thêm file vào danh sách ngoại lệ.
- **Rule TA-5 (Zero Fake API Data)**: Không chứa bất kỳ dữ liệu fallback hoặc hardcoded arrays nào trong `src/api/adminApi.ts`. Khi có lỗi, bắt buộc ném `ApiError`.
- **Single Styling Authority**: Zero styling ngoài `frontend/src/styles/index.css`.
- **Fail-Closed Write Guarding**: Vì Backend chưa có `UnitsController` (chưa có endpoint GET `/api/units` để lấy danh mục đơn vị tính), `CreateIngredientRequest` đòi hỏi `[Required] string UnitId` (GUID hợp lệ trong DB). Frontend KHÔNG ĐƯỢC tự tạo form thêm nguyên liệu hoặc tự bịa `UnitId` giả (`00000000-...`). Bề mặt tạo/sửa nguyên liệu phải giữ nguyên trạng thái đóng (`READ_ONLY_BY_CONTRACT`).
- **No Destructive Operations**: Không can thiệp DB, không chạy migration, không git reset/clean.

---

## 5. Review Focus (5 Edge Cases & Verification Invariants)

1. **Empty / Zero Total Count:** Khi Backend trả về `totalCount: 0`, `items: []`, `adminApi` và `AdminDataPage` phải trả về đúng đối tượng phân trang với `totalPages: 0`. `StateBoundary` phải hiển thị empty state rõ ràng, không xuất hiện thanh phân trang và không gây lỗi chia cho 0.
2. **Stale Asynchronous View Switching:** Khi người dùng chuyển đổi qua lại giữa `?view=ingredients` và `?view=dishes` hoặc bấm chuyển trang nhanh, cờ hủy `ignore = true` phải ngăn chặn triệt để phản hồi chậm từ truy vấn trước ghi đè lên view hiện tại.
3. **HTTP 403 / 409 State Boundary Propagation:** `AdminDataPage` bắt buộc phải lưu trữ nguyên trạng đối tượng `Error` / `ApiError` trong `error` state. Khi gặp HTTP 403 (Forbidden), `StateBoundary` phải hiển thị giao diện từ chối quyền truy cập; khi gặp lỗi mạng, phải hiển thị nút [Thử lại] gọi lại chính xác trang và view hiện tại.
4. **Pagination Boundary Invariants:**
   - Tại `pageNumber: 1` hoặc `hasPrev === false`, nút "Trang trước" bắt buộc phải bị `disabled`.
   - Tại `pageNumber === totalPages` hoặc `hasNext === false`, nút "Trang sau" bắt buộc phải bị `disabled`.
   - Khi đang nạp dữ liệu (`isLoading === true`), cả 2 nút chuyển trang đều phải bị `disabled`.
5. **Unauthorized Mutation Attempt:** `CAT.INGREDIENT.CREATE` bắt buộc phải được đánh dấu `BLOCKED` trong `docs/conformance-contracts.json` với gap ghi rõ: `UnitsController lookup authority missing; Frontend cannot supply authoritative UnitId`. Trên giao diện tuyệt đối không được có nút "Thêm nguyên liệu" hay form tạo chưa có thẩm quyền.

---

## 6. Implementation Tasks

### Task 1: Disaggregate Catalog and Admin Capabilities to Operation Grain

**Files:**
- Modify: `docs/conformance-contracts.json`
- Modify: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: `docs/backend-action-index.json` (18 actions thuộc Catalog và Admin)
- Produces: 18 capabilities độc lập, ánh xạ 1:1, không còn grouped writes:
  - `Ingredients.Create` $\rightarrow$ `CAT.INGREDIENT.CREATE` (`operation: "create"`, `deliveryClass: "BLOCKED"`)
  - `Ingredients.Update` $\rightarrow$ `CAT.INGREDIENT.UPDATE` (`operation: "update"`, `deliveryClass: "PARTIAL"`)
  - `Ingredients.Delete` $\rightarrow$ `CAT.INGREDIENT.CLOSE` (`operation: "delete"`, `deliveryClass: "PARTIAL"`)
  - `Dishes.Create` $\rightarrow$ `CAT.DISH.CREATE` (`operation: "create"`, `deliveryClass: "PARTIAL"`)
  - `Dishes.Update` $\rightarrow$ `CAT.DISH.UPDATE` (`operation: "update"`, `deliveryClass: "PARTIAL"`)
  - `Dishes.Delete` $\rightarrow$ `CAT.DISH.CLOSE` (`operation: "delete"`, `deliveryClass: "PARTIAL"`)
  - `DishBom.AddBomLine` $\rightarrow$ `CAT.BOM.LINE.ADD` (`operation: "create"`, `deliveryClass: "PARTIAL"`)
  - `DishBom.UpdateBomLine` $\rightarrow$ `CAT.BOM.LINE.UPDATE` (`operation: "update"`, `deliveryClass: "PARTIAL"`)
  - `DishBom.CloseBomLine` $\rightarrow$ `CAT.BOM.LINE.CLOSE` (`operation: "delete"`, `deliveryClass: "PARTIAL"`)
  - `AdminEmployees.Create` $\rightarrow$ `ADMIN.EMPLOYEE.CREATE` (`operation: "create"`, `deliveryClass: "PARTIAL"`)
  - `AdminEmployees.Update` $\rightarrow$ `ADMIN.EMPLOYEE.UPDATE` (`operation: "update"`, `deliveryClass: "PARTIAL"`)
  - `AdminEmployees.UpdateStatus` $\rightarrow$ `ADMIN.EMPLOYEE.STATUS` (`operation: "update"`, `deliveryClass: "PARTIAL"`)
  - `LifecycleOutbox.Get` $\rightarrow$ `ADMIN.OUTBOX.READ` (`operation: "read"`, `deliveryClass: "PARTIAL"`)
  - `LifecycleOutbox.Replay` $\rightarrow$ `ADMIN.OUTBOX.REPLAY` (`operation: "create"`, `deliveryClass: "PARTIAL"`)
  - `ApprovalRules.GetRules` $\rightarrow$ `APPR.RULES.READ` (`operation: "read"`, `deliveryClass: "READY"`)
  - `ApprovalRules.GetRuleById` $\rightarrow$ `APPR.RULES.READ` (`operation: "read"`, `deliveryClass: "READY"`)
  - `ApprovalRules.CreateRule` $\rightarrow$ `APPR.RULES.CREATE` (`operation: "create"`, `deliveryClass: "PARTIAL"`)
  - `ApprovalRules.UpdateRule` $\rightarrow$ `APPR.RULES.UPDATE` (`operation: "update"`, `deliveryClass: "PARTIAL"`)
  - `ApprovalRules.DeleteRule` $\rightarrow$ `APPR.RULES.DELETE` (`operation: "delete"`, `deliveryClass: "PARTIAL"`)

- [ ] **Step 1: Write the failing test**

Trong `scripts/check-conformance-contracts.test.mjs`, thêm test case kiểm chứng phân tách rạch ròi từng operation grain và xác thực `CAT.INGREDIENT.CREATE` bị khóa `BLOCKED`:

```javascript
test('splits Catalog and Admin capabilities at their actual operation grain', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const expectedOwners = new Map([
    ['Ingredients.Create', 'CAT.INGREDIENT.CREATE'],
    ['Ingredients.Update', 'CAT.INGREDIENT.UPDATE'],
    ['Ingredients.Delete', 'CAT.INGREDIENT.CLOSE'],
    ['Dishes.Create', 'CAT.DISH.CREATE'],
    ['Dishes.Update', 'CAT.DISH.UPDATE'],
    ['Dishes.Delete', 'CAT.DISH.CLOSE'],
    ['DishBom.AddBomLine', 'CAT.BOM.LINE.ADD'],
    ['DishBom.UpdateBomLine', 'CAT.BOM.LINE.UPDATE'],
    ['DishBom.CloseBomLine', 'CAT.BOM.LINE.CLOSE'],
    ['AdminEmployees.Create', 'ADMIN.EMPLOYEE.CREATE'],
    ['AdminEmployees.Update', 'ADMIN.EMPLOYEE.UPDATE'],
    ['AdminEmployees.UpdateStatus', 'ADMIN.EMPLOYEE.STATUS'],
    ['LifecycleOutbox.Get', 'ADMIN.OUTBOX.READ'],
    ['LifecycleOutbox.Replay', 'ADMIN.OUTBOX.REPLAY'],
    ['ApprovalRules.GetRules', 'APPR.RULES.READ'],
    ['ApprovalRules.GetRuleById', 'APPR.RULES.READ'],
    ['ApprovalRules.CreateRule', 'APPR.RULES.CREATE'],
    ['ApprovalRules.UpdateRule', 'APPR.RULES.UPDATE'],
    ['ApprovalRules.DeleteRule', 'APPR.RULES.DELETE'],
  ]);

  for (const [actionId, capabilityId] of expectedOwners) {
    const owners = contract.capabilities.filter((capability) => capability.actionIds && capability.actionIds.includes(actionId));
    assert.deepEqual(owners.map((owner) => owner.id), [capabilityId], `${actionId} must be owned by ${capabilityId}`);
  }

  const ingredientCreate = contract.capabilities.find((c) => c.id === 'CAT.INGREDIENT.CREATE');
  assert.equal(ingredientCreate.deliveryClass, 'BLOCKED');
  assert.ok(
    ingredientCreate.gaps.some((g) => g.includes('UnitsController') || g.includes('UnitId')),
    'CAT.INGREDIENT.CREATE must explicitly document missing UnitsController lookup authority'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:conformance-contracts`  
Kỳ vọng: FAIL vì `Ingredients.Create` đang thuộc `CAT.INGREDIENT.WRITE`.

- [ ] **Step 3: Update `docs/conformance-contracts.json`**

1. Khai báo các capabilities mới thay thế các capabilities gộp:
   - `CAT.INGREDIENT.CREATE`:
     - `frCode`: `FR-CAT`
     - `operation`: `create`
     - `deliveryClass`: `BLOCKED`
     - `actionIds`: `["Ingredients.Create"]`
     - `backend`: `{ controller: "backend/src/IPCManagement.Api/Features/Catalog/Controllers/IngredientsController.cs", requestDto: "backend/src/IPCManagement.Api/Features/Catalog/Contracts/IngredientDto.cs", responseDto: "backend/src/IPCManagement.Api/Features/Catalog/Contracts/IngredientDto.cs", policy: "backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs", persistence: "backend/src/IPCManagement.Api/Features/Catalog/Services/IngredientService.cs" }`
     - `gaps`: `["UnitsController lookup authority missing; Frontend cannot supply authoritative UnitId.", "Ingredient entity lacks optimistic concurrency token."]`
   - `CAT.INGREDIENT.UPDATE`:
     - `deliveryClass`: `PARTIAL`
     - `actionIds`: `["Ingredients.Update"]`
     - `gaps`: `["Unit selection authority missing for updates.", "Ingredient entity lacks optimistic concurrency token."]`
   - `CAT.INGREDIENT.CLOSE`:
     - `deliveryClass`: `PARTIAL`
     - `actionIds`: `["Ingredients.Delete"]`
     - `gaps`: `["Soft-delete does not verify concurrent modification."]`
   - Tương tự phân tách `CAT.DISH.*`, `CAT.BOM.LINE.*`, `ADMIN.EMPLOYEE.*`, `ADMIN.OUTBOX.*`, `APPR.RULES.*`.
2. Cập nhật mảng `capabilityIds` trong các requirements liên quan:
   - `FR-CAT`: cập nhật danh sách capabilities mới.
   - `FR-ADMIN`: cập nhật danh sách capabilities mới.
   - `FR-APPR`: cập nhật `APPR.RULES.READ`.
   - `BR-GLOBAL-02`: cập nhật `CAT.BOM.LINE.*`.
   - `NFR-SEC-01`: cập nhật `ADMIN.EMPLOYEE.*`.
   - `FR-SYS`, `NFR-REL-01`: cập nhật `ADMIN.OUTBOX.READ`, `ADMIN.OUTBOX.REPLAY`.
3. Cập nhật surface `admin.approval-rules` sang `capabilityIds: ["APPR.RULES.READ"]`.

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:conformance-contracts && npm run check:conformance-contracts`  
Kỳ vọng: PASS toàn bộ 22/22 tests, không có dangling reference hoặc unmapped actions.

- [ ] **Step 5: Commit**

```bash
git add docs/conformance-contracts.json scripts/check-conformance-contracts.test.mjs
git commit -m "feat(conformance): split catalog and admin capabilities to operation grain"
```

---

### Task 2: Align `adminApi.ts` with Backend `PagedResponseDto` & Authoritative DTOs

**Files:**
- Modify: `frontend/src/api/adminApi.ts`
- Modify: `frontend/src/__tests__/ApiContracts.test.ts`

**Interfaces:**
- Consumes: C# `PagedResponseDto<IngredientDto>` và `PagedResponseDto<DishDto>`.
- Produces:
  ```typescript
  export interface PagedResult<T> {
    items: T[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  }

  export interface IngredientItem {
    ingredientId: string;
    ingredientCode: string;
    ingredientName: string;
    unitId: string;
    unitName: string;
    warehouseId: string;
    warehouseName?: string;
    referencePrice: number;
    isFreshDaily?: boolean;
    isActive: boolean;
  }

  export interface DishItem {
    dishId: string;
    dishCode: string;
    dishName: string;
    dishType?: string;
    dishGroup?: string;
    isActive: boolean;
  }

  export interface PagedQueryParams {
    pageNumber?: number;
    pageSize?: number;
    searchKeyword?: string;
  }

  export const adminApi = {
    getIngredients(params?: PagedQueryParams): Promise<PagedResult<IngredientItem>>;
    getDishes(params?: PagedQueryParams): Promise<PagedResult<DishItem>>;
    getApprovalRules(): Promise<ApprovalRuleItem[]>;
  };
  ```

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/ApiContracts.test.ts`**

Viết test kiểm chứng `adminApi` truyền đúng query parameters xuống URL và ánh xạ đúng cấu trúc `PagedResponseDto` mà không có trường giả `categoryName`:

```typescript
it('retrieves ingredients with server pagination metadata and without fabricated categoryName', async () => {
  const pagedPayload = {
    items: [
      {
        ingredientId: '00000000-0000-0000-0000-000000000001',
        ingredientCode: 'NL-01',
        ingredientName: 'Thịt bò tươi',
        isActive: true,
        isFreshDaily: true,
        referencePrice: 150000,
        unitId: '00000000-0000-0000-0000-000000000010',
        unitName: 'kg',
        warehouseId: '00000000-0000-0000-0000-000000000100',
        warehouseName: 'Kho Lạnh Tổng',
      },
    ],
    totalCount: 42,
    pageNumber: 2,
    pageSize: 25,
    totalPages: 2,
    hasPrev: true,
    hasNext: false,
  };
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(pagedPayload));
  vi.stubGlobal('fetch', fetchMock);

  const result = await adminApi.getIngredients({ pageNumber: 2, pageSize: 25, searchKeyword: 'bò' });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/ingredients\?pageNumber=2&pageSize=25&searchKeyword=b%C3%B2/),
    expect.anything()
  );
  expect(result.totalCount).toBe(42);
  expect(result.pageNumber).toBe(2);
  expect(result.pageSize).toBe(25);
  expect(result.totalPages).toBe(2);
  expect(result.hasPrev).toBe(true);
  expect(result.hasNext).toBe(false);
  expect(result.items[0]).toEqual({
    ingredientId: '00000000-0000-0000-0000-000000000001',
    ingredientCode: 'NL-01',
    ingredientName: 'Thịt bò tươi',
    unitId: '00000000-0000-0000-0000-000000000010',
    unitName: 'kg',
    warehouseId: '00000000-0000-0000-0000-000000000100',
    warehouseName: 'Kho Lạnh Tổng',
    referencePrice: 150000,
    isFreshDaily: true,
    isActive: true,
  });
  expect((result.items[0] as Record<string, unknown>).categoryName).toBeUndefined();
});

it('retrieves dishes with server pagination metadata and exact DTO mapping', async () => {
  const pagedPayload = {
    items: [
      {
        dishId: '00000000-0000-0000-0000-000000000002',
        dishCode: 'M-01',
        dishName: 'Bò xào cần tỏi',
        dishType: 'Món chính',
        dishGroup: 'Nhóm thịt bò',
        isActive: true,
      },
    ],
    totalCount: 15,
    pageNumber: 1,
    pageSize: 25,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  };
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(pagedPayload));
  vi.stubGlobal('fetch', fetchMock);

  const result = await adminApi.getDishes({ pageNumber: 1, pageSize: 25 });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/Dishes\?pageNumber=1&pageSize=25/),
    expect.anything()
  );
  expect(result.totalCount).toBe(15);
  expect(result.pageNumber).toBe(1);
  expect(result.totalPages).toBe(1);
  expect(result.items[0]).toEqual({
    dishId: '00000000-0000-0000-0000-000000000002',
    dishCode: 'M-01',
    dishName: 'Bò xào cần tỏi',
    dishType: 'Món chính',
    dishGroup: 'Nhóm thịt bò',
    isActive: true,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npx vitest run frontend/src/__tests__/ApiContracts.test.ts`  
Kỳ vọng: FAIL vì `adminApi.getIngredients` chưa hỗ trợ query object và trả về mảng thay vì `PagedResult`.

- [ ] **Step 3: Implement in `frontend/src/api/adminApi.ts`**

1. Khai báo các interface chuẩn hóa: `PagedResult<T>`, `PagedQueryParams`, `IngredientItem`, `DishItem`.
2. Hàm tiện ích build query string:
   ```typescript
   function buildPagedQuery(params?: PagedQueryParams): string {
     if (!params) return '';
     const searchParams = new URLSearchParams();
     if (params.pageNumber != null) searchParams.set('pageNumber', String(params.pageNumber));
     if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize));
     if (params.searchKeyword) searchParams.set('searchKeyword', params.searchKeyword);
     const qs = searchParams.toString();
     return qs ? `?${qs}` : '';
   }
   ```
3. Triển khai `getIngredients(params)`:
   - Gọi endpoint `/ingredients${buildPagedQuery(params)}`.
   - Đọc đối tượng `PagedResponseDto<RawIngredient>`.
   - Ánh xạ sang `PagedResult<IngredientItem>` với các trường: `ingredientId`, `ingredientCode`, `ingredientName`, `unitId`, `unitName: i.unitName || '—'`, `warehouseId`, `warehouseName: i.warehouseName || undefined`, `referencePrice`, `isFreshDaily: i.isFreshDaily ?? undefined`, `isActive`. Loại bỏ hoàn toàn `categoryName`.
4. Triển khai `getDishes(params)`:
   - Gọi endpoint `/Dishes${buildPagedQuery(params)}`.
   - Đọc đối tượng `PagedResponseDto<RawDish>`.
   - Ánh xạ sang `PagedResult<DishItem>` với các trường: `dishId`, `dishCode`, `dishName`, `dishType: d.dishType || undefined`, `dishGroup: d.dishGroup || undefined`, `isActive`.

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npx vitest run frontend/src/__tests__/ApiContracts.test.ts`  
Kỳ vọng: PASS toàn bộ các tests trong `ApiContracts.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/adminApi.ts frontend/src/__tests__/ApiContracts.test.ts
git commit -m "feat(api): align adminApi with backend paged response and authoritative dtos"
```

---

### Task 3: Refactor `AdminDataPage.tsx` with View-Isolated Queries, Server Pagination & Strict Read-Only Authority

**Files:**
- Modify: `frontend/src/features/admin/AdminDataPage.tsx`
- Modify: `frontend/src/__tests__/AdminData.test.tsx`

**Interfaces:**
- Consumes: `adminApi.getIngredients(params)`, `adminApi.getDishes(params)`
- Produces: Màn hình vận hành tuân thủ chuẩn 3-Zone Workbench:
  - Chỉ gọi API tương ứng với `activeView`: xem nguyên liệu chỉ gọi `getIngredients`, xem món ăn chỉ gọi `getDishes`.
  - Điều khiển phân trang server-side rõ ràng: `Trang trước`, `Trang sau`, hiển thị `Trang X/Y (Z mục)`.
  - Cột hiển thị chuẩn hóa theo C# DTOs:
    - Bảng Nguyên liệu (7 cột): Mã nguyên liệu (`IdentifierText`), Tên nguyên liệu thực phẩm, ĐVT, Kho quản lý, Đơn giá tham chiếu (`Num` currency), Loại hàng (`Badge` Tươi sống/Tiêu chuẩn), Trạng thái (`Badge` Đang áp dụng/Tạm khóa).
    - Bảng Món ăn (5 cột): Mã món (`IdentifierText`), Tên món ăn tiêu chuẩn, Phân loại, Nhóm phân loại, Trạng thái (`Badge` Hoạt động/Tạm dừng).
  - Giữ nguyên trạng thái `READ_ONLY_BY_CONTRACT`: không có nút "Thêm nguyên liệu" hoặc dialog giả định.

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/AdminData.test.tsx`**

Viết lại toàn diện các test trong `AdminData.test.tsx` theo 4 kịch bản bắt buộc của `Rule TA-4`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminDataPage } from '../features/admin/AdminDataPage';
import { AuthProvider } from '../store/authContext';
import { adminApi, type PagedResult, type IngredientItem, type DishItem } from '../api/adminApi';

function renderPage(initialEntry = '/admin-data') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin-data" element={<AdminDataPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('AdminDataPage — Conformance & Behavioral Audit', () => {
  const mockIngredientsPage1: PagedResult<IngredientItem> = {
    items: [
      {
        ingredientId: '00000000-0000-0000-0000-000000000001',
        ingredientCode: 'NL-GAO',
        ingredientName: 'Gạo tẻ ST25',
        unitId: '00000000-0000-0000-0000-000000000010',
        unitName: 'kg',
        warehouseId: '00000000-0000-0000-0000-000000000100',
        warehouseName: 'Kho Lương Thực',
        referencePrice: 28000,
        isFreshDaily: false,
        isActive: true,
      },
    ],
    totalCount: 30,
    pageNumber: 1,
    pageSize: 25,
    totalPages: 2,
    hasPrev: false,
    hasNext: true,
  };

  const mockIngredientsPage2: PagedResult<IngredientItem> = {
    items: [
      {
        ingredientId: '00000000-0000-0000-0000-000000000002',
        ingredientCode: 'NL-THIT',
        ingredientName: 'Thịt heo nạc dăm',
        unitId: '00000000-0000-0000-0000-000000000010',
        unitName: 'kg',
        warehouseId: '00000000-0000-0000-0000-000000000100',
        warehouseName: 'Kho Lạnh',
        referencePrice: 110000,
        isFreshDaily: true,
        isActive: true,
      },
    ],
    totalCount: 30,
    pageNumber: 2,
    pageSize: 25,
    totalPages: 2,
    hasPrev: true,
    hasNext: false,
  };

  const mockDishesPage: PagedResult<DishItem> = {
    items: [
      {
        dishId: '00000000-0000-0000-0000-000000000003',
        dishCode: 'M-THIT-KHO',
        dishName: 'Thịt kho tàu nước dừa',
        dishType: 'Món chính',
        dishGroup: 'Món mặn',
        isActive: true,
      },
    ],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 25,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Kịch bản 1: Success & View-Isolation & DTO Truth
  it('loads ONLY ingredients when viewing ingredients tab and renders authoritative columns without categoryName', async () => {
    const getIngsSpy = vi.spyOn(adminApi, 'getIngredients').mockResolvedValue(mockIngredientsPage1);
    const getDshsSpy = vi.spyOn(adminApi, 'getDishes').mockResolvedValue(mockDishesPage);

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ ST25')).toBeInTheDocument();
    expect(screen.getByText('Kho Lương Thực')).toBeInTheDocument();
    expect(screen.getByText('Tiêu chuẩn')).toBeInTheDocument();
    expect(screen.queryByText(/Nhóm thực phẩm/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thêm nguyên liệu/i })).not.toBeInTheDocument();

    expect(getIngsSpy).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25 });
    expect(getDshsSpy).not.toHaveBeenCalled();
  });

  it('loads ONLY dishes when viewing dishes tab', async () => {
    const getIngsSpy = vi.spyOn(adminApi, 'getIngredients').mockResolvedValue(mockIngredientsPage1);
    const getDshsSpy = vi.spyOn(adminApi, 'getDishes').mockResolvedValue(mockDishesPage);

    renderPage('/admin-data?view=dishes');

    expect(await screen.findByRole('columnheader', { name: 'Mã món' })).toBeInTheDocument();
    expect(screen.getByText('Thịt kho tàu nước dừa')).toBeInTheDocument();
    expect(screen.getByText('Món chính')).toBeInTheDocument();

    expect(getDshsSpy).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25 });
    expect(getIngsSpy).not.toHaveBeenCalled();
  });

  // Kịch bản 2: Server Pagination Navigation
  it('navigates server pages with correct disabled boundaries', async () => {
    const user = userEvent.setup();
    const getIngsSpy = vi.spyOn(adminApi, 'getIngredients')
      .mockResolvedValueOnce(mockIngredientsPage1)
      .mockResolvedValueOnce(mockIngredientsPage2);

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByText('Gạo tẻ ST25')).toBeInTheDocument();
    expect(screen.getByText(/Trang 1\/2/)).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: 'Trang trước' });
    const nextBtn = screen.getByRole('button', { name: 'Trang sau' });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    await user.click(nextBtn);

    expect(getIngsSpy).toHaveBeenCalledWith({ pageNumber: 2, pageSize: 25 });
    expect(await screen.findByText('Thịt heo nạc dăm')).toBeInTheDocument();
    expect(screen.getByText(/Trang 2\/2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeEnabled();
  });

  // Kịch bản 3: Empty State (totalCount = 0)
  it('renders clean empty state when totalCount is 0 without pagination errors', async () => {
    vi.spyOn(adminApi, 'getIngredients').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByText('Chưa có danh mục nguyên liệu')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Phân trang danh mục' })).not.toBeInTheDocument();
  });

  // Kịch bản 4: Error Handling & Retry
  it('displays API error and retries upon clicking retry button', async () => {
    const user = userEvent.setup();
    const getIngsSpy = vi.spyOn(adminApi, 'getIngredients')
      .mockRejectedValueOnce(new Error('Lỗi kết nối cơ sở dữ liệu danh mục'))
      .mockResolvedValueOnce(mockIngredientsPage1);

    renderPage('/admin-data?view=ingredients');

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi kết nối cơ sở dữ liệu danh mục')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await user.click(retryBtn);

    expect(await screen.findByText('Gạo tẻ ST25')).toBeInTheDocument();
    expect(getIngsSpy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npx vitest run frontend/src/__tests__/AdminData.test.tsx`  
Kỳ vọng: FAIL vì `AdminDataPage` hiện tại gọi cả 2 API cùng lúc, chưa có phân trang và đang dùng trường `categoryName`.

- [ ] **Step 3: Implement in `frontend/src/features/admin/AdminDataPage.tsx`**

Sửa đổi toàn diện `AdminDataPage.tsx`:
1. Quản lý trạng thái:
   ```typescript
   const [searchParams] = useSearchParams();
   const activeView = searchParams.get('view') === 'dishes' ? 'dishes' : 'ingredients';
   const [pageNumber, setPageNumber] = useState(1);
   const [pageInfo, setPageInfo] = useState({ totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });
   const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
   const [dishes, setDishes] = useState<DishItem[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<Error | null>(null);
   ```
2. Reset `pageNumber` về 1 khi `activeView` thay đổi:
   ```typescript
   useEffect(() => {
     setPageNumber(1);
   }, [activeView]);
   ```
3. Nạp dữ liệu cô lập theo view với cờ chống race condition:
   ```typescript
   useEffect(() => {
     let ignore = false;
     setIsLoading(true);
     setError(null);

     async function fetchActiveData() {
       try {
         if (activeView === 'ingredients') {
           const result = await adminApi.getIngredients({ pageNumber, pageSize: 25 });
           if (!ignore) {
             setIngredients(result.items);
             setPageInfo(result);
             setIsLoading(false);
           }
         } else {
           const result = await adminApi.getDishes({ pageNumber, pageSize: 25 });
           if (!ignore) {
             setDishes(result.items);
             setPageInfo(result);
             setIsLoading(false);
           }
         }
       } catch (cause: unknown) {
         if (!ignore) {
           setError(cause instanceof Error ? cause : new Error('Không thể tải danh mục dữ liệu nền.'));
           setIsLoading(false);
         }
       }
     }

     fetchActiveData();
     return () => {
       ignore = true;
     };
   }, [activeView, pageNumber]);
   ```
4. Cập nhật `ingredientColumns`:
   - `code`: Mã nguyên liệu (`<IdentifierText value={row.ingredientCode} />`)
   - `name`: Tên nguyên liệu (`<span className="font-semibold text-slate-900 text-sm">{row.ingredientName}</span>`)
   - `unit`: ĐVT (`<span className="font-mono text-xs text-slate-600">{row.unitName}</span>`)
   - `warehouse`: Kho quản lý (`<span className="text-slate-600 text-sm">{row.warehouseName || '—'}</span>`)
   - `price`: Đơn giá tham chiếu (`<Num value={row.referencePrice} format="currency" className="font-bold text-slate-900 text-sm" />`)
   - `fresh`: Loại hàng (`<Badge variant="neutral" size="sm">{row.isFreshDaily ? 'Tươi sống' : 'Tiêu chuẩn'}</Badge>`)
   - `status`: Trạng thái (`<Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">{row.isActive ? 'Đang áp dụng' : 'Tạm khóa'}</Badge>`)
5. Cập nhật `dishColumns`:
   - `code`: Mã món (`<IdentifierText value={row.dishCode} />`)
   - `name`: Tên món ăn (`<span className="font-semibold text-slate-900 text-sm">{row.dishName}</span>`)
   - `type`: Phân loại (`<span className="text-slate-600 text-sm">{row.dishType || '—'}</span>`)
   - `group`: Nhóm món (`<span className="text-slate-600 text-sm">{row.dishGroup || '—'}</span>`)
   - `status`: Trạng thái (`<Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">{row.isActive ? 'Hoạt động' : 'Tạm dừng'}</Badge>`)
6. Render Zone 1 (`WorkspaceHeader`): badge context hiển thị `{pageInfo.totalCount} {activeView === 'ingredients' ? 'nguyên liệu' : 'món ăn'} persisted`. Nút "Làm mới" kích hoạt tải lại.
7. Render Zone 2 (`TelemetrySubbar`): trái hiển thị phạm vi đang xem, phải hiển thị số lượng bản ghi authoritative.
8. Render Zone 3 (`StateBoundary` + `DataGrid`):
   - `isEmpty={!isLoading && !error && (activeView === 'ingredients' ? ingredients.length === 0 : dishes.length === 0)}`
   - `emptyTitle={activeView === 'ingredients' ? 'Chưa có danh mục nguyên liệu' : 'Chưa có danh mục món ăn'}`
   - `emptyDescription="Backend chưa có dữ liệu persisted cho danh mục này."`
9. Thanh phân trang `<nav aria-label="Phân trang danh mục">` chỉ hiển thị khi `pageInfo.totalPages > 1`:
   ```tsx
   {pageInfo.totalPages > 1 && (
     <nav aria-label="Phân trang danh mục" className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2">
       <span className="text-xs text-slate-500">
         Trang {pageInfo.pageNumber}/{pageInfo.totalPages} ({pageInfo.totalCount} mục)
       </span>
       <Button variant="outline" size="xs" disabled={!pageInfo.hasPrev || isLoading} onClick={() => setPageNumber((p) => p - 1)}>
         Trang trước
       </Button>
       <Button variant="outline" size="xs" disabled={!pageInfo.hasNext || isLoading} onClick={() => setPageNumber((p) => p + 1)}>
         Trang sau
       </Button>
     </nav>
   )}
   ```
10. Tuyệt đối không thêm nút hoặc modal tạo/sửa nào.

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npx vitest run frontend/src/__tests__/AdminData.test.tsx`  
Kỳ vọng: PASS toàn bộ 5 test cases.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/admin/AdminDataPage.tsx frontend/src/__tests__/AdminData.test.tsx
git commit -m "feat(admin): refactor admin data page to view-isolated paged queries with zero synthetic fields"
```

---

### Task 4: Full Non-Mutating Verification, Review Gates & Work Closure

**Files:**
- Modify: `.planning/WORK.md`

- [ ] **Step 1: Run complete verification suite**

Chạy tuần tự toàn bộ các lệnh kiểm thử và kiểm tra tính toàn vẹn:
```bash
npm run test:conformance-contracts
npm run check:conformance-contracts
npm run test:fe:unit
npm run lint:fe
npm run build:fe
npm run depcruise:fe
git diff --check
```
Kỳ vọng:
- Conformance tests: PASS 22/22 tests.
- Frontend unit tests: PASS 17 files / ~101 tests.
- Zero fake API guard: PASS 2/2 tests.
- Lint: PASS (không có cảnh báo hoặc lỗi unused vars / unescaped entities).
- Production build: PASS (output bundle tối ưu, không có lỗi type check).
- Dependency cruise: PASS (không có vi phạm phụ thuộc vòng).
- Git diff check: PASS (chỉ có warning chuyển đổi dòng LF $\rightarrow$ CRLF).

- [ ] **Step 2: Mandatory Review Gates**

Áp dụng 3 cổng review bắt buộc theo `AGENTS.md`:
1. `ipc-test-audit`: Xác minh fixture bám sát C# DTO 100%, không mock component dưới test, bao phủ đủ 4 kịch bản, zero synthetic evidence (`Rule TA-1` đến `Rule TA-5`).
2. `ipc-ui-review`: Xác minh 3-Zone Workbench, kiểm tra D6/D7 typography/buttons, T7/T8 table compactness, khả năng truy cập bàn phím của thanh phân trang.
3. `ipc-code-review`: Rà soát diff, đảm bảo can thiệp tối thiểu đúng chủ sở hữu, không có mã thừa, bảo vệ bất biến `DOM-MODE-1`.

Định dạng ghi nhận:  
`Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact`.

- [ ] **Step 3: Update `.planning/WORK.md`**

Ghi nhận mục `GF-R33 — Catalog/Admin capability conformance and view-isolated pagination` vào `.planning/WORK.md`:
- Ghi nhận việc phân tách 18 capabilities của Catalog/Admin thành operation-grain.
- Ghi nhận `CAT.INGREDIENT.CREATE` bị khóa `BLOCKED` do thiếu `UnitsController`.
- Ghi nhận việc khôi phục metadata phân trang từ máy chủ và loại bỏ trường giả `categoryName`.
- Cập nhật trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record catalog admin conformance closure and return to idle"
```
