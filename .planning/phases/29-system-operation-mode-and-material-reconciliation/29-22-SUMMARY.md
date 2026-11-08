---
phase: 29-system-operation-mode-and-material-reconciliation
plan: 22
subsystem: protected-closeout
status: complete
tags: [mysql, reconciliation, operation-mode, playwright, evidence]
requires:
  - phase: 29-24
    provides: production quantity-import reachability
provides:
  - protected MySQL/API/browser proof for operation mode and reconciliation
  - exact-one completed reconciliation authority with zero stock/procurement action
  - Phase 29 requirement and canonical-state closeout
affects: [requirements, roadmap, memory, evidence-index]
tech-stack:
  added: []
  patterns: [raw .NET GUID storage verification, exact standalone success marker, unified protected executor]
key-files:
  created:
    - .planning/phases/29-system-operation-mode-and-material-reconciliation/29-VERIFICATION.md
    - .planning/phases/29-system-operation-mode-and-material-reconciliation/29-22-SUMMARY.md
  modified:
    - docs/EVIDENCE-INDEX.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - MEMORY.md
    - HISTORY.md
key-decisions:
  - "Historical workbook remains MISSING / NOT RECOVERED; the controlled source is fresh authority and not equivalent recovery."
  - "Retain ipc_lane7 at migration 75 with one completed Retry 16 authority and final DEFAULT mode."
  - "EF GUID evidence compares independently converted raw .NET storage hex, never MySQL UUID helper output."
actuals:
  tokens: 9200
  tasks: 2
  commits: 1
metrics:
  duration: 24 min
  completed: 2026-08-28
---

# Phase 29 Plan 22: Protected Evidence and Closeout Summary

Fresh Retry 16 production authority links server-owned operation mode, quantity import, exact-one reconciliation, raw-HEX MySQL identity and five-viewport headed Chrome evidence while proving zero procurement or inventory action.

## Accomplishments

- Independently confirmed exact `ipc_lane7` at migration 75, final `DEFAULT / 5`, one `COMPLETED / 4` reconciliation batch and 55/55 positive material lines.
- Accepted fresh five-viewport browser evidence only after DOM accessibility, authenticated API, raw-HEX DB and reload identities agreed with zero forbidden requests or browser errors.
- Confirmed the normalized procurement/inventory diff is 0 bytes using bounded non-truncating hashes and independent cross-checks.
- Reconciled OPM-01..04, MRC-01..04, CLR-01..03 and locked D-01..D-42 authority.
- Ran backend, frontend serial aggregate, hotfix, lint, checklist, OpenAPI, EF-model and Release build gates.

## Verification

See `29-VERIFICATION.md`. Aggregate results: Application 49/49; API 1,044 pass + 1 intentional skip; frontend serial 191 files / 1,228 tests; focused Phase 29 18/18; lint/checklist/API parity/EF model/Release builds PASS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Evidence harness] Replaced invalid MySQL GUID conversion**
- **Found during:** protected Retry 14.
- **Issue:** MySQL UUID helpers did not represent EF/.NET `Guid` byte storage.
- **Fix:** Fixed-vector-tested conversion, `UNHEX(expectedHex)` lookup and uppercase `HEX(column)` comparison.
- **Commit:** protected harness evidence; no production commit.

**2. [Rule 1 - UI identity] Added exact accessible batch identity**
- **Found during:** protected Retry 15.
- **Issue:** The compact suffix label did not expose the exact batch GUID in DOM evidence.
- **Fix:** Preserved compact visible copy and added exact title/screen-reader identity.
- **Commit:** `9e0805cc`.

**3. [Rule 3 - Test execution] Serialized the authoritative frontend aggregate**
- **Found during:** closeout.
- **Issue:** Parallel aggregate produced one Approval dialog contention failure; the file passed 10/10 alone.
- **Fix:** Full `--maxWorkers=1` rerun passed 191 files / 1,228 tests without source or threshold changes.

## Known Stubs

None.

## Threat Flags

None beyond the authenticated mode/reconciliation trust boundary already covered by Plans 29-01..24.

## Final Database Disposition

`ipc_lane7` intentionally remains at migration 75 with exact completed batch `0f6d0c0c-8dd6-4043-8653-4c96823e566b`; final mode is `DEFAULT`, and ports 3036/8036 are closed.

## Self-Check: PASSED

Canonical closeout files exist, protected artifacts were re-read, commit `9e0805cc` exists, all scoped verification gates passed, and unrelated user changes remained unstaged and byte-stable.
