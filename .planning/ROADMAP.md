# Roadmap: v1.4 Evidence-first UI Contract Migration

## Phase overview

- [x] **Phase 27: Warehouse Data Workspace contract pilot** — prove the contract architecture with the smallest useful collector, deterministic rules and evidence-backed Warehouse vertical slice.

Admin Data is the mandatory validation gate after Phase 27, but is not authorized for implementation yet. Purchasing remains research-locked until Admin Data validation is complete.

## Phase 27: Warehouse Data Workspace contract pilot

**Status:** COMPLETE — verified 2026-08-22 (4/4 plans)

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

## Locked follow-on order

1. **Admin Data validation — LOCKED:** may begin only after Phase 27 verification and explicit promotion decision. Its purpose is to falsify Warehouse-specific assumptions.
2. **Purchasing adoption — RESEARCH LOCKED:** may begin only after Admin Data validation and closure of the open Data Workspace/Workflow-boundary question in `.planning/research/questions.md`.

No production implementation outside Warehouse is authorized by this roadmap revision.
