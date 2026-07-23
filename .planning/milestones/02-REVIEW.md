---
phase: 02-data-driven-workflow-integration-from-ipc-sample-files
reviewed: 2026-07-03T03:10:04Z
depth: standard
files_reviewed: 112
files_reviewed_list:
  - README.md
  - backend/src/IPCManagement.Api/Controllers/ApprovalsController.cs
  - backend/src/IPCManagement.Api/Controllers/CoordinationController.cs
  - backend/src/IPCManagement.Api/Controllers/InventoryIssuesController.cs
  - backend/src/IPCManagement.Api/Controllers/InventoryReceiptsController.cs
  - backend/src/IPCManagement.Api/Controllers/MaterialDemandController.cs
  - backend/src/IPCManagement.Api/Controllers/PurchaseOrdersController.cs
  - backend/src/IPCManagement.Api/Controllers/PurchaseWorkflowController.cs
  - backend/src/IPCManagement.Api/Controllers/SupplierQuotationsController.cs
  - backend/src/IPCManagement.Api/Controllers/WorkflowReportsController.cs
  - backend/src/IPCManagement.Api/Data/IpcManagementContext.cs
  - backend/src/IPCManagement.Api/Data/Repositories/IInventoryIssueRepository.cs
  - backend/src/IPCManagement.Api/Data/Repositories/InventoryIssueRepository.cs
  - backend/src/IPCManagement.Api/Data/Repositories/ProductionPlanRepository.cs
  - backend/src/IPCManagement.Api/DependencyInjection.cs
  - backend/src/IPCManagement.Api/Helpers/Mappers/InventoryMapper.cs
  - backend/src/IPCManagement.Api/Migrations/20260702061320_AddImportAuditFields.cs
  - backend/src/IPCManagement.Api/Migrations/20260702072352_AddProductionPlanUpdatedAt.cs
  - backend/src/IPCManagement.Api/Migrations/20260702121000_AddProductionPlanMetadata.cs
  - backend/src/IPCManagement.Api/Migrations/20260702124738_AddSupplierQuotations.cs
  - backend/src/IPCManagement.Api/Migrations/20260702164531_AddPurchaseOrders.cs
  - backend/src/IPCManagement.Api/Migrations/20260702165732_FixPurchaseRequestStatusEnum.cs
  - backend/src/IPCManagement.Api/Migrations/20260702194500_AddPurchaseLineDeliveryNote.cs
  - backend/src/IPCManagement.Api/Migrations/20260702203000_AddInventoryIssueReceivedAt.cs
  - backend/src/IPCManagement.Api/Migrations/20260702204500_AddInventoryReturnType.cs
  - backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Approvals/ApprovalWorkflowDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Coordination/CoordinationDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Coordination/MenuScheduleDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Coordination/SignoffDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Inventory/InventoryDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/ProductionPlan/ProductionPlanDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/SampleData/SampleDataImportDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Supplier/SupplierQuotationDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Workflow/MaterialDemandDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Workflow/PurchaseOrderDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Workflow/PurchaseRequestWorkflowDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Workflow/UpdatePurchaseRequestLineSupplierDto.cs
  - backend/src/IPCManagement.Api/Models/DTOs/Workflow/WorkflowReportDto.cs
  - backend/src/IPCManagement.Api/Models/Entities/Ingredient.cs
  - backend/src/IPCManagement.Api/Models/Entities/Inventoryissue.cs
  - backend/src/IPCManagement.Api/Models/Entities/Inventoryreturn.cs
  - backend/src/IPCManagement.Api/Models/Entities/Mealquantityplanline.cs
  - backend/src/IPCManagement.Api/Models/Entities/Menuschedule.cs
  - backend/src/IPCManagement.Api/Models/Entities/Menuversion.cs
  - backend/src/IPCManagement.Api/Models/Entities/Productionplan.cs
  - backend/src/IPCManagement.Api/Models/Entities/Purchaseorder.cs
  - backend/src/IPCManagement.Api/Models/Entities/Purchaseorderline.cs
  - backend/src/IPCManagement.Api/Models/Entities/Purchaserequest.cs
  - backend/src/IPCManagement.Api/Models/Entities/Purchaserequestline.cs
  - backend/src/IPCManagement.Api/Models/Entities/Supplier.cs
  - backend/src/IPCManagement.Api/Models/Entities/Supplierquotation.cs
  - backend/src/IPCManagement.Api/Models/Entities/Unit.cs
  - backend/src/IPCManagement.Api/Models/Entities/User.cs
  - backend/src/IPCManagement.Api/Models/Validators/CoordinationValidators.cs
  - backend/src/IPCManagement.Api/Models/Validators/InventoryValidators.cs
  - backend/src/IPCManagement.Api/Models/Validators/SupplierQuotationValidators.cs
  - backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs
  - backend/src/IPCManagement.Api/Services/Approvals/ApprovalHandlers.cs
  - backend/src/IPCManagement.Api/Services/Approvals/ApprovalInboxService.cs
  - backend/src/IPCManagement.Api/Services/Approvals/ApprovalWorkflowService.cs
  - backend/src/IPCManagement.Api/Services/CoordinationService.cs
  - backend/src/IPCManagement.Api/Services/ICoordinationService.cs
  - backend/src/IPCManagement.Api/Services/IInventoryIssueService.cs
  - backend/src/IPCManagement.Api/Services/IInventoryReceiptService.cs
  - backend/src/IPCManagement.Api/Services/ISupplierQuotationService.cs
  - backend/src/IPCManagement.Api/Services/InventoryIssueService.cs
  - backend/src/IPCManagement.Api/Services/InventoryReceiptService.cs
  - backend/src/IPCManagement.Api/Services/InventoryReturnService.cs
  - backend/src/IPCManagement.Api/Services/ProductionPlanService.cs
  - backend/src/IPCManagement.Api/Services/SampleData/ISampleDataImportService.cs
  - backend/src/IPCManagement.Api/Services/SampleData/SampleDataImportService.CustomMenu.cs
  - backend/src/IPCManagement.Api/Services/SampleData/SampleDataImportService.cs
  - backend/src/IPCManagement.Api/Services/StockShortageException.cs
  - backend/src/IPCManagement.Api/Services/SupplierQuotationService.cs
  - backend/src/IPCManagement.Api/Services/Workflow/IMaterialDemandService.cs
  - backend/src/IPCManagement.Api/Services/Workflow/IPurchaseOrderService.cs
  - backend/src/IPCManagement.Api/Services/Workflow/IPurchaseRequestWorkflowService.cs
  - backend/src/IPCManagement.Api/Services/Workflow/IWorkflowReportService.cs
  - backend/src/IPCManagement.Api/Services/Workflow/MaterialDemandService.cs
  - backend/src/IPCManagement.Api/Services/Workflow/PurchaseOrderService.cs
  - backend/src/IPCManagement.Api/Services/Workflow/PurchaseRequestWorkflowService.cs
  - backend/src/IPCManagement.Api/Services/Workflow/WorkflowReportService.cs
  - backend/tests/IPCManagement.Api.Tests/CoordinationControllerTests.cs
  - backend/tests/IPCManagement.Api.Tests/CoordinationTransactionTests.cs
  - backend/tests/IPCManagement.Api.Tests/InventoryIssueServiceTests.cs
  - backend/tests/IPCManagement.Api.Tests/InventoryReturnServiceTests.cs
  - backend/tests/IPCManagement.Api.Tests/SampleDataImportServiceTests.cs
  - backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs
  - frontend/src/api/apiSlice.ts
  - frontend/src/components/common/ApprovalQueue.tsx
  - frontend/src/components/common/DemandSummary.tsx
  - frontend/src/components/common/RoleInbox.tsx
  - frontend/src/features/coordination/components/action-toolbar.tsx
  - frontend/src/features/coordination/components/order-status-banner.tsx
  - frontend/src/features/coordination/components/order-table.tsx
  - frontend/src/features/coordination/coordinationApi.ts
  - frontend/src/features/coordination/pages/CoordinationPage.tsx
  - frontend/src/features/coordination/types.ts
  - frontend/src/features/dashboard/pages/DashboardPage.tsx
  - frontend/src/features/projects/dishCatalogApi.ts
  - frontend/src/features/projects/pages/WeeklyMenuPage.tsx
  - frontend/src/features/reports/pages/ReportsPage.tsx
  - frontend/src/features/workflow/index.ts
  - frontend/src/features/workflow/pages/AdminDataPage.tsx
  - frontend/src/features/workflow/pages/ApprovalPage.tsx
  - frontend/src/features/workflow/pages/PurchasingPage.tsx
  - frontend/src/features/workflow/types.ts
  - frontend/src/features/workflow/workflowApi.ts
  - frontend/tests/route-smoke.spec.ts
  - package.json
  - scripts/Invoke-Iter1QualityGate.ps1
findings:
  critical: 3
  warning: 2
  info: 0
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-03T03:10:04Z
**Depth:** standard
**Files Reviewed:** 112
**Status:** issues_found

## Summary

Reviewed the Phase 02 post-phase workflow integration surface: backend workflow controllers/services, EF migrations/model snapshot, inventory and purchase DTOs, focused tests, and frontend workflow/report pages. I also validated the current suite with `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore` and `npm run build --workspace frontend`; both passed, but the tests use SQLite/text status columns and do not cover the MySQL enum/runtime stock paths below.

The blocking issues are all workflow correctness/data-integrity problems: receipt status values no longer fit the migrated MySQL enum, the new purchase-order receive endpoint does not create inventory receipts or stock ledger entries, and issue stock checks compare/subtract quantities without unit conversion.

## Critical Issues

### CR-01: Purchase receipt service writes statuses removed from the MySQL enum

**File:** `backend/src/IPCManagement.Api/Services/InventoryReceiptService.cs:162`

**Issue:** `CreateFromPurchaseRequestAsync` still allows `"PARTIALRECEIVED"` as an input status and `ResolvePurchaseReceiptStatus` still returns `"PARTIALRECEIVED"` or `"RECEIVED"` at line 335. The migration at `backend/src/IPCManagement.Api/Migrations/20260702165732_FixPurchaseRequestStatusEnum.cs:16` changes `purchaserequests.status` to `enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','CANCELLED')`, so a partial or full receipt through `/api/inventory-receipts/from-purchase` will attempt to persist enum values the database no longer accepts. The current tests pass because their SQLite schema uses `TEXT`, not the migrated MySQL enum.

**Fix:**
```csharp
// Pick one status model and make service + migration match.
// If purchaserequests owns receipt progress, keep these values in the enum:
type: "enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','PARTIALRECEIVED','RECEIVED','SENTTOWAREHOUSE','CANCELLED')"

// Otherwise stop writing receipt progress to Purchaserequest.Status:
private static string ResolvePurchaseReceiptStatus(...) => "SENTTOSUPPLIER";
// and move partial/received state exclusively to purchaseorders.status.
```

### CR-02: Purchase-order receive marks orders received without moving inventory

**File:** `backend/src/IPCManagement.Api/Services/Workflow/PurchaseOrderService.cs:136`

**Issue:** `RecordReceiptAsync` only increments `Purchaseorderline.ReceivedQty` and updates `Purchaseorder.Status` before saving at line 185. It never creates an `Inventoryreceipt`, never writes `Inventoryreceiptline`, never calls stock ledger `AddStockAsync`, and never updates `currentstock`. The frontend's active receiving UI calls this endpoint at `frontend/src/features/workflow/pages/PurchasingPage.tsx:633`, while the older stock-moving path is `/api/inventory-receipts/from-purchase`. As shipped, users can mark purchase orders as `RECEIVED` while stock, stock movements, price-variance reports, and receipt documents remain unchanged.

**Fix:**
```csharp
// In one transaction, either:
// 1. replace PurchaseOrderService.RecordReceiptAsync with the inventory receipt path,
//    requiring warehouseId/receiptDate/userId and creating Inventoryreceipt lines, or
// 2. inject stock ledger dependencies and write the same receipt + stock movement rows here.
await _stockLedgerService.AddStockAsync(
    warehouseId,
    line.IngredientId,
    line.UnitId,
    receivedQty,
    "RECEIPT",
    "purchaseorders",
    order.PurchaseOrderId,
    userIdBytes,
    "Nhap kho tu don mua",
    $"PO {order.PurchaseOrderCode}");
```

### CR-03: Issue stock validation ignores unit conversion and corrupts current stock quantities

**File:** `backend/src/IPCManagement.Api/Services/InventoryIssueService.cs:253`

**Issue:** `EnsureStockAvailableAsync` loads `Currentstocks` and compares `stock.CurrentQty` directly with `line.IssuedQty` without checking whether `stock.UnitId` matches `line.UnitId` or converting through unit rates. The later ledger call at lines 112-122 also passes the issue line unit to `RemoveStockWithCheckAsync`, whose current-stock update subtracts the raw requested quantity from the stored stock quantity. If current stock is stored as grams and demand/issue is in kilograms, the shortage check can pass and then subtract `100` from a gram balance while recording a kilogram movement.

**Fix:**
```csharp
var stock = stocks.FirstOrDefault(item => item.IngredientId.SequenceEqual(line.IngredientId));
var availableQty = stock is null
    ? 0m
    : ConvertQuantity(stock.CurrentQty, stock.Unit, demandLine.Unit);

if (DecimalPolicy.LessThanQuantity(availableQty, line.IssuedQty))
{
    // report shortage in the requested unit
}

// Also make StockLedgerService enforce matching units or convert quantities before mutating Currentstock.
```

## Warnings

### WR-01: Validator blocks the service's "issue remaining demand" path

**File:** `backend/src/IPCManagement.Api/Models/Validators/InventoryValidators.cs:74`

**Issue:** The validator requires `CreateInventoryIssueDto.Lines` to be non-empty, but the DTO itself does not require it and `InventoryIssueService.ResolveIssueLines` intentionally treats an empty list as "build lines from remaining demand" at `backend/src/IPCManagement.Api/Services/InventoryIssueService.cs:346`. Direct service tests cover the empty-list path, but API requests through `InventoryIssuesController` will be rejected by FluentValidation before the service can run.

**Fix:** Decide whether empty `Lines` is supported. If yes, remove `RuleFor(x => x.Lines).NotEmpty()` and keep `RuleForEach` for provided lines. If explicit lines are required, delete the empty-list service branch and update tests/API docs to match.

### WR-02: Frontend still contains static import cycles reported by GitNexus

**File:** `frontend/src/api/apiSlice.ts:3`

**Issue:** The API slice imports `RootState` from `frontend/src/app/store.ts`, while the store imports `apiSlice` back at `frontend/src/app/store.ts:2`. The auth slice/storage pair has the same shape: `authSlice.ts:4` imports storage functions, and `authStorage.ts:1` imports the `User` type back from the slice. Some of these are type-only imports, so the production build currently passes, but the cycles keep the module graph fragile and already fail the GitNexus cycle check called out for this phase.

**Fix:** Move shared types into leaf modules that do not import runtime slices/stores, for example `frontend/src/app/storeTypes.ts` for `RootState`-compatible typing or a local `AuthUserSnapshot` type in `authStorage.ts`, then keep `apiSlice` and storage modules independent of the store/slice runtime modules.

---

_Reviewed: 2026-07-03T03:10:04Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
