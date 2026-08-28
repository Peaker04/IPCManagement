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

## System operation mode

- [x] **OPM-01:** The active operation mode is one server-authoritative system-wide value: `DEFAULT` or `MATERIAL_RECONCILIATION`; browser storage and per-user preferences cannot override it.
- [x] **OPM-02:** Only Admin may change the mode, with confirmation, persisted actor/time audit, frontend cache invalidation and safe relocation from newly unavailable routes; mode changes never delete workflow data.
- [x] **OPM-03:** Mode eligibility and existing permission checks are both enforced. Mode never grants permission, and direct access to an excluded route returns an explicit mode-unavailable state rather than a false permission denial.
- [x] **OPM-04:** Reconciliation mode retains Dashboard, Weekly Menu, Purchasing, Warehouse, Reports, Admin Data and Admin-only Advanced Settings, while excluding Coordination, Approvals, Chef Dashboard and Approval Rules for every role.

## Material reconciliation branch

- [x] **MRC-01:** Every menu/meal import creates an independently identified reconciliation batch at grain `batch × ingredient identity × canonical unit`.
- [x] **MRC-02:** Demand and applicable tolerance are frozen when Purchasing begins entering actual quantities; later menu or configuration changes cannot rewrite historical batch results.
- [x] **MRC-03:** Each ingredient exposes exact required, purchased and issued quantities plus purchase variance, issue variance and purchase-to-issue flow gap, with full source identity and audit provenance retained.
- [x] **MRC-04:** The UI always shows exact differences and marks `Cần kiểm tra` only when the frozen tolerance is exceeded; default views prioritize exceptions and offer a secondary all-row view.

## Closed-loop material issue reconciliation

- [ ] **MRX-01:** `MATERIAL_RECONCILIATION` exposes exactly Dashboard, Weekly Menu, Warehouse, Reconciliation and Admin Data as primary navigation; Purchasing and Reports are mode-excluded from direct routes, preload, controls and requests while `DEFAULT` remains unchanged.
- [ ] **MRX-02:** Weekly Menu materializes one immutable source-linked material issue list from the imported menu/servings/BOM authority and transfers it explicitly to Warehouse without creating stock movement at transfer time.
- [ ] **MRX-03:** Warehouse creates real inventory issue documents through the canonical stock-ledger transaction, and every issue line retains exact reconciliation batch-line lineage with idempotent/concurrent duplicate protection.
- [ ] **MRX-04:** Reconciliation compares only frozen required quantity with warehouse-authoritative issued quantity; purchased concepts and manually entered issued actuals are absent from the new mode workflow, while completed Phase 29 history remains readable and immutable.
- [ ] **MRX-05:** Every retained route/tab is reduced to mode-relevant content and 5–7 decision fields; hidden routes, tabs and default-mode owners mount no excluded query/action, and user display preferences cannot re-enable backend-excluded capability.
- [ ] **MRX-06:** Full tests and protected headed evidence prove import/materialization → transfer → issue/stock movement → comparison/disposition/completion → reload across five desktop viewports, with zero procurement mutation/request and final mode restored to `DEFAULT`.

## Project-wide clarity and density

- [x] **CLR-01:** Both operation modes use concise user-language copy: each region states the current condition and at most one authorized next action without duplicated headings, implementation vocabulary or stacked explanatory notes.
- [x] **CLR-02:** Tables prioritize decision-bearing fields, use consistent type-correct alignment and spacing, shorten technical identifiers only with full-value inspection/copy/search support, and preserve raw IDs in API/export/audit/lineage.
- [x] **CLR-03:** Empty states, cards, badges, spacing and visual hierarchy are corrected at the lowest demonstrated owner using semantic DOM/geometry/runtime evidence; screenshots alone cannot authorize cleanup and business meaning cannot be removed.

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
| PUX-01..06 | 28 | Complete |
| SWH-01..03 | 28 | Complete |
| OPM-01..04 | 29 | Complete |
| MRC-01..04 | 29 | Complete |
| CLR-01..03 | 29 | Complete |
| MRX-01..06 | 30 | Planned |
