---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 11
subsystem: backend-inventory
status: complete
tags: [operational-warehouse, inventory, lineage, fail-closed]
requires: [28-10]
provides: [canonical inventory writes, canonical inventory filters, source-lineage equality]
affects: [28-12, 28-13, 28-14, 28-15]
tech-stack:
  added: []
  patterns: [resolver-before-mutation, exact-id compatibility validation, source-lineage equality]
key-files:
  modified:
    - backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReceiptService.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReturnService.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs
    - backend/src/IPCManagement.Api/Features/Catalog/Services/IngredientService.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Services/SupplementalMaterialRequestService.cs
decisions:
  - Resolve the operational warehouse before every ordinary inventory mutation and reject supplied mismatch.
  - Preserve source and persisted WarehouseId values; never merge, rewrite, or infer another warehouse.
  - Canonicalize ordinary list filters at service boundaries while retaining repository partition parameters.
metrics:
  duration: 24m
  completed: 2026-08-24
actuals:
  tokens: 15500
  tasks: 2
  commits: 2
---

# Phase 28 Plan 11: Inventory and Source-Lineage Conversion Summary

Operational warehouse resolution now precedes receipt, issue, return, stocktake, ingredient, and supplemental mutations, with exact compatibility and source-lineage checks that fail before writes.

## Accomplishments

- Converted core inventory writes to resolver-owned canonical identity.
- Required return/source issue warehouse equality and preserved document, stock, ledger, FK, and audit identities.
- Canonicalized issue, return, stocktake, and supplemental query scope without widening invalid filters.
- Updated focused SQLite fixtures for the additive warehouse shadow columns introduced by Plan 28-09.

## Verification

- Core inventory/source focused suite: 57/57 passed.
- Ingredient/supplemental/compatibility focused suite: 71/71 passed.
- API and test-project builds passed with zero warnings and errors.
- `git diff --check` passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated focused test fixtures and service construction for resolver dependency**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** Existing tests constructed converted services without the required resolver and hand-built SQLite warehouse tables lacked the new shadow columns.
- **Fix:** Injected deterministic test resolvers and added only the additive test columns required by the current EF model.
- **Files modified:** focused inventory, supplemental, ingredient, and workflow test fixtures.
- **Commits:** `4bce491d`, `f0149e79`

## Known Stubs

None.

## Self-Check: PASSED

All listed production files exist and both task commits are present.
