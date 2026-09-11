---
phase: 29-system-operation-mode-and-material-reconciliation
plan: 01
subsystem: database
tags: [ef-core, mysql, operation-mode, reconciliation]
requires:
  - phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-presentation
    provides: operational singleton and lineage conventions
provides:
  - Fail-closed persisted system operation mode singleton model
  - Immutable reconciliation batch, line, contributor, tolerance, actual, revision and disposition mappings
affects: [29-02, 29-10, 29-12, 29-13]
actuals:
  tokens: 6139
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns: [EF Core design-time metadata tests, restricted immutable lineage, optimistic concurrency tokens]
key-files:
  created: [backend/src/IPCManagement.Api/Features/Reconciliation/Persistence/ReconciliationEntityConfigurations.cs, backend/src/IPCManagement.Api/Features/SystemOperation/Persistence/SystemOperationEntityConfigurations.cs, backend/tests/IPCManagement.Api.Tests/Phase29ModelConfigurationTests.cs]
  modified: [backend/src/IPCManagement.Api/Data/IpcManagementContext.cs]
key-decisions:
  - "System operation mode uses fixed key 1 and an explicit DEFAULT/MATERIAL_RECONCILIATION check constraint."
  - "Actual presence is represented by a row, preserving explicit zero independently from missing input."
patterns-established:
  - "Frozen grain: unique batchId + ingredientId + canonicalUnitId with contributor FKs restricted."
  - "Corrections append immutable revisions while current actual and disposition projections use concurrency tokens."
requirements-completed: [OPM-01, MRC-01, MRC-02, MRC-03, MRC-04]
coverage:
  - id: D1
    description: Complete Phase 29 persistence model is discoverable from IpcManagementContext.
    requirement: OPM-01
    verification:
      - kind: unit
        ref: backend/tests/IPCManagement.Api.Tests/Phase29ModelConfigurationTests.cs
        status: pass
    human_judgment: false
duration: 18min
completed: 2026-08-25
status: complete
---

# Phase 29 Plan 01: Persistence Model Summary

**EF Core model for a fail-closed global mode singleton and immutable reconciliation authority with exact grain, lineage, revisions and concurrency**

## Performance

- **Duration:** 18 min
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Added the fixed-cardinality operation-mode authority with validated stable tokens and optimistic concurrency.
- Added batch, frozen line and contributor mappings that retain identity and prevent cascade deletion of historical lineage.
- Added tolerance, side-owned actual, append-only revision and current disposition mappings with decimal(18,6) authority.

## Task Commits

1. **RED metadata contract** - `488f10ae`
2. **GREEN complete persistence model** - `c8203c15`

## Verification

`dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~Phase29ModelConfigurationTests --no-restore` — 2 passed, 0 failed.

## Deviations from Plan

The two tightly coupled model tasks were implemented in one GREEN commit because the shared configuration file must compile as one complete model; the RED contract remains a separate preceding commit. No scope outside Plan 29-01 was changed.

## Known Stubs

None.

## Self-Check: PASSED

All declared files and commits exist. No browser or database runtime effect is claimed.
