---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 04
subsystem: ui
tags: [react, playwright, accessibility, route-owners, evidence-partition]
status: complete
requires:
  - phase: 28-03
    provides: exact 1,258-key non-Purchasing residual with attempt-3 authority
provides:
  - Zero current FAIL findings for Weekly Menu, Chef, Reports, Warehouse, Coordination, and Approvals
  - Browser-computed placeholder evidence correction for Axe false positives
  - Exact 152-key admin-only residual handoff for Plan 28-05
  - Fresh immutable six-cohort headed evidence with GET/HEAD-only ledgers
affects: [28-05, ui-audit, accessibility]
actuals:
  tokens: 3674256
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns: [owner-local accessibility remediation, browser-computed audit evidence, deterministic residual handoff]
key-files:
  created:
    - frontend/tests/uiAuditAxe.ts
    - .planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/28-05-ADMIN-RESIDUAL-HANDOFF.json
  modified:
    - frontend/src/styles/ui-redesign.css
    - frontend/src/components/ui/table.tsx
    - frontend/src/components/common/ExceptionLane.tsx
    - frontend/src/features/projects/weekly-menu/schedule/QuickServingCell.tsx
    - frontend/src/features/chef/components/material-checklist.tsx
    - frontend/src/features/reports/pages/ReportsPricePanel.tsx
    - frontend/tests/uiAuditRouteOwnerRegression.test.tsx
    - frontend/tests/weekly-menu-production-query.spec.ts
    - frontend/tests/chef-dashboard-production-query.spec.ts
    - frontend/tests/reports-production-query.spec.ts
    - frontend/tests/warehouse-production-query.spec.ts
    - frontend/tests/meal-orders-production-query.spec.ts
    - frontend/tests/approvals-production-query.spec.ts
key-decisions:
  - "Attempt-3 remains immutable authority: 1,258 residual keys partition exactly into 1,078 declared route-owner, 28 predecessor, and 152 admin-only keys."
  - "Axe placeholder contrast is accepted only when browser-computed evidence proves the scoped slate color, or an empty input's real text color differs from the pseudo-placeholder color."
  - "Authoritative zero-FAIL evidence is the five passing attempt-38 cohort members plus the corrected Weekly Menu attempt-39 member."
  - "Plan 28-05 receives only the 152 admin-owned keys at SHA-256 55b48a6c2ae84dd1b6aca529e1076af9e3b251d587c9d06d7e72d673ac3ad3a3."
requirements-completed: [PUX-01, PUX-04, PUX-05, PUX-06]
metrics:
  duration: 3h
  completed: 2026-08-24
---

# Phase 28 Plan 04: Non-admin Route-owner Remediation Summary

Six non-admin route families now have zero current FAIL findings across 1,029 headed production-route identities, while 23,212 honest `NEEDS_EVIDENCE` findings remain unchanged and one exact 152-key admin handoff is frozen for 28-05.

## Performance

- **Tasks:** 2 completed
- **Commits:** 4 including the preserved RED contract and final metadata commits
- **Fresh headed evidence:** 6 cohorts passed operationally
- **Authoritative verdict totals:** 4,116 PASS; 0 FAIL; 23,212 NEEDS_EVIDENCE; 5,600 NOT_APPLICABLE
- **Network contract:** recorded requests remained GET/HEAD-only

## Accomplishments

- Reproduced the exact 1,258-key authority hash `b8fa28d6f612c719912c89620a5729b83b0264be4fc8b57aadeb9c2ddc98fa6a` and its 1,078/28/152 disjoint partition.
- Corrected owner-local hierarchy, naming, contrast, ARIA, and scroll-region defects across Weekly Menu, Chef, Reports, Warehouse, Coordination, and Approvals.
- Corrected two audit false predicates with focused regression coverage: hidden/non-tabbable Base UI internals are not actionable, native `labels` provide names, and browser-computed placeholder/text colors supersede Axe's stale placeholder parsing only under exact evidence conditions.
- Preserved query behavior, state seams, permissions, and honest unmeasured classifications.
- Froze the admin-only handoff as 152 deterministic six-part keys with SHA-256 `55b48a6c2ae84dd1b6aca529e1076af9e3b251d587c9d06d7e72d673ac3ad3a3`.

## Evidence

The immutable authoritative member set is exactly:

- `.artifacts/phase28-ui-audit/remediation/attempt-38/non-admin-evidence/ui-audit-phase28-approvals-query-states.json`
- `.artifacts/phase28-ui-audit/remediation/attempt-38/non-admin-evidence/ui-audit-phase28-chef-dashboard-query-states.json`
- `.artifacts/phase28-ui-audit/remediation/attempt-38/non-admin-evidence/ui-audit-phase28-meal-orders-query-states.json`
- `.artifacts/phase28-ui-audit/remediation/attempt-38/non-admin-evidence/ui-audit-phase28-reports-query-states.json`
- `.artifacts/phase28-ui-audit/remediation/attempt-38/non-admin-evidence/ui-audit-phase28-warehouse-query-states.json`
- `.artifacts/phase28-ui-audit/remediation/attempt-39/weekly-menu-evidence/ui-audit-phase28-weekly-menu-query-states.json`

Attempt-38's Weekly Menu member remains immutable failed history and is not authoritative; attempt-39 supersedes only that cohort after the exact empty number-input contrast correction.

## Verification

- Focused Vitest regression: 3/3 passed.
- Production TypeScript/Vite build: passed.
- Six headed Playwright production-query adapters: passed; focused corrected Weekly cohort: passed.
- ESLint: passed.
- Dependency Cruiser: passed with zero dependency violations.
- Strict architecture growth gate: passed with pre-existing debt reported.
- Route budgets: passed; Weekly Menu remains close to its budget at 274.91/275.00 KiB.
- Handoff count/hash recomputation and `git diff --check`: passed.
- Changed-path secret/stub and temporary-diagnostic scans: clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected actionable-control naming predicate**
- **Found during:** Task 1 headed evidence
- **Issue:** Native controls associated through `element.labels` were falsely classified unnamed; hidden and non-tabbable Base UI internals were treated as actionable.
- **Fix:** Added exact visibility/name predicates and focused regression assertions to all six adapters.
- **Commit:** `08b19d94`

**2. [Rule 1 - Bug] Corrected Axe placeholder false evidence**
- **Found during:** Task 1 headed evidence
- **Issue:** Axe reported the stale muted placeholder color after the browser computed the scoped passing color, and applied pseudo-placeholder color to an empty number input.
- **Fix:** Added browser-computed evidence filtering with exact conditions; real low-contrast input text remained a FAIL and was fixed at `QuickServingCell`.
- **Commit:** `08b19d94`

**3. [Rule 2 - Missing critical functionality] Added opt-in focus semantics for scroll regions**
- **Found during:** Task 1 mobile evidence
- **Issue:** Reports exception lane and Chef checklist table container could scroll without keyboard focus.
- **Fix:** Added owner-opted labels and focusability without changing unrelated instances.
- **Commit:** `08b19d94`

## Decisions Made

- Keep all production changes at declared route owners or opt-in shared primitives activated only by those owners.
- Do not weaken `NEEDS_EVIDENCE`; the retained 23,212 findings remain explicit future evidence obligations.
- Use deterministic sorted JSON over `identity`, `ruleId`, `expected`, `actual`, `severity`, and `lowestOwner` for the 28-05 handoff hash.

## Residual Risks

- Plan 28-05 still owns 152 exact Admin Data, Approval Rules, and Advanced Settings FAIL keys.
- Headed Chef execution emits an existing React missing-key console warning from `MaterialChecklist`; it did not alter oracle verdicts and remains a follow-up code-quality risk.
- Weekly Menu route size is 274.91 KiB against a 275.00 KiB budget and has little growth headroom.
- Strict architecture output retains pre-existing split-plan debt in `MaterialDemandService` and `PurchaseHistoryReconciliationService`.

## Known Stubs

None.

## Self-Check: PASSED

All declared source, evidence, handoff, and summary files exist; commits `0744066b`, `08b19d94`, and `77a1e5d3` are present; the admin handoff recomputes to 152 keys and its pinned hash.
