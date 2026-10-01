## Review — P1 follow-up

**Scope:** Re-review only the invalid-tier repair and its bounded evidence. Previous independent four-screen review remains the baseline. No writes, Git commands, test executions or browser launches performed.

### Fixed — P1 invalid schedule prices silently falling back

**Resolved:** `frontend/src/features/planning/cost/ReadPlanningPreviewPage.tsx:86–89`.

The current owner no longer discards zero, negative or nonfinite prices before validation. It collects every present schedule `menuPrice`, rejects nonfinite/unsupported values and multiple distinct tiers, then resolves the tier. With the required, non-null DTO price contract, only an empty schedule list permits contract/default fallback.

The resulting guard correctly:
- suppresses dish/cost analytical presentation;
- prevents projected material-summary creation;
- passes `bomBlocked` to the export guard;
- leaves the independently sourced physical handoff report readable.

Evidence: `.artifacts/four-planning-screens/p1-checks/p1-step.diff`, current owner lines 86–109, and supplied P1 intake preimages. The implementation is a surgical correction, not a new pricing model or production-owner refactor.

### Correct — regression and browser evidence

**Tests — retain (R):** `ReadPlanningPreviewPage.test.tsx:62–83` exercises the public rendered page for `[0]`, `[-25000]`, `[25000,0]`, `[25000,-1]`, `[NaN]` and `[Infinity]`. Assertions require the invalid-tier warning and absent cost selector; handoff still reads its report and explains disabled export. A separate positive control verifies genuine absent-schedule contract fallback to 30k, then fresh-week schedule pricing at 34k.

`p1-checks/red-valid.log` records six failures at the intended missing-warning assertion on the pre-fix owner. That is credible regression evidence; the earlier invalid table-shape attempt is not needed for acceptance.

The unit export-disabled assertion alone has a weak negative control because its fixture contains no projected materials. The affected browser evidence supplies the stronger boundary: natural BOM sources and physical rows remain available while invalid schedule DTO prices disable export and disclose the exact reason.

**Browser oracle:** `p1-browser-1790859307321/verify.mjs` intercepts the actual `/api/coordination/menu-schedules` GET, fetches the natural response and changes only each DTO’s `menuPrice`. It tests zero pricing and valid-plus-zero pricing—not a fabricated UI warning or unrelated denied source. Analytics have no table; handoff retains physical rows with disabled BOM export and visible invalid-tier explanation. The report records `PASS_SCOPED`, with empty failures/errors/blocked-writes arrays.

### Independent image review — 3/3 this follow-up

Individually opened:

- `p1-browser-1790859307321/dish-materials-invalid-tier.png`
- `p1-browser-1790859307321/cost-invalid-tier.png`
- `p1-browser-1790859307321/purchase-summary-invalid-tier.png`

Both analytical captures show explicit unavailable-tier warnings instead of calculated output. Handoff shows the disabled export, expanded explanation and readable physical quantities/provenance/counters. No visible clipping or overlap in these affected captures.

**Actual new denominator: 3/3.** Prior **16/16** independently reviewed captures remain retained acceptance evidence, not reopened or counted as freshly reviewed. Across the two review stages: **19 distinct captures opened**.

### Ownership and checks

`p1-step.diff` confines this follow-up’s product delta to the price guard and page regressions. `ownership.json` and `batch-intake-relative.diff` preserve the approved batch’s absent-file baselines and original router/shell/purchasing-hook preimages. The supplied bounded delta introduces no API definition, backend, production-route element, MainLayout, capability or operation-mode change.

`p1-checks/green.log` records **3 files / 15 tests PASS**. `commands.json` records exit code **0** for focused tests, TypeScript, scoped ESLint and preview build. These are executor receipts, **not reviewer reruns**.

The natural CSV browser action now reads the actual downloaded bytes and checks customer `ANV` and week `2026-09-21`; this improves the previous filename-only oracle. It still does **not** independently compare all projected quantities or full CSV contents.

### Findings and residual boundaries

**No issues found.** The previous P1 is resolved.

Prior scoped approvals remain:
- **Dish materials:** effective per-serving gross BOM/reference-cost read.
- **Cost:** existing projected cost model, truthful missing-BOM handling.
- **Production plan:** persisted ID/version/lifecycle and dish quantities, read-only/no Send.
- **Handoff:** physical server grain/counters/search/paging, guarded metadata-only pending navigation, separately identified projected BOM export.

Broader readiness remains **NEEDS_EVIDENCE**: real actor enforcement, durable lifecycle, full keyboard/native-zoom/state/race coverage, complete projected CSV comparison, legacy purchasing browser acceptance and production/field performance. The previously noted production-owner argument-change race remains unproven; this fix does not certify or reopen it. Prior raw FAIL reports remain immutable.

**Limits:** supplied artifacts/source reviewed read-only; no independent live runtime, Git/index/hash or exhaustive working-tree attestation. Inherited dirt is not attributed to this repair.

**Scoped merge verdict: OK with notes — PASS_SCOPED for the approved four DEFAULT read-only sandbox candidates, including the resolved invalid-tier guard.** Evidence is under `.artifacts/four-planning-screens/{p1-intake-1790859079061,p1-checks,p1-browser-1790859307321}` plus the retained original final browser/interactions receipts.

**PAGE_READY not certified. No production cutover or remaining Demand-gate closure implied.**