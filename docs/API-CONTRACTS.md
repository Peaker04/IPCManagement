# API Contracts

## Operational warehouse compatibility

The API uses one server-authoritative operational warehouse for ordinary inventory and purchasing commands.

- `OperationalWarehouse:WarehouseId` must identify the one active warehouse. Startup fails closed for missing configuration, zero active rows, multiple active rows, a missing configured row, or configured/active mismatch.
- Compatibility request fields such as `warehouseId` and `receivingWarehouseId` may be omitted. When supplied, their parsed 16-byte identity must equal the canonical operational warehouse or the command fails before mutation.
- Source-linked receipt, return, supplemental, and purchasing workflows derive warehouse identity from their source document and require byte equality with the canonical warehouse.
- `GET /api/warehouses/selector` returns exactly one operational warehouse DTO. It is passive context, not user-selected authorization.
- Historical warehouse catalog/detail endpoints retain their explicit authorization policies.
- Response and persistence warehouse IDs remain required technical identity for foreign keys, stock grain, ledgers, purchasing fingerprints, audit, reports, cache keys, deep links, exports, and reconciliation.
- Existing warehouse IDs and historical documents are never merged, reassigned, deleted, or rewritten by startup or ordinary commands.
- Activation is an explicit operational procedure. Startup observes and validates state; it does not repair flags.
