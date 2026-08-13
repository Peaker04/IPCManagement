---
milestone: v1.0
workstream: dashboard-ui-rules-conformance
source_audit: DASHBOARD-UI-RULES-AUDIT.md
status: active
---

# Requirements — Dashboard UI Rules Conformance

## Scope contract

Phase 1 implementation scope was limited to its 19 evidence-backed `GAP` rows. Phase 2 is a separately
approved, project-wide follow-up based on `docs/UI-UX-PROJECT-AUDIT.md` and the measurement protocol.
`UNVERIFIABLE`/`NEEDS_EVIDENCE` checklist records remain evidence backlog: they MUST NOT become production
implementation work unless the Phase 2 matrix records an owner-specific `FAIL` or reaffirms an audited `GAP`.
Phase 2 has exactly one phase and at most three waves.

## Requirements

### Copy and vocabulary

- [ ] **COPY-01**: Deployable and explicitly enabled development UI surfaces do not expose unexplained
  system/development wording or credential-like hints (`P1`).
- [ ] **STATUS-01**: Every service-run lifecycle status resolves through the canonical human-readable
  vocabulary and an unknown backend value cannot render raw in the UI (`L4`).

### Semantic foundation and guardrails

- [ ] **FOUND-01**: Shared UI primitives consume semantic color roles rather than appearance palette
  utilities (`D2`).
- [ ] **FOUND-02**: Token names exposed to components describe semantic roles rather than raw palette
  appearance (`D3`).
- [ ] **FOUND-03**: A source-aware lint/check gate rejects hardcoded component colors while allowing the
  declared token-definition owner (`D4`).
- [ ] **FOUND-04**: The spacing token scale uses the declared 4px base without the current 18px exception
  (`D6`).
- [ ] **FOUND-05**: CI enforces an explicit per-route bundle-size ceiling and reports an actionable failure
  when a route exceeds it (`F11`).

### Dialog contract

- [ ] **DIALOG-01**: The shared dialog exposes the fixed `sm/md/lg/full` size scale, bounded internal body
  scrolling, and sticky header/footer behavior (`M2.1`).
- [ ] **DIALOG-02**: Dialog close requests expose an interception seam so dirty forms can prevent accidental
  backdrop/Escape/close-button dismissal without changing clean-dialog behavior (`M2.3`).
- [ ] **DIALOG-03**: The shared dialog traps focus, marks the background inert while open, and restores focus
  to the invoking control when closed (`M2.4`).
- [ ] **DIALOG-04**: Every shared dialog has a deterministic accessible name connected through
  `aria-labelledby` (`M2.5`).

### Operational tables

- [ ] **TABLE-01**: Quantitative cells use right alignment and tabular numerals; the shared number-cell style
  cannot center quantitative data (`T1`).
- [ ] **TABLE-02**: Horizontally scrollable operational tables provide a sticky header and frozen identifying
  column through the lowest shared table owner (`T7`).
- [ ] **TABLE-03**: The shared table contract supports column visibility/order, three density levels,
  account-scoped persistence, and reset-to-default, with explicit documented exceptions where the feature is
  not meaningful (`T8`).
- [ ] **TABLE-04**: Semantic table headers declare the correct `scope` and a source-aware regression prevents
  uncovered header cells (`A1`).

### Status presentation

- [ ] **STATUS-02**: Long status labels truncate without wrapping and expose the complete label through an
  accessible tooltip/title contract (`S1.7`).
- [ ] **STATUS-03**: Status presentation exposes exactly three approved sizes with table/list-safe defaults
  (`S1.8`).
- [ ] **STATUS-04**: Read-only lifecycle status and interactive tag/link behavior use separate semantic APIs;
  a status badge cannot acquire link/hover behavior accidentally (`S1.10`).

### Font layout stability

- [ ] **FONT-01**: The primary self-hosted font is preloaded or uses a metric-compatible fallback, and current
  five-viewport evidence demonstrates the resulting layout remains stable (`C9`).

### Project-wide UI assurance and evidence-led remediation

- [x] **UIMA-01**: The deterministic UI interaction matrix covers all tab owners, read-only dialog owners and
  fixture-backed loading/empty/error/permission states with structured PASS, GAP, NOT_APPLICABLE or
  NEEDS_EVIDENCE records; unavailable evidence never becomes PASS.
- [x] **UIMA-02**: `control-surface.spec.ts` fixtures and selectors accurately describe the current Reports,
  Purchasing and Warehouse source owners before its assertions are relied on for regressions.
- [ ] **UIMA-03**: Warehouse and Approvals satisfy the current lab CLS threshold (p75 <= 0.1) and no
  measured scroll/modal interaction has a main-thread task over 50ms, with a diagnostic trace linking any
  remediation to its layout or scheduling cause.
- [x] **UIMA-04**: The Reports price-list workflow has an evidence-backed task action and constrained discovery
  path; it is not dependent on an unreadable wrapped instruction cell or pagination as the only discovery method.
- [x] **UIMA-05**: The final headed gate records DOM geometry, focus, console/page/request state, CLS and long
  tasks at all five approved desktop viewports using read-only fixtures and no data mutation.

### Project-wide human UI, inventory and refresh performance

- [ ] **HUI-01**: Every production page/tab/nested view/modal/table is present in a source-aware count-locked
  inventory with owner, query-state, copy and performance disposition.
- [ ] **HUI-02**: Unknown state, action and error values render user language instead of backend enum, UUID,
  version or implementation jargon; technical detail is available only in an explicit diagnostic detail region.
- [ ] **HUI-03**: Status and badge transitions retain one stable geometry owner and animate only semantic color
  or opacity; no action/refetch causes a status cell, table header or pagination region to shift.
- [ ] **PERF-01**: Every table preserves usable stale data, column geometry, pagination and scroll during
  background refresh; skeleton is initial-load only.
- [ ] **PERF-02**: Exact invalidation, stable query arguments, hidden-tab/modal/edit pause, stale-response race
  protection and request budgets satisfy canonical F12–F24 with measured evidence.
- [ ] **PERF-03**: Production-build headed evidence covers all inventory families at five viewports and records
  DOM/request/focus/CLS/long-task facts; unmeasured surfaces remain open rather than inferred PASS.

## Evidence backlog

All `NEEDS_EVIDENCE` items stay in the audit artifact. Wave 3 may collect current headed/browser/axe/performance
evidence, but MUST NOT implement an evidence-backlog item unless that evidence first records a concrete `GAP` and
the plan is revised and re-approved.

## Out of scope

- Backend lifecycle, authorization, API, database, cache, or business-behavior changes.
- Implementing `NEEDS_EVIDENCE` assumptions.
- Tablet/mobile viewports unless separately authorized; use the five desktop viewports in `MEMORY.md`.
- GitNexus analysis.
- More than one implementation phase or more than three waves without a new user-approved roadmap decision.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COPY-01 | Phase 1 | Complete |
| STATUS-01 | Phase 1 | Complete |
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| DIALOG-01 | Phase 1 | Complete |
| DIALOG-02 | Phase 1 | Complete |
| DIALOG-03 | Phase 1 | Complete |
| DIALOG-04 | Phase 1 | Complete |
| TABLE-01 | Phase 1 | Complete |
| TABLE-02 | Phase 1 | Complete |
| TABLE-03 | Phase 1 | Complete |
| TABLE-04 | Phase 1 | Complete |
| STATUS-02 | Phase 1 | Complete |
| STATUS-03 | Phase 1 | Complete |
| STATUS-04 | Phase 1 | Complete |
| FONT-01 | Phase 1 | Complete |
| UIMA-01 | Phase 2 | Complete |
| UIMA-02 | Phase 2 | Complete |
| UIMA-03 | Phase 2 | Pending |
| UIMA-04 | Phase 2 | Complete |
| UIMA-05 | Phase 2 | Complete |
