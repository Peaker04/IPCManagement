# Roadmap: IPCManagement architecture workflow

## Milestone v1.2 — Architecture workflow 11–18

**Goal:** Close the architecture audit through one sequential workflow with explicit gates and evidence.
**Canonical source:** `docs/ARCHITECTURE-AUDIT-2026-07-26.md`, Part F, Steps 11–18.
**Legacy notice:** `.planning/archive/v1.1-legacy/ROADMAP.md` and its archived Phase 08–09 artifacts are historical only and must never drive routing or implementation.

## Phase overview

- [x] **Phase 11: Query state contract** — complete at `d2a5d62` plus supporting guardrails.
- [x] **Phase 12: Material Demand and Warehouse pilot** — complete with headed-browser evidence.
- [x] **Phase 13: State-boundary rollout** — complete across Purchasing, Approvals, Reports, Admin, Chef and Coordination.
- [x] **Phase 14: VSA boundary** — complete; dependency cycles and controller-to-DbContext access removed.
- [x] **Phase 15: Use-case and functional-core extraction** — complete through SampleData at `7ae0e67`.
- [x] **Phase 16: Persistence and reliability** — complete at `59add79` plus prior mapping/runner/lineage checkpoints.
- [x] **Phase 17: Frontend ownership** — complete, 8/8 plans; Gate 17 verified. (completed 2026-07-29)
- [ ] **Phase 18: Guardrails and workflow closeout** — pending Steps 11–17.

### Phase 11: Query state contract

**Goal:** Establish the shared `QueryView<T>` state algebra, exhaustive state tests and lint guardrail.
**Depends on:** Phase 10
**Status:** Complete

### Phase 12: Material Demand and Warehouse pilot

**Goal:** Prove the state contract on two live workflow boundaries with three-viewport browser evidence.
**Depends on:** Phase 11
**Status:** Complete

### Phase 13: State-boundary rollout

**Goal:** Apply the state contract to every remaining query-owning operational page without ownership churn.
**Depends on:** Phase 12
**Status:** Complete

### Phase 14: VSA boundary

**Goal:** Enforce the feature dependency DAG, remove cycles and direct controller-to-DbContext access.
**Depends on:** Phase 13
**Status:** Complete

### Phase 15: Use-case and functional-core extraction

**Goal:** Split Reports, Coordination, Purchasing, Catalog and SampleData by real responsibility and isolate pure policy from EF/I/O.
**Depends on:** Phase 13, Phase 14
**Status:** Complete

### Phase 16: Persistence and reliability

**Goal:** Standardize EF mapping, transactions, exceptions, migration lineage and recoverability without resetting data.
**Depends on:** Phase 15
**Status:** Complete

**Scope:**

- Extract entity mappings into feature-owned `IEntityTypeConfiguration<T>` classes; keep `IpcManagementContext` as registration root.
- Standardize a transaction runner with EF execution strategy before enabling transient retry; prevent duplicate side effects.
- Replace business `InvalidOperationException` paths with mapped domain/application exceptions.
- Reconcile canonical fresh/upgrade migration lineage without rewriting applied migrations.
- Preserve existing backups and add off-site copy plus disposable-clone restore rehearsal evidence.

**Gate:** retry cannot duplicate side effects; fresh/upgrade lineage is explained and tested; restore rehearsal meets the documented recovery target; no production/lane reset, seed or import occurs.

### Phase 17: Frontend ownership

**Goal:** Give every endpoint module, layout and page model a clear owner while keeping one API slice and stable public hooks/cache behavior.
**Depends on:** Phase 13, Phase 15, Phase 16
**Status:** Complete — 8/8 plans; verification passed 7/7 must-haves

**Scope:** split `workflowApi.ts` by feature, move `MainLayout` to `app/layout`, resolve `projects→coordination`, retire the 54-violation baseline and split oversized Admin/Reports page models.

**Gate:** zero unapproved cycle/reverse import; navigation, cache and state tests pass; OpenAPI-derived types and public hook surface do not drift; three-viewport headed-browser behavior remains stable.

### Phase 18: Guardrails and workflow closeout

**Goal:** Decompose test monoliths, enforce growth thresholds and close the workflow with reproducible evidence and synchronized documentation.
**Depends on:** Phase 11, Phase 12, Phase 13, Phase 14, Phase 15, Phase 16, Phase 17
**Status:** Pending

**Gate:** full backend/frontend/contract/dependency/migration gates and required browser evidence are green; secret scan, `git diff --check` and staged GitNexus `detect_changes` are clean; no automatic push.

## Execution rules

- Execute strictly in order 17 → 18; do not route into archived v1.1 phases.
- Each feature/use case is an atomic commit with focused regression coverage.
- `docs/ARCHITECTURE-AUDIT-2026-07-26.md` owns detailed acceptance criteria; this file mirrors status for GSD routing.
