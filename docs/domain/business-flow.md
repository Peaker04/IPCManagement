# Business Flow

IPCManagement supports an industrial catering operation. The core workflow is:

```text
weekly customer menu
  -> forecast and confirmed meal quantities
  -> per-dish BOM calculation
  -> production plan
  -> material request
  -> purchase request
  -> warehouse receipt, issue, return, and stock movement
  -> operational reports
```

## Scope

The domain source file `Document Database Lastest.docx` defines the system focus
as menu planning, meal quantity confirmation, ingredient quantity calculation,
purchasing, and warehouse management.

Important domain rules:

- Menu planning is weekly, by customer, service date, and shift.
- A customer can use different menus for morning and afternoon shifts on the
  same day.
- Expected meal quantities are received before the service date.
- Actual quantities are confirmed at 8:30 each morning for both morning and
  afternoon menus.
- Ingredient demand is calculated from menu dishes, dish BOM entries, menu
  price, and BOM rate percentage.
- Purchasing uses ingredient demand and current stock to decide what must be
  ordered from suppliers.
- Inventory is calculated from receipts, issues, returns, and adjustments.
- Stock adjustments are recorded as `stockMovements` with `movementType =
  ADJUSTMENT`; the simplified design does not use a separate stock-count
  document.

## Actors

| Actor | Main responsibility |
| --- | --- |
| Admin | Manage users, roles, system configuration, special corrections, and audit logs. |
| Manager | Select menus, confirm quantities, review calculated demand, approve material needs, and read reports. |
| Purchasing | Create purchase requests, select suppliers, and track received goods. |
| Warehouse staff | Receive goods, issue ingredients to the kitchen, record returned surplus, and monitor stock. |
| Head chef / kitchen | Receive issued ingredients and return unused ingredients after production. |
| External company/system | Provides forecast and actual meal quantities. |

## Operational Steps

1. The manager creates a weekly menu schedule for each customer and shift.
2. Forecast quantities are imported or entered before the service date.
3. At 8:30, actual quantities are confirmed for both shifts.
4. The system expands each menu into dishes and each dish into ingredient BOM
   lines.
5. A production plan is generated for the kitchen.
6. A material request is created for the warehouse and purchasing workflow.
7. Purchasing creates purchase requests when required quantity exceeds stock.
8. Warehouse staff receive goods with lot number, manufacture date, expiry date,
   actual unit price, and supplier.
9. Warehouse staff issue ingredients to the kitchen and record returned surplus.
10. Reports compare demand, purchasing, stock movement, and actual receipt price
    against reference price.

## Current Application Mapping

Current backend endpoints cover parts of this flow:

| Area | Current backend surface |
| --- | --- |
| Authentication | `backend/src/IPCManagement.Api/Controllers/AuthController.cs` |
| Dishes and BOM foundation | `DishesController`, `DishService`, `Dish`, `Dishbom` |
| Ingredients and warehouse master data | `IngredientsController`, `WarehousesController`, `Ingredient`, `Warehouse` |
| Inventory receipt/issue | `InventoryReceiptsController`, `InventoryIssuesController`, stock ledger services |
| Production planning | `ProductionPlansController`, `Productionplan`, `Productionplanline` |
| Coordination | `CoordinationController` and frontend coordination feature |

The Excel files in `.docs/` show real operational layouts that should guide
future import screens and reports, but they are not yet represented as direct
file-import APIs.
