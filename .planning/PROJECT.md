# IPCManagement UI completeness and conformance

## What This Is

IPCManagement is the operational web workbench for industrial-kitchen planning, coordination,
purchasing, warehouse, production, approvals, reports and administration. Milestone v1.3 completes the
UI/UX program defined by `.docs/UI-UX-ADDENDUM-KHONG-CO-FIGMA.md`: derive expected UI from state,
converge the hidden design system already present in code, and enforce binary conformance without Figma.

## Core Value

Every permitted operational action is reachable, every prohibited action is explained or absent, and the
same declared business state produces an equivalent, predictable UI.

## Validated foundation

- Milestone v1.2 completed query-state algebra, frontend ownership, architecture boundaries, regression
  gates and browser evidence through Phases 11–18.
- PA-2B/PC proves the WeeklyMenuLifecycle registry and read-only browser fixture on five desktop viewports.
- PB approved all eighteen UI concepts; Button uses ballot 8B and form controls use ballot 9B.
- EmptyState, ConfirmDialog and contextual Feedback have completed initial PE slices.
- Phase 19 implements the DEC-06 `CoordinationOrderScopeLifecycle` registry with `scenario × operation`,
  row-level `scope`, separate `entityState`/`projectionState`, cross-family inventory and drift-guarded debt.
- Phase 20 measures all six executable families on five desktop viewports, dispositions every unresolved
  identity, and closes ORCL-04/05 without opening a production PD action. Phase 21 completes all eighteen
  approved PB concepts with live-source gates and exact semantic exceptions.

## Current Milestone: v1.3 UI Completeness & Conformance

**Goal:** Finish the remaining addendum blocks directly: PE, then P5, P6, P7, and P8 together with PF.

**Target features:**

- Complete state/action registries and PC/PD disposition for all protected-route operational object families.
- Finish every approved PB canon or record a narrowly evidenced contextual exception in PE.
- Build P5 only from approved PB/addendum rules, prove P6 red assertions, and apply only the corresponding P7 fixes.
- Put the approved P8 checks and PF same-state/hidden-state oracle into the normal verification pipeline.
- Preserve current-source browser and database/evidence constraints already established by the project.

## Validated in Phase 21

- [x] PE: all approved PB concepts converge without changing business/auth/API behavior or adding a new variant.

## Validated in Phase 22

- [x] P5: the 20-row standard matrix contains exactly 18 approved PB rules and two PF/O3 rules; unsourced dimensions remain `UNRESOLVED`.

## Active requirements

- [ ] P6 → P7: prove each selected failure red, then fix only that evidenced failure and rerun PC.
- [ ] P8 + PF: lock the approved assertions and state-purity checks into verification and close the addendum.

## Out of Scope

- New Figma designs or an invented visual system — canon must come from the approved PB ballot and live code.
- Mobile/tablet parity — the current required matrix is the five desktop viewports in `MEMORY.md`.
- Adding an action without lower-layer, permission, state and placement evidence.
- Changing backend authorization policy merely to reconcile a frontend presentation mismatch.
- Resetting, seeding, importing or otherwise mutating `ipc_lane1` for verification.
- Editing project/process rule files such as `AGENTS.md`.

## Context

The addendum reverses the old priority: completeness (Class A) before consistency (Class B), then visual
conformance (Class C). Phases 19–20 now prove the source-level registry, rendered-control aggregate, and
evidenced no-PD disposition. Phase 21 is exactly PE; Phases 22–25 map directly to P5, P6, P7 and P8+PF.
Phase 21 completes PE: Date is 31→0, Button 8B is 77→0, Form 9B is 39/26/4→0, quantity is 26→0 and
currency is 12→0, with exact semantic exceptions protected by current-source tests. Phase 22 materialized
`docs/UI-CONFORMANCE-MATRIX.md`; Phase 23 now selects only failures that still exist after PE. The PF hidden-state
gate does not yet exist.

Brainstorming may select an evidence-backed option inside one of these named blocks, but it may not create
another phase, quota, golden-screen set, DOM-instrumentation program or acceptance criterion without an
addendum/PB source or explicit user approval.

## Non-negotiable constraints

- Preserve public API, route, cache and business behavior unless an evidenced PD finding explicitly requires change.
- Run GitNexus impact upstream/downstream before production symbol edits and final `detect_changes` before commits.
- Use the approved SAP Fiori compact patterns and existing shared components; no speculative abstraction.
- Keep history/evidence lineage and unrelated user changes intact; no push or destructive Git operation.
- Browser completion requires current-source headed Chrome evidence, not backend/API-only success.

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Continue phase numbering at 19 | v1.2 already owns Phases 11–18 and their artifacts remain historical evidence | Active |
| Skip external ecosystem research | This milestone converges approved in-repo canon; external research risks creating another variant | Active |
| Use v1.3 | The work is a substantial quality/capability milestone without changing the product's primary domain | Active |
| Map Phase 21–25 directly to PE, P5, P6, P7 and P8+PF | Prevent GSD decomposition from becoming new product/design scope | Active |
| Bound brainstorm decisions to an authorized block | Missing details stay unresolved unless addendum/PB evidence or explicit user approval supplies them | Active |
| Keep five desktop viewports only | `MEMORY.md` is authoritative; tablet/mobile were explicitly removed from the default gate | Active |

## Evolution

This document evolves at phase transitions and milestone boundaries. After each phase, validated
requirements move to completed evidence, new constraints are recorded, and active scope remains mapped to
the roadmap. After the milestone, review the core value, out-of-scope boundaries and evidence lineage.

---
*Last updated: 2026-08-02 after Phase 22 P5 matrix verification*
