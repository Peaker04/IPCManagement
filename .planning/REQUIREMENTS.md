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

- [x] **ORCL-04**: A read-only PC fixture measures expected versus rendered actions for every registry
  scenario, relevant role and all five required desktop viewports, excluding the four false-missing causes.

- [x] **ORCL-05**: Every measured THIẾU, MỒ CÔI, IM LẶNG or LỆCH VỊ TRÍ item has an evidenced disposition;
  any implemented PD action has lower-layer, permission, state, confirmation and placement tests.

### PE — Hợp nhất về canon

- [x] **CAN-01**: The PB variant inventory is regenerated from current source and fails when an unapproved
  variant or stale residual list is introduced.

- [x] **CAN-02**: Status, loading/refreshing, search ownership, query error/forbidden, empty result, table
  boundary and query-state rendering match the approved contextual canons.

- [x] **CAN-03**: Quantity/count/percent, date-only/timestamp and currency displays use shared context-aware
  formatters with explicit precision, unit and timezone behavior.

- [x] **CAN-04**: Domain/form/dialog actions use approved Button ballot 8B and form controls use ballot 9B;
  router, CommandBar, checkbox/file and pagination exceptions remain explicitly bounded.

- [x] **CAN-05**: Field validation is adjacent and accessible; simple confirmation, rich decision dialogs,
  action placement, feedback and pagination retain their approved context-specific contracts.

- [x] **CAN-06**: Each approved concept has one canonical contract or a machine-checked semantic exception,
  and the post-migration variant count matches the approved inventory.

### P5 — Ma trận chuẩn

- [x] **CONF-01**: Every P5 matrix row is derived from an approved PB decision or an explicit addendum rule;
  missing information remains unresolved rather than being invented from an absent prior prompt set.

- [x] **CONF-02**: The P5 matrix assigns every enforced rule an ID, concept, contextual canon, measurement
  layer and binary PASS condition; advisory taste and unsourced quotas stay outside the gate.

### P6 — Assertion hình học đỏ trước

- [ ] **CONF-03**: Each selected P5 rule maps to an existing source/control owner and a source-addressable
  measurement; production DOM metadata is not required unless separately justified by that rule.

- [ ] **CONF-04**: Each P6 assertion is demonstrated red against the current violating case before the
  corresponding P7 production fix is accepted.

### P7 — Sửa theo ma trận

- [ ] **CONF-05**: Each P7 change fixes only a failure proven by P6, preserves PB contextual exceptions and
  passes PC plus the existing required desktop/browser gates.

- [ ] **CONF-06**: P7 verification uses current-source evidence, preserves the database/evidence lane and
  traces each fix from P5 rule through red and green evidence.

### P8 + PF — Khóa gate và bảo vệ UI=f(state)

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
| Pixel-perfect screenshot equality as the sole oracle | Approved P5/P6 binary rules are authoritative; imagery is supporting evidence |

## Traceability

| Requirement | Phase | Status |
|---|---:|---|
| ORCL-01 | 19 | Complete |
| ORCL-02 | 19 | Complete |
| ORCL-03 | 19 | Complete |
| ORCL-04 | 20 | Complete |
| ORCL-05 | 20 | Complete |
| CAN-01 | 21 | Complete |
| CAN-02 | 21 | Complete |
| CAN-03 | 21 | Complete |
| CAN-04 | 21 | Complete |
| CAN-05 | 21 | Complete |
| CAN-06 | 21 | Complete |
| CONF-01 | 22 | Complete |
| CONF-02 | 22 | Complete |
| CONF-03 | 23 | Pending |
| CONF-04 | 23 | Pending |
| CONF-05 | 24 | Pending |
| CONF-06 | 24 | Pending |
| STATE-01 | 25 | Pending |
| STATE-02 | 25 | Pending |
| STATE-03 | 25 | Pending |
| QUAL-01 | 25 | Pending |
| DOC-01 | 25 | Pending |
| RESP-01 | Future | Deferred |
| VISION-01 | Future | Deferred |
| FIGMA-01 | Future | Deferred |

**Coverage:** 22 v1.3 requirements · 22 mapped · 0 unmapped.

---
*Last updated: 2026-07-31 after Phase 20 verification*
