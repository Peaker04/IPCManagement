# Phase 28: Project-wide UI/UX contract rollout and single-warehouse presentation — Specification

**Created:** 2026-08-23
**Ambiguity score:** 0.06 (gate: ≤ 0.20)
**Requirements:** 9 locked

## Goal

Measure every application route against one evidence-backed UI/UX contract, remediate only proven findings through shared owners, then enforce one active operational warehouse without rewriting historical warehouse identity.

## Background

Phase 27 proved the evidence workflow on Warehouse but did not refactor the whole product. The current harness covers only a subset of deterministic concerns and visual coverage omits protected routes/states. Source inventory identifies shared seams in `MainLayout`, `OperationalFrame`, `SectionPanel`, `TableViewport`, typography roles and stylesheet layers. The application also exposes multi-warehouse choices although the business operates one warehouse; warehouse identity is embedded in stock and audit grain and cannot be destructively merged in this phase.

## Requirements

1. **Whole-route inventory (PUX-01):** Every public/protected route and selected operational state has a work object, actor, viewport, hierarchy, region and lowest-owner record.
   - Current: Route ownership exists, but state/region/visual coverage is incomplete.
   - Target: One exact inventory covers every route without duplicate identity.
   - Acceptance: A validator fails for any routed page, selected state or viewport absent from the inventory.

2. **Single measurement harness (PUX-02):** Extend the existing Phase 27 Playwright/DOM evidence path with explicit local expected values.
   - Current: Overflow, clipping, dialog naming and selected geometry are measured; hierarchy/type/spacing/container/table contracts are incomplete.
   - Target: Deterministic rules cover machine-decidable semantics and geometry before AI review.
   - Acceptance: Known-bad fixtures fail each rule and known-clean fixtures pass; no second audit framework exists.

3. **Tokenized hierarchy (PUX-03):** Typography and spacing use existing semantic roles and a finite local 4/8-derived token scale.
   - Current: Shared roles exist alongside route-local CSS and redesign layers.
   - Target: Baseline identifies every unsupported literal/recipe and fixes are made at the lowest shared owner.
   - Acceptance: Source-aware checks and computed-style evidence report zero undispositioned production violation.

4. **Purposeful containers (PUX-04):** Every card/data container has one coherent purpose, accessible name and deliberate nesting.
   - Current: `SectionPanel` is canonical but low-level cards/local wrappers remain.
   - Target: Decorative/nested/redundant containers are identified; approved exceptions name their owner and rationale.
   - Acceptance: DOM evidence and review contain no unresolved unnamed, purposeless or accidental nested container.

5. **Operational tables (PUX-04):** Every table has native semantics, label/caption, type-correct alignment, bounded overflow, deliberate column priority and loading/empty/error/stale contracts.
   - Current: `TableViewport` provides geometry but route implementations vary.
   - Target: Exact table-owner inventory and deterministic checks cover all table states.
   - Acceptance: Source/DOM checks and headed states pass for every registered table owner.

6. **Three-wave remediation (PUX-05):** Findings are grouped by root cause into foundation/tokens, shared seams, and route rollout.
   - Current: No whole-web baseline or root-cause disposition exists.
   - Target: Production edits occur only after baseline finding authorization.
   - Acceptance: Every changed production path traces to an exact finding and lowest owner; no screenshot-only edit exists.

7. **Full verification (PUX-06):** Complete static, unit, browser, visual and fresh-review gates pass without weakened oracles.
   - Current: Phase 27 gates are Warehouse-centered.
   - Target: Whole-web coverage includes all declared routes/states/viewports.
   - Acceptance: Ordered gate evidence is green twice where repeatability is required and unresolved count is zero.

8. **Single active warehouse (SWH-01..03):** After UI remediation, backend resolves exactly one active operational warehouse; routine UI contains no false warehouse choice.
   - Current: APIs and UI accept/select arbitrary warehouses and no singleton invariant exists.
   - Target: Zero/multiple active warehouses fail closed; one active warehouse is passive context; historical IDs remain intact.
   - Acceptance: Relational and API tests prove zero/one/multiple behavior, legacy mismatches are rejected, and no selector appears for the one-active case.

9. **Deferred destructive consolidation:** Physical deletion, ID reassignment, balance merging and historical migration removal are research-only after Phase 28.
   - Current: Live database cardinality/collisions are unknown.
   - Target: Phase 28 preserves all historical rows/FKs and records a separate preflight/remediation research requirement.
   - Acceptance: Phase 28 diff contains no historical-ID rewrite, stock merge, warehouse deletion or old-migration edit.

## Boundaries

**In scope:**
- SPEC, CONTEXT and UI-SPEC for all-route UI/UX.
- Existing-harness extension and read-only whole-web baseline before production edits.
- Evidence-backed UI/UX fixes in at most three waves.
- Additive one-active-warehouse invariant after UI closeout; old warehouses may become retired/inactive.
- Compatibility behavior that retains warehouse IDs and server authorization.

**Out of scope:**
- Deleting or rewriting historical warehouse IDs — requires separate audited data remediation.
- Summing or merging stock between warehouses — violates current grain without operator dispositions.
- Editing/removing old migrations — deployed history must remain immutable.
- Replacing shadcn/Base UI with Fiori/Carbon — references only.
- Business workflow, permission, cache or public API redesign unrelated to the proven findings.

## Constraints

- Production UI remains unchanged until SPEC/UI-SPEC and read-only baseline are sealed.
- Screenshot is reviewer evidence, never the sole oracle.
- Deterministic rules require explicit expected values and known-bad/known-clean proof.
- Preserve active-first + visited tab state, one RTK Query API slice, route budgets and existing visual thresholds.
- Single-warehouse work is additive/fail-closed; database consolidation is deferred.

## Acceptance Criteria

- [ ] All routes/states/viewports and UI owners are inventoried exactly once.
- [ ] SPEC and checker-approved UI-SPEC are committed before harness or production edits.
- [ ] Extended harness proves each new rule against bad and clean fixtures.
- [ ] Read-only baseline is complete with `PASS/FAIL/NEEDS_EVIDENCE/NOT_APPLICABLE` and no guessed PASS.
- [ ] Every production UI edit traces to a baseline finding and lowest owner.
- [ ] Full unit/lint/dependency/build/architecture and headed browser gates pass.
- [ ] Fresh independent review has zero unresolved finding.
- [ ] Exactly one active operational warehouse is enforced only after UI rollout.
- [ ] No historical warehouse ID, stock balance, audit event or old migration is deleted/rewritten.

## Edge Coverage

**Coverage:** 8/8 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|---|---|---|---|
| Empty inventory | R1 | ✅ covered | Validator rejects missing route/state/viewport. |
| False positive | R2 | ✅ covered | Bad and clean fixtures required for every rule. |
| 200% zoom/320px | R3–R5 | 🧪 backstop | Headed reflow/text-zoom coverage required. |
| Async state | R5 | ✅ covered | Loading/empty/error/stale are explicit. |
| Unsupported exception | R3–R5 | ✅ covered | Owner+rationale disposition required. |
| Zero warehouse | R8 | ✅ covered | Fail-closed relational/API test. |
| Multiple active warehouses | R8 | ✅ covered | Fail-closed; no implicit first row. |
| Historical collisions | R9 | ✅ covered | No rewrite/merge in this phase. |

## Prohibitions (must-NOT)

**Coverage:** 6/6 applicable prohibitions resolved · 0 unresolved

| Prohibition | Requirement | Status | Verification |
|---|---|---|---|
| MUST NOT authorize a UI edit from screenshot appearance alone. | R2/R6 | resolved | test + judgment |
| MUST NOT create a second audit framework or UI stack. | R2 | resolved | source contract test |
| MUST NOT weaken thresholds/baselines to manufacture PASS. | R7 | resolved | diff review + tests |
| MUST NOT choose the canonical warehouse by `First`, sort order or activity. | R8 | resolved | negative tests |
| MUST NOT merge stock or rewrite historical warehouse IDs. | R9 | resolved | migration/diff gate |
| MUST NOT edit old migration files. | R9 | resolved | changed-path gate |

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.96 | 0.75 | ✓ | Sequence and outcomes explicit. |
| Boundary Clarity | 0.98 | 0.70 | ✓ | Destructive consolidation deferred. |
| Constraint Clarity | 0.94 | 0.65 | ✓ | Existing architecture/oracles preserved. |
| Acceptance Criteria | 0.90 | 0.70 | ✓ | Nine pass/fail criteria. |
| **Ambiguity** | **0.06** | ≤0.20 | ✓ | Auto-derived from explicit user decisions and source research. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|---|---|---|---|
| 1 | Researcher | Is Phase 27 the endpoint? | No; it is the foundation for whole-web rollout. |
| 2 | Simplifier | What comes first? | Contract and read-only baseline before production UI edits. |
| 3 | Boundary Keeper | How is one warehouse handled? | One active warehouse safely; destructive consolidation deferred. |
| 4 | Failure Analyst | What must never happen? | No silent merge, history rewrite, guessed PASS or weakened oracle. |

---

*Phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre*
*Spec created: 2026-08-23*
*Next step: UI-SPEC and harness baseline contract*
