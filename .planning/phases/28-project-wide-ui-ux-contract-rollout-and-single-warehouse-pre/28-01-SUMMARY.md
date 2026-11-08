---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 01
subsystem: frontend-test-evidence
tags: [ui-audit, reconciliation, source-aware, read-only, seal]
requires: [phase-28-production-route-artifacts]
provides: [canonical-phase28-baseline, exact-six-part-identity-validation, source-artifact-seal]
affects: [phase-28-production-remediation]
tech-stack:
  added: []
  patterns: [source-owned identity authority, production-measurement override, fail-closed evidence reconciliation]
key-files:
  created:
    - frontend/tests/uiAuditBaselineReconciliation.ts
    - frontend/tests/uiAuditBaselineReconciliation.test.ts
    - frontend/tests/uiAuditBaselineReconciliation.emit.test.ts
  modified:
    - frontend/tests/uiAuditInventory.ts
    - frontend/package.json
key-decisions:
  - "SEALED denotes complete, provenance-checked read-only reconciliation; honest NEEDS_EVIDENCE remains allowed and is counted separately from verdict outcomes."
  - "Correct stale actor/lowest-owner fields at expandUiAuditInventory source; never canonicalize or rewrite artifact identities after capture."
  - "UI-SPEC ready-state protected-route evidence is hash-consumed as complementary evidence but cannot override a canonical query-state identity."
metrics:
  completed: 2026-08-23
  identities: 2142
  findings_per_identity: 32
  measured_identities: 903
  not_applicable_identities: 469
  needs_evidence_identities: 770
status: complete
---

# Phase 28 Plan 01: Final Real-route Baseline Reconciliation Summary

The read-only Phase 28 baseline is SEALED over exactly 2,142 canonical six-part identities and 68,544 findings, with production-route measurements overriding structural fallback only on byte-exact identities.

## Accomplishments

- Corrected the stale test-owned inventory actor and lowest-owner fields at their source, preserving all `route × region × state × viewport` members and the exact 2,142 identity count.
- Added one source-aware aggregator for the login route, complementary protected ready routes, all ten query-state route artifacts, and static/form routes.
- Added exact source-artifact hashes, canonical combined JSON hashing, identity-disposition totals, verdict totals, unresolved-reason totals, and a deterministic seal fingerprint.
- Kept production facts authoritative without fabricating PASS. Structural fallback always has `productionRouteMeasured: false`; exact inventory `N/A(...)` reasons are preserved; read-only mutation states receive route/region/state-specific NEEDS_EVIDENCE reasons.
- Added fail-closed mutation tests for missing, duplicate, extra, actor-mutated and owner-mutated identities; non-GET/HEAD traffic; ownerless FAIL; guessed PASS; synthetic production measurement; generic adapter reason; and malformed canonical output closure.

## Reconciliation Result

- Seal: `SEALED`.
- Identity dispositions: measured `903`; NOT_APPLICABLE `469`; NEEDS_EVIDENCE `770`.
- Finding outcomes: PASS `4,763`; FAIL `1,453`; NOT_APPLICABLE `15,120`; NEEDS_EVIDENCE `47,208`; UNRESOLVED `0`.
- Closure failures: missing `0`; duplicate `0`; extra `0`; non-GET/HEAD `0`; ownerless FAIL `0`; guessed PASS `0`; synthetic production measurement `0`; generic placeholder reason `0`.
- Generated output remains ignored as required: `frontend/test-results/ui-audit-phase28-baseline/canonical-combined.json` and `manifest.json`. The manifest is the sole local source for artifact and combined hashes.

## Unresolved Dispositions

The 770 identity-local NEEDS_EVIDENCE rows are honest baseline scope, not seal failures:

- Read-only mutation-in-flight/mutation-failure states that would require a business or localStorage write.
- Refreshing states whose page exposes no identity-local read-only refresh trigger after populated data.
- Partial-error-stale states that cannot be produced while retaining populated cache without mutation or cache manipulation.
- The Dashboard stale/error presentation limitation recorded by its committed adapter.

Exact per-reason counts are machine-readable in the generated manifest under `needsEvidenceReasonTotals`; no generic `production-state-adapter-not-yet-implemented` reason remains.

## Verification

- Focused reconciliation, inventory, query-adapter and static/form adapter suites: 5 files / 34 tests passed.
- Frontend ESLint passed.
- Frontend TypeScript and production Vite build passed with 2,293 modules transformed.
- `git diff --check`, scoped production-diff inspection, secret/stub scan and staged-file hygiene passed before commit.

## Scope

No production source, backend, database, migration, snapshot, visual threshold, route budget, or warehouse behavior changed.

## Self-Check: PASSED

Plan 28-01 acceptance is achieved: exact identity closure, complete 32-rule records, provenance hashes, honest unresolved evidence, fail-closed invariant tests, green static gates, and a SEALED manifest.
