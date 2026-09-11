---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 03
subsystem: ui
tags: [react, playwright, accessibility, purchasing, evidence-partition]
requires:
  - phase: 28-02
    provides: hash-pinned attempt-3 authority and FAIL-only owner attribution
provides:
  - Purchasing hierarchy, native table-header, control-evidence, and contrast corrections
  - Zero current Purchasing FAIL findings across the 147-identity D5+R2 query-state matrix
  - Exact 1,258-key non-Purchasing residual handoff with six-part identity and SHA-256 pin
affects: [28-04, purchasing-ui-audit]
actuals:
  tokens: 8172
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns: [FAIL-only owner correction, actionable-control visibility predicate, immutable residual-key partition]
key-files:
  created: []
  modified:
    - frontend/src/features/purchasing/pages/PurchasingPage.tsx
    - frontend/src/features/purchasing/PurchaseServiceDateWorkbench.tsx
    - frontend/src/features/purchasing/SupplementalPurchasingWorkbench.tsx
    - frontend/src/features/purchasing/quotation/SupplierQuotationSection.tsx
    - frontend/src/features/purchasing/pages/PurchasingPage.state.test.tsx
    - frontend/tests/purchasing-production-query.spec.ts
key-decisions:
  - "Selected attempt-3 authority governs the partition: 1,461 total FAIL, 203 Purchasing FAIL, and 1,258 residual FAIL keys."
  - "Aria-hidden tabindex=-1 Base UI internal inputs are excluded from actionable unnamed-control evidence; genuine visible unnamed controls still fail."
  - "Contrast changes stay at the two selector-proven Purchasing owners; shared Input and EmptyState styling remains unchanged."
patterns-established:
  - "Residual handoffs serialize identity, ruleId, expected, actual, severity, and lowestOwner in deterministic sorted JSON before SHA-256."
requirements-completed: [PUX-01, PUX-04, PUX-05, PUX-06]
coverage:
  - id: D1
    description: Purchasing has one route H1 and native table headers in all measured workflow states.
    requirement: PUX-01
    verification:
      - kind: unit
        ref: frontend/src/features/purchasing/pages/PurchasingPage.state.test.tsx
        status: pass
      - kind: automated_ui
        ref: .artifacts/phase28-ui-audit/remediation/attempt-21/purchasing-evidence/ui-audit-phase28-purchasing-query-states.json
        status: pass
    human_judgment: false
  - id: D2
    description: Purchasing control and contrast findings are zero while GET-only query behavior and preserved panels remain unchanged.
    requirement: PUX-05
    verification:
      - kind: automated_ui
        ref: frontend/tests/purchasing-production-query.spec.ts
        status: pass
      - kind: other
        ref: npm run build -w frontend && npm run depcruise -w frontend && npm run check:route-budgets -w frontend
        status: pass
    human_judgment: false
  - id: D3
    description: Exact non-Purchasing residual FAIL keys are reproducible without consuming NEEDS_EVIDENCE.
    requirement: PUX-06
    verification:
      - kind: unit
        ref: frontend/src/features/purchasing/pages/PurchasingPage.state.test.tsx#partitions exact current recovery FAIL keys
        status: pass
    human_judgment: false
duration: 21min
completed: 2026-08-24
status: complete
---

# Phase 28 Plan 03: Purchasing Remediation and Residual Handoff Summary

**Purchasing now has zero measured query-state FAIL findings, with exact API/cache behavior preserved and 1,258 non-Purchasing FAIL keys handed to Plan 28-04 by deterministic SHA-256.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-24T07:41:07Z
- **Completed:** 2026-08-24T07:58:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Demoted the duplicate view heading while retaining the route work-object H1, and replaced the date grouping's prohibited generic ARIA with native fieldset/legend semantics.
- Added visible native headers to loading and empty workflow tables and preserved the populated table's existing seven-column contract.
- Corrected only selector-proven Purchasing quotation/empty-state contrast and excluded non-actionable `aria-hidden`, `tabindex=-1` Base UI internals from unnamed-control evidence.
- Fresh direct-Node headed attempt 21 records 147 identities with FAIL 0, PASS 637, NEEDS_EVIDENCE 3,619, NOT_APPLICABLE 448, and GET as the only observed network method.
- Pinned the exact residual handoff: 1,258 non-Purchasing FAIL keys, SHA-256 `b8fa28d6f612c719912c89620a5729b83b0264be4fc8b57aadeb9c2ddc98fa6a`.

## Task Commits

1. **Task 1 RED: Add failing Purchasing remediation contracts** - `532e334a`
2. **Task 1 GREEN: Close Purchasing audit failures** - `a6599347`
3. **Task 2: Pin exact residual FAIL handoff** - `f8e38acd`
4. **Rule 3 fix: Keep residual proof production-build safe** - `d423e068`

## Files Created/Modified

- `frontend/src/features/purchasing/pages/PurchasingPage.tsx` - Keeps the route H1 authoritative and renders the active view title as H2.
- `frontend/src/features/purchasing/PurchaseServiceDateWorkbench.tsx` - Uses native date-group and seven-column table semantics for loading/empty states.
- `frontend/src/features/purchasing/SupplementalPurchasingWorkbench.tsx` - Raises only the sealed Purchasing empty-description contrast.
- `frontend/src/features/purchasing/quotation/SupplierQuotationSection.tsx` - Corrects selector-proven quotation input, placeholder, status, and empty-row contrast.
- `frontend/src/features/purchasing/pages/PurchasingPage.state.test.tsx` - Locks source semantics, query arguments, exact 203/1,258 partition, 47,208 NEEDS_EVIDENCE exclusion, and residual hash.
- `frontend/tests/purchasing-production-query.spec.ts` - Excludes non-actionable hidden Base UI internals while retaining failure for a genuinely visible unnamed button.

## Decisions Made

- Recovery attempt 3 remains immutable authority. The stale plan-wide total of 1,453 was not used; the selected authority's exact 1,461 FAIL rows were partitioned.
- The six-part identity remains byte-preserved inside each residual key; rule and attribution fields are preserved alongside it.
- API arguments, RTK Query skip/cache identity, permissions, payloads, actions, panel mounting, active-first navigation, and preserve-visited behavior were not changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Deterministic harness bug] Excluded non-actionable hidden select internals**
- **Found during:** Task 1 fresh headed evidence
- **Issue:** The Purchasing predicate treated 1px `aria-hidden=true`, `tabindex=-1` Base UI inputs as visible unnamed controls solely because their rectangles were non-zero.
- **Fix:** Added actionable visibility conditions and a headed regression that still detects a genuinely visible unnamed button.
- **Files modified:** `frontend/tests/purchasing-production-query.spec.ts`
- **Verification:** Attempt 21 has HIER-02 FAIL 0 and the focused predicate test passes.
- **Committed in:** `a6599347`

**2. [Rule 2 - Missing critical owner coverage] Added exact selector-proven Purchasing owners**
- **Found during:** Task 1 fresh headed attribution
- **Issue:** Selected contrast failures originated in Purchasing quotation and supplemental owners omitted from the original three-file declaration.
- **Fix:** With explicit supervisor authorization, added exactly those two Purchasing production owners and the existing Purchasing query harness to scope; no shared or non-Purchasing owner changed.
- **Files modified:** `frontend/src/features/purchasing/quotation/SupplierQuotationSection.tsx`, `frontend/src/features/purchasing/SupplementalPurchasingWorkbench.tsx`
- **Verification:** Attempt 21 has A11Y-01 FAIL 0 across all measured Purchasing identities.
- **Committed in:** `a6599347`

**3. [Rule 3 - Build blocker] Replaced Node-only imports in a source-tree test**
- **Found during:** Overall production build
- **Issue:** Node built-in imports in a test under `frontend/src` were outside the production TypeScript type contract.
- **Fix:** Loaded immutable inputs through Vite raw imports and computed SHA-256 with Web Crypto.
- **Files modified:** `frontend/src/features/purchasing/pages/PurchasingPage.state.test.tsx`
- **Verification:** focused tests and production build (2,293 modules) pass.
- **Committed in:** `d423e068`

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3). Final scope is six files, entirely Purchasing plus its focused harness, below the authorized ten-file ceiling.

## Issues Encountered

- Attempt 17 is immutable failed history (`No tests found`) because the stale plan grep targeted labels not present in the current suite.
- Attempt 18 was the first full post-edit diagnostic and exposed the visibility-predicate defect; attempt 19 added selector attribution. Attempt 21 is the fresh passing authority for this plan.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 28-04 must reproduce exactly 1,258 residual keys from selected attempt 3 using sorted JSON objects containing `identity`, `ruleId`, `expected`, `actual`, `severity`, and `lowestOwner`.
- Residual SHA-256: `b8fa28d6f612c719912c89620a5729b83b0264be4fc8b57aadeb9c2ddc98fa6a`.
- The residual set excludes every `/purchasing` FAIL and all 47,208 NEEDS_EVIDENCE findings. It must not be recalculated from stale global totals.

## Self-Check: PASSED

- All six modified files exist.
- Commits `532e334a`, `a6599347`, `f8e38acd`, and `d423e068` exist.
- Focused tests 12/12, lint, production build, dependency-cruiser, architecture growth, route budgets, direct-Node headed Purchasing evidence, GET/HEAD gate, secret/stub scan, and diff hygiene passed.

---
*Phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre*
*Completed: 2026-08-24*
