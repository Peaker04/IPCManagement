# Roadmap: Dashboard UI Rules Conformance

## Overview

Milestone v1.0 first repaired the 19 source-evidenced dashboard UI rule gaps through
their lowest shared owners. Phase 2 extends the same evidence discipline project-wide:
it improves the deterministic interaction matrix, traces measured performance failures,
and repairs only findings proved by that matrix. It does not turn unmeasured checklist
items into visual defects or alter backend or business behavior.

## Phases

- [x] **Phase 1: Evidence-backed Dashboard UI Conformance** - Bring the audited shared dashboard UI seams into conformance and verify them from fresh desktop evidence. (Completed 2026-08-11)
- [ ] **Phase 2: Checklist-backed UI Assurance and Evidence-led Remediation** - All three waves executed; Reports is resolved, while Warehouse/Approvals performance remains blocked on lowest-owner trace evidence.
- [ ] **Phase 3: Project-wide Human UI and Refresh Stability** - Converge every inventoried page, tab, nested view, modal and table on user language, stable status geometry and measured refresh/performance contracts.

## Phase Details

### Phase 1: Evidence-backed Dashboard UI Conformance

**Goal**: Users can rely on consistent, accessible, and layout-stable shared dashboard UI behavior while the 19 evidence-backed rule gaps are fixed at their lowest common owners.
**Depends on**: Nothing (first phase)
**Requirements**: COPY-01, STATUS-01, FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, DIALOG-01, DIALOG-02, DIALOG-03, DIALOG-04, TABLE-01, TABLE-02, TABLE-03, TABLE-04, STATUS-02, STATUS-03, STATUS-04, FONT-01
**Success Criteria** (what must be TRUE):

  1. Users do not encounter deployable development/credential-like copy or raw service-run lifecycle values; lifecycle status uses canonical human-readable vocabulary.
  2. Users see semantically consistent shared colors, spacing, and status presentation: long lifecycle labels remain single-line with their full accessible label available, exactly three approved sizes are available, and read-only status cannot behave as an interactive tag/link; source checks prevent component color/token regressions.
  3. Users can operate dialogs at predictable `sm`, `md`, `lg`, or `full` sizes with a bounded scrolling body and persistent header/footer; keyboard focus stays within an open dialog, the background is inert, closing returns focus to its trigger, and dirty data is protected from accidental dismissal.
  4. Users can read and personalize operational tables: quantitative values are right-aligned with tabular numerals, horizontal tables retain their header and identifying column, table preferences persist per account with reset-to-default where meaningful, documented exceptions identify tables where that control is not meaningful, and semantic headers expose the correct scope.
  5. Users receive layout-stable dashboard routes within an explicit per-route bundle budget; fresh headed Chrome verification at `1920×1080`, `1440×900`, `1366×768`, `1365×900`, and `1280×900` demonstrates stable font/layout behavior for the repaired seams, with final browser, accessibility, performance, and regression evidence recorded without changing business behavior.

**Plans**: 3 plans / 3 waves — verified by `gsd-plan-checker`; execution awaits user approval.

- [x] `01-01-PLAN.md` — Wave 1: executable contracts, semantic foundation and guardrails. (Completed 2026-08-11)
- [x] `01-02-PLAN.md` — Wave 2: shared dialog, status and operational-table seams. (Completed 2026-08-11)
- [x] `01-03-PLAN.md` — Wave 3: table preferences, bounded rollout and fresh headed verification. (Completed 2026-08-11)

**UI hint**: yes

**Phase constraints**:

- Implementation scope is limited to the 19 `GAP` rows in `DASHBOARD-UI-RULES-AUDIT.md` represented by the requirements above.
- The 118 `NEEDS_EVIDENCE` rows remain an evidence backlog. Wave 3 may collect evidence, but an evidence-only row cannot become an implementation task until reclassified as a concrete `GAP` and this roadmap is revised and re-approved.
- Do not change backend lifecycle, authorization, API, database, cache, or business behavior; do not add tablet/mobile viewports; do not use GitNexus.
- User approval is required before implementation or any execution begins.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Evidence-backed Dashboard UI Conformance | 3/3 | Complete | 2026-08-11 |
| 2. Checklist-backed UI Assurance and Evidence-led Remediation | 3/3 | Executed — UIMA-03 blocked | 2026-08-11 |
| 3. Project-wide Human UI and Refresh Stability | 0/3 | In progress — Wave 1 foundation | — |

### Phase 3: Project-wide human UI and refresh stability

**Goal:** Every production page, tab, nested view, modal and table uses user-facing vocabulary and shared
presentation seams; background refresh and status transitions preserve geometry, scroll and usable data while
performance is measured and improved at the lowest responsible owner.

**Depends on:** Phase 1 shared primitives and Phase 2 interaction matrix.

**Plans:** 3 plans / waves.

**Success criteria:**

1. A source-aware inventory bidirectionally count-locks every production table, dialog and tab switcher; new
   surfaces fail until classified with copy, query-state and performance evidence.
2. Unknown backend statuses never render raw enum/UUID/version jargon; action labels are verbs and state labels
   are user-language descriptions resolved through shared registries/helpers.
3. Status/badge regions keep one stable DOM/geometry owner through pending/success/error/refetch; tables keep
   rows, column widths, pagination and scroll position during background refresh.
4. No document reload is used. Exact invalidation, stable query arguments, hidden-tab/modal/edit pause and
   stale-response protection are verified under `docs/DASHBOARD-UI-RULES.md` F12–F24.
5. Production-build headed evidence covers all inventoried surfaces at the five desktop viewports. Verdicts join
   DOM geometry, request/cache behavior, focus, console/page errors, CLS and long tasks; screenshot is review-only.

**Waves:**

- [ ] `03-01` — Inventory, user-language/status registry and refresh/performance detector foundation.
- [ ] `03-02` — Roll out by family: Weekly Menu/Coordination, Purchasing/Approvals, Warehouse/Chef,
  Reports/Admin/Auth. A family closes only when every contained table/tab/modal is dispositioned.
- [ ] `03-03` — Fresh production-build headed matrix, owner-specific performance remediation and permanent gate.

**Constraints:**

- Preserve backend lifecycle, authorization, API/database semantics and Phase 5 `ipc_lane7` lineage.
- Runtime baseline is read-only unless a separately reviewed workflow action is required; no reset/seed/import.
- Fix shared seams before callsites. Do not replace usable old data with skeleton during background fetch.
- GitNexus remains opt-in and is not used for this phase unless Kỳ explicitly requests it.

### Phase 2: Checklist-backed UI assurance and evidence-led remediation

**Goal:** Replace the partial route-default UI gate with a truthful interaction/state matrix, resolve the measured CLS and long-task failures, and repair Reports workflows only where the new evidence proves the responsible UI owner.
**Requirements**: UIMA-01, UIMA-02, UIMA-03, UIMA-04, UIMA-05
**Depends on:** Phase 1
**Plans:** at most 3 plans / waves

**Success criteria** (what must be TRUE):

  1. The interaction matrix truthfully covers each tab, read-only dialog and fixture-backed loading/empty/error/permission state without treating unavailable evidence as a PASS.
  2. Measured runtime CLS is at or below 0.1 at the defined five desktop viewports, and the measured scroll/modal trace has no main-thread task above 50ms unless a verified external limitation is explicitly reported.
  3. Reports price-list task actions and discovery controls are understandable without using a wrapped instructional table cell or pagination as the sole discovery path, but only after an owner-specific failure record confirms the change.
  4. Source tests, headed Chrome JSON evidence, console/request/focus records and production builds pass without backend, authorization, database or business-flow changes.

**Phase constraints**:

- Exactly one follow-up phase and a maximum of three sequential waves. Wave 1 is evidence/harness correction, Wave 2 is performance trace/remediation, Wave 3 is only for owner-specific UI fixes newly proven by the completed matrix.
- `UNVERIFIABLE`/`NEEDS_EVIDENCE` checklist records are measurement work, not visual-bug authorization. Do not edit a production UI owner until a recorded result is `FAIL` or an already-audited `GAP` names that owner.
- Use headed Chrome on the five desktop viewports in `MEMORY.md`, `ipc_lane9` on ports `3010/8010`, and read-only fixtures; retain screenshot files for reviewer context only.
- Do not use GitNexus, change backend/API/database/cache/authorization/business behavior, add a tablet/mobile runtime gate, reset/seed/import/restore data, or run a screenshot-only verdict.
