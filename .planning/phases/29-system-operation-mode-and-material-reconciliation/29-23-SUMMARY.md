---
phase: 29-system-operation-mode-and-material-reconciliation
plan: 23
subsystem: backend-reconciliation
tags: [aspnet-core, ef-core, mysql, reconciliation, idempotency, audit]
status: complete
requires:
  - phase: 29-21
    provides: reconciliation lifecycle, operation-mode transaction protection, tolerance authority
provides:
  - production quantity-import preview and commit API
  - canonical SHA-256 import provenance and exact-source linkage
  - atomic exact-one DRAFT reconciliation batch creation
  - additive legacy-safe MySQL authority migration
  - generated OpenAPI and TypeScript contract parity
affects: [29-22, 29-24, reconciliation-runtime-evidence]
tech-stack:
  added: []
  patterns: [bounded preview ticket, canonical fingerprint, serializable protected transaction, unique idempotency fence, fail-closed nullable legacy provenance]
key-files:
  created:
    - backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationQuantityImportService.cs
    - backend/src/IPCManagement.Api/Migrations/20260826120000_AddQuantityImportCommitAuthority.cs
    - backend/src/IPCManagement.Api/Migrations/20260826120000_AddQuantityImportCommitAuthority.Designer.cs
    - backend/tests/IPCManagement.Api.Tests/ReconciliationQuantityImportApplicationPathTests.cs
  modified:
    - backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationBatchesController.cs
    - backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs
    - backend/src/IPCManagement.Api/Features/Coordination/Persistence/ProductionEntityConfigurations.cs
    - backend/src/IPCManagement.Api/Models/Entities/QuantityImportBatch.cs
    - backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs
    - frontend/src/shared/api/contracts/openapi.json
    - frontend/src/shared/api/contracts/schema.ts
key-decisions:
  - "Canonical import identity is SHA-256 over versioned menu-version, completed plan, row-version, source-line, schedule, customer, menu, shift and exact final-serving identities."
  - "Legacy import rows remain readable but are ineligible unless status is exact CONFIRMED and all provenance fields are present."
  - "Commit creates the confirmed import, plan links, audit row and exact-one DRAFT reconciliation batch in the same serializable mode-protected transaction."
requirements-completed: [OPM-03, MRC-01, MRC-02, MRC-03]
coverage:
  - deliverable: production preview and atomic commit path
    verification:
      - kind: test
        ref: backend/tests/IPCManagement.Api.Tests/ReconciliationQuantityImportApplicationPathTests.cs
        status: pass
    human_judgment: false
  - deliverable: additive provenance and duplicate-fence migration
    verification:
      - kind: test
        ref: backend/tests/IPCManagement.Api.Tests/Phase29MigrationTests.cs#Quantity_import_authority_migration_is_additive_fail_closed_and_discoverable
        status: pass
      - kind: command
        ref: dotnet ef migrations has-pending-model-changes
        status: pass
    human_judgment: false
  - deliverable: generated API contract parity
    verification:
      - kind: command
        ref: npm run check:api-contract
        status: pass
    human_judgment: false
actuals:
  tokens: 106363
  tasks: 2
  commits: 3
metrics:
  duration: 22 min
  completed: 2026-08-26
---

# Phase 29 Plan 23: Quantity Import Commit Authority Summary

Production reconciliation now has an authorized preview/commit path that fingerprints one exact completed meal-quantity snapshot, atomically persists confirmed provenance and plan linkage, and creates exactly one DRAFT reconciliation batch without procurement or stock mutation.

## Accomplishments

- Added bounded, write-free preview tokens with canonical SHA-256 fingerprints and sorted plan/source-line inventories.
- Added serializable, mode-protected commit with stale-source rejection, exact `CONFIRMED` status, actor/time/source audit, idempotent readback and a unique concurrency fence.
- Created the import authority, every eligible `MealQuantityPlan.ImportBatchId` link and one exact-pair DRAFT reconciliation batch in one transaction.
- Added nullable legacy-safe provenance columns, menu-version FK, unique fingerprint index, Designer and model snapshot with no guessed backfill.
- Regenerated OpenAPI and TypeScript contracts and proved parity.

## Task Commits

1. `b796ea51` — production preview/commit service, controller endpoints, fail-closed source eligibility and focused application-path tests.
2. `137595a8` — additive authority migration, snapshot and migration safety tests.
3. `747e3f68` — generated API contract update required by the new public endpoints.

## Verification

- `dotnet test ... --filter FullyQualifiedName~ReconciliationQuantityImportApplicationPathTests` — PASS, 3/3.
- `dotnet test ... --filter "FullyQualifiedName~Phase29MigrationTests|FullyQualifiedName~ReconciliationQuantityImportApplicationPathTests"` — PASS, 5/5.
- `dotnet test ... --filter FullyQualifiedName~ReconciliationServiceTests` — PASS, 19/19.
- `dotnet ef migrations has-pending-model-changes ...` — PASS, no pending model changes.
- Generated SQL inspection — 942 bytes; zero `USE`, database create/drop, table drop, business update/delete or legacy backfill; required unique index and FK present.
- `npm run check:api-contract` — PASS after committing generated contracts; Release build had 0 warnings/errors.
- `git diff --check` — PASS; only line-ending notices on the four preserved unrelated working-tree changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated public API contracts**
- **Found during:** Plan verification
- **Issue:** The required contract parity command correctly detected the two new public endpoints.
- **Fix:** Regenerated and committed `openapi.json` and `schema.ts` without frontend runtime changes.
- **Commit:** `747e3f68`

**2. [Rule 1 - Verification contention] Re-ran focused tests sequentially**
- **Found during:** Overall verification
- **Issue:** Two concurrent `dotnet test` builds contended for shared `obj` outputs.
- **Fix:** Re-ran the authoritative focused command sequentially; 5/5 passed without changing code or thresholds.

## Security and Data-Safety Notes

- Coordination authorization remains independent from mode eligibility through the existing policy and mode filter.
- Commit re-queries and re-hashes inside the protected serializable boundary; client token/fingerprint values never become authority by themselves.
- The unique fingerprint fence closes duplicate first commits; duplicate-key recovery reloads the already committed import/batch pair.
- No protected database, runtime, browser, PR, PO, receipt, issue, movement, lot, snapshot or current-stock mutation was performed.
- Migration is additive and does not fabricate provenance or plan linkage for legacy rows. Down migration fails through a temporary NOT NULL guard when new authority provenance exists.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: authenticated-write-api | backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationBatchesController.cs | New Coordination-authorized preview/commit boundary. |
| threat_flag: multi-row-authority-transaction | backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationQuantityImportService.cs | Atomic import, plan-link, audit and DRAFT-batch persistence. |
| threat_flag: schema-integrity | backend/src/IPCManagement.Api/Migrations/20260826120000_AddQuantityImportCommitAuthority.cs | New provenance columns, unique fence and menu-version FK. |

## Independent Review Remediation

Commit `009520dd` closed the three independent-review blockers without widening Plan 29-23 scope:

- The migration `Down` guard now fails closed when any added provenance field contains data, including `sourceLabel`; the migration regression enumerates all four added columns inside the rollback-guard SQL block.
- Draft-source listing and direct draft creation now validate the complete linked import authority: exact `CONFIRMED` provenance, exact menu version, canonical `COMPLETED` plans, non-empty lines, and every linked line on a published-compatible exact menu version. Mixed-menu and noncanonical-status regressions fail before draft persistence.
- Fingerprint format v1 now binds `PlanCode`, with stale PlanCode mutation coverage. Token/fingerprint mismatch is also covered and persists no authority.

Remediation verification: focused Phase 29 migration/application/reconciliation tests PASS 28/28; pending-model check PASS; generated migration SQL remains additive with zero prohibited database-lane/business mutation statements; API contract parity PASS; `git diff --check` PASS.

## Self-Check: PASSED

All created files exist; commits `b796ea51`, `137595a8`, `747e3f68` and corrective commit `009520dd` exist; focused tests, model parity, SQL safety inspection, API parity and diff hygiene passed. Unrelated frontend-checklist and Plan 29-22/state changes remain unstaged and unmodified by Plan 29-23 remediation.
