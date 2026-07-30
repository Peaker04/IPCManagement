# Roadmap: IPCManagement UI Completeness & Conformance

## Milestone v1.3 — UI Completeness & Conformance

**Goal:** Complete `.docs/UI-UX-ADDENDUM-KHONG-CO-FIGMA.md` through executable completeness,
canon-convergence, binary conformance and state-purity gates.

**Foundation:** Milestone v1.2 Phases 11–18 are complete and remain historical evidence in Git and their
existing `.planning/phases/` directories. v1.3 continues numbering at Phase 19.

## Phase overview

- [ ] **Phase 19: Completeness registry expansion** — inventory operational state contracts and build the
  approved `CoordinationOrderScopeLifecycle` plus scalable registry guards.
- [ ] **Phase 20: PC/PD action completeness** — measure all registry scenarios read-only and resolve every
  observed action mismatch.
- [ ] **Phase 21: Semantic canon convergence** — make the PB inventory executable and converge state,
  feedback, search and formatting contracts.
- [ ] **Phase 22: Control canon convergence** — finish Button 8B, form 9B, validation, table/status and
  bounded contextual exceptions.
- [ ] **Phase 23: Conformance contract and red oracle** — choose harm-ranked findings/goldens, write the
  binary matrix, emit DOM source metadata and prove red-first assertions.
- [ ] **Phase 24: Conformance fixes and headed evidence** — fix the ten measured failures and pass all five
  desktop viewports with current-source headed evidence.
- [ ] **Phase 25: UI=f(state) permanent gate and closeout** — enforce same-state equivalence, hidden-state
  rules and full regression/documentation closure.

### Phase 19: Completeness registry expansion

**Goal:** Make the expected action surface derivable for every state-bearing protected-route family and
materialize the approved second-object registry without production imports.

**Requirements:** ORCL-01, ORCL-02, ORCL-03

**Success criteria:**

1. A machine-readable inventory names every protected-route operational object family and classifies its
   state, role and operation sources as importable, literal-guarded or not determinable.
2. `CoordinationOrderScopeLifecycle` rows use `scenario × operation`, row-level `scope`, separate
   `entityState`/`projectionState`, backend-authoritative permission evidence and source-drift tests.
3. Production source imports no registry/audit fixture, and every copied literal has a failing drift guard.
4. Registry format/generator can add another family without changing the meaning of existing WeeklyMenu rows.

### Phase 20: PC/PD action completeness

**Goal:** Compare expected operations with the real rendered control surface and close every evidenced gap.

**Requirements:** ORCL-04, ORCL-05

**Success criteria:**

1. Read-only fixtures cover each registry scenario, relevant role and all five desktop viewports.
2. Every potential THIẾU result records exclusion of navigation, viewport, fixture-condition and role/state mismatch.
3. Every THIẾU/MỒ CÔI/IM LẶNG/LỆCH VỊ TRÍ result is fixed or explicitly retained with evidence-backed rationale.
4. Implemented PD actions have positive and negative permission/state tests and an observable post-action result.

### Phase 21: Semantic canon convergence

**Goal:** Convert the approved PB audit from prose into executable inventory and converge semantic/state presentation.

**Requirements:** CAN-01, CAN-02, CAN-03

**Success criteria:**

1. AST/source inventory reproduces live callsite counts and rejects new unapproved variants or stale residuals.
2. Status, loading/refreshing, search, error/forbidden, empty, table and query-boundary contracts match PB canon.
3. Quantity, percent, date-only, timestamp and currency output uses shared formatters with contract tests.
4. No migration changes business state, authorization, API calls or action eligibility.

### Phase 22: Control canon convergence

**Goal:** Finish the visual/control migration while preserving the semantic exceptions approved by PB.

**Requirements:** CAN-04, CAN-05, CAN-06

**Success criteria:**

1. Domain/form/dialog native buttons in the approved migration set use Button 8B; links and adapters remain bounded exceptions.
2. Text/select/textarea controls in the approved migration set use form-control ballot 9B with accessible labels and states.
3. Field errors, confirmations, rich decisions, action placement, feedback and pagination satisfy their contextual contracts.
4. Recount reports one canonical contract or a named semantic exception for all eighteen PB concepts.

### Phase 23: Conformance contract and red oracle

**Goal:** Turn the ten most harmful current UI defects into source-addressable binary assertions before fixing them.

**Requirements:** CONF-01, CONF-02, CONF-03, CONF-04

**Success criteria:**

1. Ten findings and three IPC golden screens have screenshots, selectors, harm and scoped principle IDs.
2. `docs/UI-CONFORMANCE-MATRIX.md` contains only binary rules with layer, severity and autofix policy.
3. Dev/test DOM metadata maps every critical finding selector to a component/source owner without leaking behavior changes.
4. Each new oracle is captured failing against an isolated violation before its production fix is accepted.

### Phase 24: Conformance fixes and headed evidence

**Goal:** Resolve the ten matrix failures and prove stable Fiori/accessibility behavior across the required desktop matrix.

**Requirements:** CONF-05, CONF-06

**Success criteria:**

1. Geometry, data-grain, disabled-reason, focus, contrast, target-size, loading, table and tab assertions pass at
   `1920×1080`, `1440×900`, `1366×768`, `1365×900` and `1280×900`.
2. Every production fix is traceable from matrix ID → failing evidence → source owner → green evidence.
3. Headed Chrome current-source evidence records screenshots, action API traffic, console/page errors, CLS and long tasks.
4. Verification is read-only or uses a disposable database clone; `ipc_lane1` lineage remains unchanged.

### Phase 25: UI=f(state) permanent gate and closeout

**Goal:** Prevent completeness and consistency debt from returning after the cleanup.

**Requirements:** STATE-01, STATE-02, STATE-03, QUAL-01, DOC-01

**Success criteria:**

1. Same-kind displays given equivalent logical state have equivalent actions, status labels and mandatory facts.
2. Static hidden-state inventory rejects unapproved visibility dependencies while allowing named ephemeral interaction state.
3. Root `npm run verify` runs registry, canon, conformance/state-purity, regression, lint, dependency and build gates.
4. Application/API/frontend test counts do not decrease; GitNexus final review has no undispositioned process or Deferred item.
5. PA/PB/PC, matrix, MEMORY/HISTORY/STATE and evidence index agree and the addendum completion audit proves all 22 requirements.

## Execution rules

- Execute Phases 19 → 25 in order; each phase may contain multiple atomic plans but may not leave a migrated API/control set partial.
- Brainstormed defaults are allowed by the current user authorization, but alternatives/rationale/acceptance criteria must be recorded.
- No Figma invention, process-rule edit, automatic backend-policy reconciliation, push, destructive Git action or existing-lane mutation.
- Every production symbol edit requires GitNexus impact in both directions; every commit requires final `detect_changes`.
- Browser claims require headed current-source evidence; mock fixtures prove deterministic contracts only.

## Historical milestones

- **v1.2 — Architecture workflow 11–18:** complete before v1.3; source and verification history remain in Git and existing phase artifacts.
- **v1.1 — legacy BOM/supplier roadmap:** archived under `.planning/archive/v1.1-legacy/` and not executable.
