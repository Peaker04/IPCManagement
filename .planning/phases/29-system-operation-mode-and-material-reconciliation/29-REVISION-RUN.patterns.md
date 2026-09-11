# Phase 29: System Operation Mode and Material Reconciliation — Revision Pattern Map

**Mapped:** 2026-08-25
**Purpose:** Resolve the blocked plan architecture before any production/database execution.
**Scope:** Read-only source mapping; no production edits, no database/runtime/browser mutation, no GitNexus.
**Primary blockers addressed:** persistence ownership, commit-boundary mode fence, route/action/preload seams, complete clarity-owner closure, generated contracts, and headed evidence.

## Executive architecture decision map

1. **Persistence must be foundation-first.** Define all Phase 29 persisted entities and `IEntityTypeConfiguration<>` mappings together, add all `DbSet<>` properties to `IpcManagementContext`, then generate one reconciliation migration and snapshot from the complete model. Do not generate a migration named “...AndReconciliation” before reconciliation entities exist.
2. **Use the existing `EfTransactionRunner` as the preferred commit seam, but deepen its interface with a protected-operation/pre-commit fence.** Its operation delegate already runs inside the relational transaction and may call `SaveChangesAsync`; a fence invoked after the delegate returns but before `ExecuteInTransactionAsync` commits can re-read the mode and throw, rolling back already-flushed SQL. Endpoint filters alone are insufficient.
3. **Inventory and migrate every protected direct `SaveChanges` owner.** A transaction-runner fence covers only callers using it. Source-aware closure must classify every direct save owner as protected-and-fenced, intentionally mode-neutral, or infrastructure-only. No unclassified direct save may remain.
4. **Frontend mode eligibility composes before `RoleGuard` and before both bundle and data preload.** Keep canonical route constants, existing lazy route objects, existing permission checks, and one `apiSlice` identity.
5. **Clarity closure must be machine-owned.** Extend the Phase 27/28 source-owner registries so every actionable row has an exact production `sourceFile`/`sourceSymbol`, assigned task/wave, and terminal disposition. Closeout requires zero actionable `FAIL` and zero owner/task gaps; four reconciliation pages are not project-wide closure.
6. **Contracts remain generated.** Backend DTO/controller changes regenerate tracked OpenAPI JSON and TypeScript schema using root scripts; parity is proved by `check:api-contract`, not handwritten duplicate frontend types.
7. **Headed evidence needs a versioned Phase 29 manifest.** Reuse the current persistent headed-Chrome harness/event capture, but add explicit role × mode × route/action cells, preload/query counts, two-session relocation, DB invariants, audit, reload, focus, performance disposition, and teardown ownership.

## File Classification

| New/Modified File or file family | Role | Data Flow | Closest analog | Match quality |
|---|---|---|---|---|
| `Models/Entities/SystemOperationMode.cs` | model/singleton authority | CRUD + concurrency | `PurchaseReceiptActiveLine.cs`; operational warehouse singleton migration | role-match |
| `Models/Entities/ReconciliationBatch*.cs`, actual/revision/disposition entities | model/immutable aggregate | CRUD + append-only event history | receipt/correction/allocation entities in Inventory persistence | role/data-flow match |
| `Features/SystemOperation/Persistence/SystemOperationEntityConfigurations.cs` | EF configuration | transform/model mapping | `Features/Inventory/Persistence/InventoryEntityConfigurations.cs` | exact |
| `Features/Reconciliation/Persistence/ReconciliationEntityConfigurations.cs` | EF configuration | transform/model mapping | `InventoryEntityConfigurations.cs` | exact |
| `Data/IpcManagementContext.cs` | DbContext/config | CRUD | current `IpcManagementContext.cs` | exact |
| final Phase 29 migration + designer + model snapshot | migration/config | batch/schema | `20260812102011_AddPurchaseReceiptActiveLineFence.cs` | exact |
| `SystemOperationModeGuard` / eligibility registry | middleware/service | request-response | `RoleGuard.tsx` conceptually; backend policy conventions | partial |
| `IEfTransactionRunner.cs`, `EfTransactionRunner.cs` | transaction service | CRUD/commit boundary | current runner | exact |
| protected mutation owner files | services | transactional CRUD | existing runner-based workflows | exact |
| import draft-batch hook | service | transactional file-I/O → CRUD | `WeeklyMenuImportPersistence.CommitAsync` called within import transaction | exact |
| frontend mode endpoint/provider/registry | provider/service | request-response/event-driven invalidation | endpoint injection into `apiSlice` | exact |
| `AppRouter`, `RoleGuard`, route loaders/data preloaders | route/middleware | request-response + lazy preload | current files | exact |
| clarity inventory and closure manifests | test/config | source transform | `conditionalTableFixture.ts`, Phase 27/28 UI audit registries | exact |
| OpenAPI JSON/schema | generated contract | transform | root `gen:api` scripts | exact |
| Phase 29 headed harness/manifest | test/evidence | event-driven + file-I/O | `.artifacts/shipyard-live/live-visual-audit.mjs` | role-match |

## Pattern Assignments

### 1. Complete EF model and migration ownership

**Primary analogs:**
- `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs:24-164`
- `backend/src/IPCManagement.Api/Features/Inventory/Persistence/InventoryEntityConfigurations.cs:7-37, 221-283, 400-479`
- `backend/src/IPCManagement.Api/Migrations/20260812102011_AddPurchaseReceiptActiveLineFence.cs:13-126`

**DbContext registration pattern** (`IpcManagementContext.cs:24-164`):

```csharp
public virtual DbSet<AuditLog> Auditlogs { get; set; }
public virtual DbSet<PurchaseReceiptActiveLine> Purchasereceiptactivelines { get; set; }

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder
        .UseCollation("utf8mb4_unicode_ci")
        .HasCharSet("utf8mb4");

    modelBuilder.ApplyConfigurationsFromAssembly(typeof(IpcManagementContext).Assembly);
    OnModelCreatingPartial(modelBuilder);
}
```

**Assignment:** Phase 29 owns explicit `DbSet<>` entries for all persisted aggregates and feature-local configuration classes discovered automatically by `ApplyConfigurationsFromAssembly`. Do not put a second manual configuration switch in `OnModelCreating`.

**Configuration pattern** (`InventoryEntityConfigurations.cs:7-37`):

```csharp
entity.HasKey(item => item.AllocationDispositionId).HasName("PRIMARY");
entity.ToTable("inventoryallocationdispositions");
entity.HasIndex(item => item.SourceIssueLineId, "ixInventoryAllocationDispositionsSource");
entity.Property(item => item.Quantity).HasPrecision(18, 6).HasColumnName("quantity");
entity.Property(item => item.Version).IsConcurrencyToken().HasDefaultValue(0L).HasColumnName("version");
entity.HasOne<User>().WithMany()
    .HasForeignKey(item => item.CreatedBy)
    .OnDelete(DeleteBehavior.Restrict);
```

**Concrete Phase 29 schema ownership (must be in one schema-foundation plan before migration generation):**

| Aggregate/table | Required key/index/constraint pattern |
|---|---|
| System operation mode singleton | Fixed singleton PK/check value; stable mode token check; concurrency `Version`; updated actor/time; database-level cardinality strategy plus service exact-cardinality validation. |
| Reconciliation batch | Binary(16) PK; unique committed import/menu-version identity; status check `DRAFT/READY/IN_PROGRESS/COMPLETED`; concurrency version; created/ready/completed actor/time FKs; immutable timestamps. |
| Batch line | Binary(16) PK; **unique `(batchId, ingredientId, canonicalUnitId)`**; `decimal(18,6)` required/tolerance and exact stored differences if persisted; frozen tolerance source kind/ID/version; line concurrency. |
| Contributor | Binary(16) PK; FK batch line; source menu/version/schedule/meal-quantity/BOM line identities; original and canonical `decimal(18,6)` quantities; indexes by batch line and source ID. |
| Tolerance configuration | Explicit precedence owner, scope identity/version, exact `decimal(18,6)`, active/effective metadata; no historical line FK that allows cascading rewrite. |
| Actual/current projection | Unique `(batchLineId, side)` where side is purchased/issued; nullable row absence means missing; quantity `decimal(18,6)` permits explicit zero; side version concurrency; actor/time FK. |
| Actual revision | Append-only PK; FK actual; old/new `decimal(18,6)`; non-empty reason check; actor/time; unique command/idempotency key if commands retry. No update/delete production path. |
| Disposition | Unique batch-line current disposition or append-only versioned disposition (planner must choose one coherent model); category check/central vocabulary; non-empty reason; actor/time/version. |

**Migration pattern** (`AddPurchaseReceiptActiveLineFence.cs:34-111`):

```csharp
migrationBuilder.CreateTable(
    name: "purchasereceiptactivelines",
    columns: table => new
    {
        purchaseOrderLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
        receiptId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
        createdAt = table.Column<DateTime>(type: "datetime", nullable: false)
    },
    constraints: table =>
    {
        table.PrimaryKey("PRIMARY", x => x.purchaseOrderLineId);
        table.ForeignKey(... onDelete: ReferentialAction.Restrict);
    });
```

Copy the project conventions: binary GUIDs, explicit table/column names, named indexes/FKs, `Restrict` for immutable lineage, decimal precision, UTF-8 annotations, and reviewed SQL only where EF cannot express a fence/backfill safely.

**Required migration order:**

1. Entity classes + configurations + DbSets + focused model tests.
2. Generate final migration/designer/snapshot from that complete model.
3. Review generated SQL for `USE`, create/drop database/table, destructive backfill, or unrelated objects.
4. Apply only after disposable-lane checkpoint.
5. Run pending-model check and postflight over every Phase 29 table plus prohibited stock/procurement tables.

**Do not copy:** the blocked plan's early `20260825_AddSystemOperationModeAndReconciliation` ownership in Plan 29-01. A migration cannot own entity models introduced in later waves.

---

### 2. Audit and immutable history pattern

**Analog:** `backend/src/IPCManagement.Api/Models/Entities/AuditLog.cs:5-30`

```csharp
public DateTime ChangedAt { get; set; }
public byte[] ChangedBy { get; set; } = null!;
public string BusinessArea { get; set; } = null!;
public string EntityName { get; set; } = null!;
public byte[]? EntityId { get; set; }
public string? FieldName { get; set; }
public string? OldValue { get; set; }
public string? NewValue { get; set; }
public string? Reason { get; set; }
public string? CorrelationId { get; set; }
```

Mode transition and lifecycle transition services should append the existing audit record inside the same transaction. Actual corrections additionally need their dedicated append-only revision table because generic audit alone is not the queryable current/historical quantity authority.

---

### 3. Commit-boundary mode fence

**Closest exact seam:** `backend/src/IPCManagement.Api/Data/Transactions/EfTransactionRunner.cs:43-80`

```csharp
return await ExecutionStrategyExtensions.ExecuteInTransactionAsync<TransactionExecution<TResult>, TResult>(
    strategy,
    new TransactionExecution<TResult>(operation, verifySucceeded),
    async (state, token) =>
    {
        if (attempt++ > 0)
        {
            _context.ChangeTracker.Clear();
        }

        return await state.Operation(token);
    },
    async (state, token) =>
    {
        _context.ChangeTracker.Clear();
        return await state.VerifySucceeded(token);
    },
    (context, token) => context.Database.BeginTransactionAsync(isolationLevel, token),
    cancellationToken);
```

#### Recommended option A — deepen `IEfTransactionRunner` with protected operation metadata and pre-commit fence

Add an overload/interface such as `ExecuteProtectedAsync(operationKey, expectedModeVersion?, operation, verifySucceeded, ...)`. Inside the transaction delegate:

1. Validate operation eligibility at transaction start.
2. Run domain operation; existing services may call `SaveChangesAsync` one or more times.
3. **After domain work returns and immediately before the runner yields to `ExecuteInTransactionAsync` commit**, re-read the singleton using a database query that is not satisfied by tracked state.
4. Require the current mode/version still permits `operationKey`; throw a typed mode conflict otherwise. The surrounding transaction rolls back all SQL already flushed by `SaveChangesAsync`.
5. Preserve retry semantics: runner already clears tracked state on retry and requires callers to reload mutable entities inside the delegate.

Why this fits: it places revalidation after the last service save but before commit without a global `SaveChanges` interceptor querying recursively on the same context.

#### Option B — explicit protected unit-of-work wrapper

Create a small `IProtectedCommit`/unit-of-work seam that owns `SaveChangesAsync` and commit, then migrate every protected owner to it. This is viable but has a larger call-site blast radius and risks parallel transaction abstractions.

#### Rejected as sole fence

- Controller/action/endpoint filter: request-start only; loses race with later mode switch.
- Frontend mode cache: presentation only.
- Plain `SaveChangesInterceptor`: can run before SQL flush, but safely querying the same context during saving is problematic and it does not by itself own the later transaction commit race.
- Global DbContext override without operation metadata: cannot distinguish protected business operations from auth/outbox/system-mode work and still needs a transaction-consistent recheck.

#### Exact mutation-owner closure

The live source contains these direct save owners. The revised plan must generate a tracked inventory and assign each a disposition; the list is the current baseline, not a substitute for a source-aware test:

**Shared persistence owners:**
`Data/IUnitOfWork.cs`, `Data/UnitOfWork.cs`, `Data/Repositories/GenericRepository.cs`, `CurrentStockRepository.cs`, `RefreshTokenRepository.cs`, `IRefreshTokenRepository.cs`.

**Protected business mutation owners requiring operation-key + commit-fence coverage unless explicitly proven mode-neutral:**

- Admin: `AdminEmployeeService.cs`.
- Approvals: `ApprovalHandlers.cs`, `ApprovalRoutingService.cs`, `ApprovalWorkflowService.cs`.
- Catalog: `DishBomImportService.cs`, `DishBomService.cs`.
- Coordination: `CustomerContractService.cs`, `MealQuantityPlanService.cs`, `MenuScheduleService.cs`, `OrderAdjustmentService.cs`, `OrderPlanService.cs`, `OrderSignoffService.cs`, `PortionRuleService.cs`.
- Inventory: `InventoryIssueService.cs`, `InventoryReceiptService.cs`, `InventoryReturnService.cs`, `LegacyLineageDispositionService.cs`, `StocktakeService.cs`, `SupplementalMaterialRequestService.cs`.
- Planning: `MaterialDemandService.cs`, `ProductionPlanService.cs`, `ServiceRunService.cs`.
- Purchasing: `PurchaseOrderService.cs`, `PurchaseReceiptDraftWorkflow.cs`, `PurchaseRequestGenerationService.cs`, `PurchaseRequestSubmissionService.cs`, `PurchaseSupplierDecisionService.cs`, `ReceiptLifecycleWorkflow.cs`, `SupplierQuotationService.cs`.
- Reports commands: `DataQualityCommandService.cs`, `DataQualityDispositionService.cs`, `StockSnapshotReportService.cs`, `UnitNormalizationReviewService.cs`.
- Sample/admin data: `CustomerImportMappingService.cs`, `MenuAmendmentService.cs`, `PurchaseHistoryReconciliationService.cs`, `SampleBomImportService.cs`, `WeeklyMenuBulkEditService.cs`, `WeeklyMenuImportHistoryService.cs`, `WeeklyMenuImportService.cs`.

**Likely explicitly mode-neutral/infrastructure, but still must receive a tested disposition:** `AuthService.cs`, `LifecycleOutboxAdminService.cs`, `LifecycleOutboxProcessor.cs`, refresh-token persistence, the mode mutation service itself. Public login/health must remain available when mode authority is invalid; mode mutation needs its own expected-version transaction rather than blocking itself with the old mode.

**Closure test pattern:** scan production C# syntax for `SaveChanges/SaveChangesAsync`, transaction commits, raw SQL mutation and unit-of-work saves; fail if the containing symbol has no operation-key/fence disposition. Also scan protected controllers/endpoints for operation metadata. Keep permission policy independent and assert mode never grants access.

---

### 4. Weekly Menu committed-import seam

**Analog:** `WeeklyMenuImportPersistence.CommitAsync`, lines 20-146, with version creation at lines 306-351.

```csharp
var version = await CreateMenuVersionHeaderAsync(...);
var result = await resultBuilder.BuildAsync(plan, customer, committed: true, cancellationToken);
WeeklyMenuImportProjection.ApplyMenuVersion(result, version);
...
context.Menuversions.Add(version);
return version;
```

This persistence module stages entities but does not call `SaveChangesAsync`; `WeeklyMenuImportService` owns the surrounding transaction/save. Create exactly one draft reconciliation batch in this staged commit path after `MenuVersionId` exists. That guarantees preview/failure creates none and transaction rollback removes both import and draft. The new import operation key must be fenced through the outer `WeeklyMenuImportService` transaction, not through a controller-only check.

Do not call mutable `MaterialDemandService` as historical authority. Readiness later snapshots source identities and exact quantities into reconciliation-owned tables.

---

### 5. Frontend route, permission and preload composition

**Analogs:**
- route constants: `frontend/src/lib/routeConfig.ts:1-15`
- permission: `frontend/src/routes/RoleGuard.tsx:10-28`
- bundle preload: `frontend/src/routes/routeLoaders.ts:4-79`
- data preload: `frontend/src/routes/routeDataPreloaders.ts:6-95`
- route composition: `frontend/src/routes/AppRouter.tsx:54-81`

**Permission pattern to preserve:**

```tsx
const hasPermission =
  isAdmin ||
  requiredPermissions.length === 0 ||
  requiredPermissions.some((perm) => user.permissions?.includes(perm))

if (!hasPermission) {
  return <Navigate to={ROUTES.FORBIDDEN} replace />
}
```

**Mode seam assignment:** introduce a typed route/operation registry keyed by the existing `ROUTES` values. Route rendering composes `ModeGuard` outside `RoleGuard`: mode unavailable is resolved first; retained routes continue to the unchanged permission result.

**Preload pattern to adapt:** current bundle preloader is a `Partial<Record<string, () => Promise<void>>>`, and data preloaders dispatch RTK Query prefetches by route. The caller must check mode eligibility **before invoking either** `preloadRoute` or `preloadRouteData`. For defense in depth, both functions should also accept/consult a resolved eligibility snapshot and return immediately for excluded paths. Tests must assert importer and RTK dispatch counts remain zero.

**Locked matrix:**

| Route | DEFAULT | MATERIAL_RECONCILIATION |
|---|---|---|
| Dashboard, Weekly Menu, Purchasing, Warehouse, Reports, Admin Data | eligible then permission | eligible then permission |
| Advanced Settings | Admin permission | Admin permission |
| Coordination/Meal Orders, Approvals, Chef Dashboard, Approval Rules | eligible then permission | mode unavailable for all roles |

Retained pages also need action keys. Route eligibility does not imply every current action is eligible.

---

### 6. One RTK Query identity and exact invalidation

**Analog:** `frontend/src/api/apiSlice.ts:234-266`

```ts
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuthHandling,
  keepUnusedDataFor: 5 * 60,
  refetchOnMountOrArgChange: false,
  tagTypes: [...],
  endpoints: () => ({}),
})
```

Inject system-operation and reconciliation endpoints into this slice. Add narrow mode/configuration tags; do not create another API reducer, reset the reducer, reload the document, or use local/session storage as authority. Successful mode mutation invalidates only mode/config and eligibility-dependent data. Provider relocation reacts to server readback/version.

---

### 7. Full project-wide clarity owner closure

**Closest exact analog:** `frontend/tests/conditionalTableFixture.ts:4-17, 21-99`.

```ts
export type ConditionalTableFixture = {
  id: string
  route: '/admin-data' | '/reports'
  view: string
  sourceFile: string
  sourceSymbol: string
  tableIndex: number
  regionLabel: string
  condition: RegExp
  headerSignature: readonly string[]
  states: readonly ['loading', 'empty', 'ready']
}
```

Phase 29 should extend the existing UI audit/source-ownership files (`uiAuditInventory`, `uiAuditFixtureRegistry`, `uiSourceOwnershipManifest`, `uiAuditRemediationReconciliation`, `presentationSurfaceInventory`, `queryBoundaryInventory`) rather than add a second scanner.

**Required actionable row schema:**

```ts
type Phase29ClarityRow = {
  id: string
  rule: 'CLR-01' | 'CLR-02' | 'CLR-03'
  route: string
  state: string
  actor: string
  viewport: string
  sourceFile: string
  sourceSymbol: string
  lowestOwner: 'shared' | 'feature' | 'route'
  taskId: string
  oracle: string
  disposition: 'ACTIONABLE_FAIL' | 'FIXED' | 'N_A' | 'NEEDS_EVIDENCE'
}
```

**Closure rules:**

- Every `ACTIONABLE_FAIL` has a real existing production `sourceFile`, exact symbol, and assigned production task.
- Each assigned task declares that production file; source-aware test compares inventory owners with plan/task owner manifest.
- Shared wave closes shared rows; feature wave may touch all feature mapper/section files identified by inventory, not only reconciliation features; route-residue wave closes remaining exact routes.
- Closeout requires `ACTIONABLE_FAIL === 0`, orphan owner rows `=== 0`, missing task mappings `=== 0`, and no row promoted from `NEEDS_EVIDENCE` without the required oracle.
- Preserve initial absence, filtered absence, error, permission, mode-unavailable and stale-data meanings. One state plus at most one authorized action does not mean collapsing these states.

Because the final feature file list is evidence-derived, the planner should either (a) perform inventory as a planning prerequisite and then materialize exact clarity plans, or (b) use a blocking checkpoint after the inventory that revises/materializes the later standard plan files before execution continues. A static plan limited to four retained pages cannot claim project-wide closure.

---

### 8. Generated API contract pattern

**Source:** root `package.json` scripts.

```json
"gen:api:spec": "dotnet ... swagger tofile --output frontend/src/shared/api/contracts/openapi.json ... v1",
"gen:api": "npm run gen:api:spec && npx --yes openapi-typescript@7.13.0 ... --output frontend/src/shared/api/contracts/schema.ts --immutable --alphabetize",
"check:api-contract": "npm run gen:api && git diff --exit-code -- frontend/src/shared/api/contracts/openapi.json frontend/src/shared/api/contracts/schema.ts"
```

**Ownership:** backend contracts/controllers are production source; tracked generated outputs are:

- `frontend/src/shared/api/contracts/openapi.json`
- `frontend/src/shared/api/contracts/schema.ts`

Frontend endpoint modules consume generated schema types where current conventions permit. Contract plan must run generation after backend endpoint stability, commit both generated files, then run parity. Do not hand-edit JSON/schema or duplicate operation tokens/status values in ad hoc frontend types without a source-contract assertion.

---

### 9. Headed evidence harness and manifest

**Analog:** `.artifacts/shipyard-live/live-visual-audit.mjs:70-188, 500-568`.

Existing reusable patterns:

```js
const context = await chromium.launchPersistentContext(profile, {
  executablePath: chrome,
  headless: false,
  viewport: { width: viewports[0].width, height: viewports[0].height },
})

page.on('console', ...)
page.on('pageerror', ...)
page.on('requestfailed', ...)
page.on('response', ...)
```

It writes separated API, browser-error, performance and top-level manifest JSON and records source commit/fingerprint, database, browser/headed flag, viewports, API responses, console/page/request errors, escaped mutations, CLS and long tasks.

**Phase 29 manifest must be versioned and additive:**

```ts
type Phase29EvidenceManifest = {
  schemaVersion: 1
  sourceCommit: string
  dirtySourceFingerprint: string
  lane: string
  headed: true
  browser: 'Google Chrome'
  viewports: ['1920x1080','1440x900','1366x768','1365x900','1280x900']
  matrixCells: Array<{
    mode: 'DEFAULT' | 'MATERIAL_RECONCILIATION'
    actor: string
    route: string
    expected: 'retained' | 'mode-unavailable' | 'permission-denied'
    navigationVisible: boolean
    directRouteVerdict: string
    bundlePreloadCount: number
    dataRequestCount: number
    actionVerdicts: Array<{ operationKey: string; visible: boolean; enabled: boolean; requestCount: number }>
    domPassed: boolean
  }>
  relocationScenario: { adminSession: object; otherRoleSession: object; persistedAudit: object; passed: boolean }
  dbInvariants: Record<'purchaseRequests'|'purchaseOrders'|'receipts'|'issues'|'movements'|'lots'|'snapshots'|'currentStock', { before: string; after: string; delta: 0 }>
  immutableHistory: object
  apiResponses: object[]
  consoleErrors: object[]
  pageErrors: object[]
  requestFailures: object[]
  focusChecks: object[]
  reloadChecks: object[]
  performance: { cls: object[]; longTasks: object[]; dispositions: object[] }
  teardown: { ownedPids: number[]; remainingOwnedListeners: 0 }
  status: 'passed' | 'failed'
}
```

The role set must include Admin plus representative Purchasing, Warehouse, and retained-route permission-denied actors. Every locked route must have cells in both modes. The two-live-session mode switch/relocation is additional evidence, not a replacement for the matrix.

Use a newly controlled import/batch scope and source-line IDs. DB before/after assertions must name every prohibited authority independently; an aggregate `stockMutationCount` is insufficient.

## Shared Patterns

### Error and concurrency handling

- Use typed business/conflict exceptions mapped to user-language responses.
- Expected-version mismatch leaves mode/current actual/audit unchanged.
- `DbUpdateConcurrencyException` is an expected conflict path for concurrency-token entities, not a 500.
- Runner retries clear the change tracker; mutable entities must be loaded inside the operation delegate.

### Identity and quantity

- Binary(16) GUID IDs and source IDs are authority.
- Aggregate only by batch + ingredient ID + canonical unit ID.
- Use `decimal(18,6)` for material quantities/tolerance/comparisons, consistent with inventory quantity mappings.
- Explicit zero is present; null/absent row is missing.
- Display rounding never determines verdict.

### Authorization ordering

1. Mode eligibility.
2. Existing permission policy.
3. Domain validation.
4. Mutation inside transaction.
5. Mode/version revalidation immediately before commit.

Mode never grants permission. Invalid/missing mode fails closed for protected business work while auth/public health remain available.

### Closeout hygiene commands

Use explicit negative assertions rather than commands whose success semantics are inverted:

```bash
if git grep -nE '(BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|password\s*=\s*[^$])' -- . ':!*.example.*'; then
  echo 'secret-like content found' >&2
  exit 1
fi

test -z "$(git diff --cached --name-only)"
test -z "$(git status --porcelain=v1 -- .planning/phases/29-system-operation-mode-and-material-reconciliation | grep '^??')"
git diff --check
```

Preserve unrelated dirty work; assert no staged files and no untracked Phase 29 residue specifically rather than requiring a globally clean worktree.

## Recommended revised dependency shape

1. **Plan A — mode + complete reconciliation schema foundation:** all entities/configurations/DbSets and model tests; no DB apply yet.
2. **Plan B — shared operation registry + protected transaction-runner fence + direct-save inventory closure.**
3. **Plan C — final migration generation/review and disposable-lane checkpoint/apply/postflight.** Depends on A and B.
4. **Plan D — mode read/mutation endpoints and generated contract tracer.** Depends on A-C.
5. **Plan E — import draft/readiness domain.** Depends on B-D.
6. **Plan F — actuals/comparison/disposition/completion.** Depends on E.
7. **Plan G — frontend mode route/nav/preload/action matrix.** Depends on D and inventory contract.
8. **Plan H — clarity inventory, then exact shared/feature/route owner plans materialized from it.** Must close all actionable rows.
9. **Plan I — reconciliation UI + generated contract parity.** Depends on F-G and shared clarity seam.
10. **Plan J — disposable-lane E2E/headed matrix/versioned manifest, followed by separate evidence/state closeout.**

All executable units must be separate standard `29-NN-PLAN.md` files with valid frontmatter. The autonomous-run document may remain only as a non-executable index.

## No close analog found

| Concern | Reason | Planner guidance |
|---|---|---|
| Global mutable operation-mode aggregate | No current business singleton mode exists. | Combine EF singleton validation, audit and concurrency patterns above; do not copy deployment configuration. |
| Cross-cutting pre-commit mode race fence | Current runner centralizes many transactions but has no operation-key pre-commit participant and many direct save owners remain. | Deepen the runner and migrate/classify all protected saves; prove closure mechanically. |
| Full Phase 29 role×mode×route/action manifest | Current harness captures headed DOM/network/performance but not this matrix schema. | Extend existing harness/artifact structure; do not create a second general UI audit framework. |

## Metadata

**Analog search scope:** `backend/src/IPCManagement.Api/{Data,Models,Features,Migrations}`, `backend/tests/IPCManagement.Api.Tests`, `frontend/src`, `frontend/tests`, root/frontend package scripts, `.artifacts/shipyard-live`.
**Strong analogs read:** 12 primary files plus source inventories/search results.
**Direct save-owner baseline:** 49 production/interface files returned by source search, requiring classification.
**Pattern extraction date:** 2026-08-25.
