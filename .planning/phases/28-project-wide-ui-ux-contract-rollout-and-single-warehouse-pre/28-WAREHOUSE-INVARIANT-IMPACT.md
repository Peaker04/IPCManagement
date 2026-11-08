# Code Context

## Scope and conclusion

Read-only source analysis; migration designer history was excluded. The current model snapshot and latest migration remain relevant, but this conversion does **not** require dropping warehouse foreign keys. The safest interpretation of “one operational warehouse” is: retain one canonical `Warehouse` row and all `warehouseId` persistence keys, stop accepting warehouse choice from ordinary public workflows, resolve the canonical warehouse server-side, and remove warehouse selectors/filter controls from the frontend. Physically removing `warehouseId` would be a high-risk, unnecessary schema rewrite that destroys document lineage and composite stock identity.

## Files Retrieved

1. `backend/src/IPCManagement.Api/Features/Inventory/Controllers/WarehousesController.cs` (lines 1-73) — public catalog, selector, detail endpoints; selector explicitly accumulates every page.
2. `backend/src/IPCManagement.Api/Features/Inventory/Services/WarehouseService.cs` (lines 1-49) — maps warehouse entities to public DTOs.
3. `backend/src/IPCManagement.Api/Data/Repositories/WarehouseRepository.cs` (lines 1-55) — searchable, paged multi-row warehouse repository.
4. `backend/src/IPCManagement.Api/Features/Inventory/Contracts/WarehouseDto.cs` (lines 1-10) — public warehouse catalog contract.
5. `backend/src/IPCManagement.Api/Models/Entities/Warehouse.cs` (lines 1-35) — aggregate navigation root for all inventory records.
6. `backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs` (lines 1-410) — warehouse-bearing receipt, issue, return, shortage, create and filter contracts.
7. `backend/src/IPCManagement.Api/Features/Inventory/Contracts/StocktakeDto.cs` (lines 1-79) — warehouse-bearing stocktake create/filter/response contracts.
8. `backend/src/IPCManagement.Api/Features/Catalog/Contracts/IngredientDto.cs` (lines 1-60) — ingredient create/update currently exposes warehouse assignment.
9. `backend/src/IPCManagement.Api/Features/Purchasing/Contracts/PurchaseSupplierDecisionDto.cs` (lines 36-67) — supplier decision request/response exposes `ReceivingWarehouseId`.
10. `backend/src/IPCManagement.Api/Features/Purchasing/Contracts/WarehousePurchaseReceiptDto.cs` (lines 1-80) — receipt command requires client-provided `WarehouseId`.
11. `backend/src/IPCManagement.Api/Shared/Contracts/WorkflowReportQueryDto.cs` (lines 1-39) — shared report filter exposes `WarehouseId`.
12. `backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseSupplierDecisionService.cs` (lines 220-424) — parses and fingerprints selected receiving warehouse, then persists it on supplier decision.
13. `backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseReceivingQueries.cs` (lines 160-203) — validates an arbitrary requested warehouse exists.
14. `backend/src/IPCManagement.Api/Features/Catalog/Services/DishBomImportService.cs` (lines 305-344) — already approximates single warehouse by choosing first warehouse ordered by code.
15. `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleBomImportService.cs` (lines 190-369) — creates a warehouse if its sample code is absent and assigns imported ingredients to it.
16. `frontend/src/features/purchasing/PurchaseDecisionPanel.tsx` (lines 150-449) — fetches all warehouses, requires a receiving-warehouse selector, sends the selected ID.
17. `frontend/src/features/warehouse/pages/WarehousePage.tsx` (lines 79-98, 184-214, 261-305, 472-525, 533-538, 735-738) — selector drives stock query, issue allocation and issue command; passes catalog to receipt dialogs.
18. `frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx` (lines 23-35, 66-106, 142-152, 210-250) — receipt warehouse selector/preferred warehouse behavior.
19. `frontend/src/features/warehouse/WarehouseBatchPurchaseReceiptDialog.tsx` (lines 1-23) — batch receipt requires and renders warehouse selection.
20. `frontend/src/features/warehouse/warehouseIssueAllocation.ts` (lines 21-53) — filters stock rows by chosen warehouse.
21. `frontend/src/api/warehouseApi.ts` (lines 41-63, 313-315) — warehouse list/selector API endpoints and hooks.
22. `frontend/src/features/purchasing/purchasingModel.ts` (lines 317-328) — maps multiple warehouse options and stores selection per order.
23. `backend/tests/IPCManagement.Api.Tests/WarehousesAuthorizationIntegrationTests.cs` (lines 23-105) — deliberately creates 205 warehouse DTOs and asserts selector returns warehouse 205.
24. `backend/tests/IPCManagement.Api.Tests/RepositorySearchTests.cs` (lines 84-106) — creates three warehouses to test catalog searching.
25. `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.SupplierOrdersAndPerformance.cs` (lines 395-411) — creates supplemental second warehouse/ingredient.
26. `frontend/src/features/purchasing/purchasingModel.test.ts` (lines 241-257) — asserts 205-warehouse option mapping and per-order warehouse selection.
27. `frontend/src/app/purchasingHooksBehavior.test.tsx` (lines 199-200, 428-433) — supplies default and supplemental warehouses and expects preferred selection.
28. `frontend/src/features/warehouse/warehouseIssueAllocation.test.ts` (lines 27-104) — multi-warehouse filtering behavior.
29. `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs` — current schema authority; warehouse keys/FKs and composite stock identities must remain.
30. `backend/src/IPCManagement.Api/Migrations/20260813171032_AddMenuAmendmentDecisionFanRemediations.cs` — latest migration inspected by filename ordering; unrelated to warehouse cardinality.

## Key Code

### Production symbols that implement multi-warehouse behavior

- **Catalog:** `WarehousesController.GetAllAsync/GetSelectorAsync/GetByIdAsync`, `IWarehouseService/WarehouseService.GetPagedAsync/GetByIdAsync`, `IWarehouseRepository/WarehouseRepository.GetPagedAsync/GetByIdAsync`, `WarehouseDto`.
- **Ingredient assignment:** `CreateIngredientRequest.WarehouseId`, `UpdateIngredientRequest.WarehouseId`, `IngredientService.CreateAsync/UpdateAsync`, `IngredientValidators`, `IngredientMapper`, `IngredientRepository.GetByWarehouseAsync`.
- **Inventory commands:** `CreateInventoryReceiptRequest.WarehouseId`, `CreateInventoryReceiptFromPurchaseRequest.WarehouseId`, `CreateInventoryIssueRequest.WarehouseId`, `CreateInventoryReturnRequest.WarehouseId`, `CreateStocktakeRequest.WarehouseId`, `RecordWarehousePurchaseReceiptRequest.WarehouseId`; parsed by `InventoryReceiptService`, `InventoryIssueService`, `InventoryReturnService`, `StocktakeService`, and purchase receiving service.
- **Filters/scoping:** `InventoryIssueFilterRequestDto.WarehouseId`, `InventoryReturnFilterRequestDto.WarehouseId`, `StocktakeFilterRequestDto.WarehouseId`, `SupplementalMaterialRequestFilterRequest.WarehouseId`, `WorkflowReportQueryDto.WarehouseId`; corresponding repositories/services filter by it. `CurrentUserService.GetWarehouseId` plus inventory controllers enforce warehouse claims.
- **Purchasing compatibility:** `ConfirmPurchaseLineSupplierRequest.ReceivingWarehouseId`, `PurchaseLineSupplierDecision.ReceivingWarehouseId`, `PurchaseOrder.ReceivingWarehouseId`, `PurchaseSupplierDecisionService.Confirm...`, `PurchaseOrderDecisionValidator`, `PurchaseOrderService`, `PurchaseWorkflowMapper`. Warehouse is currently part of decision/order compatibility fingerprints and database indexes.
- **Stock domain:** `CurrentStockRepository.GetByWarehouseAndIngredientAsync/GetByWarehouseAsync/ExistsAsync/TryDecreaseAsync`, `IStockLedgerService/StockLedgerService`, `InventoryIssueStockValidator`, `warehouseIssueAllocation` all use warehouse as part of stock identity.
- **Automatic creation/selection:** `SampleBomImportService.EnsureWarehouseAsync` creates `KHO` sample warehouse; `DishBomImportService` chooses the first code-sorted warehouse for a new ingredient. The latter becomes ambiguous if old extra rows remain.

### Persistence fields that must remain internal

Keep `Warehouse.WarehouseId` and these entity fields/FKs: `Ingredient.WarehouseId`, `InventoryReceipt.WarehouseId`, `InventoryIssue.WarehouseId`, `InventoryReturn.WarehouseId`, `SupplementalMaterialRequest.WarehouseId`, `StockMovement.WarehouseId`, `CurrentStock.WarehouseId`, `CurrentStockLot.WarehouseId`, `StockSnapshot.WarehouseId`, `Stocktake.WarehouseId`, `PurchaseLineSupplierDecision.ReceivingWarehouseId`, and `PurchaseOrder.ReceivingWarehouseId`.

Reasons:
- referential integrity to the one canonical warehouse;
- immutable historical/audit provenance for receipts, issues, returns, movements and decisions;
- composite identity and concurrency (`CurrentStock` is keyed by warehouse + ingredient; lot/snapshot indexes include warehouse);
- purchasing decision fingerprint/idempotency compatibility;
- safe coexistence with historical rows during cleanup.

Also retain `warehouseId` in **response DTOs where it is a stable technical identity or required for reconciliation** (inventory document DTOs, stock rows, ledger/report export rows), even if hidden visually. Removing those response properties is a separate breaking API version change and offers little benefit.

### Public UI/API fields that can disappear

Safe to remove from ordinary client input after server-side canonical resolution exists:

- `CreateIngredientRequest.WarehouseId`, `UpdateIngredientRequest.WarehouseId`.
- `CreateInventoryReceiptRequest.WarehouseId`, `CreateInventoryReceiptFromPurchaseRequest.WarehouseId`.
- `CreateInventoryIssueRequest.WarehouseId` (derive canonical warehouse; still verify material request/stock lineage).
- `CreateInventoryReturnRequest.WarehouseId` (prefer deriving from source issue, which is stronger than a global default).
- `CreateStocktakeRequest.WarehouseId`.
- `RecordWarehousePurchaseReceiptRequest.WarehouseId` (derive canonical or receiving warehouse on order, and reject lineage mismatch internally).
- `ConfirmPurchaseLineSupplierRequest.ReceivingWarehouseId` UI/API input; persist canonical ID internally.
- Warehouse list selectors and per-order selection state in `WarehousePage`, both receipt dialogs, `PurchaseDecisionPanel`, `purchasingModel`.
- Warehouse filters in ordinary UI/query contracts where a one-warehouse filter is meaningless. For reports/admin exports, accepting the old optional filter temporarily is a useful backward-compatible no-op/validation shim.
- Warehouse code/name/type/note presentation fields may be hidden from operational screens. Do not remove warehouse identity from audit/export contracts without versioning.

### Architecture/data flow

Today the frontend calls `GET /api/warehouses/selector`, maps all returned rows to controls, sends the chosen ID in commands, validators parse it, services verify existence and copy it into entities, repositories partition stock by it, and mappers return it. Purchasing additionally copies selection into supplier decisions, fingerprints compatibility with it, creates purchase orders with it, and later receives against a selected warehouse. Claims can independently scope warehouse access. Therefore a frontend-only removal is unsafe: commands would fail validation and server behavior could still be manipulated by direct API clients.

The target flow should be: a single `IOperationalWarehouseResolver` (or narrowly named equivalent) resolves exactly one configured/canonical active row; services derive it server-side; source-document workflows derive/verify against their source warehouse; persistence and ledger APIs continue receiving an internal `byte[] warehouseId`; frontend no longer fetches/selects it.

## Findings (severity ordered)

1. **BLOCKER — client trust boundary remains multi-warehouse.** All create/receive/decision DTOs above accept warehouse IDs and services trust them after existence checks (`InventoryDto.cs`, `StocktakeDto.cs`, `WarehousePurchaseReceiptDto.cs`, `PurchaseSupplierDecisionDto.cs`). Removing controls alone does not enforce one warehouse.
2. **BLOCKER — no invariant identifies the one operational row.** Repository/service expose arbitrary paging, and imports use warehouse code or “first by code.” Before changing callers, define deterministic identity (configuration-backed ID or database invariant). `FirstOrDefault` is not sufficient while legacy rows exist.
3. **HIGH — purchasing warehouse participates in compatibility contracts.** `PurchaseSupplierDecisionService` fingerprints it; `PurchaseOrderDecisionValidator` and unique compatibility indexes compare it. Deleting the persisted field/index naively can alter grouping/idempotency and merge orders that were previously distinct. Keep the field, populate canonical ID, and preserve historical fingerprint semantics.
4. **HIGH — stock identity is warehouse-partitioned.** Removing warehouse keys from current stock, lots, snapshots or movements risks collisions and invalid ledger reconciliation. Keep schema and repository parameters internal.
5. **HIGH — claim-based warehouse authorization becomes stale semantics.** `ICurrentUserService.GetWarehouseId`, `InventoryIssuesController`, `InventoryReturnsController`, and supplemental request scoping implement multi-warehouse tenancy-like checks. Decide whether to retain claim verification against the canonical ID during transition or retire the claim contract in auth/token issuance. Silent mixed behavior is risky.
6. **MEDIUM — selector endpoints are breaking contracts.** Removing `/api/warehouses`, `/selector`, `/{id}` breaks generated OpenAPI (`frontend/src/shared/api/contracts/schema.ts`), RTK hooks, route preload, authorization integration tests, and external consumers. A compatibility phase returning exactly one row is safer than immediate endpoint deletion.
7. **MEDIUM — reports expose warehouse as filter/group/key.** `WorkflowReportQueryDto`, report DTOs/mappers, admin statistics row keys, and table contract `warehouseId+materialId` depend on it. Hide/filter removal is safe in UI; response/key removal requires report contract redesign.
8. **MEDIUM — sample/import paths can create or select the wrong row.** `SampleBomImportService.EnsureWarehouseAsync` can create another row if canonical warehouse has a different code; `DishBomImportService` chooses lexicographically first. Both must use the resolver.
9. **LOW — warehouse descriptive metadata is operationally redundant but useful administratively.** `WarehouseCode/Name/Type/Note` can disappear from operational UI; retain database/catalog DTO temporarily for diagnostics and audit readability.

## Minimum safe change set

1. Add a server-side canonical warehouse resolver with a fail-closed invariant: exactly one configured operational ID exists. Do not use `First()` as the permanent rule.
2. Add a latest migration/data operation that selects/creates the canonical row and prevents creation of additional operational warehouses (configuration plus startup validation, or a singleton marker/constraint). Reconcile historical extra rows deliberately; do not rewrite historical document IDs unless a separately audited consolidation is required.
3. Change ingredient, receipt, issue, return, stocktake, supplemental, supplier-decision and purchase-receiving services to derive canonical warehouse internally. Source-linked return/receipt operations should derive from source issue/order then assert it equals canonical.
4. Remove warehouse properties from **request** DTOs (or first make them optional/deprecated and reject non-canonical values for a compatibility release). Update FluentValidation and OpenAPI generation.
5. Keep entity fields, EF relationships, composite keys/indexes, repository/ledger method parameters, audit/report response identity, and mappers.
6. Remove frontend selector fetches and controls; pass no warehouse input. Replace display with optional static “Kho vận hành” text only where user confirmation needs context. Remove `mapWarehouseOptions`, `getSelectedReceiptWarehouseId`, and selector route prefetch if unused.
7. Keep `/api/warehouses/selector` returning the canonical singleton for one compatibility window, then remove only after generated client/external consumer review.
8. Update tests: replace 205/three/supplemental warehouse behavior tests with singleton invariant, direct API rejection of non-canonical IDs during compatibility, canonical derivation, source-lineage mismatch, and preservation of warehouse IDs in ledger/audit entities.

Likely production files changed span inventory/catalog/purchasing contracts, validators and services; warehouse controller/service/repository; auth warehouse scope; sample/import services; frontend warehouse/purchasing components; RTK API/preload; generated OpenAPI. Schema/entity changes should be limited to the singleton invariant—not removal of existing warehouse FKs.

## Breaking contracts

- Request JSON removal: `warehouseId` on ingredient, inventory receipt/issue/return/stocktake/purchase receipt; `receivingWarehouseId` on supplier decision.
- Endpoint removal: `/api/Warehouses`, `/api/Warehouses/{id}`, `/api/Warehouses/selector`.
- Query removal: warehouse filters on inventory/report endpoints.
- Auth/token contract: `warehouseId` claim if removed.
- Generated TypeScript/OpenAPI types and RTK exports/hooks.
- Purchasing fingerprint/compatibility semantics if persisted receiving warehouse is removed (not recommended).
- Report row identity/grouping if warehouse ID is removed from responses (not recommended).

A staged deprecation avoids most immediate breaks: accept omitted ID, derive canonical; if supplied require equality; return singleton selector; later remove inputs/endpoints in a versioned contract.

## Tests that explicitly create/select multiple warehouses

- `WarehousesAuthorizationIntegrationTests.cs:28-46`: creates 205 DTOs and requires complete selector pagination.
- `RepositorySearchTests.cs:84-106`: three warehouse entities for code/name/escaping search.
- `WorkflowGenerationTests.SupplierOrdersAndPerformance.cs:395-411`: supplemental warehouse plus ingredient.
- `purchasingModel.test.ts:241-257`: 205 options and arbitrary selected warehouse per order.
- `purchasingHooksBehavior.test.tsx:428-433`: default plus supplemental warehouse and preferred warehouse.
- `warehouseIssueAllocation.test.ts:27-104`: stock rows across `warehouse-a`/other IDs and selection-based filtering.
- `WarehousePurchaseReceivingTests.cs:246`: mutates command to another random warehouse to test validation/mismatch; retain as a rejection regression, adapted to canonical resolver.
- Many other backend fixtures create a single random `WarehouseId`; those should remain because internal referential identity remains required. They are not evidence of multi-warehouse UX and should not be mechanically deleted.

## Residual risks / open questions

- Existing production database cardinality and which row is canonical were not queried in this read-only source review.
- Whether external clients consume warehouse catalog/filter fields is not knowable from this repository.
- Historical extra warehouses may contain live stock. Consolidating balances is a separate audited data-integrity project; merely hiding them does not merge stock.
- Configuration versus database marker for canonical identity is a product/operations choice.
- The latest migration filename ordering was used; migration application state was not queried.

## Start Here

Open `backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs` first to enumerate the client-supplied warehouse trust surface, then introduce the canonical resolver before modifying any DTO or frontend selector.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Concrete severity-ranked findings, production symbols, data flow, contract breaks, test locations, and residual risks are documented with exact repository paths and line ranges."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "targeted find/grep/read source inspection",
      "result": "passed",
      "summary": "Mapped backend entities, contracts, controllers/services/repositories, frontend selectors, current snapshot/latest migration, and multi-warehouse tests without editing production files."
    }
  ],
  "validationOutput": [
    "Confirmed warehouse persistence across 12 warehouse-bearing entity types plus Warehouse itself.",
    "Confirmed public selectors in WarehousePage, both receipt dialogs, and PurchaseDecisionPanel.",
    "Confirmed explicit 205-warehouse, three-warehouse, supplemental-warehouse, and cross-warehouse allocation tests."
  ],
  "residualRisks": [
    "Canonical production warehouse and live database cardinality were not verified against a running database.",
    "External API consumers are not visible in this repository.",
    "Historical live-stock consolidation requires a separate audited data migration if extra warehouses contain balances."
  ],
  "noStagedFiles": true,
  "diffSummary": "Read-only analysis; only the required context.md artifact was written.",
  "reviewFindings": [
    "blocker: backend inventory/purchasing request DTOs accept arbitrary warehouse IDs, so UI-only selector removal cannot enforce one warehouse.",
    "blocker: WarehouseRepository/WarehouseService define no canonical singleton invariant; imports currently create by code or choose the first row.",
    "high: purchasing fingerprints/indexes and stock composite identities include warehouse, so warehouseId persistence must remain internal."
  ],
  "manualNotes": "Migration designer history was intentionally ignored; only the current snapshot and latest migration filename were considered."
}
```
