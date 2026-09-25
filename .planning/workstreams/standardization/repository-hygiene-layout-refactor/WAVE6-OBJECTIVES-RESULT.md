# Wave 6 follow-up — three separated objectives

Date: 2026-09-24
Branch: `refactor/large-refactor-20260924`
Baseline HEAD: `44124e091783765e3c52411d28cc5ee78c192986`

## Objective 1 — architecture baseline reconciliation

Verdict: `PASS_CURRENT_BASELINE`.

Red loop:

```text
npm run check:architecture-growth
8 issues: 7 NEW_DEBT/WORSENED_DEBT rows plus the MaterialDemandService metric drift
```

Resolution:

- Reconciled `scripts/architecture-growth-baseline.json` to the exact nine current production findings.
- Debt remains visible: 2 `PLAN_REQUIRED`, 7 `WARNING`.
- No test debt is baselined.
- Comparator behavior is unchanged: new debt, increased metric/severity and stale baseline entries still fail.
- Base-ref comparison remains unchanged and will report the introducing baseline expansion in the change that carries this reconciliation; the workflow keeps that historical comparison advisory. Subsequent source growth still fails against the exact reconciled baseline.

Verification:

- architecture comparator regression tests: 6/6 PASS;
- current strict architecture gate: PASS, exact 9 findings / zero test debt.

## Objective 2 — Dashboard error-state regression

Verdict: `PASS_FOCUSED / PASS_CI_UNIT`.

Symptom:

DEFAULT Dashboard intermittently rendered an empty Suspense fallback instead of the workflow error alert and retry action. The focused red loop reproduced 3/6 failures, including missing `role=alert` and missing retry/filter controls.

Root cause:

`DashboardPage` added a second lazy boundary around `DefaultDashboardPage` even though the route itself is already lazy-loaded by `AppRouter`. Aggregate test scheduling could leave that nested dynamic import unresolved long enough for the null fallback to own the DOM.

Resolution:

- `DefaultDashboardPage` is imported synchronously inside the already lazy Dashboard route chunk.
- Only the alternate MATERIAL_RECONCILIATION dashboard remains dynamically imported.
- DEFAULT error, retry, ready and refresh state ownership is unchanged; no visual composition, permission, data or action contract changed.
- Updated the mode-composition contract to require the DEFAULT owner to be synchronous and the MRX owner to remain lazy.

Verification:

- red before fix: 3 FAIL / 3 PASS;
- focused Dashboard + MRX tests: 7/7 PASS;
- Dashboard + mode composition: 9/9 PASS;
- frontend production build: PASS;
- exact CI-shaped frontend suite: 277 files PASS, 1,608 tests PASS, 2 SKIP, 0 FAIL.
- One unrelated Admin Select interaction was flaky in the first aggregate rerun but passed isolated 3/3 and passed in the final aggregate run; no Admin production edit was made.

## Objective 3 — Phase 42 hermetic/evidence-owned suite separation

Verdict: `PASS_CLEAN_CANDIDATE / PASS_EVIDENCE_LANE`.

Root cause:

CI excluded the whole `Phase42AggregateVerificationTests` class because 15 cases consume ignored local archive/approval receipts. That also suppressed 50 source/config/runner contracts which are clean-checkout safe.

Resolution:

- Marked the five evidence-consuming methods with xUnit trait `Category=EvidenceOwned`; theories expand to 15 evidence-owned cases.
- Clean CI now filters `Category!=EvidenceOwned` instead of excluding the Phase 42 class.
- Added a hermetic contract asserting the workflow keeps this category separation and does not restore the whole-class exclusion.
- The local Phase 42 aggregate/evidence lane still runs all 65 cases when the required evidence exists.

Verification:

- clean detached candidate with no ignored `.artifacts/shipyard-live/phase-04.2-execution`: 50/50 hermetic Phase 42 tests PASS;
- evidence-bearing source worktree: 15/15 `EvidenceOwned` tests PASS;
- CI-shaped backend suite: Application 49/49 PASS; API 1,339/1,339 PASS with the hermetic Phase 42 contracts included.
- Temporary clean worktree was removed.

## Boundaries

- No commit or push.
- No database connection, migration application, seed, restore, operation-mode change or business mutation.
- No evidence bytes or evidence hashes were modified.
- Docker remains unavailable and outside these three objectives.
