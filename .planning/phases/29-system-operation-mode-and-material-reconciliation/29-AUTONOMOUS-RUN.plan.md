---
phase: 29-system-operation-mode-and-material-reconciliation
artifact: autonomous-run-plan-set
status: executable
process_owner: GSD
production_edits_authorized: false
tracer_mode: true
plans: 10
waves: 6
requirements:
  - OPM-01
  - OPM-02
  - OPM-03
  - OPM-04
  - MRC-01
  - MRC-02
  - MRC-03
  - MRC-04
  - CLR-01
  - CLR-02
  - CLR-03
---

# Phase 29 Autonomous Run Plan

## Objective

Introduce the locked server-authoritative global operation mode, deliver the immutable material-reconciliation workflow from committed menu import through completed historical report/export, remediate project-wide clarity at demonstrated owners, and close with database, API, frontend, headed-browser and documentation evidence.

This file is the sole Phase 29 planning artifact produced by this run. It contains ten executable plan units. Executors must not edit production code until the applicable plan begins, must preserve unrelated worktree changes, must not invoke GitNexus, and must keep GSD as the only owner of planning, checkpoints, verification, evidence registration and state closeout.

## Locked execution rules

1. Read `AGENTS.md`, `MEMORY.md`, `29-SPEC.md`, `29-RESEARCH.md`, `29-CONTEXT.md` and the plan unit being executed before edits.
2. Apply D-01 through D-42 exactly. Deferred ideas in `29-CONTEXT.md` are excluded.
3. Do not reset, seed, restore or re-import an existing lane to manufacture a pass. Use a newly controlled import/batch scope per D-42.
4. Database mutation is permitted only on an approved disposable mutation lane after read-only preflight and rollback checkpoint. Never mutate `ipc_lane1`; promotion to `ipcmanagement` is a separate blocking authorization per D-39.
5. No GitNexus calls: the user explicitly requested none. Production execution uses source/tests and GSD gates.
6. Every code-producing task writes tests first or alongside the implementation. Every task has an automated gate.
7. Browser verification uses headed Google Chrome and exactly `1920×1080`, `1440×900`, `1366×768`, `1365×900`, `1280×900`. Screenshot is reviewer evidence only; verdicts come from semantic DOM, request/response, DB transition, reload rendering, focus and performance JSON.
8. Each plan commits only its declared files. Preserve unrelated user changes. Run `git diff --check` and secret/stub scan before each plan commit.
9. Migration/application and base promotion are separate checkpoints. No executor may infer promotion authority from a passing disposable-lane rehearsal.

## Minimal-wave dependency graph

| Wave | Plan | Objective | Depends on | Autonomous |
|---:|---|---|---|---|
| 1 | 29-01 | DB-safe tracer: persisted mode read/mutate through API with audit | — | No — DB lane/checkpoint |
| 1 | 29-02 | Clarity inventory and executable owner contract | — | Yes |
| 2 | 29-03 | Shared backend mode enforcement and operation registry | 29-01 | Yes |
| 2 | 29-04 | Draft batch creation and transactional ready/freeze authority | 29-01 | Yes |
| 2 | 29-05 | Frontend mode bootstrap, route/nav/preload/action eligibility | 29-01 | Yes |
| 3 | 29-06 | Purchased/issued actuals, revisions, comparison and completion | 29-03, 29-04 | Yes |
| 3 | 29-07 | Shared clarity vocabulary, identifiers, tables and empty states | 29-02, 29-05 | Yes |
| 4 | 29-08 | Weekly Menu/Purchasing/Warehouse/Reports reconciliation UI | 29-05, 29-06, 29-07 | Yes |
| 5 | 29-09 | Full regression, disposable-lane migration and headed E2E evidence | 29-03, 29-04, 29-06, 29-08 | No — DB/browser checkpoints |
| 6 | 29-10 | Evidence registration, requirements/roadmap/state/memory/history closeout | 29-09 | Yes |

Wave 1 has zero file overlap. Wave 2 plans own separate backend domain, frontend routing and batch aggregates. Wave 3 separates backend reconciliation behavior from shared frontend clarity. All user-facing reconciliation work converges in Wave 4; runtime mutation/evidence and closeout remain serialized.

---

# Plan 29-01 — Persisted operation-mode tracer and disposable-lane schema checkpoint

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: false
requirements: [OPM-01, OPM-02]
estimate:
  tokens: 42000
  raw_tokens: 42000
  tasks: 3
  confidence: low
files_modified:
  - backend/src/IPCManagement.Api/Models/Entities/SystemOperationMode.cs
  - backend/src/IPCManagement.Api/Features/SystemOperation/Contracts/SystemOperationModeContracts.cs
  - backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeService.cs
  - backend/src/IPCManagement.Api/Features/SystemOperation/Controllers/SystemOperationModeController.cs
  - backend/src/IPCManagement.Api/Data/IpcManagementContext.cs
  - backend/src/IPCManagement.Api/Migrations/20260825_AddSystemOperationModeAndReconciliation.cs
  - backend/src/IPCManagement.Api/Migrations/20260825_AddSystemOperationModeAndReconciliation.Designer.cs
  - backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs
  - backend/tests/IPCManagement.Api.Tests/SystemOperationModeIntegrationTests.cs
  - tools/database/phase29-operation-mode-preflight.sql
  - tools/database/phase29-operation-mode-postflight.sql
```

## must_haves

### truths
- D-01/D-02: every authenticated user reads the same validated singleton mode and version; missing, duplicate or invalid persisted authority fails closed.
- D-03: only Admin can change mode with expected-version concurrency, explicit confirmation and server-decided reason requirement when active work exists.
- Mode mutation persists old/new value, actor, timestamp and reason without deleting or rewriting workflow data.

### artifacts
- `SystemOperationMode` singleton entity and migration with stable `DEFAULT`/`MATERIAL_RECONCILIATION` values and concurrency token.
- Authenticated read and Admin-only mutation contracts.
- Read-only preflight/postflight scripts proving singleton validity, audit and unchanged business-table counts.

### key_links
- Controller → `SystemOperationModeService` → `IpcManagementContext` transaction.
- Mode mutation → existing `AuditLog` with old/new/actor/time/reason.
- Migration → startup/read service fail-closed validation.

<tasks>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 1: Authorize the disposable database lane and rollback checkpoint</name>
  <what-built>No database changes yet. The executor has inspected current branch status, `MEMORY.md`, Shipyard manifest, target lane identity, migration history and generated SQL.</what-built>
  <how-to-verify>Confirm the selected target is an approved disposable mutation lane, is not `ipc_lane1` or operational base, has a named rollback checkpoint/backup, and generated SQL contains no `USE`, database create/drop, table drop, destructive backfill or unrelated data mutation.</how-to-verify>
  <resume-signal>Type `approved disposable lane` with the lane name and checkpoint identifier.</resume-signal>
</task>

<task type="tracer" tdd="true">
  <name>Task 2: End-to-end persisted mode read and Admin mutation</name>
  <precondition>The approved disposable lane and rollback checkpoint from Task 1 exist and the API can reach that lane.</precondition>
  <reversibility rating="one-way">Per D-01, changing this persisted singleton and public read/mutation contract later requires migration and coordinated client changes.</reversibility>
  <files>backend/src/IPCManagement.Api/Models/Entities/SystemOperationMode.cs, backend/src/IPCManagement.Api/Features/SystemOperation/Contracts/SystemOperationModeContracts.cs, backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeService.cs, backend/src/IPCManagement.Api/Features/SystemOperation/Controllers/SystemOperationModeController.cs, backend/src/IPCManagement.Api/Data/IpcManagementContext.cs, backend/src/IPCManagement.Api/Migrations/20260825_AddSystemOperationModeAndReconciliation.cs, backend/src/IPCManagement.Api/Migrations/20260825_AddSystemOperationModeAndReconciliation.Designer.cs, backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs, backend/tests/IPCManagement.Api.Tests/SystemOperationModeIntegrationTests.cs</files>
  <behavior>
- Authenticated read returns stable token, Vietnamese label, concurrency version, updated timestamp and no browser-derived override per D-01/D-02.
- Non-Admin mutation is denied; Admin mutation requires confirmation and expected version per D-03.
- Active-work detection is server-owned; a missing reason is rejected only when the server reports work in progress.
- A stale expected version fails with a user-language conflict and leaves mode/audit unchanged.
- Missing, duplicate or invalid singleton rows fail closed rather than choosing `DEFAULT`.
  </behavior>
  <action>Write the failing integration tests first. Add one singleton row contract and exact validation. Implement authenticated GET plus Admin PUT/PATCH through one transactional service that re-reads and locks the singleton, evaluates work-in-progress, validates expected version, changes the stable token, and appends an existing-format `AuditLog`. Keep UI labels `Mặc định` and `Đối chiếu nguyên liệu`; do not expose internal tokens in normal user copy. Do not use deployment configuration or browser state as authority. This is the Phase tracer: one Admin can change the real persisted mode and another authenticated request reads it back end-to-end.</action>
  <verify><automated>dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~SystemOperationModeIntegrationTests --no-restore</automated></verify>
  <done>Mode read/mutation works end-to-end on the disposable lane; singleton validation, authorization, concurrency, work-in-progress reason and audit tests pass.</done>
</task>

<task type="auto">
  <name>Task 3: Seal migration preflight/postflight and rollback evidence</name>
  <files>tools/database/phase29-operation-mode-preflight.sql, tools/database/phase29-operation-mode-postflight.sql</files>
  <action>Create read-only scripts that record migration history, exact singleton cardinality/value/version, audit rows and row counts for menu, procurement, receipt, issue, movement, lot, snapshot and current-stock authorities. Run preflight, apply the reviewed migration once, run model-pending check and postflight, then prove unrelated business counts and identities are unchanged. Record rollback as checkpoint restore or additive feature-off; do not create a destructive down path for append-only reconciliation history.</action>
  <verify><automated>dotnet ef migrations has-pending-model-changes --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj --startup-project backend/src/IPCManagement.Api/IPCManagement.Api.csproj && dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~SystemOperationModeIntegrationTests|FullyQualifiedName~MigrationHealthCheckTests" --no-restore</automated></verify>
  <done>Disposable-lane migration and postflight pass, rollback checkpoint remains available, and no unrelated workflow or stock authority changed.</done>
</task>

</tasks>

## Threat model

| Threat | Severity | Disposition | Mitigation |
|---|---|---|---|
| Tampering with global mode | high | mitigate | Admin policy, server validation, expected-version transaction and audit |
| Stale concurrent mode overwrite | high | mitigate | concurrency token and locked transactional re-read |
| Invalid/multiple authority fallback | high | mitigate | fail-closed exact singleton cardinality/value validation |
| Destructive migration or wrong lane | critical | mitigate | blocking lane checkpoint, SQL review, pre/postflight and rollback checkpoint |

---

# Plan 29-02 — Clarity and action-owner inventory

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 02
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [CLR-01, CLR-02, CLR-03, OPM-04]
estimate:
  tokens: 26000
  raw_tokens: 26000
  tasks: 2
  confidence: low
files_modified:
  - frontend/tests/phase29ClarityInventory.ts
  - frontend/tests/phase29ClarityInventory.test.ts
  - frontend/tests/phase29ModeActionInventory.ts
  - frontend/tests/phase29ModeActionInventory.test.ts
  - .planning/phases/29-system-operation-mode-and-material-reconciliation/29-CLARITY-INVENTORY.md
```

## must_haves

### truths
- D-34/D-35/D-38: all clarity candidates and retained-route actions are inventoried before production edits and assigned to shared, feature or route-local owners in no more than three owner waves.
- D-10/D-11: retained routes expose an explicit action inventory in both modes; `DEFAULT` behavior is a tested contract.
- Deferred redesign/framework ideas are absent.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Executable mode-action and clarity inventory</name>
  <files>frontend/tests/phase29ClarityInventory.ts, frontend/tests/phase29ClarityInventory.test.ts, frontend/tests/phase29ModeActionInventory.ts, frontend/tests/phase29ModeActionInventory.test.ts</files>
  <behavior>
- Every canonical protected route has mode eligibility and every retained route has action families with existing permission metadata kept separate.
- Candidate clarity rows include route/state/actor/viewport, rule ID, exact selector or source owner, current evidence and lowest owner.
- Known-bad fixtures fail for duplicated state prose, unavailable instructions, raw technical identifiers without full-value access, wrong numeric alignment and ambiguous short codes.
- Known-clean fixtures pass without weakening Phase 27/28 rules.
  </behavior>
  <action>Extend the Phase 27/28 test-owned evidence architecture per D-38. Inventory all routes and retained-route actions, plus project-wide copy/table/empty-state/identifier candidates. Do not edit production UI. Group candidates by D-34 ownership and D-35’s three waves; mark unsupported visual judgments `NEEDS_EVIDENCE` rather than authorizing edits.</action>
  <verify><automated>npm test -w frontend -- --run frontend/tests/phase29ClarityInventory.test.ts frontend/tests/phase29ModeActionInventory.test.ts</automated></verify>
  <done>The executable inventories cover every route/action family and every evidence-backed clarity candidate with one lowest owner and test oracle.</done>
</task>

<task type="auto">
  <name>Task 2: Publish exact implementation handoff</name>
  <files>.planning/phases/29-system-operation-mode-and-material-reconciliation/29-CLARITY-INVENTORY.md</files>
  <action>Generate a human-readable handoff from the executable inventory: `Rule | Route/state/actor | Current evidence | Lowest owner | Planned wave | Test oracle | Disposition`. Include exact action keys that reconciliation mode blocks on retained routes and explicit `DEFAULT` preservation rows. Keep uncertain items as `NEEDS_EVIDENCE`; do not broaden implementation from generic examples in the UI rules.</action>
  <verify><automated>npm test -w frontend -- --run frontend/tests/phase29ClarityInventory.test.ts frontend/tests/phase29ModeActionInventory.test.ts && git diff --check</automated></verify>
  <done>The inventory is complete, mechanically consistent with tests and ready for Plans 29-07/08 without production changes.</done>
</task>

</tasks>

---

# Plan 29-03 — Shared backend mode enforcement

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 03
type: execute
wave: 2
depends_on: [29-01]
autonomous: true
requirements: [OPM-02, OPM-03, OPM-04]
estimate:
  tokens: 38000
  raw_tokens: 38000
  tasks: 2
  confidence: low
files_modified:
  - backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationEligibility.cs
  - backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeGuard.cs
  - backend/src/IPCManagement.Api/Features/SystemOperation/SystemOperationEndpointConvention.cs
  - backend/src/IPCManagement.Api/Program.cs
  - backend/tests/IPCManagement.Api.Tests/SystemOperationEligibilityTests.cs
  - backend/tests/IPCManagement.Api.Tests/SystemOperationRaceIntegrationTests.cs
```

## must_haves

### truths
- D-06/D-08: backend commands and queries consume one operation-key registry/guard; controllers do not scatter mode-token comparisons.
- D-07: every mutation revalidates mode in its transaction immediately before commit.
- D-11: `DEFAULT` is explicitly allowed and regression tested, not an implicit fallback.
- Mode never grants a permission and excluded APIs fail before domain mutation.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: One excluded mutation blocked end-to-end by shared mode policy</name>
  <files>backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationEligibility.cs, backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeGuard.cs, backend/src/IPCManagement.Api/Features/SystemOperation/SystemOperationEndpointConvention.cs, backend/src/IPCManagement.Api/Program.cs, backend/tests/IPCManagement.Api.Tests/SystemOperationEligibilityTests.cs</files>
  <behavior>
- The registry explicitly lists both modes for each operation key and encodes the locked retained/excluded matrix.
- Mode eligibility executes before existing authorization; retained-route permission denials remain permission denials.
- One representative excluded coordination mutation returns the mode-unavailable contract and writes no rows/audit.
- The same mutation remains unchanged in `DEFAULT` for an actor with permission.
  </behavior>
  <action>Write tests first. Add typed operation keys and one shared guard/filter/convention per D-06. Wire one representative excluded command end-to-end as tracer while preserving its existing authorization. Make `DEFAULT` and `MATERIAL_RECONCILIATION` explicit registry values. Return user-language mode-unavailable responses without leaking internal tokens.</action>
  <verify><automated>dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~SystemOperationEligibilityTests --no-restore</automated></verify>
  <done>The tracer operation is blocked in reconciliation mode, allowed only with existing permission in default mode, and shares a reusable enforcement seam.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Complete backend operation matrix and stale-mode race fence</name>
  <files>backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationEligibility.cs, backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeGuard.cs, backend/src/IPCManagement.Api/Features/SystemOperation/SystemOperationEndpointConvention.cs, backend/tests/IPCManagement.Api.Tests/SystemOperationEligibilityTests.cs, backend/tests/IPCManagement.Api.Tests/SystemOperationRaceIntegrationTests.cs</files>
  <behavior>
- Every protected route/action API family has a disposition matching D-08/D-10 and the locked route matrix.
- Retained reconciliation operations still require their current permission.
- A command started under `DEFAULT` but committed after Admin switches modes is rejected/rolled back per D-07.
- Read/query behavior is classified explicitly; login/public health remain available and invalid mode does not silently authorize protected work.
  </behavior>
  <action>Expand registry coverage to all protected operation families and add source-aware coverage tests that fail on unregistered endpoints. Introduce transaction-bound revalidation for mutations rather than trusting request-start or frontend state. Preserve public/auth/health availability while fail-closing protected business operations when persisted authority is invalid.</action>
  <verify><automated>dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~SystemOperationEligibilityTests|FullyQualifiedName~SystemOperationRaceIntegrationTests|FullyQualifiedName~OperationalRegistryCoverageTests" --no-restore</automated></verify>
  <done>Backend mode/permission matrix and race fence are complete with no unregistered protected operation family.</done>
</task>

</tasks>

---

# Plan 29-04 — Import-owned draft batch and immutable readiness

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 04
type: execute
wave: 2
depends_on: [29-01]
autonomous: true
requirements: [MRC-01, MRC-02]
estimate:
  tokens: 44000
  raw_tokens: 44000
  tasks: 3
  confidence: low
files_modified:
  - backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatch.cs
  - backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatchLine.cs
  - backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatchContributor.cs
  - backend/src/IPCManagement.Api/Models/Entities/ReconciliationTolerance.cs
  - backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs
  - backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationBatchesController.cs
  - backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportPersistence.cs
  - backend/tests/IPCManagement.Api.Tests/ReconciliationBatchLifecycleTests.cs
  - backend/tests/IPCManagement.Api.Tests/WeeklyMenuReconciliationBatchTests.cs
```

## must_haves

### truths
- D-12/D-13: each successful committed import creates one distinct `DRAFT`; preview/failure creates none and reimport never reuses a batch.
- D-14/D-15/D-16/D-18: `Sẵn sàng đối chiếu` transaction freezes non-empty resolved lines at `(batchId, ingredientId, canonicalUnitId)`, contributors and exact tolerance source/value/version.
- D-17: ready/completed historical authority cannot be rewritten by later menu/BOM/unit/tolerance edits.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Committed import creates one draft reconciliation batch</name>
  <files>backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatch.cs, backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportPersistence.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationBatchesController.cs, backend/tests/IPCManagement.Api.Tests/WeeklyMenuReconciliationBatchTests.cs</files>
  <behavior>
- One successful committed import writes one new draft linked to menu version/import and meal-quantity source scope.
- Two committed imports produce different batch IDs.
- Preview, validation failure and rolled-back import write no batch.
- Batch creation participates in the import transaction and preserves default-workflow behavior.
  </behavior>
  <action>Write integration tests first. Hook batch creation only into the successful commit path after the menu version identity exists, within the same transaction. Store source identities; do not invoke mutable `MaterialDemandService` as historical authority and do not create production plans, material requests or stock reservations.</action>
  <verify><automated>dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~WeeklyMenuReconciliationBatchTests|FullyQualifiedName~WeeklyMenuImportBatchTests" --no-restore</automated></verify>
  <done>Committed import creates exactly one independently identified draft; preview/failure produces zero authoritative batch.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Transactional ready/freeze at canonical identity grain</name>
  <reversibility rating="one-way">Per D-14, frozen line, contributor and tolerance wire/storage contracts cannot later be recomputed without violating immutable history.</reversibility>
  <files>backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatchLine.cs, backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatchContributor.cs, backend/src/IPCManagement.Api/Models/Entities/ReconciliationTolerance.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationBatchesController.cs, backend/tests/IPCManagement.Api.Tests/ReconciliationBatchLifecycleTests.cs</files>
  <behavior>
- Readiness rejects empty input, missing BOM, unresolved ingredient, unresolved canonical unit and zero valid lines.
- Same-name ingredient IDs remain separate; duplicate contributors aggregate only by ingredient ID plus canonical-unit ID and remain drill-down queryable.
- Tolerance precedence is ingredient override, canonical unit-group override, then system default; selected source kind/identity/version/value freeze per line.
- Ready confirmation transitions `DRAFT` to `READY` once and stale confirmation is rejected.
  </behavior>
  <action>Implement the single ready transaction per D-14. Resolve contributors from menu/import/meal-quantity/BOM source identities, calculate exact canonical-unit required decimals without auto-normalizing unresolved legacy units, persist line uniqueness and child contributors, select tolerance precedence per D-18, and freeze everything before changing status. Use source IDs, never names, for identity or aggregation.</action>
  <verify><automated>dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~ReconciliationBatchLifecycleTests --no-restore</automated></verify>
  <done>Valid drafts freeze once into immutable ready authority; every invalid identity/unit/empty edge fails without partial lines.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Prove frozen history survives source and tolerance changes</name>
  <files>backend/tests/IPCManagement.Api.Tests/ReconciliationBatchLifecycleTests.cs</files>
  <behavior>
- After ready, edits to menu, BOM, unit metadata and tolerance configuration do not alter stored required quantity, canonical unit, contributor set or tolerance bytes/decimals.
- Reimport creates a new draft and leaves the older ready batch unchanged.
- Completed batch cannot reopen; correction requires a new batch/version.
  </behavior>
  <action>Add immutable-history regression fixtures using two source versions and colliding ingredient names. Assert exact persisted decimal and identity values before/after source changes; do not compare only formatted DTO text.</action>
  <verify><automated>dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationBatchLifecycleTests&Name~Immutable" --no-restore</automated></verify>
  <done>Historical batch authority remains byte/decimal-equivalent after all locked source/config changes.</done>
</task>

</tasks>

---

# Plan 29-05 — Frontend mode bootstrap, matrix and safe relocation

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 05
type: execute
wave: 2
depends_on: [29-01]
autonomous: true
requirements: [OPM-01, OPM-02, OPM-03, OPM-04]
estimate:
  tokens: 42000
  raw_tokens: 42000
  tasks: 3
  confidence: low
files_modified:
  - frontend/src/features/system-operation/systemOperationApi.ts
  - frontend/src/features/system-operation/systemOperationEligibility.ts
  - frontend/src/features/system-operation/SystemOperationProvider.tsx
  - frontend/src/features/system-operation/ModeUnavailable.tsx
  - frontend/src/features/admin/components/AdvancedDisplaySettings.tsx
  - frontend/src/app/layout/MainLayout.tsx
  - frontend/src/routes/AppRouter.tsx
  - frontend/src/routes/routeLoaders.ts
  - frontend/src/routes/routeDataPreloaders.ts
  - frontend/src/api/apiSlice.ts
  - frontend/src/features/system-operation/systemOperationEligibility.test.ts
  - frontend/src/routes/systemOperationRouting.test.tsx
```

## must_haves

### truths
- D-04/D-30: boot reads mode through the existing `apiSlice`; shell shows passive context to all users and only Admin Advanced Settings exposes mutation.
- D-05/D-09: excluded direct routes show exactly “Chức năng này không sử dụng trong chế độ Đối chiếu nguyên liệu.” and active users relocate to Dashboard/first retained permitted route without redirect loops.
- D-08/D-10/D-11: navigation, direct routes, route bundle/data preload and route-owned actions use one typed mode registry before separate permission checks; `DEFAULT` preserves current behavior.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Boot mode and block one excluded route without preload</name>
  <files>frontend/src/features/system-operation/systemOperationApi.ts, frontend/src/features/system-operation/systemOperationEligibility.ts, frontend/src/features/system-operation/SystemOperationProvider.tsx, frontend/src/features/system-operation/ModeUnavailable.tsx, frontend/src/routes/AppRouter.tsx, frontend/src/routes/routeDataPreloaders.ts, frontend/src/api/apiSlice.ts, frontend/src/features/system-operation/systemOperationEligibility.test.ts, frontend/src/routes/systemOperationRouting.test.tsx</files>
  <behavior>
- Authenticated shell obtains persisted mode via an injected endpoint on the existing API reducer/cache.
- Direct access to one excluded route renders the exact locked message in-shell, not `/403`.
- Excluded intent does not import the route bundle or call its data preloader.
- Retained route still passes to existing `RoleGuard`, proving mode does not grant permission.
  </behavior>
  <action>Write route/query tests first. Add a typed frontend registry with stable tokens and labels, inject mode endpoints into existing `apiSlice`, and compose a mode guard outside/above permission routing. Implement the exact unavailable region and prevent both component and data preload for excluded routes. Do not reset the reducer, reload the document or read local/session storage.</action>
  <verify><automated>npm test -w frontend -- --run frontend/src/features/system-operation/systemOperationEligibility.test.ts frontend/src/routes/systemOperationRouting.test.tsx frontend/src/routes/routeDataPreloaders.test.ts</automated></verify>
  <done>One excluded route is blocked across direct route and preload while retained permission behavior remains intact.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Complete route/navigation/action matrix and safe relocation</name>
  <files>frontend/src/features/system-operation/systemOperationEligibility.ts, frontend/src/features/system-operation/SystemOperationProvider.tsx, frontend/src/app/layout/MainLayout.tsx, frontend/src/routes/AppRouter.tsx, frontend/src/routes/routeLoaders.ts, frontend/src/routes/routeDataPreloaders.ts, frontend/src/features/system-operation/systemOperationEligibility.test.ts, frontend/src/routes/systemOperationRouting.test.tsx</files>
  <behavior>
- Reconciliation mode retains Dashboard, Weekly Menu, Purchasing, Warehouse, Reports, Admin Data and Admin-only Advanced Settings; excludes Coordination, Approvals, Chef Dashboard and Approval Rules for all roles.
- Route-owned default-workflow actions on retained pages are explicitly blocked/hidden without affecting permitted reconciliation actions.
- On mode invalidation, a user on a newly excluded route relocates to Dashboard if permitted, otherwise first retained permitted route, otherwise a non-looping safe unavailable shell.
- `DEFAULT` route/navigation/preload/action snapshots match current contracts.
  </behavior>
  <action>Consume the exact Plan 29-02 action inventory and complete the typed matrix per D-08/D-10. Evaluate mode before permission while keeping permission metadata independent. Implement safe relocation per D-05 and zero unauthorized intent preload/query. Keep canonical route constants and lazy-load architecture.</action>
  <verify><automated>npm test -w frontend -- --run frontend/src/features/system-operation/systemOperationEligibility.test.ts frontend/src/routes/systemOperationRouting.test.tsx frontend/src/routes/routeDataPreloaders.test.ts frontend/tests/route-smoke.preserved-routes.spec.ts</automated></verify>
  <done>Every protected route and action family has exact role×mode behavior with default-path regression coverage.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Admin mode control and passive shell context</name>
  <files>frontend/src/features/admin/components/AdvancedDisplaySettings.tsx, frontend/src/features/system-operation/systemOperationApi.ts, frontend/src/app/layout/MainLayout.tsx, frontend/src/routes/systemOperationRouting.test.tsx</files>
  <behavior>
- All authenticated users see passive Vietnamese current-mode context; only Admin sees the switch in Advanced Settings.
- Mutation confirmation includes expected version and conditionally required reason from server work-in-progress response.
- Success invalidates only mode/configuration and dependent eligibility tags; no document reload or broad API reset.
- Conflict displays current server value and requires reload/review.
  </behavior>
  <action>Place the control in the existing Advanced Settings owner per D-30. Use one focused confirmation dialog; show stable user labels only. Invalidate exact tags per D-04, preserve query cache identity, and let provider relocation react to the new server readback.</action>
  <verify><automated>npm test -w frontend -- --run frontend/src/routes/systemOperationRouting.test.tsx frontend/src/features/admin/components/AdvancedDisplaySettings.test.tsx frontend/src/api/apiSlice.requestDeduplication.test.ts</automated></verify>
  <done>Admin can safely change mode and all users observe passive context without reload or cache reset.</done>
</task>

</tasks>

---

# Plan 29-06 — Actuals, revisions, exact comparisons, dispositions and completion

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 06
type: tdd
wave: 3
depends_on: [29-03, 29-04]
autonomous: true
requirements: [MRC-02, MRC-03, MRC-04]
estimate:
  tokens: 47000
  raw_tokens: 47000
  tasks: 3
  confidence: low
files_modified:
  - backend/src/IPCManagement.Api/Models/Entities/ReconciliationActual.cs
  - backend/src/IPCManagement.Api/Models/Entities/ReconciliationActualRevision.cs
  - backend/src/IPCManagement.Api/Models/Entities/ReconciliationDisposition.cs
  - backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationActualService.cs
  - backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationComparisonService.cs
  - backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationCompletionService.cs
  - backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationActualsController.cs
  - backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationReportsController.cs
  - backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs
  - backend/tests/IPCManagement.Api.Tests/ReconciliationActualTests.cs
  - backend/tests/IPCManagement.Api.Tests/ReconciliationComparisonTests.cs
  - backend/tests/IPCManagement.Api.Tests/ReconciliationCompletionTests.cs
  - backend/tests/IPCManagement.Api.Tests/ReconciliationStockIsolationTests.cs
```

## must_haves

### truths
- D-22..D-26: Purchasing and Warehouse own separate exact canonical-unit actuals; initial entry/correction is versioned, explicit zero is valid, stale writes conflict, and no procurement/warehouse/stock authority mutates.
- D-19..D-21: exact signed purchase variance, issue variance and flow gap are stored/projected; only absolute `>` frozen tolerance is exceptional, with triggering comparison names and stable exception-first ordering.
- D-27..D-29: exceptional lines require centralized category plus reason; completion transaction rechecks all lines and freezes immutable report/export with full IDs/provenance.

<feature>
  <name>Audited reconciliation actual and completion domain</name>
  <files>backend reconciliation entities/services/controllers/contracts and four focused test files listed above</files>
  <behavior>
- Purchased entry requires purchasing permission; issued entry requires warehouse permission; Admin status alone bypasses neither.
- First actual transitions `READY` to `IN_PROGRESS`; correction appends old/new/actor/time/reason and increments side version.
- Null is missing, explicit decimal zero is present; stale side version fails without revision loss.
- Positive, negative, zero and equality-at-tolerance fixtures preserve exact decimals; equality is `Khớp`, strict greater-than is `Cần kiểm tra`.
- A line is exceptional when any of three comparisons exceeds tolerance and reports each trigger.
- Completion rejects empty batch, missing side, unresolved exceptional disposition, empty reason or stale version; success records actor/time and rejects later mutations.
- Actual entry changes no PR, PO, receipt, issue, movement, lot, snapshot or current-stock row/value.
  </behavior>
  <implementation>Implement separate side-owned actual projections and append-only revisions, centralized disposition vocabulary, pure decimal comparison service, exception-first stable query ordering, transactional completion and historical full-ID CSV/export contract. Revalidate mode and permission in each mutation transaction. Do not derive actuals from existing procurement/stock documents.</implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED/GREEN purchased and issued actual entry with revisions</name>
  <files>backend/src/IPCManagement.Api/Models/Entities/ReconciliationActual.cs, backend/src/IPCManagement.Api/Models/Entities/ReconciliationActualRevision.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationActualService.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationActualsController.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs, backend/tests/IPCManagement.Api.Tests/ReconciliationActualTests.cs</files>
  <behavior>
- Separate side permissions, exact quantity, explicit zero confirmation, actor/time/version and append-only correction reason.
- First actual changes `READY` to `IN_PROGRESS`; completed batch rejects mutation.
- Concurrent stale corrections yield one accepted revision and one conflict, never silent overwrite.
  </behavior>
  <action>Write failing tests, implement the smallest domain/service/controller behavior that passes, then refactor shared side logic without merging permissions or records. Return user-language conflicts with current server quantity/version.</action>
  <verify><automated>dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~ReconciliationActualTests --no-restore</automated></verify>
  <done>Both role-owned sides support audited entry/correction and reject stale/completed writes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: RED/GREEN exact comparison, ordering and disposition</name>
  <files>backend/src/IPCManagement.Api/Models/Entities/ReconciliationDisposition.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationComparisonService.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationReportsController.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs, backend/tests/IPCManagement.Api.Tests/ReconciliationComparisonTests.cs</files>
  <behavior>
- Exact three signed differences for shortage, surplus, zero and equality boundary.
- Strict greater-than frozen tolerance marks exception; each triggering comparison is named.
- Ordering is unresolved exceptions, resolved exceptions, within-tolerance, then stable ingredient label/identity.
- `Hiện tất cả` alters filtering only and never stored status.
- Disposition category is centralized and requires non-empty human reason.
  </behavior>
  <action>Build comparison as deterministic decimal domain logic and expose paged report/history projections. Preserve full source IDs and contributor drill-down. Keep display formatting outside verdict calculation.</action>
  <verify><automated>dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~ReconciliationComparisonTests --no-restore</automated></verify>
  <done>Comparison and disposition semantics pass every numeric boundary and stable-order fixture.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: RED/GREEN transactional completion, export and stock-isolation proof</name>
  <files>backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationCompletionService.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationReportsController.cs, backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs, backend/tests/IPCManagement.Api.Tests/ReconciliationCompletionTests.cs, backend/tests/IPCManagement.Api.Tests/ReconciliationStockIsolationTests.cs</files>
  <behavior>
- Completion rechecks non-empty line set, purchased/issued presence, dispositions, reasons and versions in one transaction.
- Success records completion actor/time and exposes immutable report/export with full IDs/provenance.
- Before/after DB inventory proves zero reconciliation-caused procurement, receipt, issue, movement, lot, snapshot and current-stock mutation.
  </behavior>
  <action>Implement completion transaction and CSV/export projection. Add database before/after assertions over every prohibited table/value family from D-26 and SPEC prohibitions; do not rely on mocked repositories for the isolation proof.</action>
  <verify><automated>dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationCompletionTests|FullyQualifiedName~ReconciliationStockIsolationTests" --no-restore</automated></verify>
  <done>A complete batch is meaningful, immutable and historically exportable, with zero stock/procurement side effects.</done>
</task>

</tasks>

---

# Plan 29-07 — Shared clarity seams

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 07
type: execute
wave: 3
depends_on: [29-02, 29-05]
autonomous: true
requirements: [CLR-01, CLR-02, CLR-03]
estimate:
  tokens: 40000
  raw_tokens: 40000
  tasks: 3
  confidence: low
files_modified:
  - frontend/src/lib/workflowConfig.ts
  - frontend/src/lib/formatters.ts
  - frontend/src/components/ui/QueryView.tsx
  - frontend/src/components/ui/table.tsx
  - frontend/src/components/ui/OperationalIdentifier.tsx
  - frontend/src/features/reports/pages/ReportEmptyRow.tsx
  - frontend/tests/phase29ClarityInventory.ts
  - frontend/tests/phase29ClarityInventory.test.ts
  - frontend/tests/ui-audit-remediation.spec.ts
```

## must_haves

### truths
- D-34/D-35: shared vocabulary/identifier/table/query owners are corrected before feature and route residue.
- D-36: shortened IDs are recognizable, collision-safe and retain inspect/copy/full-value search; raw API/export/audit IDs are unchanged.
- D-37: initial absence, filtered absence, load error and permission/mode unavailable remain distinct, with one authorized next action at most.
- D-38: existing Phase 27/28 harness gains known-bad/known-clean coverage; no second scanner/framework appears.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Collision-safe operational identifier end-to-end in one table</name>
  <files>frontend/src/components/ui/OperationalIdentifier.tsx, frontend/src/lib/formatters.ts, frontend/src/features/reports/pages/ReportEmptyRow.tsx, frontend/tests/phase29ClarityInventory.test.ts</files>
  <behavior>
- Structured ID renders recognizable Vietnamese document type and shortest collision-safe distinguishing segment.
- Full value is inspectable, keyboard-copyable and searchable; two colliding suffixes expand until distinct or show full value.
- API model/export input remains byte-identical.
  </behavior>
  <action>Write known-bad/collision tests first, create one shared identifier owner and wire one existing report table as the tracer. Do not alter raw IDs or create route-local truncation helpers. Ensure accessible naming and copy feedback.</action>
  <verify><automated>npm test -w frontend -- --run frontend/tests/phase29ClarityInventory.test.ts</automated></verify>
  <done>One real table uses collision-safe concise identity with complete inspect/copy/search access.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Shared vocabulary, query-state and table decision contracts</name>
  <files>frontend/src/lib/workflowConfig.ts, frontend/src/lib/formatters.ts, frontend/src/components/ui/QueryView.tsx, frontend/src/components/ui/table.tsx, frontend/src/features/reports/pages/ReportEmptyRow.tsx, frontend/tests/phase29ClarityInventory.test.ts</files>
  <behavior>
- Internal tokens/enums map through centralized Vietnamese vocabulary.
- Corrected regions expose one state message and zero/one authorized action; load error and permission/mode state cannot render as empty.
- Text aligns left, numeric decimals right with tabular digits, units move to header when invariant, technical audit detail uses progressive disclosure.
- Decision-bearing columns remain visible before low-priority technical fields.
  </behavior>
  <action>Apply only inventory-proven shared rows. Extend existing workflow vocabulary, formatters, query boundary and table primitives; do not create parallel components. Preserve loading/stale/error/permission distinctions and Phase 28 geometry contracts.</action>
  <verify><automated>npm test -w frontend -- --run frontend/tests/phase29ClarityInventory.test.ts && npm run test:ui-measurements -w frontend</automated></verify>
  <done>Shared clarity seams satisfy semantic and geometry tests without weakening existing thresholds.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Consume shared owners across exact inventory callsites</name>
  <files>frontend/tests/phase29ClarityInventory.ts, frontend/tests/phase29ClarityInventory.test.ts, frontend/tests/ui-audit-remediation.spec.ts</files>
  <action>Update the executable inventory to require every shared-owned candidate to import/use the canonical owner. Add source-aware closure assertions and known-clean fixtures. Leave feature/route-local rows for Plan 29-08; do not classify unsupported candidates as fixed.</action>
  <verify><automated>npm test -w frontend -- --run frontend/tests/phase29ClarityInventory.test.ts && npm run test:ui-measurements -w frontend</automated></verify>
  <done>Shared-owner rows are closed mechanically and remaining rows have exact feature/route owners.</done>
</task>

</tasks>

---

# Plan 29-08 — Reconciliation work-area UI and route residue

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 08
type: execute
wave: 4
depends_on: [29-05, 29-06, 29-07]
autonomous: true
requirements: [MRC-01, MRC-02, MRC-03, MRC-04, CLR-01, CLR-02, CLR-03]
estimate:
  tokens: 48000
  raw_tokens: 48000
  tasks: 3
  confidence: low
files_modified:
  - frontend/src/features/reconciliation/reconciliationApi.ts
  - frontend/src/features/reconciliation/ReconciliationBatchTable.tsx
  - frontend/src/features/reconciliation/ReconciliationActualDrawer.tsx
  - frontend/src/features/reconciliation/ReconciliationComparisonTable.tsx
  - frontend/src/features/projects/weekly-menu/reconciliation/WeeklyMenuReconciliationPanel.tsx
  - frontend/src/features/purchasing/reconciliation/PurchasingReconciliationPanel.tsx
  - frontend/src/features/warehouse/reconciliation/WarehouseReconciliationPanel.tsx
  - frontend/src/features/reports/reconciliation/ReconciliationReportsPanel.tsx
  - frontend/src/features/projects/pages/WeeklyMenuPage.tsx
  - frontend/src/features/purchasing/pages/PurchasingPage.tsx
  - frontend/src/features/warehouse/pages/WarehousePage.tsx
  - frontend/src/features/reports/pages/ReportsPage.tsx
  - frontend/src/features/reconciliation/reconciliationFlow.test.tsx
  - frontend/tests/phase29ClarityInventory.test.ts
```

## must_haves

### truths
- D-31/D-32: reconciliation appears inside Weekly Menu, Purchasing, Warehouse and Reports using existing tabs/query boundaries/tables/dialogs/drawers, not parallel top-level routes or a new component framework.
- D-33: readiness and completion use focused confirmation dialogs; entry/correction uses one page-level drawer, including deliberate zero confirmation and stale-conflict review.
- Users can create/read draft diagnostics, mark ready, enter role-owned actuals, see exact comparison triggers, disposition exceptions, complete, inspect history and export full provenance.
- Route-local clarity residue closes at demonstrated owners while `DEFAULT` business behavior remains intact.

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: End-to-end one-line reconciliation user path</name>
  <files>frontend/src/features/reconciliation/reconciliationApi.ts, frontend/src/features/reconciliation/ReconciliationBatchTable.tsx, frontend/src/features/reconciliation/ReconciliationActualDrawer.tsx, frontend/src/features/reconciliation/ReconciliationComparisonTable.tsx, frontend/src/features/projects/weekly-menu/reconciliation/WeeklyMenuReconciliationPanel.tsx, frontend/src/features/purchasing/reconciliation/PurchasingReconciliationPanel.tsx, frontend/src/features/warehouse/reconciliation/WarehouseReconciliationPanel.tsx, frontend/src/features/reports/reconciliation/ReconciliationReportsPanel.tsx, frontend/src/features/reconciliation/reconciliationFlow.test.tsx</files>
  <behavior>
- Weekly Menu displays committed draft diagnostics and “Sẵn sàng đối chiếu”; ready batch becomes available in role-owned Purchasing/Warehouse work areas.
- Purchasing enters purchased actual, Warehouse enters issued actual, Reports displays required/purchased/issued and all exact differences with `Khớp`/`Cần kiểm tra` triggers.
- One page-level drawer handles entry/correction; explicit zero requires deliberate confirmation and null remains missing.
- RTK Query uses the existing reducer and exact invalidation tags.
  </behavior>
  <action>Write the integration component test first with real endpoint contracts. Implement the thinnest production-quality one-line path across all four retained work areas. Reuse current primitives and keep permissions/mode eligibility independent. Do not create top-level routes or infer actuals from procurement/stock APIs.</action>
  <verify><automated>npm test -w frontend -- --run frontend/src/features/reconciliation/reconciliationFlow.test.tsx</automated></verify>
  <done>A permitted user can traverse one real batch line from draft readiness to exact comparison across retained work areas.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Complete lifecycle, correction, exception, history and export UX</name>
  <files>frontend/src/features/reconciliation/ReconciliationBatchTable.tsx, frontend/src/features/reconciliation/ReconciliationActualDrawer.tsx, frontend/src/features/reconciliation/ReconciliationComparisonTable.tsx, frontend/src/features/projects/weekly-menu/reconciliation/WeeklyMenuReconciliationPanel.tsx, frontend/src/features/purchasing/reconciliation/PurchasingReconciliationPanel.tsx, frontend/src/features/warehouse/reconciliation/WarehouseReconciliationPanel.tsx, frontend/src/features/reports/reconciliation/ReconciliationReportsPanel.tsx, frontend/src/features/reconciliation/reconciliationFlow.test.tsx</files>
  <behavior>
- Diagnostics block readiness clearly; contributor drill-down preserves source identities.
- Correction requires reason and expected version; stale conflict shows current server value and asks reload/review.
- Default report orders unresolved/resolved exceptions before matches; `Hiện tất cả` is secondary.
- Completion dialog reports every missing actual/disposition and completed history rejects controls.
- Export contains full raw IDs/provenance while visible IDs use shared collision-safe presentation.
  </behavior>
  <action>Expand the tracer through all lifecycle states and error/query states. Use focused readiness/completion dialogs and a single page-level drawer per D-33. Preserve exact differences and trigger names beside dispositions. Add accessibility/focus-return tests.</action>
  <verify><automated>npm test -w frontend -- --run frontend/src/features/reconciliation/reconciliationFlow.test.tsx frontend/src/features/reports/pages/reportCsv.test.ts</automated></verify>
  <done>All locked reconciliation states, concurrency conflicts, completion blockers, history and export are user-operable and tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire retained pages and close feature/route clarity residue</name>
  <files>frontend/src/features/projects/pages/WeeklyMenuPage.tsx, frontend/src/features/purchasing/pages/PurchasingPage.tsx, frontend/src/features/warehouse/pages/WarehousePage.tsx, frontend/src/features/reports/pages/ReportsPage.tsx, frontend/tests/phase29ClarityInventory.test.ts</files>
  <action>Add reconciliation tabs/sections only in their locked retained work areas and condition them through the typed mode/action registry. Apply Plan 29-02 route-local clarity rows at their exact lowest owners: remove duplicate prose, unavailable instructions and low-priority technical clutter while preserving query meanings, business values and full identity access. Do not change excluded routes merely to hide them.</action>
  <verify><automated>npm test -w frontend -- --run frontend/src/features/reconciliation/reconciliationFlow.test.tsx frontend/tests/phase29ClarityInventory.test.ts frontend/src/features/purchasing/pages/PurchasingPage.state.test.tsx frontend/src/features/warehouse/pages/WarehousePage.presentation.test.ts frontend/src/features/reports/pages/ReportsPage.permissions.test.tsx</automated></verify>
  <done>All four retained work areas expose correct mode-owned UI and every authorized clarity inventory row is closed.</done>
</task>

</tasks>

---

# Plan 29-09 — Full verification, database checkpoint and headed evidence

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 09
type: execute
wave: 5
depends_on: [29-03, 29-04, 29-06, 29-08]
autonomous: false
requirements: [OPM-01, OPM-02, OPM-03, OPM-04, MRC-01, MRC-02, MRC-03, MRC-04, CLR-01, CLR-02, CLR-03]
estimate:
  tokens: 46000
  raw_tokens: 46000
  tasks: 3
  confidence: low
files_modified:
  - frontend/src/shared/api/contracts/openapi.json
  - frontend/src/types/generatedApi.ts
  - frontend/tests/phase29-system-operation-reconciliation.spec.ts
  - tools/e2e/phase29-system-operation-reconciliation.mjs
  - tools/database/phase29-reconciliation-postflight.sql
  - .artifacts/shipyard-live/phase29-system-operation-reconciliation/manifest.json
  - .planning/phases/29-system-operation-mode-and-material-reconciliation/29-VERIFICATION.md
```

## must_haves

### truths
- D-39/D-40: generated contracts, focused/full tests, migration/model, architecture/hygiene, disposable-lane postflight and browser evidence all pass before closeout.
- D-41: two simultaneous role sessions prove Admin mode change, another user relocation, request behavior and persisted/audited mode.
- D-42: a newly controlled import/batch scope proves complete reconciliation without resetting/reusing ambiguous historical data.
- Browser evidence covers semantic DOM/API/DB/reload/performance at all five viewports; screenshot alone grants no verdict.

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Regenerate contracts and run complete static/regression gates</name>
  <files>frontend/src/shared/api/contracts/openapi.json, frontend/src/types/generatedApi.ts, frontend/tests/phase29-system-operation-reconciliation.spec.ts</files>
  <action>Regenerate OpenAPI and frontend types from current backend. Add source-contract tests for stable tokens, Vietnamese labels, exact route matrix, full ID export and no duplicate API reducer. Run focused Phase 29 suites, complete backend tests, complete frontend tests serially, lint, dependency-cruiser, architecture, backend build, frontend production build, migration pending-model check, UI measurement and hygiene. Do not alter thresholds/baselines to pass.</action>
  <verify><automated>dotnet test backend/IPCManagement.sln --no-restore && npm test -w frontend -- --runInBand && npm run lint -w frontend && npm run dependency:check -w frontend && npm run build -w frontend && dotnet build backend/IPCManagement.sln --no-restore && dotnet ef migrations has-pending-model-changes --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj --startup-project backend/src/IPCManagement.Api/IPCManagement.Api.csproj && npm run test:ui-measurements -w frontend</automated></verify>
  <done>Generated parity and every required automated project gate pass without weakened contracts.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking-human">
  <name>Task 2: Authorize controlled E2E mutation and verify rollback readiness</name>
  <what-built>The executor has a fresh run-id, approved disposable lane candidate, source-backed runtime plan, controlled import scope, DB preflight, rollback checkpoint and no-writer ownership proof.</what-built>
  <how-to-verify>Confirm the lane is disposable and not protected/base, the controlled week/customer/import scope is new and read-only-preflight clean, credentials come from `MEMORY.md` environment names, the rollback checkpoint is named, and only run-owned API/frontend/Chrome processes will be touched.</how-to-verify>
  <resume-signal>Type `approved phase29 e2e` with lane, run-id and checkpoint identifier.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Execute two-session headed role×mode and reconciliation evidence</name>
  <precondition>The Task 2 lane/run/checkpoint authorization is present; source-backed `/health/ready` proves the exact approved database and current migrations.</precondition>
  <files>frontend/tests/phase29-system-operation-reconciliation.spec.ts, tools/e2e/phase29-system-operation-reconciliation.mjs, tools/database/phase29-reconciliation-postflight.sql, .artifacts/shipyard-live/phase29-system-operation-reconciliation/manifest.json, .planning/phases/29-system-operation-mode-and-material-reconciliation/29-VERIFICATION.md</files>
  <action>Run headed Google Chrome through Shipyard with separate Admin and representative non-Admin sessions. Prove same initial server mode across both and a fresh browser; Admin switches mode while the second session occupies an excluded route; capture relocation, no excluded preload/data request, retained permission behavior, API mutation/audit and DB persisted mode. On a newly controlled import, prove preview/failure creates no batch, commit creates one draft, readiness freezes exact source/tolerance, Purchasing and Warehouse enter/correct role-owned actuals including explicit zero and stale conflict, Reports shows exact differences/triggers/order, disposition/completion/history/export work, and DB before/after shows zero PR/PO/receipt/issue/movement/lot/snapshot/current-stock mutation. Re-run after menu/BOM/tolerance edits to prove immutable history. At each of the five viewports save final screenshot, semantic DOM metrics, post-action API, console/page/failed requests, focus, CLS and long tasks. Teardown only owned processes and write one manifest even on failure.</action>
  <verify><automated>node tools/e2e/phase29-system-operation-reconciliation.mjs && node -e "const m=require('./.artifacts/shipyard-live/phase29-system-operation-reconciliation/manifest.json'); if(m.status!=='passed'||m.viewports?.length!==5||m.db?.stockMutationCount!==0||m.browser?.consoleErrors!==0||m.browser?.pageErrors!==0) process.exit(1)"</automated></verify>
  <done>Fresh headed evidence proves the full locked phase across two sessions, five viewports, API, DB and reload, with zero prohibited lifecycle mutation and owned teardown complete.</done>
</task>

</tasks>

---

# Plan 29-10 — Evidence, documentation and state closeout

```yaml
phase: 29-system-operation-mode-and-material-reconciliation
plan: 10
type: execute
wave: 6
depends_on: [29-09]
autonomous: true
requirements: [OPM-01, OPM-02, OPM-03, OPM-04, MRC-01, MRC-02, MRC-03, MRC-04, CLR-01, CLR-02, CLR-03]
estimate:
  tokens: 24000
  raw_tokens: 24000
  tasks: 2
  confidence: low
files_modified:
  - docs/DOMAIN.md
  - docs/DATA-GRAIN-MATRIX.md
  - docs/GLOSSARY.md
  - docs/ARCHITECTURE.md
  - docs/DEPLOYMENT.md
  - docs/EVIDENCE-INDEX.md
  - frontend/README.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - MEMORY.md
  - HISTORY.md
  - .planning/phases/29-system-operation-mode-and-material-reconciliation/29-VERIFICATION.md
```

## must_haves

### truths
- Canonical docs describe the implemented mode/batch contracts once, with data grain, permissions, deployment/promotion and UI vocabulary accurately linked.
- Evidence hashes live only in `docs/EVIDENCE-INDEX.md`; current gate lives only in `MEMORY.md`; completed historical narrative moves to `HISTORY.md`.
- All eleven roadmap requirement IDs are checked only after independent verification evidence passes.
- Working tree has no staged files or untracked Phase 29 residue after atomic closeout commit.

<tasks>

<task type="tracer">
  <name>Task 1: Reconcile verification and canonical documentation</name>
  <files>docs/DOMAIN.md, docs/DATA-GRAIN-MATRIX.md, docs/GLOSSARY.md, docs/ARCHITECTURE.md, docs/DEPLOYMENT.md, docs/EVIDENCE-INDEX.md, frontend/README.md, .planning/phases/29-system-operation-mode-and-material-reconciliation/29-VERIFICATION.md</files>
  <action>Fact-check docs against implemented source, generated contracts, DB postflight and headed manifest. Document stable internal values only in technical contract sections and Vietnamese labels in user vocabulary; add reconciliation grain/contributor/tolerance/actual/revision/completion invariants; document disposable-lane migration and separate base-promotion authorization; register artifact hashes only in evidence index. The verification file must map every SPEC acceptance item and D-01..D-42 to exact automated/browser/DB evidence and mark any missing item as blocker rather than passing by prose.</action>
  <verify><automated>git diff --check && node tools/docs/check-links.mjs</automated></verify>
  <done>Canonical docs and verification agree with running code/evidence and contain no duplicated hash/gate authority.</done>
</task>

<task type="auto">
  <name>Task 2: Close requirements, roadmap, state, memory and history atomically</name>
  <files>.planning/REQUIREMENTS.md, .planning/ROADMAP.md, .planning/STATE.md, MEMORY.md, HISTORY.md, .planning/phases/29-system-operation-mode-and-material-reconciliation/29-VERIFICATION.md</files>
  <action>Only after verification has zero blocker, mark OPM-01..04, MRC-01..04 and CLR-01..03 complete, update the Phase 29 roadmap plan inventory/status, advance STATE, remove the open Phase 29 work from MEMORY and append the completed narrative to HISTORY. Keep external base promotion pending if it was not separately authorized; do not represent disposable-lane success as operational promotion. Run secret/stub scan, `git diff --check`, verify no generated artifact escaped the declared directories, and commit this documentation/state closeout atomically.</action>
  <verify><automated>git diff --check && git grep -nE "(password|token|connection string)[[:space:]]*[:=][[:space:]]*[^$<{]" -- . ':!*.lock' ':!frontend/src/shared/api/contracts/openapi.json' && git status --porcelain=v1</automated></verify>
  <done>Phase 29 is closed truthfully in GSD state, evidence is indexed, historical work is moved out of MEMORY, and no staged/untracked residue remains.</done>
</task>

</tasks>

---

## Phase-level verification gates

1. **Backend focused:** all `SystemOperation*` and `Reconciliation*` tests pass.
2. **Backend aggregate:** complete solution tests/build pass; intentional skips remain explicitly dispositioned.
3. **Mode matrix:** endpoint coverage has no unregistered protected family; role×mode route/action/API tests prove mode never grants permission.
4. **Frontend focused:** routing, preload, Admin mode control, reconciliation flow and clarity inventory pass.
5. **Frontend aggregate:** serial unit suite, lint, dependency-cruiser, architecture and production build pass.
6. **Generated parity:** OpenAPI and generated frontend types are clean after regeneration.
7. **Database:** approved disposable-lane preflight → reviewed migration → apply once → pending-model zero → postflight → rollback evidence; protected/base untouched absent separate authorization.
8. **Data integrity:** exact singleton, immutable batches, contributor/source identity, tolerance bytes/decimals, revisions and completion audit pass; prohibited stock/procurement mutation count is zero.
9. **Browser:** headed two-session evidence at five viewports proves route relocation, no excluded preload/query, full controlled batch flow, semantic DOM, focus, API, DB, reload, CLS/long tasks and zero browser errors.
10. **Clarity:** executable inventory has zero authorized actionable `FAIL`; unsupported qualitative findings remain honest `NEEDS_EVIDENCE` and do not authorize edits.
11. **Hygiene:** `git diff --check`, secret/stub scan and declared-scope inspection pass; no GitNexus evidence exists because this is explicitly graph-free planning and user prohibited GitNexus.
12. **Closeout:** verification maps every requirement and D-01..D-42; docs/state/evidence ownership rules hold; no staged files remain.

## Phase success criteria

- One persisted, audited and concurrency-safe global mode is identical across users/sessions and cannot be overridden client-side.
- Admin-only mutation safely propagates without document reload, data deletion or stale excluded mutation commit.
- The exact locked route/action matrix is enforced before but separately from existing permissions at navigation, direct route, preload and backend boundaries.
- Every committed import creates a distinct draft; explicit readiness freezes non-empty canonical identity, contributors, required quantity and tolerance authority.
- Purchased/issued actuals and append-only corrections remain batch-owned and stock/procurement-isolated.
- Exact comparison/tolerance/disposition/completion/history/export semantics pass numeric, concurrency and immutability tests.
- Both modes receive inventory-authorized clarity corrections with full identity, query-state, permission and audit meaning preserved.
- Full automated, database and headed-browser evidence passes before GSD closes Phase 29.

## Multi-source coverage audit

| Source | ID | Feature / decision | Plan(s) | Status |
|---|---|---|---|---|
| GOAL | — | Global mode + immutable reconciliation + project-wide clarity | 01-10 | COVERED |
| REQ | OPM-01 | One server-authoritative global mode | 01, 05, 09 | COVERED |
| REQ | OPM-02 | Admin mutation, audit, invalidation, relocation | 01, 05, 09 | COVERED |
| REQ | OPM-03 | Mode plus permission enforcement | 03, 05, 09 | COVERED |
| REQ | OPM-04 | Exact retained/excluded matrix | 02, 03, 05, 09 | COVERED |
| REQ | MRC-01 | Independent import batch and canonical grain | 04, 08, 09 | COVERED |
| REQ | MRC-02 | Frozen demand/tolerance immutable history | 04, 06, 09 | COVERED |
| REQ | MRC-03 | Exact required/purchased/issued and provenance | 06, 08, 09 | COVERED |
| REQ | MRC-04 | Exact differences, tolerance, exception-first/all rows | 06, 08, 09 | COVERED |
| REQ | CLR-01 | Concise state plus authorized action | 02, 07, 08, 09 | COVERED |
| REQ | CLR-02 | Decision tables and preserved full identity | 02, 07, 08, 09 | COVERED |
| REQ | CLR-03 | Lowest-owner semantic/geometry correction | 02, 07, 08, 09 | COVERED |
| RESEARCH | — | Durable singleton, existing audit, fail closed | 01 | COVERED |
| RESEARCH | — | Shared route/preload/permission seams | 03, 05 | COVERED |
| RESEARCH | — | Snapshot source identities, not mutable demand authority | 04 | COVERED |
| RESEARCH | — | No name merge or legacy unit auto-normalization | 04, 06 | COVERED |
| RESEARCH | — | Batch-owned actuals, no stock/procurement lifecycle | 06, 09 | COVERED |
| RESEARCH | — | Optimistic concurrency and immutable lifecycle | 01, 04, 06 | COVERED |
| RESEARCH | — | Frozen tolerance and exact decimal comparison | 04, 06 | COVERED |
| RESEARCH | — | Existing Phase 27/28 evidence harness | 02, 07, 09 | COVERED |
| CONTEXT | D-01..D-07 | Mode authority, propagation and transaction enforcement | 01, 03, 05, 09 | COVERED |
| CONTEXT | D-08..D-11 | Route/action registry and explicit DEFAULT | 02, 03, 05 | COVERED |
| CONTEXT | D-12..D-17 | Batch lifecycle, import identity and freeze | 04, 06 | COVERED |
| CONTEXT | D-18..D-21 | Tolerance, comparison, trigger and ordering | 04, 06, 08 | COVERED |
| CONTEXT | D-22..D-26 | Role-owned actuals, revision, zero, isolation | 06, 08, 09 | COVERED |
| CONTEXT | D-27..D-29 | Disposition, completion, historical export | 06, 08, 09 | COVERED |
| CONTEXT | D-30..D-33 | UI placement and interaction | 05, 08 | COVERED |
| CONTEXT | D-34..D-38 | Three-wave clarity and existing harness | 02, 07, 08, 09 | COVERED |
| CONTEXT | D-39..D-42 | DB lane, layered verification, two sessions, controlled scope | 01, 09, 10 | COVERED |

Deferred physical warehouse changes, legacy unit normalization, derived procurement/stock actuals, per-user modes and alternate component/audit frameworks are intentionally excluded and do not appear in tasks.

## Plan inventory

| Plan | Primary output | Commits after |
|---|---|---|
| 29-01 | Persisted mode tracer, migration and DB checkpoint | Wave 1 |
| 29-02 | Executable clarity/action inventory | Wave 1 |
| 29-03 | Shared backend mode/permission/race enforcement | Wave 2 |
| 29-04 | Draft import batch and immutable ready snapshot | Wave 2 |
| 29-05 | Frontend mode bootstrap, matrix and relocation | Wave 2 |
| 29-06 | Actuals, revisions, comparisons and completion | Wave 3 |
| 29-07 | Shared clarity seams | Wave 3 |
| 29-08 | Four-work-area reconciliation UI and residue | Wave 4 |
| 29-09 | Full gates, disposable DB and headed evidence | Wave 5 |
| 29-10 | Canonical docs and GSD closeout | Wave 6 |

Each execution plan creates `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-{NN}-SUMMARY.md` after its atomic commit. The planning artifact itself must be committed separately and atomically before any executor begins production work.
