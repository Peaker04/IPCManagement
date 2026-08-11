# Lifecycle kernel migration runbook

> Vận hành runtime, lane, artifact và database synchronization gate dùng chung được khóa
> ở `docs/SHIPYARD-OPERATIONS.md`. Runbook này là phần migration/data-integrity chi tiết
> của gate đó.

## Scope

Migration `20260808170000_AddLifecycleKernel` is additive only. It creates:

- `lifecycletransitions` — append-only transition evidence;
- `lifecycleoutboxmessages` — committed-but-undelivered event rows; and
- `lifecyclecommandreceipts` — idempotent command responses.

It changes no existing document table, status, stock movement, receipt writer or runtime behavior.

## Preconditions

1. Confirm the target database/lane and migration history; never run against `ipc_lane1` merely for a test.
2. Preserve an approved backup/checkpoint and capture `__EFMigrationsHistory` before deployment.
3. Confirm migration `20260808160000_EnforceMenuAmendmentSeparation` is already present.
4. Generate/review the idempotent SQL script from the checkout being deployed. The current local review artifact is `.artifacts/lifecycle-standardization/phase2-add-lifecycle-kernel.sql`.
5. Stop deployment if any of the three table names already exist without the matching EF history entry; reconcile manually rather than force applying.

## Deployment

Use reviewed SQL/bundle through the normal database release lane. Do not invoke automatic runtime migration from multiple API instances. After apply, verify all three tables, their unique indexes and the recorded migration ID.

## Rollback

Before any lifecycle command writes these tables, the technical down migration drops only the three new empty tables. After transition evidence exists, do not use destructive down migration: disable the feature path, preserve evidence, and recover with the approved database checkpoint/runbook if a rollback is required.

## Post-deploy verification

- `dotnet ef migrations has-pending-model-changes` is clean in the deploy checkout.
- A transaction containing a staged lifecycle transition produces one transition, one outbox row, one command receipt and one audit record.
- Replaying the same command ID returns the existing receipt and does not stage a second event.
- No receipt stock movement is created by this phase; Receipt integration starts only in Phase 3.

## Clone preservation và base promotion

`ipcmanagement` là base đích cuối. Một migration hoặc reconciliation mới phải được rehearsal trên
`ipc_lane9` theo thứ tự `preflight → reviewed SQL → apply → postflight → rollback evidence → re-apply`.
Sau khi lane pass, base chỉ nhận đúng reviewed SQL/reconciliation artifact đã khóa hash, sau checkpoint
riêng và cùng business/schema oracle; không clone hoặc restore toàn bộ lane đè lên base.

Database clone phải dựng bảng từ `SHOW CREATE TABLE`, copy trigger và so table definition, foreign-key
inventory cùng trigger inventory. Clone phải fail-closed nếu migration history chứa migration sở hữu
trigger/schema object nhưng target thiếu object đó. `CREATE TABLE ... LIKE` không đủ làm clone contract
vì không bảo toàn foreign key; row count và table-name equality riêng lẻ cũng không chứng minh schema
integrity.

Mỗi promotion phải lưu tối thiểu: target database, migration history trước/sau, checkpoint path + hash,
reviewed SQL hash, apply result, postflight schema/business evidence, rollback result của rehearsal và
health readiness. Không chạy mutation nào trong contract này trên `ipc_lane1`.

## Phase 4 lineage migrations — preflight before apply

Migrations `20260809123338_AddInventoryReturnLineSourceIssueLine` and
`20260809125931_AddInventoryIssueLineMaterialRequestSource` are additive nullable
foreign keys. They must not be applied until a read-only preflight on the selected
non-production lane classifies every historical row. Do not backfill a source ID by
ingredient name, issue header, or a first matching demand row.

Run the following read-only checks on the target lane and retain their result with
the deployment evidence (replace neither `USE` nor the target connection in this
file):

```powershell
dotnet run --project backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj --no-build -- `
  lineage-preflight --settings backend/src/IPCManagement.Api/appsettings.json --database ipc_lane9

# Emits every ambiguous IssueLineId with its candidate count for manual disposition.
dotnet run --project backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj --no-build -- `
  lineage-preflight-details --settings backend/src/IPCManagement.Api/appsettings.json --database ipc_lane9
```

```sql
-- Issue rows that would stay legacy after migration. A matching demand count of
-- one is only a candidate for a reviewed backfill; zero or many is an exception.
SELECT iil.`issueLineId`, iil.`issueId`, iil.`ingredientId`, iil.`unitId`,
       COUNT(mrl.`requestLineId`) AS `matchingDemandLineCount`
FROM `inventoryissuelines` AS iil
LEFT JOIN `inventoryissues` AS ii ON ii.`issueId` = iil.`issueId`
LEFT JOIN `materialrequestlines` AS mrl
  ON mrl.`requestId` = ii.`materialRequestId`
 AND mrl.`ingredientId` = iil.`ingredientId`
 AND mrl.`unitId` = iil.`unitId`
GROUP BY iil.`issueLineId`, iil.`issueId`, iil.`ingredientId`, iil.`unitId`
HAVING COUNT(mrl.`requestLineId`) <> 1;

-- All pre-migration returns remain explicitly unallocated until a human
-- disposition is recorded. They are never inferred from ingredient/unit.
SELECT irl.`returnLineId`, irl.`returnId`, ir.`issueId`, irl.`ingredientId`,
       irl.`unitId`, irl.`quantity`
FROM `inventoryreturnlines` AS irl
JOIN `inventoryreturns` AS ir ON ir.`returnId` = irl.`returnId`;

-- Run this only after the additive migration has been applied to the isolated
-- lane and before any reviewed backfill. Existing source/unit mismatches must
-- block the release because the new FK proves existence, not compatibility.
SELECT iil.`issueLineId`, iil.`materialRequestLineId`
FROM `inventoryissuelines` AS iil
JOIN `materialrequestlines` AS mrl ON mrl.`requestLineId` = iil.`materialRequestLineId`
WHERE iil.`ingredientId` <> mrl.`ingredientId` OR iil.`unitId` <> mrl.`unitId`;
```

The expected pre-expand posture is: all ambiguous issue rows and every historic
return row are explicitly marked as legacy/reconciliation exceptions. The expected
post-expand posture is: zero source/unit mismatch. No automated UPDATE is executed.
The reviewed additive source-line migrations and
`20260809144527_AddLegacyLineageDispositionWorkflow` are applied on `ipc_lane9`.
The latest preflight reports `DispositionRows=0`, `AmbiguousIssueLines=173`,
`LegacyReturnLines=3`, and the open-line unique fence is present. Do not apply
these migrations to `ipc_lane1`.

## Phase 4 legacy-lineage disposition workflow

Every legacy issue/return line is handled independently:

```text
Admin create proposal → PENDING_MANAGER_REVIEW
Manager (different actor) approve/reject → APPROVED | REJECTED
Admin apply approved provenance → APPLIED
```

The API validates material-request/issue, ingredient and unit at create and again
at apply. `APPLIED` writes only the nullable source FK. Rejected, stale-version,
self-review, wrong-role, duplicate-active and already-mapped-source cases remain
exceptions and must not alter quantities or stock movements. The reconciliation
projection returns each source-line disposition so the UI can perform the same
reviewed workflow without inferring by ingredient name.

## Phase 4 supplemental open-request fence

Migration `20260809141103_AddOpenSupplementalRequestUniqueFence` adds the virtual
generated column `openIssueLineId` and unique index
`uxSupplementalMaterialRequestsOpenIssueLine`. The expression is non-null only
while a supplemental request is not `REJECTED` or `FULFILLED`, so it permits
terminal history but forbids more than one active exception for an issue line.
It is the database concurrency boundary; the service-level lookup is only an early,
idempotent response.

Before apply, stop API writers and run this read-only preflight on the chosen lane:

```powershell
dotnet run --project backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj --no-build -- `
  supplemental-open-preflight --settings backend/src/IPCManagement.Api/appsettings.json --database ipc_lane9
```

`DuplicateOpenIssueLineCount` must be zero. If it is not, do not apply the
migration or choose a winner: disposition each existing active request first. Review
the generated SQL: it must contain only the virtual `ADD COLUMN`, `CREATE UNIQUE
INDEX` and EF history row—no data update, delete, backfill or fallback writer.

After apply, rerun the same command. It must report
`OpenFenceMigrationApplied=1`, `GeneratedOpenIssueLineColumnCount=1` and
`OpenIssueLineUniqueIndexCount=1`, in addition to zero duplicate groups. A duplicate
key from the named index is an idempotent concurrent-create outcome and must return
the request created by the winning transaction; do not use `INSERT IGNORE`,
`REPLACE`, or destructive upserts. The primary-source rationale and MySQL/MariaDB
caveats are in `docs/research/mysql-open-supplemental-request-uniqueness-2026-08-09.md`.

### Rollback-only contention proof

After the post-apply preflight is clean, run the two-connection timing probe only
on `ipc_lane9`:

```powershell
dotnet run --project backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj --no-build -- `
  supplemental-open-concurrency-probe --settings backend/src/IPCManagement.Api/appsettings.json --database ipc_lane9
```

The command inserts two different requests for one eligible issue line in separate
transactions. The first transaction remains open; the second must return
`LOCK_WAIT_TIMEOUT` on the generated-column unique index. Both transactions are
then rolled back, and `ResidualRows` must be `0`. The command rejects every target
other than `ipc_lane9` before opening a database connection; it is verification
only, never a seeding or cleanup mechanism.
