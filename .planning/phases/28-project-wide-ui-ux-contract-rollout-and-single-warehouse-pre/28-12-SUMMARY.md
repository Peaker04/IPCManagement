---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 12
subsystem: backend-trust-boundaries
status: complete
tags: [purchasing, imports, selector, authorization, operational-warehouse]
requires: [28-11]
provides: [canonical receiving identity, resolver-backed imports, singleton selector, claim equality]
affects: [28-13, 28-14, 28-15]
tech-stack:
  added: []
  patterns: [source-order equality, exact singleton selector, resolver-backed import]
key-files:
  modified:
    - backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseSupplierDecisionService.cs
    - backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseReceivingService.cs
    - backend/src/IPCManagement.Api/Features/Catalog/Services/DishBomImportService.cs
    - backend/src/IPCManagement.Api/Features/SampleData/Services/SampleBomImportService.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Services/WarehouseService.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Controllers/WarehousesController.cs
    - backend/src/IPCManagement.Api/Security/CurrentUserService.cs
decisions:
  - Supplier decisions always persist the canonical receiving warehouse while retaining fingerprint semantics.
  - Import paths resolve an existing operational warehouse and never create or select one by code or ordering.
  - Selector exposes exactly one resolver-owned DTO; catalog/detail authorization remains separate.
metrics:
  duration: 23m
  completed: 2026-08-24
actuals:
  tokens: 16000
  tasks: 2
  commits: 2
---

# Phase 28 Plan 12: Purchasing, Import, Selector, and Authorization Summary

Purchasing receiving identity, BOM imports, selector output, and warehouse claim scope now derive from the fail-closed operational warehouse authority without changing persisted lineage or public compatibility fields.

## Accomplishments

- Canonical receiving warehouse is included in supplier decision fingerprints and receipt commands.
- Purchase receipt mismatch fails before any receipt, lease, audit, lifecycle, stock, or order effect.
- Dish and sample BOM imports no longer select by code/order or create a warehouse.
- `/api/warehouses/selector` returns the exact resolver-owned singleton.
- Warehouse claim mismatch returns no scope; absent claims do not gain access.

## Verification

- Purchasing/import/selector/auth focused suite: 40/40 passed.
- API and test-project builds passed with zero warnings and errors.
- `git diff --check` passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated focused test factories for resolver dependencies and singleton selector contract**
- **Found during:** Tasks 1-2
- **Fix:** Added deterministic test resolvers and changed selector authorization assertions from paged catalogs to one passive singleton.
- **Commits:** `6d424156`, `6d0ad2d4`

## Known Stubs

None.

## Self-Check: PASSED

All listed files and commits exist.
