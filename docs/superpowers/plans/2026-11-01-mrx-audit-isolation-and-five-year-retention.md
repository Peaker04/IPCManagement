# MRX Audit Isolation and Five-Year Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MRX audit complete and mode-isolated, retain rolled-back import provenance, and enforce five-calendar-year operational/archive retention contracts.

**Architecture:** Build batch audit membership from persisted MRX lineage instead of business-area labels. Preserve committed import source rows as inactive history, then strengthen existing recovery scripts so immutable provider receipts cannot pass unless their live lock covers at least five calendar years.

**Tech Stack:** ASP.NET Core 9, C# 13, EF Core 9/Pomelo, MySQL, PowerShell 5+, xUnit, FluentAssertions.

**Spec:** `docs/superpowers/specs/2026-11-01-mrx-data-integrity-and-five-year-retention-design.md`

## Global Constraints

- Phase 1 plan must be complete and its active/history semantics stable before this plan starts.
- `DEFAULT != MATERIAL_RECONCILIATION`; broad `BusinessArea == "Inventory"` is never sufficient MRX membership evidence.
- Keep MRX operational history queryable for at least five calendar years; this plan adds no automatic purge after five years.
- Historical archive must be encrypted, immutable, off-host and retained until at least `archiveCreatedAtUtc.AddYears(5)`.
- Repository guards are not live provider evidence; runtime retention remains `NEEDS_EVIDENCE` until an authorized restore drill.
- No source row, audit row, stock movement or decision history may be reconstructed from names or fabricated metadata.
- Do not apply migrations, run provider operations, restore or drop databases without separate exact-target authorization.
- Add no dependency, second state ledger, allowlist or test-only production seam.
- Commit steps require explicit Owner authorization at execution; otherwise record `NOT_RUN`.

## Review Focus

- An MRX batch audit includes issue-line/daily-line/source-revision events whose `EntityId` is not the batch ID — pinned in Task 1.
- An unrelated DEFAULT inventory audit never appears in global or batch MRX audit — pinned in Tasks 1–2.
- A rolled-back committed import remains inspectable but cannot become the active weekly source — pinned in Task 3.
- A leap-day archive created on 2024-02-29 must satisfy calendar `AddYears(5)`, not a guessed day count — pinned in Task 4.
- A receipt can pass static shape checks only when matching live provider metadata carries the same five-year lock — pinned in Tasks 4–5.

---

### Task 1: Proven MRX Audit Scope Query

**Files:**
- Create: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxAuditScopeQuery.cs`
- Create: `backend/tests/IPCManagement.Api.Tests/MrxAuditScopeQueryTests.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`

**Interfaces:**
- Consumes: Phase 1 retained contributors/dispositions plus batch, daily, source revision/delta, amendment, quantity import, issue/return and lifecycle relations.
- Produces: `MrxAuditScopeQuery.Apply(IQueryable<AuditLog> audits, byte[]? batchId)`; the returned query proves membership through explicit entity-type plus relational subqueries and remains server-side.

- [ ] **Step 1: Write failing scope tests**

Create tests:

```csharp
Batch_scope_includes_related_daily_issue_amendment_revision_and_disposition_ids()
Batch_scope_excludes_unrelated_mrx_batch_and_default_inventory_ids()
Global_scope_excludes_default_inventory_audit_with_same_business_area()
```

Seed exact related IDs and one unrelated DEFAULT issue audit. Assert membership by both entity type and entity ID.

- [ ] **Step 2: Run tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxAuditScopeQueryTests"
```

Expected: FAIL because the scope query does not exist.

- [ ] **Step 3: Implement bounded lineage resolution**

Resolve only the requested batch’s identity graph. Keep entity-type names explicit; avoid a generic reflection crawler or loading full tables.

- [ ] **Step 4: Integrate the report service**

For batch scope, filter by resolved typed identities. For global scope, use persisted MRX relations to include only MRX rows. Retain existing actor projection/order.

- [ ] **Step 5: Run scope and report tests**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxAuditScopeQueryTests|FullyQualifiedName~ReconciliationDashboardAndReportsTests"
```

Expected: PASS; unrelated DEFAULT audit absent.

- [ ] **Step 6: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxAuditScopeQuery.cs backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs backend/tests/IPCManagement.Api.Tests/MrxAuditScopeQueryTests.cs backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs
git commit -m "fix(mrx): scope audit by persisted lineage"
```

### Task 2: Audit Table/CSV Pagination Parity

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationReportsController.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs`

**Interfaces:**
- Consumes Task 1 scope query.
- Produces one shared filtered/sorted audit query used by table page and CSV export.
- CSV exports the full filtered audit scope; table remains paged.

- [ ] **Step 1: Add failing parity tests**

Assert page 1/page size 1 returns one row with total 2 while CSV contains both scoped rows and neither unrelated row. Assert table and CSV share batch membership semantics.

- [ ] **Step 2: Run and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationDashboardAndReportsTests.Audit"
```

Expected: FAIL where CSV currently consumes one requested page.

- [ ] **Step 3: Extract one audit query composition**

Keep paging only in the table method. Add a full filtered export method that reuses scope/order but does not fake “full history” from a page DTO.

- [ ] **Step 4: Run controller/report tests**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationDashboardAndReportsTests|FullyQualifiedName~ReconciliationReportsController"
```

Expected: PASS.

- [ ] **Step 5: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationReportsController.cs backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs
git commit -m "fix(mrx): keep audit table and export in scope"
```

### Task 3: Retain Rolled-Back Import Provenance

**Files:**
- Modify: `backend/src/IPCManagement.Api/Models/Entities/MenuVersion.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Coordination/Persistence/MenuEntityConfigurations.cs`
- Modify: `backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportPersistence.cs`
- Modify: `backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportHistoryService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuServiceContracts.cs`
- Modify: `backend/src/IPCManagement.Api/Features/SampleData/Contracts/SampleDataImportDto.cs`
- Modify: `backend/src/IPCManagement.Api/Features/SampleData/Controllers/WeeklyMenuImportsController.Queries.cs`
- Create: `backend/src/IPCManagement.Api/Migrations/20261101103000_RetainWeeklyMenuImportSnapshots.cs`
- Create: `backend/src/IPCManagement.Api/Migrations/20261101103000_RetainWeeklyMenuImportSnapshots.Designer.cs`
- Modify: `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.ContractsAndProduction.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportBatchTests.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportsControllerContractTests.cs`
- Modify generated: `frontend/src/shared/api/contracts/openapi.json`
- Modify generated: `frontend/src/shared/api/contracts/schema.ts`
- Modify: `frontend/src/api/weeklyMenuApi.ts`
- Modify: `frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx`
- Modify: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Modify: `frontend/src/__tests__/ApiContracts.test.ts`

**Interfaces:**
- `MenuVersion.NormalizedSourceSnapshotJson` is nullable `longtext`; missing legacy evidence remains unknown.
- Produces deterministic `WeeklyMenuImportSnapshotDto` at grain customer/week/tier → service date/shift → persisted dish slot/dish identity/source order.
- Produces `IWeeklyMenuImportHistoryService.GetWeeklyMenuImportSnapshotAsync(string menuVersionId, CancellationToken)` and guarded `GET weekly-menu/import-history/{menuVersionId}/snapshot`.
- `MenuVersion.Status == "ROLLED_BACK"` remains history authority; the current `MenuSchedulesRemoved` result stays truthful because mutable operational schedules may still be removed after snapshot persistence.

- [ ] **Step 1: Write failing snapshot/rollback tests**

Add tests:

```csharp
Committed_import_persists_deterministic_normalized_source_snapshot()
Rollback_materializes_missing_legacy_snapshot_before_removing_draft_projection()
Rolled_back_snapshot_retains_every_date_shift_slot_and_dish_identity()
Snapshot_endpoint_returns_history_but_active_weekly_query_does_not_reactivate_it()
```

Assert a reimport after rollback cannot mutate the old version-owned snapshot.

- [ ] **Step 2: Run rollback/import tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~WorkflowGenerationTests|FullyQualifiedName~WeeklyMenuImportBatchTests|FullyQualifiedName~WeeklyMenuImportsControllerContractTests"
```

Expected: compile/test failure because the snapshot owner/query does not exist.

- [ ] **Step 3: Add the snapshot column and deterministic serializer**

Add the entity mapping/migration. Serialize from committed plan/result data in stable date/shift/source-order order inside the import transaction. On rollback of a legacy DRAFT with no snapshot, serialize its still-current schedule/menu graph before existing operational deletions; never reconstruct after deletion.

- [ ] **Step 4: Add guarded history detail query**

Deserialize only the selected `MenuVersion` snapshot. Return not-found/unavailable explicitly when the version or retained snapshot is missing; do not infer from another version.

- [ ] **Step 5: Emit the UI gate and expose retained history**

Record a scoped gate for `/weekly-menu`: existing workbench, current roles/mode, six states, existing Modal/Button/StateBoundary primitives, no new tokens. Add a history-row action that loads and displays the normalized snapshot; a missing legacy snapshot renders unavailable, not empty.

- [ ] **Step 6: Regenerate and verify contracts**

Run:

```bash
npm run gen:api
npm run test:unit -w frontend -- src/__tests__/ApiContracts.test.ts src/__tests__/WeeklyMenu.test.tsx
```

Confirm a second generation leaves hashes unchanged. Run `npm run check:api-contract` only after an authorized generated-contract commit.

- [ ] **Step 7: Run connected Backend tests**

Use Step 2 command. Expected: PASS; rollback still removes only the mutable draft projection after the snapshot is durable.

- [ ] **Step 8: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Models/Entities/MenuVersion.cs backend/src/IPCManagement.Api/Features/Coordination/Persistence/MenuEntityConfigurations.cs backend/src/IPCManagement.Api/Features/SampleData backend/src/IPCManagement.Api/Migrations backend/tests/IPCManagement.Api.Tests frontend/src/shared/api/contracts frontend/src/api/weeklyMenuApi.ts frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx frontend/src/__tests__ .planning/WORK.md
git commit -m "fix(menu): retain normalized import snapshots"
```

### Task 4: Five-Calendar-Year Provider Receipt Guard

**Files:**
- Modify: `scripts/database-recovery/ImmutableObjectProvider.ps1`
- Modify: `scripts/database-recovery/Invoke-DatabaseRecovery.ps1`
- Modify: `backend/tests/IPCManagement.Api.Tests/RecoveryScriptContractTests.cs`

**Interfaces:**
- Provider receipt adds required `archiveCreatedAtUtc`.
- `Assert-ProviderReceipt` requires `retainUntilUtc >= archiveCreatedAtUtc.AddYears(5)` and still requires future, immutable lock metadata.
- Live metadata comparison includes `archiveCreatedAtUtc` and exact `retainUntilUtc`.

- [ ] **Step 1: Add executable failing PowerShell contract tests**

Add tests invoking the actual function with receipts for:

```text
2024-02-29 → retain through 2029-02-28: PASS
one second before AddYears(5): FAIL
five years exactly: PASS
expired or mismatched live retention: FAIL
missing archiveCreatedAtUtc: FAIL
```

Do not rely only on source-string assertions.

- [ ] **Step 2: Run RecoveryScriptContractTests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~RecoveryScriptContractTests"
```

Expected: FAIL because the receipt has no archive timestamp/minimum duration rule.

- [ ] **Step 3: Implement the receipt rule**

Parse both timestamps as `DateTimeOffset`, compare calendar `AddYears(5)`, and include the archive timestamp in live metadata equality. Keep fail-closed shape/hash/lock checks.

- [ ] **Step 4: Bind backup publication to the run timestamp**

Have `Invoke-DatabaseRecovery.ps1` require/verify the provider receipt’s `archiveCreatedAtUtc` against the current archive/run identity; do not let an adapter invent an older timestamp to shorten retention.

- [ ] **Step 5: Run recovery contract tests**

Use Step 2 command. Expected: PASS without provider credentials or live upload.

- [ ] **Step 6: Commit if authorized**

```bash
git add scripts/database-recovery/ImmutableObjectProvider.ps1 scripts/database-recovery/Invoke-DatabaseRecovery.ps1 backend/tests/IPCManagement.Api.Tests/RecoveryScriptContractTests.cs
git commit -m "fix(recovery): enforce five year archive lock"
```

### Task 5: Five-Year Restore Evidence Contract

**Files:**
- Modify: `scripts/database-recovery/RestoreOracle.ps1`
- Modify: `scripts/database-recovery/Invoke-DatabaseRecovery.ps1`
- Modify: `backend/tests/IPCManagement.Api.Tests/RecoveryScriptContractTests.cs`
- Modify: `docs/OPERATIONS.md`

**Interfaces:**
- Restore result records provider object identity, archive creation, retain-until, lock mode/state and download request identity.
- Restore oracle retains current schema/row/checksum checks and adds an MRX business-oracle summary supplied from the restored target, not an external-file hash alone.

- [ ] **Step 1: Add failing recovery evidence tests**

Assert `RESTORE_VERIFIED` cannot be emitted before five-year live metadata validation and restored-target MRX oracle comparison. Assert a provider receipt mismatch blocks restore before DB creation.

- [ ] **Step 2: Run recovery tests and confirm RED**

Use Task 4 test command. Expected: FAIL on missing evidence ordering/business oracle.

- [ ] **Step 3: Extend restore evidence**

Add restored-target MRX counts/digests for batches, daily lines, contributors, revisions/deltas, linked issues/movements, dispositions and audits. Keep this bounded; do not claim full semantic equivalence beyond compared fields.

- [ ] **Step 4: Update OPERATIONS current/target/evidence language**

Separate 14–30 day operational backups from five-year immutable archives. Keep live provider/restore status `NEEDS_EVIDENCE` until actually run.

- [ ] **Step 5: Run recovery tests**

Expected: PASS. Do not invoke provider upload or restore without authorization.

- [ ] **Step 6: Commit if authorized**

```bash
git add scripts/database-recovery backend/tests/IPCManagement.Api.Tests/RecoveryScriptContractTests.cs docs/OPERATIONS.md
git commit -m "feat(recovery): verify retained MRX archive evidence"
```

### Task 6: Retention and Mode-Isolation Canonical Documentation

**Files:**
- Modify: `docs/DOMAIN.md`
- Modify: `docs/domain/material-reconciliation.md`
- Modify: `docs/FLOWS.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `.planning/WORK.md`

**Interfaces:**
- Consumes Tasks 1–5.
- Produces stable operational/archive retention and audit-scope authority for Phase 3.

- [ ] **Step 1: Update DOMAIN and bounded MRX contract**

Record five-year queryable operational history, append-only provenance, typed audit lineage and prohibition on broad Inventory-label MRX classification.

- [ ] **Step 2: Update FLOWS**

Document MRX audit/report and backup→immutable archive→restore drill handoff without presenting target infrastructure as deployed fact.

- [ ] **Step 3: Run documentation and architecture checks**

```bash
npm run check:conformance-contracts
npm run test:architecture-growth
npm run check:architecture-growth
git diff --check
```

Expected: PASS except line-ending notices explicitly reported.

- [ ] **Step 4: Run Phase 2 focused verification**

```bash
dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj -c Release --no-restore
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~MrxAuditScopeQueryTests|FullyQualifiedName~ReconciliationDashboardAndReportsTests|FullyQualifiedName~WeeklyMenuImport|FullyQualifiedName~RecoveryScriptContractTests|FullyQualifiedName~WorkflowGenerationTests"
```

Expected: PASS with actual counts recorded.

- [ ] **Step 5: Run mandatory review gates and update WORK**

Use `ipc-test-audit` and `ipc-code-review`. Record the mandated semicolon report format. Mark live provider/archive/restore evidence `NEEDS_EVIDENCE` unless an exact authorized drill was completed.

- [ ] **Step 6: Commit if authorized**

```bash
git add docs .planning/WORK.md
git commit -m "docs(mrx): define five year audit retention"
```
