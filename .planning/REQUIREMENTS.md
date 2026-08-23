# Requirements: v1.4 Evidence-first UI Contract Migration

**Defined:** 2026-08-22
**Status:** ACTIVE
**Core value:** UI conformance is decided by explicit design contracts and reproducible evidence; Playwright collects evidence and AI reviews only the non-deterministic design concerns.

## Contract architecture

- [x] **UIC-01:** Every route selected for migration has one declared page archetype, work object, grain, required semantic regions, component owners and responsive invariants.
- [x] **UIC-02:** The evidence collector records the same route/state/actor/viewport with screenshot, AI-mode ARIA snapshot with boxes, geometry, approved computed styles and console errors; trace/network evidence is added when the finding requires it.
- [x] **UIC-03:** Deterministic rules run before AI and fail on machine-decidable semantic, layout, component-region, responsive and accessibility violations.
- [x] **UIC-04:** Every AI finding is schema-valid and includes evidence, expected, actual, severity, component owner, confidence and a non-PASS verdict; qualitative taste without those fields is rejected.
- [x] **UIC-05:** The implementation foundation remains shadcn/Base UI. SAP Fiori and Carbon patterns may be adopted only after conversion to IPCManagement tokens, existing-owner component contracts, page archetypes or Playwright rules.

## Warehouse Data Workspace pilot

- [x] **WHP-01:** Warehouse has a minimal Data Workspace contract derived from its current route, states, actors and owners; the pilot introduces no generic page renderer, UI DSL or speculative framework.
- [x] **WHP-02:** Warehouse baseline evidence is captured before production refactoring and every authorized change traces to a deterministic or schema-valid AI finding.
- [x] **WHP-03:** Warehouse refactoring preserves business behavior, API/cache contracts, permissions and current visual identity unless a finding proves that a shared visual rule must change.
- [x] **WHP-04:** The pilot closes with build → structural contract → accessibility → screenshot evidence → responsive contract → AI review, followed by fresh before/after reconciliation and zero unresolved broad visual failure from Phase 27.1.

## Non-Warehouse visual reconciliation

- [x] **VREC-01:** All 21 non-Warehouse failures have reproducible route/state/viewport identities, expected/actual/diff evidence and owner-level dispositions.
- [x] **VREC-02:** Every production regression is fixed at its lowest demonstrated owner; baseline changes require semantic/DOM/geometry proof and never rely on screenshots alone.
- [x] **VREC-03:** Visual thresholds, viewport matrices, assertions, route fixtures and comparison logic remain unchanged unless a separately proven harness defect requires a stricter deterministic replacement.
- [x] **VREC-04:** The complete broad visual suite passes twice consecutively before full frontend unit, lint, dependency-cruiser, production build and hygiene gates run green.

## Project-wide UI/UX rollout

- [ ] **PUX-01:** Every public/protected route and selected state has an exact work object, information hierarchy, one-H1/region contract, actor, viewport and lowest owner recorded before production edits.
- [ ] **PUX-02:** The existing Phase 27 measurement harness detects machine-decidable typography, spacing, container, table, responsive and accessibility failures from explicit local expected values; no parallel audit framework is introduced.
- [ ] **PUX-03:** Typography and spacing converge on the existing semantic roles and local token scale; route-local literals or recipes require an evidence-backed exception.
- [ ] **PUX-04:** Cards and data containers have one coherent purpose, accessible names and deliberate nesting; tables have semantic labels, type-correct alignment, bounded overflow, column priority and complete query states.
- [ ] **PUX-05:** Findings are grouped and fixed by shared root cause in at most three implementation waves: foundation/tokens, shared seams, and route rollout/verification.
- [ ] **PUX-06:** Full unit, lint, dependency, production build, architecture/hygiene, headed browser and fresh independent review gates pass without weaker visual thresholds or broad baseline updates.

## Single operational warehouse presentation

- [ ] **SWH-01:** Routine UI presents one operational warehouse as passive context once and removes false selection, repeated warehouse labels and meaningless warehouse columns/filters when runtime authorization exposes exactly one option.
- [ ] **SWH-02:** Warehouse identity remains present in API payloads, authorization, audit events, deep links/exports where required, and database/data-grain contracts; client presentation never weakens server enforcement.
- [ ] **SWH-03:** Harness coverage proves zero warehouse blocks safely, one warehouse removes false choice, and unexpected multiple authorized warehouses fail closed or expose an explicit selector rather than silently merging data.

## Out of scope for the Warehouse phase

- Replacing shadcn/Base UI with SAP UI5, Carbon or another component stack.
- Redesign mockups, copied enterprise-system visual styling or pixel-perfect screenshot oracles.
- Implementing Admin Data or Purchasing production changes.
- Resolving Purchasing Workflow semantics before Admin Data validation.
- Creating generic archetype renderers or a whole-project UI framework.
- Changing backend behavior, authorization, API/cache identity or database semantics.

## Traceability

| Requirement | Phase | Status |
|---|---:|---|
| UIC-01..05 | 27 | Complete |
| WHP-01..03 | 27 | Complete |
| WHP-04 | 27 | Complete |
| VREC-01..04 | 27.1 | Complete |
| PUX-01..06 | 28 | Researching |
| SWH-01..03 | 28 | Researching |
