---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 08
subsystem: api
tags: [warehouse, startup-validation, fail-closed, mysql, provenance]
requires:
  - phase: 28-07
    provides: hash-pinned independent blind review closeout before warehouse work
provides:
  - observation-only configured operational warehouse resolver
  - typed zero/multiple/missing/mismatch diagnostics
  - pre-traffic startup gate with no repair behavior
affects: [28-09, warehouse-invariant, deployment]
actuals:
  tokens: 4157
  tasks: 2
  commits: 5
tech-stack:
  added: []
  patterns: [bounded cardinality observation, exact byte identity, pre-traffic fail-closed validation]
key-files:
  created:
    - backend/src/IPCManagement.Api/Features/Inventory/Services/IOperationalWarehouseResolver.cs
    - backend/src/IPCManagement.Api/Features/Inventory/Services/OperationalWarehouseResolver.cs
    - backend/tests/IPCManagement.Api.Tests/OperationalWarehouseInvariantTests.cs
  modified:
    - backend/src/IPCManagement.Api/Data/Repositories/IWarehouseRepository.cs
    - backend/src/IPCManagement.Api/Data/Repositories/WarehouseRepository.cs
    - backend/src/IPCManagement.Api/Helpers/DeploymentConfigurationValidator.cs
    - backend/src/IPCManagement.Api/Program.cs
    - backend/tests/IPCManagement.Api.Tests/DeploymentConfigurationValidatorTests.cs
key-decisions:
  - "Read at most two active rows so cardinality is proven without selecting, sorting, or loading an unbounded set."
  - "Keep startup observation separate from the 28-09 additive schema and separately authorized activation."
patterns-established:
  - "Operational singleton resolution parses configured identity before data access and returns the original persisted byte array only on exact equality."
  - "Startup invariant failures propagate before middleware setup and traffic; no bootstrap or repair path exists."
requirements-completed: [SWH-02, SWH-03]
coverage:
  - id: D1
    description: "Exact observation-only configured operational warehouse resolution with typed failure semantics"
    requirement: SWH-02
    verification:
      - kind: unit
        ref: "backend/tests/IPCManagement.Api.Tests/OperationalWarehouseInvariantTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pre-traffic startup gate invokes the resolver once and propagates fail-closed diagnostics"
    requirement: SWH-03
    verification:
      - kind: unit
        ref: "backend/tests/IPCManagement.Api.Tests/DeploymentConfigurationValidatorTests.cs"
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-08-24
status: complete
---

# Phase 28 Plan 08: Operational Warehouse Observation Summary

**Exact configured warehouse identity is observed before traffic with bounded cardinality and typed fail-closed diagnostics, without warehouse mutation or fallback selection.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-24T16:07:23Z
- **Completed:** 2026-08-24T16:12:35Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a read-only repository query that materializes at most two rows marked operational, proving zero/one/multiple semantics without ordering or candidate selection.
- Added exact configured-ID resolution that preserves the persisted `byte[]` identity and distinguishes missing configuration, zero active, multiple active, missing configured row, and inactive/config mismatch.
- Added a startup gate before middleware and traffic that resolves exactly once and propagates invariant failures without repair.

## Task Commits

1. **Task 1 RED: resolver invariant tests** - `3963b1dd`
2. **Task 1 GREEN: exact observation-only resolver** - `f8578fb6`
3. **Task 2 RED: startup gate tests** - `6d3e44b2`
4. **Task 2 GREEN: pre-traffic startup gate** - `02e12123`

## Files Created/Modified

- `backend/src/IPCManagement.Api/Data/Repositories/IWarehouseRepository.cs` - Declares bounded operational candidate observation.
- `backend/src/IPCManagement.Api/Data/Repositories/WarehouseRepository.cs` - Reads active rows only, capped at two and without ordering.
- `backend/src/IPCManagement.Api/Features/Inventory/Services/IOperationalWarehouseResolver.cs` - Resolver contract and typed invariant failures.
- `backend/src/IPCManagement.Api/Features/Inventory/Services/OperationalWarehouseResolver.cs` - Exact config/cardinality/identity observation.
- `backend/src/IPCManagement.Api/Helpers/DeploymentConfigurationValidator.cs` - Single-call operational warehouse startup validation.
- `backend/src/IPCManagement.Api/Program.cs` - Scoped resolver registration and pre-traffic invocation.
- `backend/tests/IPCManagement.Api.Tests/OperationalWarehouseInvariantTests.cs` - Six zero/one/multiple/config/mismatch regressions.
- `backend/tests/IPCManagement.Api.Tests/DeploymentConfigurationValidatorTests.cs` - Startup call-count and failure propagation regressions.

## Decisions Made

- The repository uses a narrow read-only SQL projection for the future `IsOperationalActive` marker because its EF entity/schema mapping belongs exclusively to Plan 28-09. This keeps 28-08 inside its exact ownership while allowing the runtime contract to compile independently.
- Configuration is parsed before querying active rows. Missing or malformed configuration therefore fails closed without touching the database.
- The selected successful result is the original persisted ID array, not a regenerated or rewritten identity.

## Verification

- Focused resolver suite: 6/6 passed.
- Combined resolver/startup suite: 12/12 passed.
- API and test-project builds: zero warnings and zero errors.
- EF pending-model check: no changes since the latest migration.
- No-write/no-fallback source gates, changed-line secret/stub scan, exact file ownership check, old-migration unchanged check, and `git diff --check`: passed.
- Database evidence was inspected read-only before implementation. No database command, migration apply, seed, reset, activation, retirement, or data mutation was run.

## Deviations from Plan

None - plan executed exactly as written. The interactive tracer verification was explicitly approved after its 6/6 tests and negative source gate passed.

## Known Stubs

None.

## Issues Encountered

The broad literal scan matched pre-existing placeholder-detection messages inside `DeploymentConfigurationValidator`; the authoritative scan was rerun against added diff lines and found no secret, TODO, FIXME, or placeholder stub.

## Next Phase Readiness

- Plan 28-09 can add the locked Pomelo/MySQL `IsOperationalActive` plus DB-generated nullable `OperationalSingletonKey` schema and normal unique index.
- Runtime will intentionally fail closed until the additive schema exists, configuration names an existing row, and a separately authorized operation activates exactly that row.
- No activation or data consolidation has been authorized or performed.

## Self-Check: PASSED

All eight implementation/test files exist and commits `3963b1dd`, `f8578fb6`, `6d3e44b2`, and `02e12123` are present.

---
*Phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre*
*Completed: 2026-08-24*
