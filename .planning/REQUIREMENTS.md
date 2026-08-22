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
- [ ] **WHP-04:** The pilot closes with build → structural contract → accessibility → screenshot evidence → responsive contract → AI review, followed by fresh before/after reconciliation and zero unresolved broad visual failure from Phase 27.1.

## Non-Warehouse visual reconciliation

- [ ] **VREC-01:** All 21 non-Warehouse failures have reproducible route/state/viewport identities, expected/actual/diff evidence and owner-level dispositions.
- [ ] **VREC-02:** Every production regression is fixed at its lowest demonstrated owner; baseline changes require semantic/DOM/geometry proof and never rely on screenshots alone.
- [ ] **VREC-03:** Visual thresholds, viewport matrices, assertions, route fixtures and comparison logic remain unchanged unless a separately proven harness defect requires a stricter deterministic replacement.
- [ ] **VREC-04:** The complete broad visual suite passes twice consecutively before full frontend unit, lint, dependency-cruiser, production build and hygiene gates run green.

## Promotion gates

- [ ] **VAL-01:** Admin Data validates the Warehouse contract without a Warehouse-specific exception or a prebuilt broad framework.
- [ ] **VAL-02:** A rule, token or shared component contract is promoted only when Warehouse and Admin Data demonstrate the same owner-level need.
- [ ] **VAL-03:** Purchasing remains deferred until Admin Data validation is complete and the open Data Workspace-versus-Workflow research question is resolved.

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
| WHP-04 | 27 | Blocked by Phase 27.1 |
| VREC-01..04 | 27.1 | Planned |
| VAL-01..02 | Deferred until Warehouse closeout | Locked |
| VAL-03 | Open research gate | Locked |
