# Requirements: UI Completeness & Conformance

**Defined:** 2026-07-31
**Milestone:** v1.3
**Core Value:** Every permitted operational action is reachable and the same declared business state
produces an equivalent, predictable UI.

## v1.3 Requirements

### Completeness oracle (PA–PD)

- [x] **ORCL-01**: Maintainers can enumerate every state-bearing object family exposed on protected
  operational routes and see whether state, roles and valid operations are machine-readable, with source references.
- [x] **ORCL-02**: Every family with an importable lifecycle/action contract has an executable registry
  whose rows project code rather than copy it; unknown cells and literal-source drift checks are explicit.
- [x] **ORCL-03**: `CoordinationOrderScopeLifecycle` uses the approved grain `scenario × operation`, includes
  `scope`, and separates `entityState` from `projectionState` without production code importing the registry.
- [ ] **ORCL-04**: A read-only PC fixture measures expected versus rendered actions for every registry
  scenario, relevant role and all five required desktop viewports, excluding the four false-missing causes.
- [ ] **ORCL-05**: Every measured THIẾU, MỒ CÔI, IM LẶNG or LỆCH VỊ TRÍ item has an evidenced disposition;
  any implemented PD action has lower-layer, permission, state, confirmation and placement tests.

### Canon convergence (PB–PE)

- [ ] **CAN-01**: The PB variant inventory is regenerated from live production AST/source and fails when
  an unapproved variant or stale residual list is introduced.
- [ ] **CAN-02**: Status, loading/refreshing, search ownership, query error/forbidden, empty result, table
  boundary and query-state rendering match the approved contextual canons.
- [ ] **CAN-03**: Quantity/count/percent, date-only/timestamp and currency displays use shared context-aware
  formatters with explicit precision, unit and timezone behavior.
- [ ] **CAN-04**: Domain/form/dialog actions use approved Button ballot 8B and form controls use ballot 9B;
  router, CommandBar, checkbox/file and pagination exceptions remain explicitly bounded.
- [ ] **CAN-05**: Field validation is adjacent and accessible; simple confirmation, rich decision dialogs,
  action placement, feedback and pagination retain their approved context-specific contracts.
- [ ] **CAN-06**: Each approved concept has one canonical contract or a machine-checked semantic exception,
  and the post-migration variant count matches the approved inventory.

### Binary conformance (P5–P8)

- [ ] **CONF-01**: Ten harm-ranked IPC findings and three existing IPC golden screens are recorded with
  selectors, screenshots and explicit list-report/object-page/worklist principle scope.
- [ ] **CONF-02**: `docs/UI-CONFORMANCE-MATRIX.md` assigns every enforced principle an ID, measurement layer,
  binary PASS condition, severity and autofix permission; advisory visual taste is kept outside the gate.
- [ ] **CONF-03**: Critical page/panel/table/action DOM emits source-addressable component metadata in
  development/test builds without changing production behavior.
- [ ] **CONF-04**: Each new L2 assertion is demonstrated red against a focused violating probe before the
  production fix is accepted.
- [ ] **CONF-05**: The conformance harness enforces the approved geometry, data-grain, disabled-reason,
  focus, contrast, target-size, loading-stability, table and tab invariants at all five desktop viewports.
- [ ] **CONF-06**: Headed Chrome evidence from current source contains final screenshots, action requests,
  console/page errors, CLS and long-task data without mutating `ipc_lane1`.

### State purity and permanent gate (PF)

- [ ] **STATE-01**: Equivalent logical states rendered in multiple same-kind locations expose equivalent
  actions, status labels and mandatory facts, with deterministic tests for every identified pair.
- [ ] **STATE-02**: A static inventory classifies local/global/time/order/cache values that affect visibility;
  unapproved hidden presentation state fails the gate and approved ephemeral interaction state is explicit.
- [ ] **STATE-03**: Root verification runs the registry, canon, conformance and state-purity gates so the
  completed cleanup cannot silently regress.

### Quality and documentation

- [ ] **QUAL-01**: Existing application, API and frontend tests remain green with nondecreasing counts;
  lint, dependency-cruiser, production build, architecture growth and GitNexus final review pass.
- [ ] **DOC-01**: PA/PB/PC audits, conformance matrix, MEMORY, HISTORY, STATE and evidence index agree on
  current status without duplicating authoritative metrics or hashes.

## Future Requirements

- **RESP-01**: Add tablet/mobile parity after the user explicitly restores those viewports to the default gate.
- **VISION-01**: Add a write-isolated visual-judge pipeline after binary DOM/source mapping is proven stable.
- **FIGMA-01**: Produce design files only if future product work needs a separate design authoring workflow.

## Out of Scope

| Feature | Reason |
|---|---|
| New visual canon invented by an agent | Violates PB ballot and risks creating another variant |
| Backend permission reconciliation without product evidence | Backend remains authoritative; mismatches require explicit business disposition |
| Existing-lane reset/seed/import | Preserved database/evidence lineage must not be mutated for UI verification |
| Editing `AGENTS.md` or process rules | Explicitly excluded by the user for this task |
| Pixel-perfect screenshot equality as the sole oracle | Binary state/DOM/harm contracts are authoritative; imagery is supporting evidence |

## Traceability

| Requirement | Phase | Status |
|---|---:|---|
| ORCL-01, ORCL-02, ORCL-03 | 19 | Complete |
| ORCL-04, ORCL-05 | 20 | Pending |
| CAN-01, CAN-02, CAN-03 | 21 | Pending |
| CAN-04, CAN-05, CAN-06 | 22 | Pending |
| CONF-01, CONF-02, CONF-03, CONF-04 | 23 | Pending |
| CONF-05, CONF-06 | 24 | Pending |
| STATE-01, STATE-02, STATE-03, QUAL-01, DOC-01 | 25 | Pending |

**Coverage:** 22 v1.3 requirements · 22 mapped · 0 unmapped.

---
*Last updated: 2026-07-31 after autonomous scope confirmation for milestone v1.3*
