---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 10
subsystem: api
tags: [warehouse, compatibility, dto, fluentvalidation, provenance]
requires:
  - phase: 28-09
    provides: additive inactive-by-default MySQL singleton schema and authorization-gated activation contract
provides:
  - exact 63-boundary warehouse trust-surface inventory for Plans 28-10 through 28-13
  - nullable ordinary warehouse compatibility inputs for later server derivation and equality enforcement
  - retained response, filter, stock, audit, report, purchasing, and lineage identities
affects: [28-11, 28-12, 28-13, warehouse-invariant]
actuals:
  tokens: 7544
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns: [exact trust-surface inventory, omitted-or-format-valid compatibility input, retained technical identity]
key-files:
  created:
    - backend/tests/IPCManagement.Api.Tests/OperationalWarehouseCompatibilityTests.cs
  modified:
    - backend/src/IPCManagement.Api/Features/Catalog/Contracts/IngredientDto.cs
    - backend/src/IPCManagement.Api/Features/Catalog/Validators/IngredientValidators.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Contracts/StocktakeDto.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Validators/InventoryValidators.cs
    - backend/src/IPCManagement.Api/Features/Purchasing/Contracts/PurchaseSupplierDecisionDto.cs
    - backend/src/IPCManagement.Api/Features/Purchasing/Contracts/WarehousePurchaseReceiptDto.cs
key-decisions:
  - "The Plan 28-10 inventory is the sole mutable boundary registry; Plans 28-11 through 28-13 consume it without modifying it."
  - "Ordinary warehouse inputs accept omission for later resolver derivation, while supplied values remain GUID-shaped compatibility claims for exact service-boundary equality checks."
  - "Response and internal warehouse identities remain non-null technical keys for provenance, stock grain, audit, reports, purchasing fingerprints, and lineage."
patterns-established:
  - "Compatibility DTOs use nullable warehouse input with conditional format validation; omission is not treated as an arbitrary warehouse choice."
  - "Every warehouse trust boundary has one exact file/symbol key, one disposition, and one owner plan."
requirements-completed: [SWH-02, SWH-03]
coverage:
  - id: D1
    description: "Exact warehouse trust-surface inventory rejects missing, duplicate, extra, unresolved, and invalid-owner rows"
    requirement: SWH-03
    verification:
      - kind: unit
        ref: "backend/tests/IPCManagement.Api.Tests/OperationalWarehouseCompatibilityTests.cs#TrustSurfaceInventory"
        status: pass
    human_judgment: false
  - id: D2
    description: "DTO and validator compatibility accepts omission, rejects malformed supplied IDs, and retains response/internal identities"
    requirement: SWH-02
    verification:
      - kind: unit
        ref: "backend/tests/IPCManagement.Api.Tests/OperationalWarehouseCompatibilityTests.cs#DtoValidatorFilter"
        status: pass
    human_judgment: false
duration: 8min
completed: 2026-08-24
status: complete
---

# Phase 28 Plan 10: Warehouse DTO Compatibility Summary

**A 63-boundary exact trust inventory now governs the four backend slices, while ordinary warehouse inputs permit server derivation without erasing provenance, stock grain, audit, report, purchasing, or lineage identity.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-24T16:25:50Z
- **Completed:** 2026-08-24T16:33:43Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Froze one exact file/symbol inventory spanning DTO, validator, filter, write, lineage, purchasing, import, selector, authorization, generated-contract, and retained-identity boundaries across Plans 28-10 through 28-13.
- Made only the Plan 28-10 ordinary warehouse request fields nullable compatibility shims; omitted fields can be derived by later resolver-backed services and supplied malformed IDs remain rejected.
- Preserved every warehouse response/filter/internal identity required for FKs, stock partitioning, purchasing fingerprints, audit, reporting, exports, cache identity, and source reconciliation.

## Task Commits

1. **Task 1 RED: failing exact trust inventory gate** - `3653d9c0`
2. **Task 1 GREEN: frozen exact 63-boundary inventory** - `c25b3a3f`
3. **Task 2 RED: failing DTO compatibility contracts** - `99ddcf22`
4. **Task 2 GREEN: optional ordinary compatibility inputs** - `00f4f699`

## Files Created/Modified

- `backend/tests/IPCManagement.Api.Tests/OperationalWarehouseCompatibilityTests.cs` - Sole inventory plus omission, malformed-input, and retained-identity regressions.
- `backend/src/IPCManagement.Api/Features/Catalog/Contracts/IngredientDto.cs` - Makes create input warehouse identity optional while retaining response identity.
- `backend/src/IPCManagement.Api/Features/Catalog/Validators/IngredientValidators.cs` - Validates supplied compatibility identity without rejecting omission.
- `backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs` - Makes receipt, purchase receipt, issue, and return compatibility IDs optional; leaves filters and responses intact.
- `backend/src/IPCManagement.Api/Features/Inventory/Contracts/StocktakeDto.cs` - Makes stocktake input warehouse identity optional; retains stocktake response/filter identity.
- `backend/src/IPCManagement.Api/Features/Inventory/Validators/InventoryValidators.cs` - Applies conditional GUID validation to supplied compatibility inputs.
- `backend/src/IPCManagement.Api/Features/Purchasing/Contracts/PurchaseSupplierDecisionDto.cs` - Makes supplier-decision receiving identity optional input; preserves decision response identity.
- `backend/src/IPCManagement.Api/Features/Purchasing/Contracts/WarehousePurchaseReceiptDto.cs` - Makes purchase-receipt warehouse identity optional lineage compatibility input.

## Decisions Made

- Exact canonical/source byte equality remains owned by the service-boundary conversions in Plans 28-11 and 28-12; Plan 28-10 changes only DTO/validator/filter trust shape and cannot widen authorized scope by itself.
- Filters remain nullable compatibility identities and response DTOs remain unchanged because reports, audit, stock, exports, cache keys, and reconciliation still require technical warehouse provenance.
- No fallback selector, repair path, startup mutation, or data operation was introduced.

## Verification

- Phase 28-09 schema invariant precondition: 6/6 passed before Task 1.
- Task 1 RED failed on the exact unresolved inventory row; GREEN trust inventory suite passed 3/3.
- Task 2 RED failed on non-null/required omission behavior; GREEN DTO/validator/filter suite passed 4/4.
- Combined `OperationalWarehouseCompatibilityTests`: 7/7 passed.
- API and test-project builds: zero warnings and zero errors.
- EF pending-model check: no changes since the latest migration.
- Changed-path, historical-migration, retained-identity, no-fallback/no-mutation, changed-line secret/stub, and `git diff --check` gates passed.
- No database command, migration application, activation, retirement, repair, seed, reset, restore, deletion, merge, reassignment, or stock mutation was performed.

## Deviations from Plan

None - plan executed exactly as written. The interactive Task 1 tracer checkpoint was approved before Task 2 began.

## Known Stubs

None.

## Threat Flags

No unplanned threat surface. The planned client DTO/filter trust boundary is covered by exact inventory closure, omitted-or-format-valid input tests, and retained-identity assertions. Exact canonical/source equality is explicitly assigned to Plans 28-11 and 28-12 service owners.

## Issues Encountered

The Task 2 RED test initially needed `System.Reflection` to inspect C# nullable metadata; adding that test-only namespace import allowed the intended behavioral RED failures to run. No production workaround or scope change was needed.

## User Setup Required

None for Plan 28-10. A separate residual deployment authorization remains for applying the Plan 28-09 migration and later activating exactly one configured existing warehouse; this plan neither requires nor performs either operation.

## Next Phase Readiness

- Plan 28-11 can consume the frozen inventory read-only and enforce canonical/source byte equality before inventory/catalog writes and filters.
- Plan 28-12 can convert purchasing, import, selector, and authorization owners without altering the Plan 28-10 registry.
- Plan 28-13 can independently close every inventory row and regenerate client contracts from backend source.

## Self-Check: PASSED

All eight implementation/test files exist. Commits `3653d9c0`, `c25b3a3f`, `99ddcf22`, and `00f4f699` are present. Focused tests, builds, model check, retained-identity scan, prohibitions, hygiene checks, and exact changed-path review passed.

---
*Phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre*
*Completed: 2026-08-24*
