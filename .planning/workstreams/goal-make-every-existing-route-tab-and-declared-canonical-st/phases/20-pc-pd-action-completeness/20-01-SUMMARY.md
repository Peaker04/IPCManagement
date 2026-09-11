---
phase: 20
plan: 01
subsystem: frontend-test-oracle
tags: [pc, registry, completeness, read-only, source-guard]
requires:
  - Phase 19 executable registry family manifest and shared registry contract
provides:
  - normalized PC measurement row and exact five-viewport identity
  - fail-closed false-missing, unknown and raw-control validators
  - reusable source-fragment and production-import guards
affects:
  - Phase 20 aggregate browser fixture and disposition ledger
tech-stack:
  added: []
  patterns:
    - test-owned executable contract
    - imported authoritative viewport vocabulary
key-files:
  created:
    - frontend/tests/pcActionCompletenessContract.ts
    - frontend/tests/pcActionCompletenessContract.test.ts
    - frontend/tests/pcActionCompletenessSourceGuards.ts
  modified: []
key-decisions:
  - Reuse PA2B_VIEWPORTS rather than create a second five-viewport literal.
  - A THIẾU row is invalid until navigation, viewport, fixture-condition and role/state causes are all ruled out.
  - UNKNOWN evidence may remain unresolved but can never be counted as KHỚP.
requirements-completed: [ORCL-04, ORCL-05]
duration: 18 min
completed: 2026-07-31
---

# Phase 20 Plan 01: PC measurement contract summary

A test-owned PC contract now gives all six future family shards one deterministic identity, read-only evidence
label, raw control shape, false-missing discipline and source-drift boundary without importing audit code into
production.

## Work completed

1. Added `PcMeasurementRow`, exact mismatch vocabulary, the five imported PA-2B viewports and read-only fixture
   safety metadata.
2. Added runtime validators for duplicate identity, unsupported viewport, incomplete raw controls, missing
   source evidence, UNKNOWN-as-match and premature THIẾU classification.
3. Added unique source-fragment and production-import guards with committed positive and negative probes.

## Commits

| Commit | Description |
|---|---|
| `4059298` | `test(20-01): add PC measurement contract` |

## Verification

- Focused PC/registry suite: `4 files / 49 tests` passed.
- Full frontend unit suite: `101 files / 568 tests` passed; prior baseline was `100 files / 560 tests`.
- Targeted ESLint for all three new files passed.
- Production source scan found no import of the PC contract, source guards or future fixture.
- `git diff --check` and added-line credential/stub scan passed.
- GitNexus lightweight final staged audit on `feature/workflow-b17-b18`: LOW, 24 changed test symbols,
  3 files, 0 affected production process; no escalation or Deferred item.
- GitNexus was refreshed with `--index-only --branch feature/workflow-b17-b18`, so the generated/local
  `AGENTS.md` rule block was not rewritten.

## Deviations from Plan

- The first `gsd-executor` remained running for five minutes without writing a file or commit. Filesystem and
  git spot-checks proved no partial work, so it was closed and the plan was executed inline under the same
  exclusive file scope.
- The initial draft copied the viewport values. Source review found the importable `PA2B_VIEWPORTS` contract;
  the implementation was corrected before commit to reuse that source directly.

**Total deviations:** 2 resolved without scope expansion. **Impact:** no production, policy, browser, runtime or
database behavior changed.

## Self-Check: PASSED

- All three declared files exist and are committed.
- All task and plan verification criteria pass.
- The code commit exists and only contains the three declared test-owned files.
- Ready for Plan 20-02 aggregate read-only fixture execution.
