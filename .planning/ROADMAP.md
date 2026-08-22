# Roadmap: v1.4 Evidence-first UI Contract Migration

## Phase overview

- [ ] **Phase 27: Warehouse Data Workspace contract pilot** — implementation and Warehouse-only verification are green, but final approval is blocked by Phase 27.1 reconciliation of 21 non-Warehouse visual failures.
- [ ] **Phase 27.1: Non-Warehouse visual reconciliation** — explain and resolve all 21 broad visual failures before Phase 27 may close.

Admin Data is the mandatory validation gate after Phase 27, but is not authorized for implementation yet. Purchasing remains research-locked until Admin Data validation is complete.

## Phase 27: Warehouse Data Workspace contract pilot

**Status:** BLOCKED — 4/4 implementation plans complete; final approval withdrawn pending Phase 27.1

**Goal:** Prove that IPCManagement can express, collect, evaluate and remediate a Data Workspace UI contract without introducing a broad UI framework or changing business behavior.

**Requirements:** UIC-01, UIC-02, UIC-03, UIC-04, UIC-05, WHP-01, WHP-02, WHP-03, WHP-04

### Required sequence

1. Inventory Warehouse work object, state, actor, permission, current component ownership and five current desktop viewports.
2. Declare the smallest Warehouse Data Workspace contract needed to test semantic/IA, layout/responsive, component ownership and interaction/accessibility rules.
3. Extend the current Playwright measurement harness to collect screenshot, `ariaSnapshot({ mode: "ai", boxes: true })`, geometry, approved computed styles, viewport and console evidence.
4. Run deterministic rules before AI review. Findings without a reproducible oracle remain `NEEDS_EVIDENCE` or `UNRESOLVED` and cannot authorize production edits.
5. Run read-only AI review only for hierarchy, grouping, balance and information architecture; reject findings that fail the finding schema.
6. Refactor one Warehouse vertical slice at the lowest demonstrated owner.
7. Verify build → structural contract → accessibility → screenshot evidence → responsive contract → AI review, then compare fresh before/after evidence.

### Success criteria

1. Warehouse has one explicit Data Workspace contract and a reproducible evidence manifest for every selected state/actor/viewport.
2. Deterministic rules identify machine-decidable failures before AI and produce selector/box/metric-backed findings.
3. Every accepted AI finding includes evidence, expected, actual, severity and component owner.
4. No production change is justified by screenshot appearance alone.
5. No new component stack, generic page renderer, archetype DSL or speculative framework is introduced.
6. Existing shadcn/Base UI foundation, route/API/cache/permission behavior and database semantics remain unchanged.
7. The phase ends with a bounded contract package suitable for validation on Admin Data, not automatic project-wide rollout.

### Stop conditions

- Stop implementation if Warehouse requires an undeclared Workflow archetype contract.
- Stop promotion if a proposed shared abstraction has only one route consumer.
- Stop closeout on any `FAIL`, `GAP`, `NEEDS_EVIDENCE` or `UNRESOLVED` item inside declared pilot scope.
- Do not update snapshots, baselines or thresholds to convert a failure into PASS.
- Phase 27 cannot close while Phase 27.1 contains any unexplained or unresolved broad visual failure.

## Locked follow-on order

1. **Admin Data validation — LOCKED:** may begin only after Phase 27 verification and explicit promotion decision. Its purpose is to falsify Warehouse-specific assumptions.
2. **Purchasing adoption — RESEARCH LOCKED:** may begin only after Admin Data validation and closure of the open Data Workspace/Workflow-boundary question in `.planning/research/questions.md`.

No production implementation outside Warehouse is authorized by this roadmap revision.

## Phase 27.1: Non-Warehouse visual reconciliation

**Status:** PLANNED — executed immutable Plan 01, protocol-invalid historical Plan 01C, authoritative reseal Plan 01R, additive focused-launcher Plan 01F, topology-validator correction Plan 01V, then Plans 02–07 across 11 serialized waves

**Goal:** Explain, classify and resolve all 21 non-Warehouse failures in `frontend/tests/visual-routes.spec.ts` without laundering production regressions, weakening the visual oracle or broad-updating baselines.

**Requirements:** VREC-01, VREC-02, VREC-03, VREC-04

**Depends on:** Phase 27 implementation and evidence through Plan 27-04; this phase gates Phase 27 final approval rather than Admin Data promotion.

### Success criteria

1. Every one of the 21 failures has expected/actual/diff, deterministic route/state/viewport identity and an owner-level disposition.
2. Production defects are fixed at the lowest demonstrated owner; stale baselines are updated only after semantic/DOM/geometry evidence proves current behavior is intended.
3. No screenshot threshold, viewport, assertion, route fixture or comparison logic is weakened to manufacture PASS.
4. The complete unchanged broad visual suite passes twice consecutively, followed by full frontend unit, lint, dependency-cruiser, production build and hygiene gates.
5. Phase 27 final verification is rerun only after Phase 27.1 closes with zero unresolved item.

**Plans:** 11 plans

Plans:

- [x] 27.1-01-PLAN.md — Immutable original source root and deterministic inventory of all 21 failures (wave 1).
- [x] 27.1-01C-PLAN.md — Immutable historical correction provenance, explicitly `SUPERSEDED_PROTOCOL_INVALID` and non-authoritative (wave 2).
- [x] 27.1-01R-PLAN.md — Additive authoritative reseal with seven byte/blob pins and exact adjacent payload/marker commits (wave 3; depends on 01C).
- [x] 27.1-01F-PLAN.md — Additive executable focused-only browser adapter with child-launch trace and sealed direct-CLI/config bytes (wave 4; depends on 01R).
- [ ] 27.1-01V-PLAN.md — Freeze immutable operational base `06f920e0` plus dynamic clean planningHead and exact planning-only delta/hash; seal direct planningHead→payload→marker lineage for downstream historical attestation (wave 5; depends on 01F).
- [ ] 27.1-02-PLAN.md — Resolve Chef/Purchasing readiness using 01V topology-validator and 01F focused authority (wave 6; depends on 01V).
- [ ] 27.1-03-PLAN.md — Reconcile Login and Dashboard with immutable row/class scopes (wave 7).
- [ ] 27.1-04-PLAN.md — Reconcile Meal Orders and Weekly Menu, then aggregate seven core rows (wave 8).
- [ ] 27.1-05-PLAN.md — Reconcile Reports, Approvals and locked Admin Data baselines (wave 9).
- [ ] 27.1-06-PLAN.md — Reconcile four Purchasing Phase-09 baselines under the research lock (wave 10).
- [ ] 27.1-07-PLAN.md — Two original-harness broad visual passes, fresh Phase 27 review, full gates and WHP-04 closeout (wave 11).
