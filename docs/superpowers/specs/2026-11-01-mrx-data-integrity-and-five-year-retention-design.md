# MRX Data Integrity and Five-Year Retention — Design

**Date:** 2026-11-01
**Status:** Approved by Owner — 2026-11-01
**Scope:** `MATERIAL_RECONCILIATION` reporting, immutable history, audit isolation, operational stock-provision transparency, query scale, import provenance, and five-year recovery
**Primary requirements:** `BR-GLOBAL-01`, `BR-GLOBAL-02`, `BR-GLOBAL-03`, `BR-MRX-EDIT-5`, `BR-MRX-EDIT-7`, `BR-MRX-EDIT-8`, `NFR-PERF-02`, `NFR-REL-01`

## 1. Intent

Make MRX facts accurate across Warehouse, Reconciliation, reports, CSV exports and recovery, while preserving enough immutable lineage to explain every quantity and decision for at least five calendar years.

The remediation closes nine audited defects:

1. Completed-register fabricates issued quantity by copying required quantity.
2. Variance-register uses gross issue quantity and can expose invalidated dispositions.
3. Source recomputation hard-deletes contributor lineage.
4. Supplemental issue, return and actual correction hard-delete disposition evidence.
5. MRX audit trail omits related entities and can mix DEFAULT inventory audit.
6. Backup/recovery contracts do not enforce five-year retention.
7. MRX automatic stock provisioning is not visible in create/detail UI.
8. Transaction-history date filters are ignored and the query is unbounded.
9. Rolled-back committed imports lose their normalized source graph.

This design treats accuracy and historical evidence as one contract: a report is not correct if it cannot be reconciled to retained source, ledger and decision facts.

## 2. Goals

- One canonical server-side net-issued calculation for daily status, variance, completion and completed-register reporting.
- Completed-register and variance-register must report ledger-derived facts; no status-derived quantities.
- Retain replaced contributors and invalidated dispositions as queryable history instead of deleting them.
- Scope MRX audit by proven MRX lineage, never by broad `BusinessArea == "Inventory"` alone.
- Keep operational MRX history queryable for at least five calendar years.
- Keep an encrypted, immutable, independently recoverable off-host archive for at least five calendar years.
- Surface every automatic MRX stock provision in the create response and persisted issue detail.
- Apply report filters and pagination in SQL before materialization.
- Preserve normalized committed-import provenance after rollback.
- Keep `DEFAULT != MATERIAL_RECONCILIATION` and existing actor/permission/mode/version protections.

## 3. Non-goals

- No data warehouse, event-sourcing rewrite, accounting subsystem or second stock ledger.
- No change to MRX lifecycle states or role ownership.
- No purchasing workflow inside MRX.
- No reconstruction of missing historical evidence from names, display order or guessed relationships.
- No migration application, production backup, provider operation, deployment or database mutation under this design/plan scope. Those require separate current authorization.
- No broad cleanup of unrelated DEFAULT reports, imports or legacy records.
- No new frontend primitive, styling authority or dependency.

## 4. Anti-goals

The remediation fails even if tests pass when it:

- copies required quantity into an issued field;
- treats missing linked ledger evidence as zero or success;
- hard-deletes a valid contributor, disposition, stock movement, issue, return, revision or audit record;
- includes a DEFAULT audit row in an MRX report;
- claims five-year retention from a local 14-day ZIP or an unverified provider receipt;
- displays auto-provision metadata that cannot be reloaded from durable data;
- implements filters only in the browser or after `ToListAsync`;
- creates a test-only export, wrapper, fake API path or synthetic production record.

## 5. Current ownership and observed costs

| Concern | Current owner | Observed cost |
|---|---|---|
| Daily net issue projection | `ReconciliationBatchService.GetWarehouseDailyAsync` | Correct logic is local to one large service and is reimplemented differently by reports. |
| Variance/completed/history/audit reports | `ReconciliationReportsService` | Gross issue totals, fabricated completed totals, ignored filters and broad audit scope. |
| Source revision recomputation | `MrxBatchRecomputer` | Replaced contributor rows are physically deleted. |
| Disposition freshness | `ReconciliationActualService`, `ReconciliationInventoryIssueCreator`, `InventoryReturnService` | Daily invalidation model exists, but several paths delete evidence. |
| MRX stock provisioning | `ReconciliationInventoryIssueCreator`, `StockLedgerService` | Durable adjustment exists but is referenced too broadly and omitted from DTO/UI. |
| Menu import rollback | `WeeklyMenuImportHistoryService` | Committed normalized source rows are deleted. |
| Recovery | `tools/db/*`, `scripts/database-recovery/*`, `docs/OPERATIONS.md` | Operational 14-day target exists; five-year minimum and live evidence do not. |

## 6. Approaches considered

### Approach A — Patch each endpoint independently

Fix completed totals, variance totals, audit filtering and UI separately.

- **Advantage:** smallest initial diffs.
- **Cost:** repeats ledger logic, leaves future divergence likely, and does not establish a coherent retention contract.
- **Decision:** rejected.

### Approach B — Replace MRX persistence with event sourcing

Model every source, issue and disposition transition as a new event store.

- **Advantage:** natural historical reconstruction.
- **Cost:** replaces stable EF/MySQL owners, duplicates existing stock/audit/revision ledgers and greatly expands migration risk.
- **Decision:** rejected as unnecessary.

### Approach C — Strengthen existing owners with shared deterministic projections and soft invalidation

Keep current entities, transactions and routes. Extract one internal net-ledger projection, retain historical rows with invalidation metadata, query audits through proven lineage, and enforce a separate five-year archive contract.

- **Advantage:** smallest complete change, preserves deployed architecture and makes all consumers agree.
- **Cost:** requires bounded schema migrations and generated API updates.
- **Decision:** selected by Owner.

## 7. Delivery structure and priority

One umbrella contract is implemented through three sequential, independently reviewable phases.

### Phase 1 — Quantitative truth and immutable evidence

Priority: highest. Until complete, MRX reports may be numerically wrong and historical lineage may disappear.

- Canonical net-issued projection.
- Correct variance and completed reports.
- Contributor soft invalidation.
- Weekly/daily disposition soft invalidation.
- Existing lifecycle/concurrency behavior unchanged.

### Phase 2 — Audit isolation and five-year retention

- Batch-lineage audit scope.
- DEFAULT/MRX audit isolation.
- Five-year operational-history policy.
- Five-year immutable provider retention enforcement.
- Restore evidence and runbook contracts.
- Rolled-back import provenance retention.

### Phase 3 — Operational transparency and scale

- Durable issue-level stock-provision lineage and UI badges.
- SQL date/batch filtering and server pagination for transaction history.
- Generated contract and frontend pagination updates.
- Focused performance and full-flow verification.

Phase 2 may begin only after Phase 1 contracts are stable. Phase 3 consumes the retained/audit identities established by Phases 1–2.

## 8. Canonical quantitative authority

### 8.1 Net-issued grain

The canonical grain is:

```text
reconciliationBatchDailyLineId
  → grossIssued
  → receivedReturnQuantity
  → netIssued = round6(grossIssued - receivedReturnQuantity)
```

Only linked `InventoryIssueLine` rows count. Only received returns count. Missing linked issue lines produce `null / UNTOUCHED`, not decimal zero.

### 8.2 Internal owner

Create the internal Reconciliation owner:

```csharp
internal sealed class ReconciliationNetIssueProjection
```

It accepts a bounded set of daily-line IDs or batch IDs and returns typed facts containing:

- daily line ID;
- gross issued quantity;
- received return quantity;
- net issued quantity;
- whether any linked issue exists.

It performs database filtering before materialization and uses `DecimalPolicy.RoundQuantity`/six-decimal authority.

### 8.3 Consumers

The following must consume this same projection:

- `ReconciliationBatchService.GetWarehouseDailyAsync`;
- `ReconciliationActualService.SetDailyDispositionAsync` freshness/status calculation;
- `ReconciliationCompletionService` through the daily projection;
- `ReconciliationReportsService.GetVarianceRegisterAsync`;
- `ReconciliationReportsService.GetCompletedRegisterAsync`.

No report may derive physical issued quantity from `Status`, `RequiredQuantity`, a disposition, or UI state.

### 8.4 Completed-register behavior

For every completed batch:

- `TotalRequired` = retained frozen weekly requirement total.
- `TotalIssued` = sum of canonical daily net-issued facts.
- `TotalVariance` = `round6(TotalIssued - TotalRequired)`.
- A completed batch may legitimately have non-zero variance when all required dispositions are valid.
- Missing daily lineage remains an explicit legacy compatibility branch; it must not fabricate equality. The completed register must expose unavailable quantitative fields or use the existing legacy authority only when proven.

### 8.5 Variance-register behavior

- Uses net issued, not gross issued.
- Includes only active daily dispositions where `InvalidatedAt == null` as current decisions.
- Historical invalidated decisions remain available through audit/history, not current decision columns.
- Exact normalized difference is omitted from the variance list.
- Under/over labels come from the same `ReconciliationDailyIssuePolicy` used by Warehouse/completion.

## 9. Immutable contributor history

### 9.1 Schema behavior

`ReconciliationBatchContributor` gains bounded historical validity metadata:

- `InvalidatedAt` nullable;
- `InvalidatedBySourceRevisionId` nullable FK to `ReconciliationSourceRevision` with `Restrict` delete behavior.

Existing rows migrate as active (`NULL`). New contributors are active. When source revision changes an open day:

1. Existing active contributors for changed identities receive invalidation metadata.
2. New contributor rows are appended.
3. Unchanged days/identities retain their existing rows and IDs.
4. Locked dates remain untouched.

Operational projections filter active contributors. Historical/revision queries may include invalidated rows.

No contributor hard delete is allowed after migration.

### 9.2 Revision traceability

A source revision must be able to answer:

- which contributor rows stopped being active;
- which contributor rows became active;
- the before/after required quantity delta;
- actor, role, mode, reason and time.

The existing revision/delta tables remain owners; no second event store is introduced.

## 10. Immutable disposition history

### 10.1 Daily dispositions

Use existing fields:

- `InvalidatedAt`;
- `InvalidatedBy`;
- `InvalidationReason`.

Supplemental issue, received return, actual correction and source recomputation invalidate the current decision instead of deleting it.

A new decision for the same daily line must append a new disposition row. Therefore the current unique relationship must become “at most one active disposition,” implemented with the existing MySQL generated-nullable-key pattern or another reviewed database fence. Reusing and clearing an invalidated row is prohibited because it destroys the prior decision version.

### 10.2 Weekly dispositions

`ReconciliationDisposition` gains the same invalidation metadata and active-row uniqueness behavior. Weekly legacy compatibility remains readable; new daily-line batches continue to use daily decisions.

### 10.3 Query semantics

- Current comparison/completion reads only active dispositions.
- History/audit reads all versions.
- Invalidation records the invalidating actor, exact reason, timestamp and correlation/command identity where available.
- No code path calls `Remove` for a valid MRX disposition.

## 11. MRX audit isolation and completeness

### 11.1 Proven lineage scope

A batch-scoped audit query builds a bounded identity set from persisted relations:

- batch;
- batch lines and daily lines;
- contributors;
- source revisions and deltas;
- menu amendment(s) and applied menu versions;
- quantity import batch and relevant quantity lines;
- MRX inventory issues and issue lines;
- received legacy returns/return lines where present;
- active and invalidated dispositions;
- lifecycle command receipts/transitions associated with the batch.

Audit rows are included only when entity type and entity ID match this proven set, or when a canonical correlation/source relation binds them to the batch.

### 11.2 Global MRX audit

The unscoped MRX audit endpoint must not use `BusinessArea == "Inventory"` as sufficient evidence. It includes Inventory audits only when their entity has MRX batch lineage.

`DEFAULT` inventory records remain absent even while both modes share physical stock.

### 11.3 Table and CSV parity

The table endpoint and CSV export use the same query and filters. Pagination changes presentation only; it cannot change membership semantics.

## 12. Five-year retention contract

### 12.1 Operational history

For at least five calendar years from the business record’s terminal or creation timestamp, whichever is later:

- MRX batches, frozen lines, daily lines, contributors, revisions, deltas, issues, issue lines, stock movements, returns, dispositions, audits, lifecycle receipts and normalized committed-import provenance remain queryable.
- No cleanup command may hard-delete these records.
- Customer/user/master records referenced by retained history use restrict/retained identity behavior sufficient to keep historical reads valid.
- Retention is not implemented by keeping only display strings or a checksum.

Records older than five years still require an explicit, separately authorized archival/disposition policy; this scope does not add automatic purge.

### 12.2 Archive retention

Operational short-term backups and historical archives are separate:

- **Operational backup:** every `<= 4h`, target retention 14–30 days, RPO/RTO contract unchanged.
- **Historical archive:** encrypted immutable off-host object retained until at least `archiveCreatedAtUtc.AddYears(5)`.

`Assert-ProviderReceipt` must reject a receipt whose `retainUntilUtc` is earlier than the five-calendar-year threshold. Live provider metadata must match the receipt.

The local `Backup-Database.ps1` default remains an operational tool but must not claim five-year compliance. Its cleanup must never target provider/archive evidence.

### 12.3 Required evidence

Five-year retention is `NEEDS_EVIDENCE` until an authorized environment proves:

- official provider adapter identity;
- object version and encryption key reference;
- immutable lock state;
- live `retainUntilUtc` meeting the threshold;
- independent off-host/account security domain;
- successful restore drill to a new `ipc_restore_*` target;
- schema, row, ledger and MRX business-oracle parity;
- measured RPO/RTO.

Repository tests prove guards, not live retention.

## 13. Rolled-back import provenance

A committed import that is rolled back must retain its normalized source graph for five years. The operational `MenuSchedule` table cannot own immutable version history because it has a unique customer/date/shift key and reimport mutates that row to the next version. Therefore provenance is retained as a version-owned normalized snapshot, not by pretending mutable schedules are immutable.

Selected behavior:

- `MenuVersion` owns `NormalizedSourceSnapshotJson` (`longtext`) containing the committed customer/week/tier plus every date/shift/slot, dish ID/name and persisted source order needed to explain the import result.
- New commits write the snapshot in the same transaction as the import. For a legacy DRAFT version without a snapshot, rollback first materializes the snapshot from its still-current schedule/menu graph, then may remove the operational draft projection.
- `MenuVersion` becomes `ROLLED_BACK`; its snapshot, checksum, file metadata, actor/time and audit remain retained.
- A guarded import-history detail query exposes the normalized snapshot. Operational weekly queries continue to select only active/current versions.
- Rollback remains forbidden once quantity/downstream authority makes it unsafe.

No missing legacy snapshot is fabricated after its operational graph has already disappeared. Restoring an old version continues through an explicit version/rollback command with concurrency checks; the snapshot is evidence, not a mutation source by default.

## 14. Transparent MRX stock provisioning

### 14.1 Durable lineage

The issue ID already exists before shortage provisioning. MRX provision `StockMovement` rows must use:

- `MovementType = ADJUSTMENT`;
- `RefTable = inventoryissues` (canonical entity/table token selected consistently with existing ledger conventions);
- `RefId = issueId`;
- reason/note explicitly identifying `MRX provision` and the reconciliation batch.

The issue’s `ReconciliationBatchId` preserves batch lineage. This binds every provision to the exact issue that consumed it without a new table or second ledger.

### 14.2 API contracts

Both `InventoryIssueCreatedDto` and MRX `InventoryIssueDto` detail expose a read-only collection:

```text
ingredientId
unitId
unitName
provisionedQuantity
stockMovementId (technical detail only)
```

The create response is generated from the persisted movements, not only transient shortage data, so idempotent replay returns the same metadata.

### 14.3 UI behavior

- Successful initial/supplemental issue shows a non-blocking amber notice when provisioning occurred.
- Issue detail shows `Đã tự động bù tồn kho: +X <unit>` on each affected ingredient.
- No badge appears without durable adjustment evidence.
- Provisioning remains one atomic protected transaction with the issue and ISSUE movements.
- This visibility does not create a Purchasing action or imply a receipt.

## 15. Transaction-history filtering and scale

### 15.1 Query contract

`batchId`, `fromDate`, `toDate`, `pageNumber` and `pageSize` are applied to `IQueryable` before `ToListAsync`.

Validation:

- `fromDate <= toDate`;
- page number `>= 1`;
- page size bounded by configured `Pagination:MaxPageSize`;
- all filters preserve MRX-only lineage.

The table endpoint returns canonical page metadata. CSV uses the same batch/date scope and exports the full filtered result through a bounded/streaming implementation; it does not silently export only the visible page.

### 15.2 Expected load

The design targets 10–50 authenticated users, about 20 active workers, 100–300 customers and five years of two-shift daily history, yielding hundreds of thousands to low millions of issue/audit/contributor rows.

Required indexes are selected from actual generated SQL/query plans, at minimum covering:

- MRX issue batch/date/created ordering;
- issue-line daily lineage;
- received return source issue line;
- active contributor daily/revision scope;
- active disposition daily/weekly scope;
- audit entity type/entity ID/time;
- source revision batch/revision number.

No speculative index is added without query evidence.

## 16. API, frontend and compatibility

- Backend DTO changes require authorized OpenAPI regeneration; generated files are never hand-edited.
- Existing handwritten MRX aliases consume generated schema where already established.
- Transaction-history UI gains server pagination using existing pagination primitives/patterns.
- Stock-provision UI reuses `Badge`, `InlineBanner`, `Num` and existing workbench/modal owners; no CSS token or primitive is added.
- Existing URLs remain; only optional pagination query parameters and response fields are added.
- Legacy completed batches without daily lineage remain readable with explicit unavailable compatibility, never fabricated values.
- Existing actor permissions and mode guards remain unchanged.

## 17. Failure and concurrency behavior

- All mutation paths continue through protected transactions and expected mode/aggregate versions.
- Source apply versus issue race remains exactly-one-winner.
- Invalidation and replacement rows commit atomically with the mutation that made the old evidence stale.
- Idempotent issue replay returns the original provision metadata.
- A retry after uncertain commit verifies durable rows, not tracked state.
- A report with incomplete lineage returns explicit compatibility/partial status or fails closed; it never fills missing quantities.
- Archive guard failure stops archival publication and does not delete the operational backup.
- Restore failure leaves production untouched and retains provider object/receipt evidence.

## 18. Migration strategy

Three bounded forward migrations are preferred, aligned with the phases:

1. Contributor/disposition invalidation and active-row fences.
2. Version-owned normalized import snapshot and its guarded history-query support.
3. Query indexes required by measured MRX report SQL.

Each migration requires:

- Designer/snapshot parity;
- no destructive `Down` claim as operational recovery;
- backfill existing rows as active without inventing actor/reason;
- duplicate preflight before adding active-row unique fences;
- isolated MySQL application and rollback rehearsal under separate authorization;
- no application to `ipcmanagement` during implementation verification.

## 19. Verification strategy

### Phase 1

- Owner regression: completed batch with accepted non-zero variance reports real net issued.
- Owner regression: received return changes variance report exactly as Warehouse daily projection.
- Owner regression: invalidated disposition is absent from current report/completion but retained historically.
- Owner regression: source revision retains old and new contributor rows.
- Relational concurrency tests for active disposition fence and source apply/issue behavior.

### Phase 2

- Audit contract: batch report includes daily/issue/amendment/revision events and excludes unrelated DEFAULT inventory audit.
- Rollback provenance: committed normalized rows remain queryable but absent from active weekly source.
- Retention guard tests reject `retainUntilUtc < createdAt + 5 years`, including leap-year boundary.
- Recovery script contract tests keep provider/live metadata checks fail-closed.
- Authorized provider/restore evidence remains separately gated.

### Phase 3

- API/component tests show provision metadata only from durable movement lineage and preserve it on command replay/reload.
- Transaction-history tests prove date/batch filtering occurs in SQL semantics and page metadata is correct.
- CSV parity test proves full filtered scope rather than current page.
- Frontend tests cover loading, empty, error, permission-denied, partial and conflict states without mocking the feature owner.
- Permanent sandbox E2E covers issue with declared shortage → visible provision → detail reload → reconciliation/completion/report consistency.

### Final gates

- Focused RED→GREEN tests per owner.
- Full relevant Backend, generated API parity, Frontend unit/lint/dependency/build.
- Strict architecture and root aggregate verification.
- Authorized isolated MySQL integration and MRX browser path.
- `ipc-test-audit`, `ipc-code-review`; `ipc-ui-review` for Phase 3 UI changes.
- Report `PASS / FAIL / NEEDS_EVIDENCE / BLOCKED` per criterion; no production-readiness claim from unit tests alone.

## 20. Documentation owners to update during implementation

- `docs/DOMAIN.md`: append-only MRX historical decision/contributor and five-year retention invariants.
- `docs/domain/material-reconciliation.md`: canonical net-issued report authority, provision visibility and historical query behavior.
- `docs/FLOWS.md`: report/audit/recovery handoff where behavior changes.
- `docs/OPERATIONS.md`: operational versus five-year archive policy and evidence status.
- Generated OpenAPI/schema after authorized DTO changes.
- `.planning/WORK.md`: sole lifecycle/task state and verification evidence.

## 21. Acceptance criteria

The program is complete only when:

1. Completed and variance reports equal the canonical linked stock ledger for the same batch/daily lines.
2. No report copies required quantity into issued quantity or treats missing lineage as equality.
3. Replaced contributors and stale dispositions remain queryable with invalidation lineage.
4. Current projections ignore invalidated records without erasing them.
5. Batch audit includes all proven MRX-related entities and excludes unrelated DEFAULT inventory audit.
6. Committed rolled-back imports retain normalized source provenance while remaining operationally inactive.
7. Auto-provision is durably tied to the exact issue and visible after reload/idempotent replay.
8. Transaction-history batch/date filters and pagination execute server-side; CSV uses the same full filtered scope.
9. Repository guards require five calendar years for immutable archive receipts.
10. An authorized live provider/restore drill supplies independent evidence before retention is marked PASS.
11. No valid MRX operational history is hard-deleted before five years.
12. `DOM-MODE-1`, RBAC, versioning, locking, idempotency and stock-ledger invariants remain intact.

## 22. Builder calls settled by this design

- Use the existing EF/MySQL/transaction architecture, not event sourcing.
- Use one internal net-ledger projector, not endpoint-specific arithmetic.
- Retain history through append + invalidation, not audit-summary-plus-delete.
- Bind provision movement to exact issue ID; derive batch through the issue.
- Treat five years as both queryable operational history and immutable off-host recovery.
- Split execution into three phase plans; no mega-plan execution.

No unresolved product decision remains for planning. Provider selection, credentials, production target, archive schedule ownership and migration application remain operational authorization/evidence questions, not implementation design choices.
