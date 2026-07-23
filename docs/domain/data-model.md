# Data Model

The domain database reference is `.docs/IPCmanagement.sql`, supported by
`Document Database Lastest.docx`. The SQL file defines 31 business tables. The
current backend EF Core model in `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`
contains matching `DbSet` entries plus newer runtime tables such as
`Currentstocks` and `Refreshtokens`.

## Database Conventions

- Database name in the source document: `ipcManagement`.
- Business primary and foreign keys use UUID values stored as `BINARY(16)`.
- Business table and column names use camelCase.
- Shift and workflow statuses use database enums in the source SQL.
- MySQL collation in the EF Core context is `utf8mb4_unicode_ci`.

## Table Groups

| Domain group | Tables |
| --- | --- |
| Auth and audit | `roles`, `users`, `auditLogs` |
| Master data | `customers`, `warehouses`, `suppliers`, `units`, `ingredients` |
| Menu and BOM | `dishes`, `dishBom`, `bomAdjustments`, `menus`, `menuItems`, `menuSchedules` |
| Quantity and production | `quantityImportBatches`, `mealQuantityPlans`, `mealQuantityPlanLines`, `quantityAdjustments`, `productionPlans`, `productionPlanLines` |
| Material and purchasing | `materialRequests`, `materialRequestLines`, `purchaseRequests`, `purchaseRequestLines` |
| Inventory | `inventoryReceipts`, `inventoryReceiptLines`, `inventoryIssues`, `inventoryIssueLines`, `inventoryReturns`, `inventoryReturnLines`, `stockMovements` |

## Central Relationships

| Concept | Relationship |
| --- | --- |
| Customer menu schedule | `menuSchedules` links customer, service date, shift, menu, menu price, and BOM rate. |
| Menu composition | `menuItems` links menu records to dishes. |
| Ingredient calculation | `dishBom` links dishes to ingredients with gross quantity and waste rate. |
| Meal quantity plan | `mealQuantityPlans` and lines store forecast/confirmed quantities by date, shift, customer, and menu. |
| Production plan | `productionPlanLines` are derived from confirmed quantity plan lines and menu dishes. |
| Material request | `materialRequestLines` aggregate ingredient demand and suggested purchase quantity. |
| Purchase request | `purchaseRequestLines` connect supplier choices to material request lines. |
| Inventory ledger | Receipts, issues, returns, and adjustments write `stockMovements`; current stock is maintained separately in the application. |

## Important Status Fields

The SQL reference uses these workflow enum concepts:

| Field | Values |
| --- | --- |
| `shiftName` | `MORNING`, `AFTERNOON` |
| `warehouseType` | `PHULIEUGIAVI`, `TUOI`, `DONGLANH`, `KHAC` |
| menu schedule status | `DRAFT`, `CONFIRMED`, `CANCELLED` |
| quantity import status | `RECEIVED`, `VALIDATED`, `CONFIRMED`, `REJECTED` |
| quantity plan status | `DRAFT`, `FORECASTED`, `CONFIRMED`, `ADJUSTED`, `CANCELLED` |
| production status | `CREATED`, `SENTTOKITCHEN`, `COMPLETED`, `CANCELLED` |
| material request status | `DRAFT`, `MANAGERAPPROVED`, `SENTTOWAREHOUSE`, `EXPORTED`, `CANCELLED` |
| purchase request status | `DRAFT`, `SENTTOSUPPLIER`, `PARTIALRECEIVED`, `RECEIVED`, `CANCELLED` |
| stock movement type | `RECEIPT`, `ISSUE`, `RETURN`, `ADJUSTMENT` |

## Indexes and Constraints To Preserve

The SQL reference highlights these domain constraints:

- `menuSchedules(customerId, serviceDate, shiftName)` must be unique.
- `mealQuantityPlans(serviceDate, status, confirmedAt)` supports quantity plan lookups.
- `menuSchedules(weekStartDate, serviceDate, shiftName, customerId)` supports weekly menu views.
- `dishBom(dishId, effectiveFrom, effectiveTo)` supports effective-dated BOM lookup.
- `materialRequests(planId, status)` supports production-to-request tracking.
- `purchaseRequests(purchaseForDate, status)` supports purchasing queues.
- `inventoryReceiptLines(ingredientId, expiredDate, lotNumber)` supports expiry and lot tracking.
- `stockMovements(warehouseId, ingredientId, movementDate)` supports stock ledger lookup.

## Development Notes

- Keep database changes aligned with EF Core entities and migrations under
  `backend/src/IPCManagement.Api/Migrations`.
- New write workflows should update both durable transaction tables and the
  stock ledger/current-stock view when inventory is affected.
- Do not bypass audit requirements for quantity, BOM, stock, or approval
  corrections; the domain model includes `auditLogs`, `bomAdjustments`, and
  `quantityAdjustments` for this reason.
