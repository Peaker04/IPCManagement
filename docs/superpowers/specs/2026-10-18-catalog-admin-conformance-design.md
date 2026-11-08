# Catalog & Admin Capability Conformance Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner Approval  
**Scope:** `FR-CAT` (Catalog & BOM) and `FR-ADMIN` (Admin & Rules) Conformance, Backend Ground Truth Alignment, Elimination of Synthetic Evidence, and Write Surface Guarding  
**State Owner:** `.planning/WORK.md`  
**Parent Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

---

## 1. Intent & The "Why"

In the historical frontend implementation, the `/admin-data` route appeared functional on the surface, but this was achieved through synthetic artifacts:
1. **Mock Fallbacks:** When the network failed or the server returned empty data, `adminApi.ts` fell back to hardcoded arrays of ingredients (`NL-THIT-01`), dishes, and approval rules.
2. **Fake Mutations:** `createIngredient` returned `{ success: true }` in JavaScript memory without sending an HTTP request, creating the illusion of successful creation while persisting nothing.
3. **Mismatched Payloads:** The create form sent `unitName: "Kilogram"`. However, the Backend C# contract (`CreateIngredientRequest`) requires `[Required] string UnitId`, a valid GUID foreign key in the database `Units` table. Furthermore, the Backend currently has no `UnitsController` endpoint (`GET /api/units`) to look up or select unit IDs.
4. **Fabricated Attributes:** The table displayed a "Nhóm thực phẩm" column mapped to `categoryName`. C# `IngredientDto` does not possess a `categoryName` property.
5. **Pagination Truncation:** `adminApi.ts` stripped all server pagination metadata (`totalCount`, `pageNumber`, `pageSize`, `totalPages`, `hasPrev`, `hasNext`), truncating catalogs to the first 20 records.

This design establishes a strictly verified, grounded chain of truth between requirements, Backend C# contracts, Frontend API adapters, and UI rendering. It eliminates all synthetic data, binds the UI strictly to existing C# DTOs, and keeps write surfaces closed (`READ_ONLY_BY_CONTRACT`) until authoritative unit selection and concurrency endpoints exist in Backend.

---

## 2. Mandatory UI Kit & Design System Authority (Zero Inventions)

**CỐT LÕI BẮT BUỘC:** 100% mã giao diện BẮT BUỘC phải tái sử dụng trực tiếp các thành phần có sẵn trong Catalog dự án (`docs/UI-KIT.md`, `frontend/src/components/ui/`, `frontend/src/components/workbench/`). **TUYỆT ĐỐI CẤM TỰ CHẾ, TỰ PHÁT MINH COMPONENT MỚI HOẶC VIẾT CSS RIÊNG.**

### Danh mục thành phần có sẵn được phép sử dụng:

1. **Khung bố cục 3-Zone Workbench (`frontend/src/components/workbench/`)**:
   - `WorkspaceHeader` (Zone 1 - 56px): Tiêu đề trang + badge đếm số lượng persisted + nút thao tác outline "Làm mới".
   - `TelemetrySubbar` (Zone 2 - 44px): Chỉ báo phạm vi nghiệp vụ và pill số lượng dòng authoritative.
   - `DataGrid`, `type ColumnDef` (Zone 3): Bảng dữ liệu phẳng, chiều cao dòng 36–40px (`T8`), header cố định (`T7`), hover hàng nhẹ nhàng.
   - `StateBoundary`: Quản lý tập trung 6 trạng thái UI (`loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`), tích hợp sẵn skeleton loading và nút thử lại khi lỗi.
   - `WorkbenchSkeleton`: Skeleton loading hình học đồng dạng với bảng thật (loại bỏ layout shift CLS <= 0.1).
2. **UI Primitives chuẩn hóa (`frontend/src/components/ui/`)**:
   - `Button`: Chỉ dùng biến thể `variant="outline"` với kích thước chuẩn (`size="default"` trên Header, `size="xs"` trên thanh phân trang).
   - `Badge`: Chỉ dùng hiển thị trạng thái hoạt động (`variant="success"` / `variant="neutral"`) và loại hàng (`variant="neutral"`).
   - `Num`: Định dạng số tiền `format="currency"` căn phải, tự động áp dụng font `tabular-nums` và dấu phân cách hàng nghìn (`T1`, `T3`).
   - `IdentifierText`: Hiển thị mã nguyên liệu/món ăn dạng monospace (`L1`, `L7`), hỗ trợ hover sao chép mã.
3. **Thanh phân trang chuẩn mực (`nav` pagination)**:
   - Tái sử dụng chính xác mẫu thiết kế chuẩn từ `ReportsPage.tsx`: Thẻ `<nav aria-label="Phân trang danh mục">`, nhãn văn bản chuẩn `Trang X/Y (Z mục)` và 2 nút `<Button variant="outline" size="xs">` cho "Trang trước" và "Trang sau".
4. **Quy định cấm tuyệt đối**:
   - **CẤM** tạo file component mới (không tạo PaginationControl, không tạo AdminTable, không tạo BadgeV2).
   - **CẤM** viết thêm bất kỳ class CSS tùy tiện, style inline `style={{...}}`, hoặc mã hex màu nào ngoài các semantic tokens đã có trong `frontend/src/styles/index.css`.
   - **CẤM** tạo các khối thẻ hộp lồng hộp (Zero Box-in-Box), không dùng thẻ `<details>` hay card KPI phình to.

---

## 3. Requirements & Governance Matrix (`FR`, `NFR`, `UXR`, `D`, `T`, `M`, `N`)

This design and its downstream implementation explicitly bind and enforce the following canonical governance requirements:

### Functional Requirements (FR)
- `FR-CAT`: Quản trị danh mục nguyên liệu, món ăn, định mức BOM gốc, quy cách.
- `FR-ADMIN`: Quản trị khách hàng, nhân viên, quy tắc phê duyệt, cấu hình hệ thống.
- `BR-GLOBAL-02`: Định mức BOM gốc bất biến, đơn vị tính chuẩn xác theo từng khay/suất.

### UI Non-Functional Requirements (NFR-UI)
- `NFR-UI-01` (Table Scalability & Viewport): Mọi danh sách vượt quá 20 dòng bắt buộc phải có phân trang server (`PagedResponseDto<T>`) hiển thị rõ số trang, tổng số bản ghi và thanh điều hướng phân trang.
- `NFR-UI-02` (Triple-Layer RBAC Defense): Bảo vệ 3 lớp: Route (`ProtectedRoute` / `RoleGuard(['ADMIN'])`), Navigation (`CANONICAL_ROUTES` allowedRoles), và Action (`ActionGuard` - tạm thời không expose write action).
- `NFR-UI-03` (Strict Formatting Primitives): 100% số tiền dùng `<Num format="currency">`, mã chứng từ/nguyên liệu dùng `<IdentifierText>`, ngày tháng dùng `VietnameseDateInput` định dạng `dd/MM/yyyy`. Cấm số trần không đơn vị.
- `NFR-UI-04` (Accessibility WCAG 2.2 AA): Tỷ lệ tương phản text >= 4.5:1, nút điều khiển >= 3:1. Hỗ trợ phím Tab/Enter/Esc, outline focus rõ nét (`focus-visible:ring-2`), aria-label đầy đủ cho bảng và phân trang.
- `NFR-UI-05` (Motion & Zero CLS): Mọi hiệu ứng chuyển động thời gian <= 150ms, tôn trọng `prefers-reduced-motion`, skeleton loading đồng dạng với bảng thật để không gây giật dịch chuyển bố cục (CLS <= 0.1).

### User Experience Requirements (UXR)
- `UXR-01` (3-Zone Workbench Foundation): Cố định 3 zone: Zone 1 (Header 56px), Zone 2 (Telemetry 44px), Zone 3 (Bảng dữ liệu & Phân trang).
- `UXR-02` (Operational Density): Ưu tiên hiển thị tối đa dữ liệu nghiệp vụ hữu ích trong 1 màn hình cuộn, không padding thừa.
- `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% nhãn tiếng Việt chuẩn: "Mã nguyên liệu", "Tên nguyên liệu thực phẩm", "ĐVT", "Kho quản lý", "Đơn giá tham chiếu", "Loại hàng", "Trạng thái", "Làm mới", "Trang trước", "Trang sau". Cấm UUID thô, mã enum tiếng Anh hay từ ngữ tự chế.
- `UXR-05` (Destructive & Terminal Guards): Mọi thao tác đóng/khóa hoặc thay đổi dữ liệu phải có xác nhận an toàn (hiện tại chưa expose write).

### Design System & Taste Floor (Impeccable `Operate` Mode & `D1–D9`)
- Mode: **`Operate`** (Môi trường vận hành công nghiệp bếp ăn tập thể, đề cao tốc độ quét mắt, tính chính xác và mật độ thông tin).
- `D1–D5` (Token Authority & Palette): 100% màu sắc xuất phát từ semantic tokens trong `frontend/src/styles/index.css`. Tông màu trung tính cool-slate mát mắt, không dùng màu sặc sỡ, không gradient tím/hồng kiểu AI-slop.
- `D6` (Typography Scale): Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`, hỗ trợ dấu tiếng Việt đầy đủ không bị cụt dấu mũ/móc.
- `D7` (Action Hierarchy): Tối đa 1 nút Primary trên một vùng làm việc. Vì màn hình này ở chế độ đọc an toàn (`READ_ONLY_BY_CONTRACT`), có **0 nút Primary**, nút "Làm mới" là nút Outline (`variant="outline"`).
- `D8` (Neutral Baseline): Viền hairline `1px border-slate-200`, không đổ bóng đậm (no heavy drop-shadows), không bo góc tròn hình viên thuốc trên bảng nghiệp vụ.
- `D9` (Icon Grammar): Icons Lucide chuẩn hóa stroke 2px, kích thước 16px/20px.

### Table & Data Grid Rules (`T1–T16`)
- `T1` (Alignment): Số tiền, đơn giá BẮT BUỘC căn phải và dùng `<Num>`; mã định danh và tên căn trái; ĐVT, trạng thái căn giữa.
- `T2` (Header Sync): Tiêu đề cột `<th>` căn lề đồng bộ 100% với ô dữ liệu `<td>` bên dưới (tiêu đề "Đơn giá tham chiếu" căn phải, "ĐVT" căn giữa).
- `T3` (Tabular Figures): Số tiền và số lượng sử dụng font `tabular-nums` để chữ số thẳng hàng không bị xô lệch layout.
- `T5` (Row Separator): Đường viền phân cách hàng tinh tế 1px (`border-slate-200`), không dùng lưới ca-rô đậm.
- `T7` (Horizontal Freeze): Bảng cố định tiêu đề (`sticky top-0`) khi cuộn dọc; cố định cột mã nguyên liệu khi cuộn ngang.
- `T8` (Operational Compact Density): Chiều cao dòng chuẩn `36px–40px` cho toàn bộ các dòng dữ liệu.
- `T11–T12` (Column Count): Bảng nguyên liệu 7 cột, bảng món ăn 5 cột; thông tin rõ ràng, không nhồi nhét >15 cột.
- `T13–T16` (Pagination Integrity): Phân trang server-side với thông tin minh bạch "Trang X/Y (Z mục)", nút điều hướng disable chính xác tại biên 1 và biên cuối.

### Navigation Rules (`N1–N7`)
- `N1–N5` (Work Object Navigation): URL query `?view=ingredients` và `?view=dishes` làm chủ view hiển thị.
- `N6` (Nested Sidebar Authority): Thẩm quyền điều hướng thuộc về Sidebar v2; loại bỏ các tab bar nội bộ trang cũ gây trùng lặp.
- `N7` (Disclosure Accessibility): Nút nhóm dùng `aria-expanded`, link active dùng `aria-current="page"`.

### Modal & Dialog Rules (`M1–M3`)
- `M1.1–M1.2`: Tuyệt đối không xếp chồng nhiều lớp popup modal. Ở giai đoạn này không mở modal thêm/sửa khi chưa có `UnitsController`.

---

## 4. Goals, Non-Goals & Anti-Goals

### Goals
1. **Operation-Grain Capability Disaggregation:** Split all grouped capabilities (`CAT.INGREDIENT.WRITE`, `CAT.DISH.WRITE`, `CAT.BOM.WRITE`, `ADMIN.EMPLOYEE.WRITE`, `APPR.RULES`, `ADMIN.OUTBOX`) into 18 distinct operation-level capabilities in `docs/conformance-contracts.json`.
2. **Ground Truth DTO Alignment:** Re-align `frontend/src/api/adminApi.ts` with C# `IngredientDto`, `DishDto`, and `PagedResponseDto<T>`.
3. **Server Pagination Preservation:** Expose `totalCount`, `pageNumber`, `pageSize`, `totalPages`, `hasPrev`, `hasNext` from `PagedResponseDto<T>` to Frontend views.
4. **View-Isolated Query Execution:** Refactor `AdminDataPage.tsx` to execute queries strictly based on the active URL view (`?view=ingredients` loads only ingredients; `?view=dishes` loads only dishes).
5. **Accessible Server Pagination UI:** Implement semantic, accessible pagination controls (`<nav aria-label="Phân trang danh mục">`) adhering to 3-Zone Workbench layout rules using existing `Button` primitives.
6. **Fail-Closed Write Guarding:** Classify `CAT.INGREDIENT.CREATE` as `BLOCKED` due to missing `UnitsController` lookup authority. Prohibit unbacked create forms or dummy GUID generation.

### Non-Goals
- Modifying Backend C# code, schemas, migrations, or database tables in this slice (Backend semantic changes require separate Owner authorization).
- Building an unbacked "Create Ingredient" modal that guesses `UnitId` or sends raw text `unitName`.
- Adding client-side search indexing or mock filtering engines.
- Refactoring `ApprovalRulesPage.tsx` (which is already read-only and aligned with `ApprovalRule`).

### Anti-Goals (Forbidden Outcomes)
- Introducing any `getBaseline*()` or hardcoded fallback data in `adminApi.ts` (violates Rule TA-5).
- Fabricating `categoryName` or any non-existent property in TypeScript types.
- Generating synthetic identifiers (e.g., `00000000-0000-0000-0000-000000000000` or random GUIDs) to force an unsupported API request to pass.
- Calling both ingredient and dish endpoints simultaneously on mount when only one view is active.
- Flattening `ApiError` instances into plain strings, which obscures HTTP 403 (Forbidden) and 409 (Conflict) states.

---

## 5. Technical Ground Truth (Backend Contracts)

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
*Technical Reality:*
- `UnitName` and `WarehouseName` are nullable string projections resolved via joins in `IngredientMapper`.
- `IsFreshDaily` is a nullable boolean flag indicating daily fresh delivery versus standard stock.
- `ReferencePrice` is a decimal monetary value.
- **`categoryName` does not exist.**

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

### D. Why `CAT.INGREDIENT.CREATE` is `BLOCKED`
`IngredientsController.CreateAsync` accepts `CreateIngredientRequest`:
```csharp
public class CreateIngredientRequest
{
    [Required] [MaxLength(50)]  public string  IngredientCode { get; set; } = string.Empty;
    [Required] [MaxLength(200)] public string  IngredientName { get; set; } = string.Empty;
    public bool    IsFreshDaily   { get; set; } = false;
    [Range(0, double.MaxValue)] public decimal ReferencePrice { get; set; } = 0;
    [Required]                  public string  UnitId         { get; set; } = string.Empty;
    public string? WarehouseId    { get; set; }
}
```
`IngredientService.CreateAsync` executes:
```csharp
var unitBytes = GuidHelper.ParseGuidString(dto.UnitId)
    ?? throw new ArgumentException("UnitId không hợp lệ.");
```
If `UnitId` is missing or not a 16-byte binary GUID referencing an existing row in `Units`, the service throws an exception and fails transaction validation. Because Backend exposes no `UnitsController` endpoint (`GET /api/units`), the client has no authoritative source to populate a unit dropdown. Inventing a dummy ID or sending `unitName` violates data integrity invariants. Consequently, `CAT.INGREDIENT.CREATE` must remain classified as `BLOCKED`.

---

## 6. UI Architecture & 3-Zone Workbench Specification

### Scoped Pre-Code UI Gate Block

```markdown
### Scoped Pre-Code UI Gate Block — Admin Data
- Route: /admin-data (N6 leaves: ?view=ingredients, ?view=dishes)
- Single Primary Work Object: OperationalFrame (Surfaces: admin.ingredients, admin.dishes)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: shared master data)
- RBAC Guards: RoleGuard(['ADMIN']) at route level; zero write actions exposed
- 6 UI States:
  - loading: WorkbenchSkeleton (kind: table, columns: 7 for ingredients / 5 for dishes, rows: 8, toolbar: true)
  - empty: StateBoundary (emptyTitle: "Chưa có danh mục nguyên liệu/món ăn", emptyDescription: "Backend chưa có dữ liệu persisted cho danh mục này.")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (ApiError status 403 renders distinct permission denied alert)
  - partial: N/A (all rendered columns map to authoritative C# DTO properties)
  - write-reconciliation: N/A (read-only surface, no concurrent write surface active)
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, StateBoundary, DataGrid, Button, Badge, Num, IdentifierText
- Compliance Pledges: D6 (>=12px), D7 (0 primary, 1 outline), T7 (frozen header), T8 (36-40px density), M1.2 (0 blocking modals), N6 (URL-leaf views)
```

### Zone Decomposition (Using 100% Existing Composites & Primitives)

#### Zone 1: WorkspaceHeader (`components/workbench/WorkspaceHeader.tsx` - `h-14` / 56px)
- **Title**: "Quản trị dữ liệu & Danh mục"
- **Context Badge**: `<Badge variant="neutral">` hiển thị số lượng bản ghi persisted thực tế từ response phân trang:
  - Ingredients: `${totalCount} nguyên liệu persisted`
  - Dishes: `${totalCount} món ăn persisted`
- **Actions**: Nút outline duy nhất `<Button variant="outline" size="default">Làm mới</Button>` kích hoạt nạp lại dữ liệu (`D7`).

#### Zone 2: TelemetrySubbar (`components/workbench/TelemetrySubbar.tsx` - `h-11` / 44px)
- **Left Control**: `<span className="text-xs font-semibold text-slate-700">`:
  - `activeView === 'ingredients' ? 'Danh mục nguyên liệu thực phẩm' : 'Danh mục món ăn tiêu chuẩn'`
- **Right Telemetry**: Pill nằm ngang:
  - `Tổng danh mục: ${totalCount} mặt hàng authoritative`

#### Zone 3: Data Grid & Server Pagination
- **State Boundary (`components/workbench/StateBoundary.tsx`)**: Bọc toàn bộ bảng; hiển thị `WorkbenchSkeleton` khi `isLoading`; hiển thị empty scenario khi `totalCount === 0`; hiển thị `ApiError` với nút `[Thử lại]` khi có lỗi mạng.
- **Table Columns (Ingredients - 7 columns via `DataGrid.tsx`)**:
  1. `code` (16%): `<IdentifierText value={row.ingredientCode} />`
  2. `name` (28%): `<span className="font-semibold text-slate-900 text-sm">{row.ingredientName}</span>`
  3. `unit` (10%, center): `<span className="font-mono text-xs text-slate-600">{row.unitName || '—'}</span>`
  4. `warehouse` (16%): `<span className="text-slate-600 text-sm">{row.warehouseName || '—'}</span>`
  5. `price` (14%, right): `<Num value={row.referencePrice} format="currency" className="font-bold text-slate-900 text-sm" />`
  6. `fresh` (8%, center): `<Badge variant="neutral" size="sm">{row.isFreshDaily ? 'Tươi sống' : 'Tiêu chuẩn'}</Badge>`
  7. `status` (8%, center): `<Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">{row.isActive ? 'Đang áp dụng' : 'Tạm khóa'}</Badge>`
- **Table Columns (Dishes - 5 columns via `DataGrid.tsx`)**:
  1. `code` (18%): `<IdentifierText value={row.dishCode} />`
  2. `name` (38%): `<span className="font-semibold text-slate-900 text-sm">{row.dishName}</span>`
  3. `type` (18%): `<span className="text-slate-600 text-sm">{row.dishType || '—'}</span>`
  4. `group` (14%): `<span className="text-slate-600 text-sm">{row.dishGroup || '—'}</span>`
  5. `status` (12%, center): `<Badge variant={row.isActive ? 'success' : 'neutral'} size="sm">{row.isActive ? 'Hoạt động' : 'Tạm dừng'}</Badge>`
- **Server Pagination Navigation (`components/ui/button.tsx`)**:
  - Rendered chỉ khi `totalPages > 1`.
  - Accessible container: `<nav aria-label="Phân trang danh mục" className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2">`.
  - Page indicator: `<span className="text-xs text-slate-500">Trang ${pageNumber}/${totalPages} (${totalCount} mục)</span>`.
  - Nút chuyển trang: `<Button variant="outline" size="xs" disabled={!hasPrev || isLoading}>Trang trước</Button>` và `<Button variant="outline" size="xs" disabled={!hasNext || isLoading}>Trang sau</Button>`.

---

## 7. Frontend API Contract Specifications

### Interfaces (`frontend/src/api/adminApi.ts`)

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

export interface PagedQueryParams {
  pageNumber?: number;
  pageSize?: number;
  searchKeyword?: string;
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
```

### Method Signatures

```typescript
export const adminApi = {
  getIngredients(params?: PagedQueryParams): Promise<PagedResult<IngredientItem>>;
  getDishes(params?: PagedQueryParams): Promise<PagedResult<DishItem>>;
  getApprovalRules(): Promise<ApprovalRuleItem[]>;
};
```

---

## 8. Machine Inventory Disaggregation (`docs/conformance-contracts.json`)

Grouped capabilities must be split into operation-grain capabilities:

| Previous Grouped Capability | New Disaggregated Capability | Operation | Delivery Class | Action Index ID | Reason / Gaps |
|---|---|---|---|---|---|
| `CAT.INGREDIENT.WRITE` | `CAT.INGREDIENT.CREATE` | `create` | `BLOCKED` | `Ingredients.Create` | Missing `UnitsController` authority; entity lacks optimistic concurrency token |
| `CAT.INGREDIENT.WRITE` | `CAT.INGREDIENT.UPDATE` | `update` | `PARTIAL` | `Ingredients.Update` | Missing unit selection authority for update; entity lacks optimistic concurrency token |
| `CAT.INGREDIENT.WRITE` | `CAT.INGREDIENT.CLOSE` | `delete` | `PARTIAL` | `Ingredients.Delete` | Soft-delete does not verify concurrent modification |
| `CAT.DISH.WRITE` | `CAT.DISH.CREATE` | `create` | `PARTIAL` | `Dishes.Create` | No optimistic concurrency token |
| `CAT.DISH.WRITE` | `CAT.DISH.UPDATE` | `update` | `PARTIAL` | `Dishes.Update` | No optimistic concurrency token |
| `CAT.DISH.WRITE` | `CAT.DISH.CLOSE` | `delete` | `PARTIAL` | `Dishes.Delete` | Soft-delete does not verify concurrent modification |
| `CAT.BOM.WRITE` | `CAT.BOM.LINE.ADD` | `create` | `PARTIAL` | `DishBom.AddBomLine` | No frontend mutation surface mapped |
| `CAT.BOM.WRITE` | `CAT.BOM.LINE.UPDATE` | `update` | `PARTIAL` | `DishBom.UpdateBomLine` | No frontend mutation surface mapped |
| `CAT.BOM.WRITE` | `CAT.BOM.LINE.CLOSE` | `delete` | `PARTIAL` | `DishBom.CloseBomLine` | Soft-close without concurrency token |
| `ADMIN.EMPLOYEE.WRITE` | `ADMIN.EMPLOYEE.CREATE` | `create` | `PARTIAL` | `AdminEmployees.Create` | Concurrency and UI surface unresolved |
| `ADMIN.EMPLOYEE.WRITE` | `ADMIN.EMPLOYEE.UPDATE` | `update` | `PARTIAL` | `AdminEmployees.Update` | Concurrency and UI surface unresolved |
| `ADMIN.EMPLOYEE.WRITE` | `ADMIN.EMPLOYEE.STATUS` | `update` | `PARTIAL` | `AdminEmployees.UpdateStatus` | Concurrency and UI surface unresolved |
| `ADMIN.OUTBOX` | `ADMIN.OUTBOX.READ` | `read` | `PARTIAL` | `LifecycleOutbox.Get` | Outbox monitor surface not yet mapped |
| `ADMIN.OUTBOX` | `ADMIN.OUTBOX.REPLAY` | `create` | `PARTIAL` | `LifecycleOutbox.Replay` | Outbox replay surface not yet mapped |
| `APPR.RULES` | `APPR.RULES.READ` | `read` | `READY` | `ApprovalRules.GetRules`, `ApprovalRules.GetRuleById` | Mapped to `admin.approval-rules` surface |
| `APPR.RULES` | `APPR.RULES.CREATE` | `create` | `PARTIAL` | `ApprovalRules.CreateRule` | No write surface exposed |
| `APPR.RULES` | `APPR.RULES.UPDATE` | `update` | `PARTIAL` | `ApprovalRules.UpdateRule` | No write surface exposed |
| `APPR.RULES` | `APPR.RULES.DELETE` | `delete` | `PARTIAL` | `ApprovalRules.DeleteRule` | No write surface exposed |

---

## 9. Verification & Test Audit Strategy

### Test Suites & Rules

1. **Rule TA-1 (Backend-Grounded Fixtures)**:
   - All test mocks in `ApiContracts.test.ts` and `AdminData.test.tsx` use exact PascalCase/camelCase properties matching C# DTOs.
   - Example fixture:
     ```json
     {
       "items": [{
         "ingredientId": "00000000-0000-0000-0000-000000000001",
         "ingredientCode": "NL-GAO",
         "ingredientName": "Gạo tẻ ST25",
         "unitId": "00000000-0000-0000-0000-000000000010",
         "unitName": "kg",
         "warehouseId": "00000000-0000-0000-0000-000000000100",
         "warehouseName": "Kho Lương Thực",
         "referencePrice": 28000,
         "isFreshDaily": false,
         "isActive": true
       }],
       "totalCount": 30,
       "pageNumber": 1,
       "pageSize": 25,
       "totalPages": 2,
       "hasPrev": false,
       "hasNext": true
     }
     ```
2. **Rule TA-2 (No Self-Mocking)**:
   - Test `AdminDataPage` as a whole component rendered inside `<MemoryRouter>` and `<AuthProvider>`. Mock only `adminApi` or `fetch`.
3. **Rule TA-4 (4 Behavioral Scenarios)**:
   - **Scenario 1 (Success & View Isolation)**: Assert only `getIngredients` is called when `view=ingredients`; assert only `getDishes` is called when `view=dishes`. Assert all 7 authoritative columns render.
   - **Scenario 2 (Empty / Zero Total Count)**: Assert `StateBoundary` empty state renders cleanly when `totalCount === 0`.
   - **Scenario 3 (Error & Retry)**: Assert API rejection displays the error message and clicking "Thử lại" triggers a re-fetch.
   - **Scenario 4 (Pagination Navigation)**: Assert clicking "Trang sau" invokes `getIngredients({ pageNumber: 2, pageSize: 25 })` and updates boundary states.
4. **Machine Conformance Test**:
   - `scripts/check-conformance-contracts.test.mjs` verifies that every single action in `docs/backend-action-index.json` is mapped 1:1, that `CAT.INGREDIENT.CREATE` is `BLOCKED`, and that no dangling capability references exist.

---

## 10. What is Left to the Builder

The builder (executing agent) will:
1. Run the failing conformance test in `scripts/check-conformance-contracts.test.mjs`.
2. Update `docs/conformance-contracts.json` to disaggregate the capabilities and resolve all requirement references.
3. Add failing contract tests in `frontend/src/__tests__/ApiContracts.test.ts` and implement `adminApi.ts`.
4. Add failing component tests in `frontend/src/__tests__/AdminData.test.tsx` and refactor `AdminDataPage.tsx` using 100% existing UI Kit components.
5. Run the full verification suite (`conformance`, `unit`, `lint`, `build`, `depcruise`, `diff-check`).
6. Apply the 3 mandatory review gates (`ipc-test-audit`, `ipc-ui-review`, `ipc-code-review`) and record the results in `.planning/WORK.md`.
