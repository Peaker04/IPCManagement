---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 06
subsystem: ui-audit
tags: [playwright, headed-chrome, accessibility, deterministic-evidence, reconciliation]
status: complete
requires:
  - phase: 28-05
    provides: locked Admin residual handoff and 112-row raw legacy disposition
provides:
  - Two byte-identical headed production-route matrices containing 2,142 identities and 68,544 findings each
  - Hash-pinned append-only attempt-67 selection authority
  - Fail-closed reconciliation preserving 47,208 NEEDS_EVIDENCE and 112 raw legacy Admin rows
  - Deterministic transition and endpoint readiness for Weekly Menu and Chef evidence
  - Selector-proven Dashboard contrast closure
affects: [phase-28-closeout, ui-audit, accessibility]
tech-stack:
  added: []
  patterns: [direct Node-controlled headed capture, byte-exact canonical reconciliation, endpoint-observed readiness, owner-local semantic tone]
key-files:
  created:
    - frontend/tests/uiAuditRemediationReconciliation.ts
    - frontend/tests/uiAuditRemediationReconciliation.test.ts
    - frontend/tests/uiAuditRemediationReconciliation.emit.test.ts
    - frontend/tests/uiAuditRemediationPrecondition.test.ts
    - frontend/tests/ui-audit-remediation.spec.ts
    - tools/e2e/run-phase28-remediation.mjs
  modified:
    - frontend/tests/uiAuditBaselineReconciliation.ts
    - frontend/tests/weekly-menu-production-query.spec.ts
    - frontend/tests/chef-dashboard-production-query.spec.ts
    - frontend/src/styles/components/dashboard.css
key-decisions:
  - "Retain the 112 Admin Data legacy rows as raw FAIL provenance with NON_ACTIONABLE_RAW_RETAINED disposition; report raw PASS 6,104 and effective closed PASS 6,216 without rewriting evidence."
  - "Require byte-exact canonical equality after schema-defined network ordering; never suppress request member-set differences."
  - "Fix the four Dashboard contrast failures only at .ipc-dashboard-gate-copy small using existing semantic slate-600."
  - "Treat Weekly Menu's mid-transition outline-button result and Chef's pre-tab service-run query as deterministic readiness defects in the evidence adapters, not as grounds for axe filtering or fabricated requests."
metrics:
  duration: 7h
  completed: 2026-08-24
actuals:
  tokens: 12722
  tasks: 2
  commits: 5
---

# Phase 28 Plan 06: Deterministic Remediation Reconciliation Summary

Two fresh headed Chrome runs now reconcile byte-for-byte at SHA-256 `ff043b0d44db49944d33076dea37a015b596bcd0f2e606db84643c1f23454724`, preserving the exact 2,142-identity matrix, all 47,208 honest NEEDS_EVIDENCE findings, and the 112 immutable legacy Admin raw rows while closing actionable FAIL and UNRESOLVED to zero.

## Performance

- **Tasks:** 2 completed
- **Commits:** 5 task commits
- **Focused unit tests:** 34/34 passed
- **Fresh headed evidence:** two complete production-route matrices
- **Production build:** 2,293 modules passed
- **Network contract:** GET/HEAD-only; zero observed writes

## Accomplishments

- Added a fail-closed reconciliation contract that validates recovery-authority member hashes, immutable historical LOST_NO_BACKUP truth, six-part identities, exact 32-rule membership, read-only network evidence, honest NEEDS_EVIDENCE preservation, actionable failure closure, and byte-exact two-run equality.
- Captured append-only `attempt-67` using a direct Node-controlled Vite and repository-resolved headed Playwright process lane, with all runner output path-disjoint from `frontend/test-results`.
- Selected run 2 only after run 1 and run 2 independently passed the full matrix and their canonical bytes matched.
- Preserved the 112 Admin Data legacy rows as raw evidence under `NON_ACTIONABLE_RAW_RETAINED`; no threshold, predicate, oracle, screenshot, baseline, or raw verdict was rewritten.
- Corrected the selector-proven Dashboard gate-description contrast from slate-500 to existing semantic slate-600 and proved the four exact failing identities exceed 4.5:1.
- Diagnosed the Weekly Menu run-only failure as axe sampling an outline button during `transition-colors`; the adapter now waits for finite subtree animations to settle before measurement.
- Made Chef `production-active-then-documents-visited` deterministic by observing the exact endpoint-owned service-run GET before visiting the documents tab and slicing the record ledger.

## Exact Closure

- Identity count per run: `2,142`
- Rules per identity: `32`
- Findings per run: `68,544`
- Raw verdict totals per run: `PASS 6,104`, `FAIL 112`, `NOT_APPLICABLE 15,120`, `NEEDS_EVIDENCE 47,208`, `UNRESOLVED 0`
- Legacy raw Admin disposition: `112 NON_ACTIONABLE_RAW_RETAINED`
- Effective closed totals: `PASS 6,216`, actionable `FAIL 0`, `NOT_APPLICABLE 15,120`, `NEEDS_EVIDENCE 47,208`, `UNRESOLVED 0`
- Run 1 SHA-256: `ff043b0d44db49944d33076dea37a015b596bcd0f2e606db84643c1f23454724`
- Run 2 SHA-256: `ff043b0d44db49944d33076dea37a015b596bcd0f2e606db84643c1f23454724`
- Byte equality: `true`
- Actionable owner-bearing FAIL: `0`
- Non-GET/HEAD requests: `0`

## Evidence

- Attempt manifest: `.artifacts/phase28-ui-audit/remediation/attempt-67/manifest.json`
- Run 1 canonical evidence: `.artifacts/phase28-ui-audit/remediation/attempt-67/run-1/canonical-combined.json`
- Run 2 canonical evidence: `.artifacts/phase28-ui-audit/remediation/attempt-67/run-2/canonical-combined.json`
- Selection authority: `.artifacts/phase28-ui-audit/remediation/selected-attempt.json`
- Evidence is intentionally gitignored; `git status --short --ignored` reports both attempt-67 and the selection authority with `!!`, while normal and staged status remain empty.

## Verification

- `npm run test:unit -w frontend -- --run tests/uiAuditRemediationReconciliation.test.ts tests/uiAuditBaselineDelta.test.ts tests/uiAuditRemediationPrecondition.test.ts --maxWorkers=1`: 3 files / 34 tests passed.
- Focused headed Weekly Menu adapter after transition readiness: passed with the exact previously transient identity at A11Y-01 PASS.
- Focused headed Dashboard adapter: all four exact prior A11Y-01 identities passed.
- Focused headed Chef adapter twice: both artifacts byte-identical; all 28 measured `chef-documents` records contain exactly one expected service-run GET.
- Full attempt-67 run 1: all route adapters passed.
- Full attempt-67 run 2: all route adapters passed.
- Fail-closed immutable emitter/reconciler: passed.
- `npm run build -w frontend`: TypeScript and Vite production build passed.
- `git diff --check`: passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected selector-proven Dashboard contrast**
- **Found during:** Task 2 attempt-65
- **Issue:** `.ipc-dashboard-gate-copy small` used slate-500 over pale-blue gate backgrounds, measuring 4.18–4.46:1 across four exact Dashboard identities.
- **Fix:** Applied existing semantic slate-600 only to the gate description owner and added exact contrast regressions.
- **Files modified:** `frontend/src/styles/components/dashboard.css`, `frontend/tests/uiAuditRemediationPrecondition.test.ts`
- **Commit:** `239b892d`

**2. [Rule 1 - Bug] Settled Weekly Menu transition before axe capture**
- **Found during:** Task 2 attempt-65
- **Issue:** Axe sampled the generated-demand outline button while `transition-colors` interpolated through a 4.1:1 frame; settled colors passed.
- **Fix:** Waited for the measured panel's finite subtree animations/transitions to settle and retained exact violation attribution.
- **Files modified:** `frontend/tests/weekly-menu-production-query.spec.ts`
- **Commit:** `239b892d`

**3. [Rule 1 - Bug] Stabilized Chef endpoint-owned request readiness**
- **Found during:** Task 2 attempt-66
- **Issue:** Four `chef-documents` records visited the documents tab before the production-active service-run GET was guaranteed to issue, producing a true network member-set mismatch.
- **Fix:** Observed the exact GET before visiting documents and asserted its presence in every measured document record without fabrication or filtering.
- **Files modified:** `frontend/tests/chef-dashboard-production-query.spec.ts`
- **Commit:** `feac2e65`

**4. [Rule 3 - Blocking] Replaced unavailable vite-node CLI path**
- **Found during:** Task 2 attempt-63
- **Issue:** The repository had no `node_modules/vite-node/vite-node.mjs` executable.
- **Fix:** Used the already-installed repository Vitest runner with a dedicated fail-closed emit test.
- **Files modified:** `tools/e2e/run-phase28-remediation.mjs`, `frontend/tests/uiAuditRemediationReconciliation.emit.test.ts`
- **Commit:** `f1b1b3e4`

## Decisions Made

- Attempts 63–66 remain immutable failed evidence and were never reused or altered.
- Attempt 67 was created only after confirming the whole root and selection authority were absent.
- Network arrays are sorted as a schema-defined deterministic ordering before canonical serialization; request presence and multiplicity remain exact and fail closed.
- No production API, backend, database, cache, permission, business behavior, shared styling primitive, threshold, axe rule, baseline snapshot, or historical authority changed.

## Residual Risks

None within Plan 28-06. The 112 legacy Admin raw rows remain deliberately visible as provenance and are separately dispositioned rather than hidden.

## Known Stubs

None.

## Self-Check: PASSED

All declared source/test/controller files exist; commits `37dab867`, `5c60e4f4`, `239b892d`, `f1b1b3e4`, and `feac2e65` exist; attempt-67 run hashes are equal; exact totals and read-only gates pass; selection authority pins run 2 to the matching hash; no staged source files remain.
