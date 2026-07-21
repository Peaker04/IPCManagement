# Phase 09: Supplier canonical refresh and purchasing workflow alignment - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 31 planned new/modified files or file groups
**Analogs found:** 29 / 31
**Authority note:** Phase research reports the GitNexus index stale relative to the current commit, and GitNexus MCP was unavailable in this mapping session. Direct source/test evidence below is authoritative; re-index before implementation and run symbol impact before every edit.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `Services/SampleData/PurchaseHistorySourceParser.cs` | service/utility | file-I/O, transform | `Services/SampleData/XlsxWorkbookReader.cs`; `SampleDataImportService.cs:393-520` | role-match |
| `Services/SampleData/PurchaseHistoryNormalizationPolicy.cs` | utility | transform | `SampleDataImportService.cs:452-475`; tests `:16-36` | role-match |
| `Services/SampleData/PurchaseHistoryReconciliationService.cs` | service | batch, CRUD | `SampleDataImportService.cs:393-520`; `ApprovalHandlers.cs:23-50` | role/data-flow composite |
| `Models/DTOs/SampleData/*Reconciliation*.cs` | model | request-response | `Models/DTOs/SampleData/SampleDataImportDto.cs` | exact role |
| `Controllers/SampleDataController.cs` | controller | request-response | same file `:11-49` | exact |
| Phase 9 reconciliation/decision/exception entities and EF configuration | model/config | CRUD, event-driven | current entities plus migration `20260719143000...cs:15-56` | role-match |
| new Phase 9 forward migration + model snapshot | migration | batch/CRUD | `20260719143000_AddSupplementalMaterialRequests.cs` | exact role |
| `Services/Approvals/ApprovalHandlers.cs` | service | event-driven, CRUD | same file `:11-126` | exact |
| `Services/Approvals/ApprovalInboxService.cs` | service | request-response | same file `:295-328` | exact |
| approval target enum/registry/DTOs/validators | model/config | request-response | `IApprovalTargetHandler.cs`, `ApprovalWorkflowValidators.cs`, existing workflow DTOs | exact role |
| `Services/Workflow/PurchaseRequestWorkflowService.cs` and interface | service | CRUD, request-response | same file `:29-140`, `:526-586` | exact |
| purchase workbench DTO/query files | model | request-response | `PurchasePlanPageDto.cs`, `PurchaseRequestQueryDto.cs`, `PurchaseOrderPageDto.cs` | exact role |
| `Controllers/PurchaseWorkflowController.cs` | controller | request-response | same file `:11-105` | exact |
| `Services/Workflow/PurchaseOrderService.cs` | service | CRUD | same file `:27-101` | exact |
| `Services/Workflow/PurchaseReceivingService.cs` | service | CRUD/event-driven | `PurchaseOrderService.cs:230-263` | role/data-flow match |
| `Controllers/WarehousePurchaseReceiptsController.cs` | controller | request-response | `PurchaseWorkflowController.cs:11-105`, with Warehouse policy | role-match |
| `frontend/src/features/workflow/workflowApi.ts` | service/provider | request-response | same file `:1771-1797` | exact |
| `frontend/.../weekly-menu/demand/useMaterialDemand.ts` and demand UI | hook/component | event-driven, request-response | existing hook plus Weekly Menu purchase summary | exact role |
| `frontend/src/features/workflow/pages/ApprovalPage.tsx` / `ApprovalQueue.tsx` | component | request-response, event-driven | same page `:80-129`, `:392-443` | exact |
| `frontend/src/features/workflow/pages/PurchasingPage.tsx` | component | request-response | same page `:1-115` | exact role; structure must change |
| `frontend/src/features/workflow/purchasing/PurchasingWorkflowGuide.tsx` | component | transform/event-driven | `ViewSwitcher` usage in `PurchasingPage.tsx:43-101` | partial; no six-stage analog |
| `ServiceDateGroup.tsx`, `SupplierEvidencePanel.tsx`, `PriceExceptionPanel.tsx`, `ReceivingProgress.tsx` | component | request-response | existing purchasing sections; `WarehousePage.tsx:306-340` | role-match |
| Warehouse page/hook receipt form | component/hook | CRUD, request-response | existing `WarehousePage.tsx`; move transaction ownership from purchasing order hook | role-match |
| four new backend Phase 9 test files | test | transform/CRUD/request-response | `SampleDataImportServiceTests.cs`, `PurchaseRequestPlannerTests.cs` | exact role |
| frontend purchasing/demand model and hook tests | test | transform/event-driven | existing `purchasingModel.test.ts`, `purchasingHooksBehavior.test.tsx`, `demandModel.test.ts` | exact role |
| focused Phase 9 Playwright spec/fixtures | test | request-response, event-driven | `frontend/tests/route-smoke.spec.ts:822-900` | exact role |
| `frontend/tests/route-smoke.spec.ts` | test | request-response | same file | exact |
| `frontend/tests/ui-audit.spec.ts` | test | request-response | same file `:16-45` | exact |
| `frontend/tests/visual-routes.spec.ts` + snapshots | test | request-response | same file `:4-58` | exact |
| disposable clone/apply verification artifact | config/test | batch | no repository analog | none |
| operator backup/restore evidence format | config | file-I/O | no approved repository analog | none; human checkpoint |

## Pattern Assignments

### Reconciliation parser, policy, service and DTOs

**Primary analog:** `backend/src/IPCManagement.Api/Services/SampleData/SampleDataImportService.cs`

**Workbook traversal and source-row boundary** (`393-436`):

```csharp
var purchaseFile = sourceDirectory.GetFiles("IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx").FirstOrDefault();
var sheetNames = _reader.GetSheetNames(purchaseFile.FullName)
    .Where(name => !string.Equals(name, "NGUỒN", StringComparison.OrdinalIgnoreCase))
    .Where(name => !string.Equals(name, "SUMMARY", StringComparison.OrdinalIgnoreCase))
    .ToList();
rows = _reader.ReadTable(purchaseFile.FullName, sheetName, PurchaseRequiredHeaders, request.MaxRows);
var supplierName = ResolveSupplierName(sheetName, supplierPolicies);
```

Copy the reader/sheet mechanics, not the mutation policy. New parser candidates must include workbook hash, sheet, original row, raw cells, normalized cells, source key, business key and blockers. Replace the hard-coded 19.5 filename with the audited server-known 20.7 source identity.

**Current anti-pattern to characterize and replace** (`450-519`):

```csharp
var deliveryDate = ParseDate(Get(row, "Ngày Giao hàng"));
var itemName = Get(row, "Tên hàng");
if (deliveryDate is null || string.IsNullOrWhiteSpace(itemName) || quantity <= 0 || unitPrice <= 0)
{
    fileResult.RowsSkipped++;
    continue;
}
var unit = EnsureUnit(NormalizeUnitCode(Get(row, "Đơn vị tính")), ...);
// immediately ensures ingredient, receipt, receipt line, movement and current stock
```

Preview must instead be pure/`AsNoTracking`, produce row-level diagnostics, and never silently skip, dynamically create an unknown unit, clamp a date, or default `KG`. Preview and apply call the same policy/classifier. Apply rebuilds and compares source hash, policy/as-of, database fingerprint and exact action identities/counts inside an explicit transaction before writing.

**SUMMARY mapping to retain but harden** (`523-556`): read `SUMMARY` C/D/E/F with deterministic sheet keys. Add explicit schema/header/pseudo/placeholder exclusion and approved data-bearing-sheet inclusion; do not accept every nonblank C/D pair.

### Development-only reconciliation controller

**Analog:** `backend/src/IPCManagement.Api/Controllers/SampleDataController.cs:11-49`

```csharp
[ApiController]
[Route("api/sample-data")]
[Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
[EnableRateLimiting("api-general")]
public class SampleDataController : ControllerBase
{
    if (!_environment.IsDevelopment())
        return StatusCode(StatusCodes.Status403Forbidden,
            ApiResponse.FailResult("Import dữ liệu mẫu chỉ được bật trong môi trường Development."));
    var result = await _sampleDataImportService.ImportAsync(request, cancellationToken);
    return Ok(ApiResponse<SampleDataImportResultDto>.SuccessResult(result, message));
}
```

Add preview/apply under this same Catalog + Development + production-hide boundary. Accept manifest/backup evidence, never a browser filesystem path. Follow `PurchaseWorkflowController.cs:59-76` for `KeyNotFoundException` → 404 and domain/argument exceptions → 400.

### Persistence and forward migration

**Analog:** `backend/src/IPCManagement.Api/Migrations/20260719143000_AddSupplementalMaterialRequests.cs:9-56`

```csharp
[DbContext(typeof(IpcManagementContext))]
[Migration("20260719143000_AddSupplementalMaterialRequests")]
public partial class AddSupplementalMaterialRequests : Migration
{
    migrationBuilder.CreateTable(... binary(16) ids, decimal(18,6), varchar bounds ...,
        constraints: table => {
            table.PrimaryKey("PRIMARY", x => x.requestId);
            table.ForeignKey(... onDelete: ReferentialAction.Restrict);
        })
        .Annotation("MySql:CharSet", "utf8mb4")
        .Annotation("Relational:Collation", "utf8mb4_unicode_ci");
    migrationBuilder.CreateIndex(... unique: true);
}
```

Use a new forward-only migration; do not edit applied migrations or the untracked cleanup SQL. Persist reconciliation run/manifest/evidence, source row/action identity, package conversion snapshot, explicit supplier confirmation/evidence and versioned price exception. Use bounded strings, binary(16) IDs, `Restrict` FKs, unique retry/business keys and composite lookup indexes. Update `IpcManagementContextModelSnapshot.cs` through EF conventions.

### Approval targets, handlers and inbox

**Analog:** `backend/src/IPCManagement.Api/Services/Approvals/ApprovalHandlers.cs:11-97`

```csharp
await using var transaction = await Context.Database.BeginTransactionAsync();
try {
    var result = await HandleCoreAsync(entityId, request, actorId);
    await Context.SaveChangesAsync();
    await transaction.CommitAsync();
    return result;
} catch {
    await transaction.RollbackAsync();
    throw;
}
```

**History/idempotency pattern** (`63-95`):

```csharp
var alreadyResolved = await Context.Approvalhistories.AsNoTracking()
    .AnyAsync(item => item.TargetType == targetType && item.TargetId == targetId);
if (alreadyResolved) throw new InvalidOperationException("Phiếu này đã được xử lý.");
Context.Approvalhistories.Add(new Approvalhistory {
    TargetType = targetType, TargetId = targetId,
    Decision = request.Status.ToString().ToUpperInvariant(),
    OldStatus = oldStatus, NewStatus = newStatus,
    Reason = request.Reason, ActionBy = actorId, ActionAt = actionAt
});
```

Add typed material-demand and price-exception handlers to the existing registry, derive actor server-side, validate manager policies and append history atomically. Price exceptions need proposal/evidence version identity so a changed decision cannot reuse stale approval.

**Inbox anti-analog:** `ApprovalInboxService.cs:307-328` currently emits `ItemType = "price-alert"` tied to a purchase request. Replace it with a durable exception target having its own `TargetType`, `TargetId`, evidence, reason and working approve/reject actions; add material demand as a first-class inbox target.

### Supplier decision, submit gate and week read model

**Analog:** `PurchaseRequestWorkflowService.cs:74-140`

```csharp
var quotations = await _context.Supplierquotations
    .Include(q => q.Supplier)
    .Where(q => ingredientIds.Contains(q.IngredientId) && q.IsActive != false &&
        q.Supplier.IsActive != false && q.EffectiveFrom <= today &&
        (q.EffectiveTo == null || q.EffectiveTo >= today))
    .ToListAsync(cancellationToken);
var receiptLines = await _context.Inventoryreceiptlines
    .Include(line => line.Unit).Include(line => line.Receipt).ThenInclude(r => r.Supplier)
    .Where(line => ingredientIds.Contains(line.IngredientId))
    .OrderByDescending(line => line.Receipt.ReceiptDate)
    .ThenByDescending(line => line.Receipt.CreatedAt).ToListAsync(cancellationToken);
```

Keep effective quotation/latest valid receipt evidence selection, but remove `activeSuppliers.FirstOrDefault()` and do not write a supplier during generation. Suggestions are candidates only; confirmation snapshots evidence, actor and time.

**Submit validation analog:** `PurchaseRequestWorkflowService.cs:526-566`

```csharp
if (!ApprovedDemandStatuses.Contains(materialRequest.Status))
    throw new InvalidOperationException("Cần duyệt nhu cầu nguyên liệu trước khi gửi đơn mua.");
if (!currentShortageLineIds.SetEquals(purchaseLineDemandIds))
    throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
foreach (var line in purchaseRequest.Purchaserequestlines) {
    if (line.Supplier is null || line.Supplier.IsActive == false) ...
    var referencePrice = await ResolveReferencePriceAsync(line, cancellationToken);
}
```

Extend this gate to require an explicit matching supplier-decision snapshot and approved current price exception only when server variance is strictly `> 15m` (test 14.99/15.00/15.01). Do not globally alter `IsPriceIncreaseWarning` without impact analysis because approval/report callers use it.

The new week endpoint should use query DTO/page conventions from `PurchasePlanPageDto.cs` and `PurchaseOrderPageDto.cs`: Monday week, nested service dates, `FULLDAY`, server-derived stages/blockers/totals and ordered/received/remaining progress. Browser must not recompute eligibility or variance.

### Supplier-split purchase orders

**Analog:** `PurchaseOrderService.cs:27-101`

```csharp
if (purchaseRequest.Status != "APPROVED")
    throw new InvalidOperationException("Chỉ có thể tạo đơn mua hàng từ đề xuất mua hàng đã được duyệt.");
var linesToConvert = purchaseRequest.Purchaserequestlines
    .Where(line => line.Purchaseorderline is null).ToList();
var existingOrdersBySupplier = await _context.Purchaseorders
    .Where(po => po.PurchaseRequestId == purchaseRequestIdBytes)
    .ToDictionaryAsync(po => Convert.ToBase64String(po.SupplierId), cancellationToken);
foreach (var supplierGroup in linesToConvert.GroupBy(line => Convert.ToBase64String(line.SupplierId))) { ... }
```

Preserve grouping by confirmed supplier and existing-order lookup. Improve retry behavior: if all lines already converted, return the existing order set/progress rather than treating a safe retry as a duplicate failure. Back this with a unique database key and integration test.

### One Warehouse-owned receiving transaction

**Analog:** `PurchaseOrderService.cs:239-263`

```csharp
await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
_context.Inventoryreceipts.Add(receipt);
foreach (var line in receipt.Inventoryreceiptlines)
    await _stockLedgerService.AddStockAsync(warehouseId, line.IngredientId, line.UnitId,
        line.Quantity, "RECEIPT", "purchaseorders", order.PurchaseOrderId, userIdBytes, ...);
order.Status = ComputeOrderStatus(order.Purchaseorderlines);
await _context.SaveChangesAsync(cancellationToken);
await transaction.CommitAsync(cancellationToken);
```

Extract/delegate this into one `PurchaseReceivingService` and a separately Warehouse-authorized controller. Do not put a Warehouse action beneath the Purchase-policy controller (stacked policies would require both). Validate remaining quantity, warehouse, lot, manufacture/expiry ordering and idempotency key; create receipt/lines, ledger/current stock and PO progress in one transaction. Purchasing receives read-only progress only.

### Controller authorization and response mapping

**Analog:** `PurchaseWorkflowController.cs:11-105`

```csharp
[Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
[HttpPatch("requests/{id}/lines/{lineId}/supplier")]
[Authorize(Policy = AuthorizationPolicies.PurchaseGenerateAccess)]
public async Task<IActionResult> UpdateLineSupplier(...) {
    var userId = _currentUserService.GetUserId(User);
    try { ... return Ok(ApiResponse.SuccessResult(...)); }
    catch (KeyNotFoundException ex) { return NotFound(ApiResponse.FailResult(ex.Message)); }
    catch (InvalidOperationException ex) { return BadRequest(ApiResponse.FailResult(ex.Message)); }
}
```

Use server identity and existing policies. New Warehouse receiving controller gets the Warehouse policy only; approval decisions remain manager-routed through the existing approval controller.

### RTK Query contracts and invalidation

**Analog:** `frontend/src/features/workflow/workflowApi.ts:1771-1797`

```ts
getApprovalRecords: builder.query<ApprovalInboxPage, ApprovalInboxQuery | void>({
  query: query => ({ url: '/approvals/inbox', params: { limit: query?.limit ?? 20, ... } }),
  transformResponse: response => ({ items: getData(response).items.map(mapApprovalInboxItem), ... }),
  providesTags: ['WorkflowReports'],
}),
executeApprovalDecision: builder.mutation<ApiResponse<unknown>, ApprovalDecisionRequest>({
  query: ({ targetType, targetId, status, reason }) => ({
    url: `/approvals/${targetType}/${targetId}`, method: 'POST', body: { status: status === 'Approve' ? 0 : 1, reason },
  }),
  invalidatesTags: ['WorkflowReports'],
}),
```

Add typed week/detail/supplier-decision/exception/order/receipt endpoints in this existing API. Use scoped tags for week, request, approval and orders so Warehouse receipt refreshes Purchasing progress. Server state stays in RTK Query; local state is only URL navigation and open form/dialog input.

### Purchasing workbench and route state

**Analog to reshape:** `PurchasingPage.tsx:1-35` imports `OperationalFrame`, `CommandBar`, `ContextStrip`, `ViewSwitcher` and `useSearchParams`, then initializes one-time local `activeView`. Replace the five-view union with URL-restorable `week`, `date`, `stage` and a six-step ordered guide. Preserve `OperationalFrame` composition and extracted feature hooks/sections.

Do not copy the current first-document conveniences (`purchasingDocuments[0]`, disconnected tabs). Use stable server IDs, one active date, visible blocker reasons and explicit draft/supplier confirmation.

For dense tables copy `WarehousePage.tsx:306-340`:

```tsx
<SectionPanel title="Tồn kho hiện tại" ...>
  <TableViewport ariaLabel="..." caption="...">
    <table className="ipc-data-table"><thead>...</thead><tbody>...</tbody></table>
  </TableViewport>
  <PaginationBar page={...} pageSize={...} totalItems={...} onPageChange={...} />
</SectionPanel>
```

Apply the UI-SPEC fixed 480px/400px viewport geometry, real headers during loading/empty/error, local horizontal scroll, eight-row paging unless server contract differs, and no page-level overflow.

### Approval UI and accessible confirmation

**Analog:** `ApprovalPage.tsx:99-129`, `392-443`

```tsx
if (status === 'Reject' && !reason.trim()) { toast(...); return; }
if (!record.targetType || !record.targetId) { toast(...); return; }
await executeApprovalDecision({ targetType, targetId, status, reason: reason.trim() || null }).unwrap();
```

Reuse `Dialog`, labelled title/description, required rejection reason, destructive reject button and neutral safe button. Phase 9 must replace generic cancel labels with the contextual safe labels, focus the safe action initially, return focus to the trigger/record, keep pending noncancellable mutations open, and announce outcomes. Material demand and price exception must no longer be disabled `price-alert` records.

### Backend tests

**Analogs:** `SampleDataImportServiceTests.cs:16-36`, `:390-439`; `PurchaseRequestPlannerTests.cs:8-36`

```csharp
[Theory]
[InlineData("Kg", "KG")]
[InlineData("Bịch", "BICH")]
public void NormalizeUnitCode_Should_Handle_CommonVietnameseUnits(...) { ... }

await using var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();
var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
```

Create the four named Wave 0 files. Use table-driven pure tests for aliases, ambiguous `kh`/`canh`, package/date limits and strict price boundaries; SQLite/context fixtures for preview purity, drift, dependency actions, approval history, explicit confirmation, PO retry and atomic partial/full Warehouse receipt. Avoid reflection for new public policy objects; inject the policy/service directly. Disposable-clone apply tests are separate from live DB and require operator backup/restore evidence.

### Frontend and browser tests

**Route/E2E analog:** `frontend/tests/route-smoke.spec.ts:822-900` stubs the inbox, asserts the exact approval request body and returns a status/history payload. Extend this harness for material demand, price exception, week/date workbench, supplier confirmation, PO split and Warehouse partial/final receive; do not create another browser harness.

**Audit/visual analogs:**

```ts
// ui-audit.spec.ts:16-31
const protectedRoutes = [... APPROVALS, PURCHASING, WAREHOUSE ...];
const viewports = [{ width: 1365, height: 900 }, { width: 390, height: 844 }];

// visual-routes.spec.ts:4-20
const visualRoutes = [...];
const visualViewports = [{ name: 'desktop', ... }, { name: 'mobile', ... }];
```

Add 1280x900 and 768x1024 Phase 9 geometry assertions, URL restore, explicit-selection checks, no page overflow, table-owned scrolling, focus return and pending-dialog behavior. Update existing purchasing/approvals/warehouse snapshots only after deterministic fixtures pass.

## Shared Patterns

### Authorization and actor identity

Source: `SampleDataController.cs:11-40`, `PurchaseWorkflowController.cs:11-38`. Controllers use policy attributes, rate limiting and `_currentUserService.GetUserId(User)`; client payloads never supply actor IDs. Keep Development/Catalog guards for reconciliation, manager target policies for decisions, Purchase policies for decisions/order handoff, and a separate Warehouse-only receipt endpoint.

### Transactions and audit

Source: `ApprovalHandlers.cs:31-50`, `PurchaseOrderService.cs:239-261`. Multi-entity state transitions use explicit EF transactions, one `SaveChanges`, commit on success and rollback/throw on failure. Persist actor/time/reason/evidence and use unique retry keys. Reconciliation additionally compares fresh manifest/fingerprint/counts inside the transaction.

### Error responses and UI preservation

Source: `PurchaseWorkflowController.cs:59-76`; `ApprovalPage.tsx:99-129`. Domain exceptions become safe 400/404 `ApiResponse` messages. Frontend mutations use `.unwrap()`, keep forms/dialogs open on failure, preserve values and surface blocking errors accessibly.

### Server authority

The server owns demand approval eligibility, shortages, supplier evidence, variance/exception eligibility, stages, totals and receipt progress. Frontend owns only URL week/date/stage and transient forms. RTK Query invalidation refreshes all affected routes.

### Immutable operational history

Do not overwrite linked/approved/received receipts, lines, movements, PRs or POs. Version corrections or retain snapshots. Hard-delete only source-absent sample-generated orphans proven dependency-free; remap/deactivate referenced catalog records.

### Vocabulary and layout

Use the approved Vietnamese nouns (`Nhu cầu nguyên liệu`, `Đề xuất mua`, `Đơn đặt hàng`, `Báo giá`, `Nhập kho`), existing IPC tokens/primitives, native tables, bounded paging and visible status text. No new UI kit, upload/path UI, marketing styling or client-computed gates.

## No Analog Found

| File/Artifact | Role | Data Flow | Reason / Planner Direction |
|---|---|---|---|
| disposable database clone + preview/apply/no-op/restore verification fixture | test/config | batch | No repository-standard clone harness was found. Define an operator-approved, non-live target and checkpoint; unit tests are not restore evidence. |
| backup/restore evidence record format | config/model | file-I/O | Business/operations choice remains open. Plan a human verification checkpoint before apply; never infer or fabricate evidence. |
| six-stage `PurchasingWorkflowGuide` | component | event-driven/transform | Existing `ViewSwitcher` supplies styling/semantics only; no exact six-stage prerequisite guide exists. Follow `09-UI-SPEC.md` ordered-list/status contract. |

## Metadata

**Analog search scope:** `backend/src/IPCManagement.Api/{Controllers,Services,Models,Migrations}`, `backend/tests/IPCManagement.Api.Tests`, `frontend/src/{components,features}`, `frontend/tests`

**Strong analogs read:** 14 files; additional DTO/entity/test paths scanned by filename and targeted search

**Pattern extraction date:** 2026-07-21

**Implementation preflight:** re-index GitNexus, inspect dirty-file ownership, run upstream impact on every symbol selected for editing, warn on HIGH/CRITICAL risk, and use direct current source as the final truth.
