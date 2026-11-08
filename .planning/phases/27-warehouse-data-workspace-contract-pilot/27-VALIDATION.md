---
phase: 27
slug: warehouse-data-workspace-contract-pilot
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-22
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for the Warehouse-only evidence-first UI contract pilot.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1 + Playwright 1.60/Google Chrome |
| **Config file** | `frontend/vite.config.ts`, `frontend/playwright.config.ts` |
| **Quick run command** | `npm run test:unit -w frontend -- --run tests/warehouseDataWorkspaceContract.test.ts --maxWorkers=1` |
| **Focused browser command** | `npm exec -w frontend playwright test tests/ui-audit.spec.ts --grep "Warehouse Data Workspace contract" --workers=1` |
| **Full phase suite** | `npm run test:fe:unit && NODE_OPTIONS=--max-old-space-size=4096 npm run test:ui-measurements -w frontend -- --workers=1 && npm run lint:fe && npm run depcruise:fe && npm run build:fe` |
| **Estimated feedback** | quick ≤30s; focused browser ≤5m; full phase suite ≤15m |

## Sampling Rate

- **After every task commit:** run the task's exact Vitest command; collector/rule tasks also run focused Warehouse Playwright.
- **After every plan wave:** run quick contract tests, the focused Warehouse browser gate and `git diff --check`.
- **Before phase verification:** run the ordered Plan 27-04 ladder and fresh AI reconciliation.
- **Max quick feedback latency:** 30 seconds target; browser evidence is an explicit slower gate, never substituted with screenshot inspection.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure behavior | Test type | Automated command/evidence | File exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|----------------------------|-------------|--------|
| 27-01-01 | 01 | 1 | UIC-01..04, WHP-01 | T-27-01..04 | Read-only complete tracer record; fail-closed schema | unit + browser | Contract unit + tracer grep | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | UIC-01, UIC-04/05, WHP-01 | T-27-03/04 | Exact bounded contract/fixture and closed AI schema | unit | Contract unit | ❌ W0 | ⬜ pending |
| 27-02-01 | 02 | 2 | UIC-02, WHP-02 | T-27-05/08 | Exactly 15 synthetic read-only records | unit + browser | Contract/state unit + baseline grep | ❌ W0 | ⬜ pending |
| 27-02-02 | 02 | 2 | UIC-03, WHP-02 | T-27-05/07 | Deterministic gate runs before AI and preserves baseline FAIL | unit + browser | Deterministic unit + baseline grep | ❌ W0 | ⬜ pending |
| 27-02-03 | 02 | 2 | UIC-04, WHP-02 | T-27-06..08 | Fresh read-only reviewer packet/run/output are attested and schema-valid | unit + artifact assertion | Contract unit + Node packet/output validator | ❌ W0 | ⬜ pending |
| 27-03-01 | 03 | 3 | UIC-01/03/05, WHP-02/03 | T-27-09..12 | Finding-authorized opt-in layout preserves shared defaults | unit + browser | Split/Movement unit + responsive grep | ❌ W0 | ⬜ pending |
| 27-03-02 | 03 | 3 | UIC-01/03/05, WHP-03 | T-27-11/12 | Only accepted semantic findings change production; behavior preserved | unit + static/build | Warehouse unit + lint/depcruise/build | ❌ W0 | ⬜ pending |
| 27-04-01 | 04 | 4 | UIC-01..03, WHP-04 | T-27-13 | Fresh identities and deterministic green before reviewer | build + unit + browser | Ordered fresh capture command | ❌ W0 | ⬜ pending |
| 27-04-02 | 04 | 4 | UIC-04, WHP-04 | T-27-14/15 | New blind reviewer and exact five-category packet are attested | unit + artifact assertion | Contract unit + Node packet/output validator | ❌ W0 | ⬜ pending |
| 27-04-03 | 04 | 4 | UIC-01..05, WHP-01..04 | T-27-13..16 | Full gates green; no automatic promotion or scope leak | browser + full frontend | Measurement/visual/unit/lint/depcruise/build/hygiene | existing + W0 artifacts | ⬜ pending |

## Wave 0 Requirements

- [ ] `frontend/tests/warehouseDataWorkspaceContract.ts` — literal Warehouse contract and closed schemas.
- [ ] `frontend/tests/warehouseDataWorkspaceFixture.ts` — versioned representative fixture and actors/states.
- [ ] `frontend/tests/warehouseEvidenceCollector.ts` — facts-only single-record collector.
- [ ] `frontend/tests/warehouseDeterministicRules.ts` — pure capture-to-findings evaluator.
- [ ] `frontend/tests/warehouseDataWorkspaceContract.test.ts` — schema, fixture, rule and reviewer-packet tests.
- [ ] Focused Warehouse describes in `frontend/tests/ui-audit.spec.ts`.
- [ ] Structural state/region tests for `WarehouseMovementPanel`.
- [ ] Compile probe for installed `ariaSnapshot({ mode: "ai", boxes: true })` API.

## Manual-Only Verifications

None. Screenshot inspection and AI review are not untracked manual checks: both must have versioned input/output manifests, run IDs and schema validation. Human review may supplement but cannot replace automated geometry/semantic verdicts.

## Ordered Phase Gate

1. Production build.
2. Contract/schema and structural state tests.
3. Accessibility/browser capture.
4. Screenshot artifact collection.
5. Responsive geometry and deterministic gate.
6. Attested fresh AI review/re-review.
7. Cross-route measurements and Warehouse visual evidence.
8. Full frontend unit, lint, dependency-cruiser, production build and hygiene.

Any `FAIL`, `GAP`, `STILL_FAILING`, `REGRESSED`, `NEEDS_EVIDENCE` or `UNRESOLVED` inside declared scope blocks closeout.

## Validation Sign-Off

- [x] All tasks have automated verification or explicit Wave 0 dependencies.
- [x] Sampling continuity: no task lacks an automated check.
- [x] Wave 0 covers every missing reference.
- [x] No watch-mode flags.
- [x] Reviewer execution is machine-attested rather than an unrecorded prompt/manual claim.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved for planning 2026-08-22; execution evidence pending
