---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 05
subsystem: ui
tags: [react, accessibility, responsive, admin, headed-evidence]
status: complete
requires:
  - phase: 28-04
    provides: exact 152-key admin residual handoff
provides:
  - Exact Admin Data 130px overflow closed at 320x900@200%
  - Approval Rules and Advanced Settings contrast and nested-interactive residuals closed
  - Selector-proven 28-06 admin closure handoff with honest NEEDS_EVIDENCE retained
affects: [28-06, ui-audit, admin-ui]
tech-stack:
  added: []
  patterns: [owner-local intrinsic sizing, named local table viewport, sibling native controls, semantic contrast tokens]
key-files:
  created: []
  modified:
    - frontend/src/app/pages/AdminDataPage.tsx
    - frontend/src/app/pages/admin-data/AdminBomPanel.tsx
    - frontend/src/features/admin/pages/ApprovalRulesPage.tsx
    - frontend/src/features/admin/components/AdvancedDisplaySettings.tsx
    - frontend/src/app/pages/admin-data/AdminDataPage.state.test.ts
    - frontend/src/features/admin/pages/ApprovalRulesPage.state.test.tsx
    - frontend/src/features/admin/components/AdvancedDisplaySettings.test.tsx
key-decisions:
  - "Constrain the exact 600px BOM table and open BOM form at their owner instead of changing the shared TableViewport or dialog primitive."
  - "Treat the 112 remaining raw Admin Data adapter rows as non-actionable stale-predicate duplicates only because 28-04 already locked the hidden Base UI and browser-computed contrast predicates; do not weaken thresholds or rewrite evidence."
  - "Preserve all NEEDS_EVIDENCE findings and pass them unchanged to Plan 28-06."
metrics:
  duration: 1h
  completed: 2026-08-24
actuals:
  tokens: 5169
  tasks: 2
  commits: 5
---

# Phase 28 Plan 05: Admin Residual Remediation Summary

Admin Data now contains its fixed-width BOM work inside a named keyboard-scrollable viewport at 200% text zoom, while Approval Rules and Advanced Settings use passing semantic text tones and distinct native interaction owners without changing admin behavior.

## Performance

- **Tasks:** 2 completed
- **Commits:** 5 (one RED contract and four scoped implementation commits)
- **Focused unit tests:** 28/28 passed
- **Fresh headed evidence:** Admin Data 196 identities; Approval Rules 49 identities; Advanced Settings 63 identities
- **Network contract:** zero non-GET/HEAD requests in all authoritative evidence members

## Accomplishments

- Revalidated the handoff at exactly 152 unique six-part keys and SHA-256 `55b48a6c2ae84dd1b6aca529e1076af9e3b251d587c9d06d7e72d673ac3ad3a3`, with the owner set exactly `AdminDataPage`, `ApprovalRulesPage`, and `AdvancedDisplaySettings`.
- Removed the exact Admin Data `130px` document overflow at `/admin-data|admin-imports|populated|administrator|320x900@200%|AdminDataPage`; final focused probing reports no overflow event and all actions remain reachable.
- Confined the 600px BOM table to the existing named, focusable local table viewport without changing shared table behavior.
- Kept the manual BOM form intrinsically shrinkable inside dialog portal padding at 200% text zoom.
- Replaced exact Approval Rules low-contrast text tones with existing semantic slate/red tones.
- Split Advanced Settings accordion expansion and `Hiện tất cả tab` into sibling native buttons, preserving expansion, keyboard access, localStorage keys, tab visibility guards, and reset behavior.

## Exact 28-06 Closure Handoff

### Authority reproduced before edits

- Count: `152`
- Unique exact keys: `152`
- SHA-256: `55b48a6c2ae84dd1b6aca529e1076af9e3b251d587c9d06d7e72d673ac3ad3a3`
- Six-part identity preservation: `152/152`
- Unknown or non-admin owner keys: `0`

### Completed residual disposition

- Exact responsive findings (`RESP-01`, `RESP-02`): `2 → 0` actionable FAIL.
- Approval Rules: `0` current raw/actionable FAIL in attempt-44.
- Advanced Settings: `0` current raw/actionable FAIL in attempt-52.
- Admin Data actionable FAIL after applying the already-locked 28-04 Base UI visibility/name and browser-computed contrast predicates: `0`.
- Admin Data raw legacy-adapter rows retained for provenance: `112` (`56 HIER-02` plus the same `56 A11Y-01` duplicates). These are not actionable findings: the observed controls are Base UI internals whose production owners already carry accessible labels, and their contrast rows are the browser-computed false-positive class fixed and regression-locked in 28-04. They are not promoted to PASS by changing thresholds or production semantics.
- Unauthorized changed key outside the 152-key admin partition: `0`.
- Honest `NEEDS_EVIDENCE`: preserved; no evidence promotion was performed.
- `UNRESOLVED`: `0` introduced.

Plan 28-06 must consume this distinction fail-closed: reconcile owner-bearing/actionable findings using the locked 28-04 predicates, retain raw adapter provenance, and preserve every `NEEDS_EVIDENCE` unless separately authorized production measurement exists.

## Evidence

- Admin Data final headed member: `.artifacts/phase28-ui-audit/remediation/attempt-62/admin-data-evidence/ui-audit-phase28-admin-data-query-states.json` — 196 identities, 6,272 findings, zero responsive FAIL, zero non-GET/HEAD requests, 4,592 NEEDS_EVIDENCE preserved.
- Approval Rules headed member: `.artifacts/phase28-ui-audit/remediation/attempt-44/admin-controls-evidence/ui-audit-phase28-approval-rules-query-states.json` — 49 identities, zero raw FAIL, zero non-GET/HEAD requests, 1,148 NEEDS_EVIDENCE preserved.
- Advanced Settings headed member: `.artifacts/phase28-ui-audit/remediation/attempt-52/admin-controls-evidence/ui-audit-phase28-static-form-production-routes.json` — 63 scoped identities, zero raw FAIL, zero non-GET/HEAD requests, 602 NEEDS_EVIDENCE preserved.

## Verification

- Focused Vitest: 3 files / 28 tests passed.
- Headed Playwright Admin Data adapter: 4/4 cohort tests passed.
- Headed Playwright Approval Rules adapter: 1/1 passed.
- Headed Playwright static/form adapter: 1/1 passed.
- ESLint: passed.
- Dependency Cruiser: 437 modules / 1,643 dependencies / zero violations.
- Production build: 2,293 modules passed.
- Strict architecture growth: passed with only pre-existing debt.
- Route budgets: all passed; Weekly Menu remains 274.92/275.00 KiB.
- `git diff --check`: passed.
- Changed-path stub/secret review: no new stub or secret.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the selector-proven overflow owner**
- **Found during:** Task 1 headed evidence
- **Issue:** Initial form-grid wrapping did not close the residual because the actual escaping owner was the 600px BOM table and, while the manual dialog was open, its intrinsic form width inside zoom-scaled portal padding.
- **Fix:** Added a viewport-bounded wrapper around only the BOM table and a shrinkable owner-local dialog width accounting for portal padding.
- **Files modified:** `frontend/src/app/pages/admin-data/AdminBomPanel.tsx`
- **Commits:** `313fe729`, `afbec1db`, `84c5a5cb`

**2. [Rule 1 - Bug] Removed opacity-induced Advanced Settings contrast loss**
- **Found during:** Task 2 headed Axe evidence
- **Issue:** Disabled-looking navigation cards blended otherwise passing slate tones through parent opacity, reducing computed contrast to 3.29:1.
- **Fix:** Kept explicit state text/line-through styling and removed parent opacity blending.
- **Files modified:** `frontend/src/features/admin/components/AdvancedDisplaySettings.tsx`
- **Commit:** `13454923`

## Decisions Made

- No shared primitive, route, permission, policy, cache, API, backend, database, or business behavior changed.
- No threshold, baseline, oracle, or historical artifact was rewritten.
- Screenshot evidence was not used as a verdict oracle.

## Residual Risks

- The Admin Data production-query adapter still emits 112 raw rows from its pre-28-04 visibility/name/contrast predicate; Plan 28-06 must reconcile them through the already-tested predicate rather than mistake them for owner-bearing/actionable failures.
- Weekly Menu route budget remains close to its ceiling at 274.92/275.00 KiB; this plan did not touch that route.
- Pre-existing architecture split-plan debt remains in `MaterialDemandService` and `PurchaseHistoryReconciliationService`.

## Known Stubs

None.

## Self-Check: PASSED

All seven declared changed source/test files exist; commits `1327a619`, `313fe729`, `13454923`, `afbec1db`, and `84c5a5cb` exist; the handoff recomputes to 152 unique exact keys at the pinned SHA-256; final focused unit, headed evidence, lint, dependency, build, architecture, route-budget, and diff gates passed.
