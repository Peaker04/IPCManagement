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
- DEC-06 approves the next registry schema: `CoordinationOrderScopeLifecycle`, row grain
  `scenario × operation`, row-level `scope`, separate `entityState` and `projectionState`.

## Current Milestone: v1.3 UI Completeness & Conformance

**Goal:** Finish PA→PF and P5→P8 so completeness, canon convergence, geometry/accessibility and
`UI = f(state)` are continuously machine-verifiable.

**Target features:**

- Complete state/action registries and PC/PD disposition for all protected-route operational object families.
- Migrate every approved PB canon or record a narrowly evidenced semantic exception.
- Create a ten-rule harm-ranked conformance matrix, red-first DOM assertions and five-viewport fixes.
- Add same-state UI equivalence and hidden-state checks to the normal verification pipeline.
- Produce headed-browser evidence from the current source without mutating the preserved database lane.

## Active requirements

- [ ] Complete the state/action completeness oracle beyond WeeklyMenuLifecycle.
- [ ] Converge every approved PB concept and make the variant inventory executable.
- [ ] Establish binary UI conformance and source-addressable DOM evidence.
- [ ] Enforce state purity and same-state UI equivalence in CI/local verify.
- [ ] Close the milestone with reproducible tests, headed evidence and synchronized canonical docs.

## Out of Scope

- New Figma designs or an invented visual system — canon must come from the approved PB ballot and live code.
- Mobile/tablet parity — the current required matrix is the five desktop viewports in `MEMORY.md`.
- Adding an action without lower-layer, permission, state and placement evidence.
- Changing backend authorization policy merely to reconcile a frontend presentation mismatch.
- Resetting, seeding, importing or otherwise mutating `ipc_lane1` for verification.
- Editing project/process rule files such as `AGENTS.md`.

## Context

The addendum reverses the old priority: completeness (Class A) before consistency (Class B), then visual
conformance (Class C). Existing evidence proves only one lifecycle object and only three PE concepts.
`docs/PB-UI-VARIANT-AUDIT.md` still identifies live residuals in formatting, table boundaries,
buttons, form controls, validation and search ownership. `docs/UI-CONFORMANCE-MATRIX.md` and the PF hidden-
state gate do not yet exist.

The user explicitly authorized this task to brainstorm and select evidence-backed defaults when a
decision gate would otherwise block progress. Each such decision must be recorded with alternatives,
rationale and observable acceptance criteria.

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
| Replace user gates with recorded brainstorm decisions in this task | The user explicitly delegated those choices so progress must not stop on D-10/golden/PD-style gates | Active |
| Keep five desktop viewports only | `MEMORY.md` is authoritative; tablet/mobile were explicitly removed from the default gate | Active |

## Evolution

This document evolves at phase transitions and milestone boundaries. After each phase, validated
requirements move to completed evidence, new constraints are recorded, and active scope remains mapped to
the roadmap. After the milestone, review the core value, out-of-scope boundaries and evidence lineage.

---
*Last updated: 2026-07-31 after starting milestone v1.3 UI Completeness & Conformance*
