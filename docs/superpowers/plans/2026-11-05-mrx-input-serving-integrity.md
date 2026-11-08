# MRX input-serving integrity implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task, native/direct-parent only. No delegation, worktree or commits. WORK is the sole live task-state owner; checkboxes below specify work, not another execution ledger.

**Goal:** Make the existing G6 reject wrong, duplicated or misplaced input servings before downstream correctness can mask them.

**Architecture:** Keep the authored coverage manifest authoritative; add a test-side raw-row comparator consumed by G6. Reuse existing workflow stages, request observation, independent material oracle and evidence artifacts; add one optional fixture checkpoint immediately after accepted source reload and before quantity preview.

**Tech Stack:** Installed TypeScript/Vitest/Playwright and existing MySQL verifier. No installs or schema changes.

**Spec:** `docs/superpowers/specs/2026-11-05-mrx-input-serving-integrity-design.md` (owner-approved short design).

## Global Constraints

- Native only; preserve inherited dirty tree and empty staging. No production repair, G5 policy change, stage/commit/push/deploy, migration, synthetic master provisioning or user-service replacement.
- DEFAULT != MATERIAL_RECONCILIATION. Main DB remains untouched; raw DB queries during future runtime use the existing guarded clone verifier only.
- Existing one-shot campaign permission is consumed. This plan does not authorize a new Preflight/Execute, browser login, clone creation or business mutations.
- No skip, DISTINCT/first-row duplicate hiding, expected-value derivation from actual responses, weakened assertions, timeout increases or new production test seams.
- Workbook menu facts and UI-entered servings are separate input sources. Existing BOM, stock, concurrency, version, history and export assertions remain.

## Review Focus

1. Correct totals can hide duplicate/missing schedule lines: Task1 compares raw cardinality and exact expected keys.
2. Same total can hide swapped Mặn/Chay or offsetting date errors: Task1 negative controls and Task2 per-cell checkpoints.
3. Historical versions can look like duplicate active inputs: Task2 binds each accepted version and verifies predecessors separately.
4. A post-transfer check is too late: Task2 inserts the checkpoint before quantity preview/commit/freeze/transfer.
5. Dish/merge members must not multiply people: Task2 requires schedule-linked counts, unchanged servings on dish-only revisions and existing BOM distinct-dish semantics.

## Task 1 — Authoritative raw input gate

**Files:** extend `frontend/tests/e2e-mrx/fixtures/menuCoverage.ts` and its existing `__tests__/menuCoverage.test.ts`. Existing G6 is the production-of-evidence caller; no application exports.

**Interfaces:** reuse `CoverageServings`. Add a test-side `assertServingInputs(expected: CoverageServings[], actual: ServingInputFact[]): void`, where each actual fact contains date, shift, scheduleId, quantityPlanLineId, savory, vegetarian and final. Nulls remain null; no coercion to zero. G6 supplies only rows from the independently pinned customer/version and separately checks exact schedule-set membership before calling it. A valid fact set has one current schedule per authored date/shift and exactly one quantity line for each schedule; if domain inspection establishes a different legitimate schedule multiplicity, stop and revise the design rather than silently relaxing uniqueness.

- [ ] Load test-audit/ipc-test-audit and inspect current entities, active-version selection and raw import schedule cardinality; trace all current coverage-helper consumers. Confirm BR-MRX-SERV-1/2 and expected schedule multiplicity before implementing SQL.
- [ ] Add one parameterized behavioral owner case with hand-authored rows: valid101/17,total118; duplicate identical row; missing row; split102/16 with the same118total; and two date errors101→102/203→202 that preserve the grand total. Expect only the valid snapshot to pass. These are in-memory gate controls, not seeded business facts.
- [ ] Run `cd frontend && npx --no-install vitest run tests/e2e-mrx/fixtures/__tests__/menuCoverage.test.ts`. Observe intended missing-gate or missed-mismatch RED, not dependency/config failure.
- [ ] Implement the smallest comparator with exact key/value/cardinality checks and useful mismatch messages. Do not sanitize or deduplicate actual rows. Extend the valid case to a legitimate repeated dish/slot scenario only through the existing source/material owner, not by multiplying input facts.
- [ ] Rerun the focused command to GREEN. Helper GREEN proves detection capability, not runtime input correctness.

## Task 2 — Bind real G6 input checkpoints before downstream work

**Files:** `frontend/tests/e2e-mrx/fixtures/mrxWorkflow.ts`, its existing `__tests__/mrxWorkflow.test.ts` where behavior can be tested meaningfully, and `frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts`.

**Interfaces:** add optional `sourceAccepted?: (coordinator: Page, scope: MrxScenarioScope) => Promise<void>` to the existing pages options. Invoke once after successful Admin decision and coordinator reload, immediately before `source-check-quantity`. An exception stops setup; callers without it are unchanged. G6 supplies the callback and reuses its input-check function after revisions. No duplicate workflow or global callback registry.

- [ ] Read all `createTransferredBatch` callers and actual amendment submit/decision/apply DTOs. Observe real source-command requests through G6 listeners; assert authored date/shift/split values and exact affected identities, including all fields that encode user input, not merely log payloads. Register before action and remove listeners in finally.
- [ ] Capture accepted amendment/version identity from actual command/readback, verifying it belongs to the authored customer/week and expected predecessor. Do not use unrestricted latest-version selection as the oracle. Use raw menuschedules + mealquantityplanlines joined to plans for date and version linkage, with an outer join so missing lines remain observable. Select identifiers and split/final fields; no DISTINCT, SUM or first-match LIMIT hiding duplicates.
- [ ] Derive expected date/shift schedule membership from authored source and the confirmed domain cardinality, then verify both directions: every expected schedule exists, no unexpected schedule exists, exactly one current quantity line references each. Run Task1 gate against the authored serving table at sourceAccepted, before the first downstream quantity request. Missing/null/inconsistent fields fail.
- [ ] On that loaded coordinator editor, assert each visible Mặn/Chay input after reload equals its authored value. Validate complete edit-scope DTO date/shift cardinality and values too; do not infer a passing negative assertion from an unloaded page.
- [ ] After every existing apply/reload, update expected values only from the declared edit action, never from the response. Run raw input and DTO/DOM checks before `assertMaterials`. Dish-only edits retain all servings; existing increase/decrease revisions replace only the target cell. Check unchanged scope and raw predecessor snapshots; historical version rows are not extra current people.
- [ ] Repeat a read/reload without a write and compare raw identities/counts/values. Do not replay mrx-apply with invented idempotency expectations or add extra mutation revisions merely for coverage.
- [ ] Extend existing revision/readback evidence with per-checkpoint accepted version, authored serving table and raw observed keys/counts/values. Do not publish credentials or unrelated business rows. Keep new runtime coverage explicitly NOT_RUN until actually executed.
- [ ] Run `cd frontend && npx --no-install vitest run tests/e2e-mrx/fixtures/__tests__/menuCoverage.test.ts tests/e2e-mrx/fixtures/__tests__/mrxWorkflow.test.ts`; run installed ESLint on touched TS and strict harness TypeScript using the established installed-root compiler invocation. Load ipc-code-review and review real baseline callers, listener cleanup, duplicate visibility and fail-before-preview ordering. Do not claim a static hook-order check is E2E proof.
- [ ] Update WORK with exact local results and remaining runtime limits. A demonstrated production defect requires a separate bounded owner repair with intended RED→GREEN, not an altered expected table.

## Runtime handoff and acceptance

Implementation approval covers local harness edits/checks only unless the owner explicitly grants fresh runtime scope. Before any future run, agree the fresh disposable target/actors/mutations/cleanup and selected cases, preserve the unresolved Chrome resource blocker and unchanged budgets, and freeze the candidate. Do not reuse historical clones/profiles/credentials or automatically rerun the full campaign.

Actual acceptance requires new sourceAccepted and revision checkpoint artifacts, independent input/request/raw-row/readback equality, no duplicate active input, unchanged controls/predecessors, and the retained downstream assertions. Historical 20 revisions do not satisfy new checks. Whole export/performance/G5 acceptance remains outside this addition.

## Native self-review

Design clauses map to Task1 raw comparator/negative controls and Task2 request→pre-preview→revision/readback lineage. Review Focus1/2 are explicit control cases;3/4/5 are explicit integration checkpoints. Callback/comparator interfaces have real G6 callers; no application seam or additional runner. Runtime not admitted, business repair not pre-authorized. Submit this plan for owner review before implementation.
