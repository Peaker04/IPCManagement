---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 15
subsystem: phase-closeout
status: complete
tags: [regression, architecture, build, evidence, historical-authority]
requires: [28-14]
provides: [exact-three regression, zero-failure frontend aggregate, source-aware historical authority reconciliation]
affects: []
tech-stack:
  added: []
  patterns: [tracked immutable recovery authority, explicit emitter environment contract, source-aware historical provenance]
key-files:
  created: []
  modified:
    - frontend/tests/uiAuditBaselineReconciliation.test.ts
    - frontend/tests/uiAuditBaselineReconciliation.emit.test.ts
    - frontend/tests/uiAuditRemediationReconciliation.emit.test.ts
    - frontend/tests/validateVisualReconciliation.ts
    - frontend/tests/uiStatePurityInventory.ts
    - frontend/tests/presentationSurfaceInventory.test.ts
decisions:
  - Preserve the missing historical Phase 28 hashes as LOST_NO_BACKUP and consume only the tracked selected immutable attempt-3 authority.
  - Reconcile Phase 27/27.1 locks through canonical tracked source and Git provenance without claiming old bytes equal current bytes.
  - Keep emission validation deterministic in ordinary aggregate runs and require the complete explicit environment contract for actual artifact writes.
metrics:
  duration: 58m
  completed: 2026-08-24
actuals:
  tokens: 3900
  tasks: 2
  commits: 7
---

# Phase 28 Plan 15: Final Regression and Closeout Summary

Phase 28 closes with the full frontend aggregate at 186 files / 1,209 tests passed, while historical LOST_NO_BACKUP facts, immutable recovered authority, production behavior, operational database state, and rollback artifacts remain unchanged.

## Accomplishments

- Migrated Phase 28 baseline reconciliation tests from ignored/missing `frontend/test-results` inputs to the tracked, hash-pinned selected recovery authority at `.artifacts/phase28-ui-audit/baseline-recovery/attempt-3/evidence`.
- Preserved historical manifest and combined-baseline hashes strictly as `LOST_NO_BACKUP`, with `restored=false` and `byteEqualityToLostArtifacts=false`.
- Split ordinary remediation validation from the explicitly configured emitter path; partial environment configuration remains rejected and validation is not weakened.
- Reconciled Phase 27/27.1 source, line-ending, attestation, and Git-location locks against current canonical tracked source plus historical Git provenance.
- Updated only test-owned inventory counts, source locations, formatting parsers, and hidden-state fingerprints where current semantic behavior was already correct.
- Made no production, API, browser threshold/oracle, migration, database, activation, or rollback-artifact change.

## Exact Disposition of the Original 24 Failed Tests

The original log also contained one suite-load assertion in `operationalStateActionRegistry.test.ts`; Vitest reported it as a failed file, not one of the 24 failed test cases. It is listed separately so every failing file/assertion is accounted for.

### LOST_NO_BACKUP dependency — 13 tests

- `tests/uiAuditBaselineReconciliation.emit.test.ts` — canonical writer could not find ignored Phase 28 source artifacts.
- `tests/uiAuditBaselineReconciliation.test.ts` — 12 failures: canonical reconciliation; missing identity; duplicate identity; extra identity; mutated actor; mutated owner; non-GET/HEAD request; ownerless FAIL; guessed PASS; generic adapter reason; synthetic `productionRouteMeasured`; missing/duplicate canonical output identities.
- Disposition: load every source member from selected immutable attempt-3, validate each member against tracked recovery-authority SHA-256, and retain the old lost hashes/status unchanged. No old bytes were recreated.

### Dedicated-emitter invocation contract — 1 test

- `tests/uiAuditRemediationReconciliation.emit.test.ts` — ordinary aggregate invocation lacked `PHASE28_RECOVERY_AUTHORITY` and the rest of the emitter environment.
- Disposition: ordinary invocation performs pure tracked-authority validation; emission executes only when all five explicit variables are present, while partial configuration fails closed.

### Stale historical authority — 3 tests

- `tests/validateVisualReconciliation.test.ts` — two downstream-readiness assertions bound current HEAD to historical Phase 27.1 Git/source hashes.
- `tests/warehouseDataWorkspaceContract.test.ts` — post-correction attestation compared canonical LF hash to the CRLF working-tree byte representation.
- Disposition: historical correction bytes remain pinned and are proven in Git ancestry; current canonical tracked source is separately required to exist. Text attestations hash canonical LF source. No equality claim is made between old correction bytes and later current source.

### Presentation count / hidden state / source formatting — 7 tests

- `tests/buttonPrimitiveConvergence.test.ts` — current native-button locations changed and two stale exceptions disappeared.
- `tests/formPrimitiveConvergence.test.ts` — current receipt checkbox location moved.
- `tests/presentationSurfaceInventory.test.ts` — reviewed action inventory is 225, not 224.
- `tests/typographyContract.test.ts` — the scanner incorrectly counted a source-adjacent test file as production typography.
- `tests/uiOwnershipInstrumentationContract.test.tsx` — exact one-line attribute formatting rejected semantically identical multiline JSX.
- `tests/uiStatePurityContract.test.ts` — eight test-owned count/fingerprint records were stale after authorized Phase 28 source changes.
- `src/features/warehouse/pages/WarehouseMovementPanel.test.tsx` — exact whitespace formatting rejected the unchanged `SplitWorkbench wideDetailRail` semantic contract.
- Disposition: narrowed inventories/parsers and refreshed exact fingerprints from current semantic source; no production behavior changed.

### Failed-file assertion outside Vitest's 24-test count — 1 suite

- `tests/operationalStateActionRegistry.test.ts` — manifest debt source still pointed to line 66 after the function declaration moved to lines 63–71.
- Disposition: source-aware range updated in the manifest and its validating test; policy fragments and behavior remain unchanged.

### Production defects / genuine unrelated blockers

- Production defects: none.
- Genuine unrelated blockers: none.

## Verification

- Focused original-failure set: 13 files / 158 tests passed.
- Exact full frontend aggregate: 186 files / 1,209 tests passed / 0 failed.
- ESLint: passed.
- Dependency Cruiser: 438 modules / 1,645 dependencies / 0 violations.
- Production build: 2,294 modules transformed.
- Strict architecture tests: 6/6 passed; strict growth gate passed with exact existing debt.
- Route budgets: 10/10 passed; thresholds unchanged.
- `git diff --check`: passed.
- Staged-file check: empty.
- `api:check`: not available in the current frontend package; no replacement command was invented. Generated-contract/static checks from the completed implementation remain unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed aggregate dependence on ignored historical inputs**
- **Found during:** closeout blocker resolution
- **Issue:** tests read paths that the project intentionally does not track.
- **Fix:** read selected tracked recovery authority and verify member hashes.
- **Commit:** `22e9d221`

**2. [Rule 1 - Bug] Reconciled stale historical source locks**
- **Found during:** Phase 27/27.1 focused failures
- **Issue:** historical hashes and current source were treated as the same byte authority.
- **Fix:** prove historical bytes in Git ancestry and validate current tracked source separately.
- **Commit:** `077e9bcb`

**3. [Rule 1 - Bug] Refreshed narrow test-owned inventories/parsers**
- **Found during:** presentation/hidden-state/source-formatting failures
- **Issue:** line/count/fingerprint locks were stale or formatting-sensitive.
- **Fix:** update exact current inventory and semantic parsers only.
- **Commit:** `d95952d3`

## Known Stubs

None.

## Residual Risks

- Weekly Menu (274.93/275.00 KiB) and Purchasing (254.73/255.00 KiB) retain narrow route-budget headroom; thresholds were not changed.
- Existing strict architecture debt remains exactly tracked for `WarehousePage`, `MaterialDemandService`, `PurchaseHistoryReconciliationService`, and `DataQualityReportService`; no growth occurred.
- KnownProxies remains an operational warning pending exact trusted proxy addresses; this closeout did not alter runtime configuration.

## Self-Check: PASSED

All changed test files exist, commits `22e9d221`, `077e9bcb`, and `d95952d3` exist, the aggregate and requested static/build gates pass, and no staged files remain before the metadata commit.
