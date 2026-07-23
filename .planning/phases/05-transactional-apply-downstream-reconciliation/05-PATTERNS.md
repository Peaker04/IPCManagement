# Phase 5 Pattern Map — Transactional Apply & Downstream Reconciliation

**Mapped:** 2026-07-16  
**Repository commit/index:** `a342945` (`feature/production-plan`), GitNexus up to date  
**Scope:** implementation analogs for Phase 5 only; no frontend cutover and no legacy-surface retirement

## 1. Evidence status and hard prerequisite boundary

GitNexus concept queries found the inventory transaction flows (`InventoryReceiptService.CreateAsync`, `InventoryIssueService.CreateAsync`) but were weak for staleness, cache, snapshots and idempotency. The line-level source and tests below are therefore authoritative. Per `AGENTS.md`, run upstream `impact` on every exact symbol immediately before implementation edits; interface/DI results are an epistemic lower bound.

Phase 5 has two different kinds of inputs. They must never be described interchangeably:

| Status at mapping time | Artifacts | Phase 5 rule |
|---|---|---|
| **EXISTING SOURCE** | `DishService`, `MaterialDemandService`, `MaterialDemandCalculator`, purchase/order/inventory services, `WorkflowReportService`, `CoordinationTransactionTests`, current EF model | Reuse conventions or characterize landmines as documented below. |
| **PHASE 3 PLANNED, NOT SOURCE YET** | `CanonicalBomContract`, `CanonicalBomModels`, `BomPolicy`, `IBomInvariantValidator`, `BomReconciliationRunContract`, `Bomreconciliationrun`, `Dishbom.SourceRunId/SourceKind`, `03-LIFECYCLE-POLICY.md`, Gate A | Phase 5 consumes the delivered versions after Gate A; it must not recreate or guess them. `03-03-PLAN.md:61-98` is design intent, not current code. |
| **PHASE 4 PLANNED, NOT SOURCE YET** | canonical parser, canonical diff, dependency evidence reader, pure legacy classifier, preview manifest/fingerprint/store, read-only reconciliation service/controller, Gate B | Phase 5 extends the delivered preview boundary into apply and uses the same policy/classifiers. It must not create a second classifier/fingerprint. See `04-02-PLAN.md:114-149` and `04-03-PLAN.md:94-180`. |

The checked Phase 3/4 production artifacts, `03-LIFECYCLE-POLICY.md`, `.artifacts/bom-v1.1/gate-a/GATE-A.md`, and `.artifacts/bom-v1.1/gate-b/GATE-B.md` are all absent at mapping time. Therefore every Phase 5 source-edit plan must begin with a fail-closed prerequisite task: Gate A and Gate B must be `PASS`, delivered contract/policy/schema hashes must match their gate evidence, backup marker must be valid, preview blocker count must be zero, and the Phase 5 ownership manifest/impact report must exist.

## 2. Transaction coordinator and EF execution pattern

### Closest existing transaction analogs

1. `InventoryReceiptService.CreateAsync` (`54-130`) uses `IUnitOfWork.BeginTransactionAsync`, stages the receipt and stock-ledger/current-stock mutations on the same context, calls one `SaveChangesAsync`, commits, and explicitly rolls back in `catch`. `InventoryIssueService.CreateAsync` (`59-127`) follows the same pattern for issue, stock removal and material-request status.
2. `ApprovalHandlerBase.HandleAsync` (`ApprovalHandlers.cs:23-50`) wraps domain status change plus approval history in one transaction and rolls back on null/error.
3. `DishService.CommitBomImportAsync` (`418-525`) is the closest BOM-shaped sequence: preview/parse occurs before the transaction; overlap/version mutations and a batch audit are staged inside it; `SaveChangesAsync` and commit are followed by `ClearCatalogCache`. Reuse the boundary ordering, not this old importer.
4. `CoordinationTransactionTests.cs:27-73` uses an in-memory relational SQLite connection, an injected `SaveChangesInterceptor`, and a fresh verification context to prove failed saving leaves both plan and line unchanged. This is the strongest existing atomic rollback test shape.

### Mandatory divergence for Phase 5

- There is **no existing call** to `Database.CreateExecutionStrategy()` or an equivalent retry coordinator. `UnitOfWork.cs:15-22` only forwards `BeginTransactionAsync` and `SaveChangesAsync`. For Pomelo/MySQL, Phase 5 should execute the complete database transaction delegate through the provider execution strategy, so a transient retry reruns revalidation, DML, run counts and audit as one unit.
- Parse, bounded workbook hash and pure desired-state construction stay outside the transaction. Inside the execution-strategy delegate, open the transaction, reload the server-owned manifest, recompute the DB fingerprint, re-read complete dependency evidence, reclassify, compare action IDs/counts and only then mutate.
- Use one scoped `IpcManagementContext` for run row, BOM/catalog mutations, downstream changes, adjustments and audit. Do not call a service that owns a second context/transaction.
- Generate/validate idempotency identity before DML, but rely on the Phase 3 database-unique fingerprint as the concurrency authority. The retry delegate must recognize an already `COMPLETED` run and return its persisted result with zero new version/adjustment/audit rows.
- Catch/rollback exception and `OperationCanceledException`; do not convert cancellation into a partial `FAILED` commit. If a durable failure status is required, write it in a separate explicitly designed transaction only after rollback, without claiming domain mutation succeeded.
- `DishService.CommitBomImportAsync` lacks an explicit `catch`, performs per-row database queries (`450-464`), allows actor-less audit, updates a same-effective-date published row in place, and has no execution strategy or idempotency guard. It is an **anti-pattern** for apply internals.
- `PurchaseOrderService.RecordReceiptAsync` (`213-235`) opens/commits a transaction but has no explicit catch/rollback. Disposal may roll back, but Phase 5 tests should not copy this weaker shape.
- Post-commit cache/report invalidation must remain outside the retried transaction delegate. A retry must never emit duplicate external/post-commit effects.

Recommended target composition (names may follow delivered Phase 4 ownership):

```text
BomCatalogReconciliationService.ApplyAsync(previewId, workbook, effectiveDate, reason, actor)
  -> parse/hash outside transaction
  -> provider execution strategy
       -> begin transaction
       -> reload run/manifest + re-fingerprint/reclassify
       -> BomApplyMutationExecutor (version/archive/deactivate/delete)
       -> BomDownstreamReconciler (eligible draft/open only)
       -> adjustment + audit + run counts
       -> SaveChanges once (or bounded deterministic batches in same transaction)
       -> reconcile counts/checksums
       -> commit
  -> BomPostCommitInvalidator
  -> persisted apply result
```

## 3. Audit, run counts and manual adjustment patterns

### Existing analogs

- `CoordinationService.CreateCustomerContractAsync` stages domain changes and `Auditlog` before the same `SaveChangesAsync` (`135-163`). Its private `AddAudit` usage across the service demonstrates the standard audit fields: actor/time, business area, entity name/id, field, old/new value and reason.
- `DishService.CommitBomImportAsync:506-520` creates one `Auditlog` with aggregate created/updated/archived counts in the same context as BOM DML.
- `DishService.AddBomAdjustmentIfNeeded` (`1718-1745`) records old/new gross quantity and waste, actor, reason and timestamp. `WorkflowReportService.GetAuditChangesAsync` reads `Auditlogs`, approval histories and BOM adjustments using `AsNoTracking` (`1109-1517`).
- `ApprovalHandlerBase.SaveHistoryAsync` (`55-85`) checks existing resolution and appends immutable approval history; it illustrates a duplicate-operation guard, though its application-level `AnyAsync` is not a substitute for Phase 3's unique reconciliation fingerprint.

### Existing gaps Phase 5 must close

- `AddBomAdjustmentIfNeeded` silently returns when actor is missing (`1727-1731`) and accepts a blank reason. `UpdateBomLineAsync` can therefore version a published BOM without the required actor/reason and writes an adjustment only for quantity/waste changes, not every versioned field.
- Manual `AddBomLineAsync`, `UpdateBomLineAsync` and `CloseBomLineAsync` call `SaveChangesAsync` without an explicit domain+adjustment+audit transaction (`633-914`). Manual published edits need the shared Phase 3 invariant/version policy and one transaction.
- The old bulk audit uses `EntityId = actor` (`DishService.cs:515`), not a run/candidate identity. Canonical apply should link run audit and per-entity adjustment/audit to `Bomreconciliationrun`/`SourceRunId` and preserve traceability.
- Apply counts are not free-form strings. Persist the Phase 3 typed buckets (`keep/create/version/archive/deactivate/regenerate/delete/block/error`, plus before/after totals), compare them to the fresh Phase 4 classification before commit, and reject negative/inconsistent or changed counts.
- Unchanged rows create no version, adjustment or audit. A second identical apply returns the prior completed result/no-op; it must not append an empty run audit.

### BOM versioning analog

`DishService.UpdateBomLineAsync:792-852` is the closest existing published-version implementation:

- compute whether a versioned field changed;
- for a published row require a later effective date;
- check overlap in the exact dish/ingredient/unit/tier/customer scope;
- close the old interval at `newEffectiveFrom - 1 day` (`824-827`);
- insert a new `Dishbom` (`830-846`);
- append adjustment and save.

Reuse these semantics only through the delivered shared Phase 3 invariant engine. Do not copy the method because it is not transactional, does not set canonical provenance, does not audit all versioned fields, and actor/reason are optional. `DishCatalogTests.cs:324-473` provides characterization fixtures for overlap, draft overlap and published quantity version creation.

## 4. Retention mutation and dependency guards

Phase 5 must execute the exact Phase 4 classifier result after server-side reclassification. The action enum/reason/evidence/policy version are authoritative; entity code/name or absence from the workbook is never delete proof.

### Existing guard analogs

- `PurchaseOrderService.CancelAsync` blocks cancellation once any order line has received quantity (`240-256`). `RecordReceiptAsync` rejects a cancelled order and over-receipt (`152-197`). Status calculation distinguishes `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED` (`12-15`, `288-297`).
- `InventoryReceiptService.CreateFromPurchaseRequestAsync` only accepts `SENTTOSUPPLIER`/`PARTIALRECEIVED`, verifies supplier/unit/remaining quantity, writes ledger and status audit in one transaction (`140-344`).
- `InventoryIssueService` allows issue only for its explicit approved-demand set (`15-20`, `68-76`), prevents over-issue, writes stock movement, and transitions fully issued demand to `EXPORTED` with audit (`418-499`).
- `InventoryReturnService` blocks over-return/waste, warehouse mismatch and duplicate receipt confirmation; return/waste creates ledger evidence. These are immutable dependency families, not cleanup candidates.
- Existing data-quality cleanup guards skip purchase lines with receipt/order and inventory issues with returns, kitchen receipt or stock-movement references (`WorkflowReportService.cs:2113-2204`). Reuse the evidence families, not `CleanupDataQualityAsync` mutation behavior.

### Required Phase 5 rules

- `delete` is allowed only when the fresh evidence still proves a true orphan, every relevant reference family is complete, and stock equals zero. If evidence is missing/contradictory, convert to blocker and rollback; never downgrade uncertainty to archive/delete.
- Existing history, approval, audit, adjustment, stock ledger/movement, order/receipt/issue/return means retain/archive/deactivate according to the Phase 3 lifecycle policy. Approved/locked/completed documents and ledger rows are never updated to make cleanup easier.
- Apply mutations leaf-first and deterministic: eligible draft purchase/inventory leaves, then draft material demand/production, then draft menu, then BOM/catalog archive/delete. A locked downstream reference blocks the upstream destructive action.
- Compare the actual affected IDs and counts—not only row counts—to the freshly classified set. Any extra/missing ID or database concurrency error is rollback.
- The codebase uses several partially inconsistent status strings (`PARTIALRECEIVED` in inventory receipt versus `PARTIALLY_RECEIVED` in purchase orders, plus `MANAGERAPPROVED`, `APPROVED`, `SENTTOSUPPLIER`, `EXPORTED`). Phase 5 must consume the versioned Phase 3 lifecycle table and fail closed on unknown values rather than compose another private `HashSet`.

## 5. Material-demand BOM resolution, units and snapshots

### Current resolution behavior

`MaterialDemandService.GenerateAsync` derives tier from `MenuSchedule.MenuPrice`, selects effective published BOM and calls `ResolveBomLines` (`99-130`). The current resolver (`997-1019`) is **full-set shadowing**: if any matching customer line exists it returns only customer lines; otherwise it returns globals. This directly conflicts with approved ingredient-level overlay semantics.

Target resolver behavior for a dish/tier/effective date:

```text
effective global rows keyed by ingredient identity + technical unit
  overlaid by matching customer rows on the same key
  -> customer row replaces only its matching global row
  -> unmatched global rows remain
  -> customer-only ingredient rows are added
```

The target key must come from delivered `BomPolicy`/`CanonicalBomScopeKey`; do not invent a different key inside `MaterialDemandService`. Preserve deterministic ordering and reject overlapping/colliding active versions. `WorkflowGenerationTests.cs:367-433` characterizes whole-set customer preference and global fallback, but it does **not** prove partial overlay; add a fixture with at least two global ingredients and one customer override.

### Quantity and unit behavior

- `MaterialDemandCalculator.Calculate` (`7-28`) currently computes `servings × gross × portionRate × bomRate ÷ yieldRate`, while `MaterialDemandService` passes `FixedBomRatePercent=100` but still passes live `portionRule.PortionRatePercent` (`124-130`). Phase 5's canonical demand must not multiply the legacy portion-rule factor; representative expected quantity is `servings × grossQtyPerServing` with only explicitly approved yield semantics.
- Stock conversion is an existing good analog: `TryConvertQuantity` requires positive conversion rates and equal normalized base-unit code, then converts through base rate (`1031-1080`). Missing conversion becomes a typed issue rather than a silent conversion (`1082-1101`). Reuse the unit-policy result delivered by Phase 3 and keep unknown/ambiguous/nonconvertible cases blocking.
- `Materialrequestline` already stores the numerical BOM snapshot: `BomId`, tier, scope, servings, gross quantity, BOM rate, applied portion metadata, yield, total required, current stock and suggested purchase (`Materialrequestline.cs:18-42`). `EnsureMaterialRequestLine` writes/updates these fields (`MaterialDemandService.cs:755-810`). This is the existing historical snapshot boundary.
- `WorkflowReportService.GetIngredientDemandAsync` reads those stored material-request-line values (`430-504`), and purchase plan reads demand/purchase/receipt snapshots (`507-646`). These reports should continue reading stored document facts after BOM versioning.
- Not every report is snapshot-safe: `GetPriceVarianceByDishGroupAsync` loads today's active `Dishboms` and weights by current gross quantity (`909-959`), and several report labels navigate to current Dish/Ingredient/Unit names. Phase 5 must explicitly classify current-catalog reports versus historical reports. Historical numeric results must never re-resolve the latest BOM; if bit-for-bit labels are required, persist them rather than assuming current navigation is immutable.

## 6. BOM change token and scoped staleness

### Existing analog

`MaterialDemandService.GetStalenessAsync` (`179-290`) compares `Productionplan.UpdatedAt` with:

- quantity-line `UpdatedAt` (`237-245`);
- menu-version `CreatedAt` (`247-261`);
- current-stock `LastUpdated` for demand ingredients (`264-280`);
- cancelled demand status (`227-230`).

`Currentstock.RowVersion` is an existing EF concurrency analog: `[Timestamp]` in `Currentstock.cs:18-19` and `.IsRowVersion().IsConcurrencyToken()` in `IpcManagementContext.cs:2581-2586`. It protects stock writes; it is not a BOM staleness token.

### Missing target behavior

There is no persisted BOM change token/fingerprint on `Productionplan` or `Materialrequest`, and `Dishbom` has no `UpdatedAt`/rowversion suitable for scope-aware comparison. `BomId` on each material-request line snapshots the selected version but cannot by itself detect a newly added customer override/global ingredient.

Phase 5 should add one testable BOM-scope token abstraction (and a forward schema delta if persistence is required) built deterministically from the resolved ordered BOM set and Phase 3 provenance/version identity. Its scope includes customer, price tier, dish, effective date and ingredient+unit overlay key. Persist the token used by each generated draft document and recompute it for staleness. An unrelated dish/tier/customer/effective interval must not mark the document stale.

Do not use wall-clock timestamps alone, process-local cache state, max `BomId`, or the global latest run. Token comparison must survive restart and explain which scope changed.

## 7. Draft/open reconciliation and lifecycle maps

### Existing regeneration analogs and landmines

- `MaterialDemandService.GenerateAsync` upserts a production plan/material request, rewrites snapshot fields, and `PruneStaleLines` removes no-longer-generated demand/production lines (`648-810`). `WorkflowGenerationTests.cs:112-159` proves stale demand/production/purchase lines can be pruned on a second generation.
- `PurchaseRequestWorkflowService.GenerateFromDemandAsync` updates only when the purchase request is not `SENTTOSUPPLIER`, prunes stale lines and writes audit (`29-176`). `ClearStalePurchaseRequestAsync` also preserves a submitted request (`179-225`). Its submit validation compares the exact current shortage-line ID set and blocks stale purchase data (`494-566`), a useful set-equality guard.
- `SampleDataImportService.CustomMenu.InvalidateWorkflowDocumentsForMenuReimportAsync` (`531-605`) cancels **every non-cancelled** material/purchase request in the week/customer scope and audits it. It does not restrict to draft/open and is therefore an anti-pattern for Phase 5 retention.
- Current `MaterialDemandService.PruneStaleLines` removes `Purchaserequestlines` attached to a stale demand line without loading/checking purchase status, order or receipt (`692-719`). It must not be reused for canonical reconciliation until guarded.
- `EnsureMaterialRequestAsync` preserves `MANAGERAPPROVED` but resets every other existing status to `DRAFT` (`648-679`). This is not a lifecycle policy and can revive/overwrite unsupported states.

### Target reconciler

- Input is the fresh scoped BOM change set plus the delivered lifecycle policy; output is an explicit plan of `keep`, `mark-stale`, `cancel`, `regenerate`, or `block` per document.
- Only the exact draft/open statuses listed in the versioned policy may change. Ordered/received/issued/returned or approved/locked/completed evidence blocks regeneration/destructive upstream mutation.
- Process each document at most once per reconciliation run. Persist old/new linkage and source run (or equivalent) so retry/no-op tests can prove no duplicate replacement.
- Preserve completed/locked document rows and their audit/approval/ledger checksums bit-for-bit. Reconciliation should create a new draft snapshot or mutate an allowed draft; it must not recalculate history in place.
- Use deterministic dependency order and set equality before each leaf removal. If the actual candidate set differs from preview/fresh classification, rollback the complete apply.

## 8. Cache and report invalidation after commit

### Existing pattern

`DishService` stores two catalog cache keys with `IMemoryCache` and `ClearCatalogCache` removes both (`1580-1584`). Old bulk commit calls it only after transaction commit (`523-525`); manual add/update/close call it after `SaveChangesAsync` (`702-704`, `848-850`, `881-884`, `912-913`). This ordering is correct: preview never invalidates, and consumers should not see uncommitted state.

### Required Phase 5 abstraction

- There is no shared cache/tag/report invalidator. Create one post-commit abstraction owned by the BOM application boundary rather than calling `DishService`'s private method or duplicating string keys.
- Record invalidation intents while reconciling, commit database state, then invalidate current catalog/validation/report tags once. Do not clear cache inside the execution-strategy delegate or before commit.
- A post-commit invalidation failure cannot roll back an already committed database transaction. It must be observable and recoverable (for example, remove known local keys best-effort and mark/retry invalidation), while reads capable of bypass/refresh see the committed database state.
- Test both directions: injected pre-commit failure produces no invalidation; successful commit invalidates once; second idempotent no-op does not append audit/version and does not need destructive invalidation; the next current-catalog request sees new BOM; historical report still reads stored material-request snapshots.

## 9. Relational, injected-failure and idempotency test patterns

### Existing infrastructure to reuse

| Concern | Existing analog | Reuse | Phase 5 gap |
|---|---|---|---|
| Relational rollback | `CoordinationTransactionTests.cs:27-73`; shared SQLite connection, interceptor, fresh verification context | Inject a save failure and assert ordered before/after state from a new context. | Extend to domain + run + adjustment + audit + downstream tables and cancellation. |
| Audit failure injector | `ThrowOnAuditlogSaveChangesInterceptor` (`CoordinationTransactionTests.cs:635-663`) | The interceptor detects pending `Auditlog` and throws. | It is currently only defined, not used by a test; Phase 5 must wire it into an actual apply rollback test. |
| Transaction interaction | `InventoryIssueServiceTests.cs:100-170`, receipt/return tests | Assert commit on success and rollback on exception for fast feedback. | Mocks cannot prove relational atomicity or FK/checksum retention. |
| Mixed workflow fixture | `WorkflowGenerationTests` demand/purchase/inventory/report fixtures | Realistic statuses, links, stock and audit rows. | Add all six retention actions, all blocker families and immutable checksums. |
| Customer/tier/unit | `WorkflowGenerationTests.cs:367-479`, conversion tests around `300-363` | Exact tier/effective/unit behavior. | Partial ingredient overlay, all technical-unit families and unrelated-scope non-staleness. |
| Provider-hosted test | `CustomWebApplicationFactory.cs:10-25` | Replace context with isolated MySQL connection. | `WorkflowLifecycleE2ETests.cs:30-33` silently returns without env; Gate C must report BLOCKED, never green. |
| Duplicate guard | `ApprovalHandlerBase.SaveHistoryAsync:63-69`, `PurchaseOrderService` second-call test (`WorkflowGenerationTests.cs:4411-4424`) | Characterize duplicate/race behavior. | These throw/block; canonical apply requires persisted completed-result/no-op via unique fingerprint. |

### Required Phase 5 suites

1. `BomApplyTransactionTests`
   - stale/expired/actor/policy/effective-date/file/DB drift returns conflict with zero mutation;
   - injected exception before audit save, during downstream DML, during audit save, and cancellation all leave domain/run-success/adjustment/audit/downstream counts and immutable checksums unchanged;
   - action-ID/count mismatch and new blocker rollback;
   - successful apply commits domain, run counts, adjustments and audit together.

2. `BomApplyIdempotencyTests`
   - same source hash + contract/policy + effective date + scope/reason identity applies once;
   - concurrent duplicate attempts are serialized by the database unique fingerprint; one completes, the other returns the persisted result/no-op;
   - second call creates zero versions, adjustments, audits or downstream replacements;
   - retryable provider failure through the MySQL execution strategy does not double-write.

3. `BomRetentionApplyTests`
   - exact fresh delete IDs equal preview true-orphan IDs;
   - stock nonzero, history, approval, audit, ledger, movement, order, receipt, issue or return always retain/block;
   - approved/locked/completed, audit, approval and ledger ordered row checksums remain identical;
   - zero FK orphans after commit; unknown/incomplete/contradictory evidence blocks.

4. `BomDownstreamReconciliationTests`
   - 25k/30k/34k, every technical-unit family and conversion failures;
   - two-global/one-customer partial overlay proves customer replacement plus global fallback;
   - scoped token stales only affected customer/tier/dish/effective documents;
   - eligible draft/open documents regenerate once in leaf-first order with old/new/run linkage;
   - ordered/received/issued/returned and locked/completed block and remain unchanged;
   - no legacy portion-rule multiplication in canonical quantity fixtures.

5. `BomCacheReportConsistencyTests` and `DishManualBomAuditTests`
   - post-commit invalidation exactly once and no pre-commit invalidation;
   - current catalog/report sees new version, historical demand report retains stored old snapshot;
   - published manual edit without actor/reason rejects with zero mutation;
   - valid edit creates closed old version + new version + adjustment + audit atomically.

SQLite remains the fast relational loop. MySQL is mandatory for execution-strategy retry, isolation/fingerprint uniqueness, binary IDs, timestamp concurrency and hosted API apply behavior. An unavailable isolated MySQL target is a **BLOCKED** Gate C item, not a skipped pass.

## 10. Planner target-to-analog checklist

| Phase 5 target | Closest existing analog | Convention to retain | Mandatory divergence / stop condition |
|---|---|---|---|
| Transactional apply coordinator | inventory receipt/issue transactions; approval handler; old BOM commit | One context, domain+audit before one commit, explicit rollback | Add provider execution strategy, fresh revalidation, unique fingerprint/no-op; no old importer calls. |
| Run/audit/counts | old bulk audit; `Auditlog`; BOM adjustment | Actor/time/reason, old/new values, same transaction | Consume Phase 3 typed run contract; no optional actor/reason or free-form-only counts. |
| Published BOM version | `UpdateBomLineAsync:792-852` | Close old interval, new row, overlap guard | Shared Phase 3 policy, canonical provenance, full audit, transaction and unchanged=no-op. |
| Retention apply | Phase 4 planned classifier/evidence; report cleanup guards | Reference/stock/order/receipt/issue/return evidence | Phase 4 Gate B required; exact IDs/counts, unknown=block, no broad delete. |
| Customer overlay | current `ResolveBomLines` + tests | Effective published tier/customer filtering | Replace full-set shadowing with ingredient+unit overlay/global fallback. |
| Unit/demand math | stock conversion helper; demand snapshot fields | Typed conversion failure, decimal rounding, stored snapshots | No silent conversion/fallback KG and no legacy portion factor for canonical demand. |
| Staleness token | quantity/menu/stock timestamp checks; current-stock rowversion | Explainable scoped reasons | Add persisted deterministic BOM-scope token; no global timestamp/max-ID token. |
| Draft regeneration | demand/purchase upsert/prune | Deterministic upsert and set-equality checks | Versioned lifecycle policy, leaf-first, once/run, locked/operational states block. |
| Cache/report consistency | post-save `ClearCatalogCache`; material-line snapshot reports | Invalidate after commit; historical values from stored lines | Shared invalidator, once after retry delegate; classify/repair live-BOM historical reports. |
| Failure/idempotency evidence | relational interceptor fixture; inventory transaction mocks | Fresh verification context and explicit rollback assertions | MySQL retry/concurrency proof, no silent skip, immutable checksums across all protected families. |

## 11. Phase boundary and forbidden shortcuts

Allowed in Phase 5:

- canonical apply endpoint/application service after Gate B;
- transaction coordinator, mutation executor and typed persisted run result;
- published BOM versioning/provenance, retention-aware archive/deactivate/true-orphan delete;
- scope-aware BOM token, customer ingredient overlay and guarded draft/open reconciliation;
- manual published-edit audit hardening, post-commit invalidation and focused tests/Gate C evidence;
- forward schema migration only if needed for persisted staleness/linkage; never rewrite an applied migration.

Deferred/forbidden:

- no Admin shadcn/RTK workbench or legacy endpoint/template retirement (Phases 6/7);
- no `SampleDataImportService.ReplaceBomCatalog`, `Clean_Legacy_Imported_Bom.sql`, old `DishService.CommitBomImportAsync`, or `WorkflowReportService.CleanupDataQualityAsync` as the production runner;
- no broad `RemoveRange(all)`, cascade cleanup, status guessed from strings, client-supplied candidate/action/count/hash/actor, or best-effort continuation after drift;
- no mutation before Gate A/Gate B/backup marker/blocker-zero proof;
- no claim that Phase 3/4 planned artifacts already exist; executor must inspect delivered artifacts and stop if they differ materially from this map.

