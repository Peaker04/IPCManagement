# Roadmap: IPCManagement UI Completeness & Conformance

## Milestone v1.3 — UI Completeness & Conformance

**Goal:** Execute the work blocks in `.docs/UI-UX-ADDENDUM-KHONG-CO-FIGMA.md` directly, without adding
new design programs or acceptance criteria that are not sourced by the addendum and the approved PB audit.

**Foundation:** Milestone v1.2 Phases 11–18 are complete and remain historical evidence in Git and their
existing `.planning/phases/` directories. PB was approved before this roadmap. v1.3 continues numbering at
Phase 19 and maps the addendum blocks without renumbering the project's historical phases.

## Phase overview

- [x] **Phase 19: PA — Completeness registry expansion** — inventory operational state contracts and build the
  approved `CoordinationOrderScopeLifecycle` plus scalable registry guards (completed 2026-07-31).

- [x] **Phase 20: P3/P4 + PC/PD — Action completeness** — use source-addressable controls and the capturer to
  measure all registry scenarios and disposition every observed mismatch (completed 2026-07-31).

- [x] **Phase 21: PE — Hợp nhất về canon** — finish the approved PB concepts one concept at a time, (completed 2026-08-01)
  preserving the contextual exceptions already approved.

- [ ] **Phase 22: P5 — Ma trận chuẩn** — turn the approved PB choices into the standard matrix required
  by the addendum; do not invent a new visual canon.

- [ ] **Phase 23: P6 — Assertion hình học đỏ trước** — add a failing assertion for each selected P5 rule
  before changing the corresponding production presentation.

- [ ] **Phase 24: P7 — Sửa theo ma trận** — fix only the failures demonstrated by P6, then rerun PC and
  the existing verification gates to ensure no new mismatch.

- [ ] **Phase 25: P8 + PF — Khóa gate và bảo vệ UI=f(state)** — put the approved matrix assertions and
  state-purity checks into the permanent gate, then close the addendum.

### Phase 19: PA — Completeness registry expansion

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

### Phase 20: P3/P4 + PC/PD — Action completeness

**Goal:** Compare expected operations with the real rendered control surface and close every evidenced gap.

**Requirements:** ORCL-04, ORCL-05

**Success criteria:**

1. Read-only fixtures cover each registry scenario, relevant role and all five desktop viewports.
2. Every potential THIẾU result records exclusion of navigation, viewport, fixture-condition and role/state mismatch.
3. Every THIẾU/MỒ CÔI/IM LẶNG/LỆCH VỊ TRÍ result is fixed or explicitly retained with evidence-backed rationale.
4. Implemented PD actions have positive and negative permission/state tests and an observable post-action result.

### Phase 21: PE — Hợp nhất về canon

**Goal:** Apply PE exactly as written: converge each approved PB concept without changing business behavior or
creating a new presentation variant.

**Requirements:** CAN-01, CAN-02, CAN-03, CAN-04, CAN-05, CAN-06

**Success criteria:**

1. Every PB concept is migrated or retained as a named contextual exception with source evidence.
2. Callsite inventory is regenerated from current source and the post-migration count is checked.
3. Tests cover the approved canonical contract and every retained semantic exception.
4. PC is rerun after each completed concept; no new mismatch, business-state, authorization or API behavior change is introduced.

### Phase 22: P5 — Ma trận chuẩn

**Goal:** Materialize the standard matrix from PB decisions already approved by the user.

**Requirements:** CONF-01, CONF-02

**Success criteria:**

1. Every matrix row points to an approved PB decision or an explicit addendum rule.
2. Each row states the concept, canonical/contextual rule, measurement layer and binary PASS condition.
3. Missing information is marked unresolved instead of being supplied from an absent prior prompt set.
4. The matrix does not introduce a new component, visual style, viewport or product requirement.

### Phase 23: P6 — Assertion hình học đỏ trước

**Goal:** Demonstrate each selected P5 conformance failure with a red assertion before applying its fix.

**Requirements:** CONF-03, CONF-04

**Success criteria:**

1. Each assertion maps to one P5 matrix row and an existing source/control owner.
2. The assertion is captured red against the current failing case before any production fix.
3. Test-only source mapping is preferred; production DOM metadata is added only if separately justified by the selected rule.
4. This phase changes no business state, permission, operation or action eligibility.

### Phase 24: P7 — Sửa theo ma trận

**Goal:** Fix only the failures established by P6 and verify that the fixes do not create a PC regression.

**Requirements:** CONF-05, CONF-06

**Success criteria:**

1. Every fix traces from P5 row to P6 red evidence, changed source and green evidence.
2. Only the selected presentation failure is changed; PB contextual exceptions remain intact.
3. PC and the existing required desktop/browser gates pass after the fix.
4. Verification preserves the database/evidence lane and does not infer backend success from frontend rendering alone.

### Phase 25: P8 + PF — Khóa gate và bảo vệ UI=f(state)

**Goal:** Lock the approved P5–P7 work and the addendum's O3 state-purity oracle into the permanent gate.

**Requirements:** STATE-01, STATE-02, STATE-03, QUAL-01, DOC-01

**Success criteria:**

1. Equivalent logical state in same-kind displays yields equivalent actions, status labels and mandatory facts.
2. Undeclared local presentation state that changes visibility fails the gate; named ephemeral interaction state remains allowed.
3. Root verification runs the approved registry, canon, P5/P6 assertions and PF state-purity checks.
4. Existing regression counts do not decrease and canonical status/evidence documents agree.
5. Closeout reports completion against PA, PB, P3, P4, PC, PD, PE, P5, P6, P7, P8 and PF directly.

## Execution rules

- Execute Phases 19 → 25 in order; Phase 21–25 map directly to PE, P5, P6, P7 and P8+PF respectively.
- Brainstorming may resolve a choice inside an authorized addendum block, but may not create a new phase, finding quota,
  golden-screen quota, DOM-instrumentation program or acceptance criterion without a source or explicit user approval.

- No Figma invention, process-rule edit, automatic backend-policy reconciliation, push, destructive Git action or existing-lane mutation.
- Every production symbol edit requires GitNexus impact in both directions; every commit requires final `detect_changes`.
- Browser claims require headed current-source evidence; mock fixtures prove deterministic contracts only.

## Historical milestones

- **v1.2 — Architecture workflow 11–18:** complete before v1.3; source and verification history remain in Git and existing phase artifacts.
- **v1.1 — legacy BOM/supplier roadmap:** archived under `.planning/archive/v1.1-legacy/` and not executable.
