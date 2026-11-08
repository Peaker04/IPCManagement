# MRX Disposable MySQL Evidence Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the pending MRX migrations, concurrency behavior, retained-history query plans, and G1 provision flow on a run-owned full clone of `ipcmanagement`, then remove every run-owned resource without mutating the source database.

**Architecture:** Add a fail-closed PowerShell evidence orchestrator with a small safety module, reuse the existing MySQL/.NET/Playwright owners, and teach the MRX E2E harness to consume a prepared migrated database without owning its clone or drop lifecycle. The outer runner is the only database owner; `ipcmanagement` is read-only, and index work is conditional on captured MySQL plans.

**Tech Stack:** PowerShell 5+, MySQL 9.5 CLI/mysqldump, .NET 9/EF Core 9/Pomelo, Node 22, Playwright, xUnit, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-mrx-disposable-mysql-evidence-execution-design.md`

## Global Constraints

- `ipcmanagement` is exact source-only; no DDL, DML, migration, mode change, cleanup, restore, or seed may target it.
- Every mutable target must match `^ipc_mrx_evidence_[0-9]{8}t[0-9]{6}z_[a-z0-9]{6}$` and the current run ID.
- Target must be absent before creation; never use `CREATE DATABASE IF NOT EXISTS` for evidence.
- Credentials never appear in process arguments, repository files, WORK, screenshots, or evidence output.
- `.planning/WORK.md` remains the sole task-state owner; `.artifacts/mrx-evidence/<run-id>/` is ignored run output, not task state.
- Cleanup drops only the current run-owned target and is mandatory in `finally`; cleanup failure is `BLOCKED_CLEANUP`.
- Do not create an index migration without captured before/after MySQL evidence.
- G1 mutation runs only against the prepared evidence target and never against `ipcmanagement`.
- Provider publication/restore remains out of scope until official adapter and credentials are supplied.
- No dependency installation, guardrail exemption, allowlist padding, synthetic production evidence, commit, or push without its exact authorized step.

## Review Focus

- A pre-existing evidence target must fail before any dump/restore and must never be reused — pinned in Task 1.
- A mismatched E2E run ID or protected database name must fail before Kestrel or MySQL mutation — pinned in Task 4.
- Failure after target creation must still remove only the run-owned target and temporary defaults/dump files — pinned in Tasks 2 and 5.
- G1 must compare create/detail/replay provision movement identity, not only a success banner — pinned in Task 4.
- A poor `EXPLAIN` plan may justify an index, but absence of authorized representative evidence must produce `NEEDS_EVIDENCE`, not a speculative migration — pinned in Task 3.

---

### Task 1: Run-Owned Database and Credential Guardrails

**Files:**
- Create: `scripts/mrx-evidence/MrxEvidenceSafety.ps1`
- Create: `backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs`
- Modify: `frontend/tests/e2e-mrx/core/dbGuardrail.ts`
- Modify: `frontend/tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts`

**Interfaces:**
- Produces PowerShell `Assert-MrxEvidenceSource -DatabaseName <string>`.
- Produces PowerShell `Assert-MrxEvidenceTarget -DatabaseName <string> -RunId <string>`.
- Produces PowerShell `Assert-MrxEvidenceTargetAbsent -DatabaseName <string> -ReadDatabaseCount <scriptblock>`.
- Produces TypeScript `resolveMrxE2eDatabase(env: NodeJS.ProcessEnv): { database: string; prepared: boolean; runId?: string }`.
- Exact protected names include `ipcmanagement`, `ipc_lane1..ipc_lane9`, `ipc_e2e_template`, and `ipc_mrx_e2e_sandbox` unless the legacy non-prepared harness owns the fixed sandbox.

- [ ] **Step 1: Write failing PowerShell and TypeScript guard tests**

Add tests:

```text
Evidence_target_policy_accepts_exact_run_owned_name_and_rejects_protected_targets
Evidence_target_policy_rejects_existing_target_and_run_id_mismatch
prepared E2E accepts only an evidence database whose suffix matches MRX_EVIDENCE_RUN_ID
prepared E2E rejects ipcmanagement, fixed sandbox, lanes, templates and unsafe names
legacy non-prepared E2E still accepts only ipc_mrx_e2e_sandbox
```

- [ ] **Step 2: Run tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxDisposableEvidenceContractTests" --no-restore
npm run test:unit -w frontend -- --run tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts
```

Expected: FAIL because run-owned evidence guards do not exist.

- [ ] **Step 3: Implement the minimal guard functions**

PowerShell uses anchored regex and exact source equality. TypeScript derives prepared mode only when `MRX_E2E_PREPARED_DATABASE === "1"`; in prepared mode it requires `MRX_E2E_DATABASE` and `MRX_EVIDENCE_RUN_ID` to agree.

- [ ] **Step 4: Run guard tests**

Use Step 2 commands. Expected: PASS.

- [ ] **Step 5: Commit if authorization remains active**

```bash
git add scripts/mrx-evidence/MrxEvidenceSafety.ps1 backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs frontend/tests/e2e-mrx/core/dbGuardrail.ts frontend/tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts
git commit -m "test(mrx): guard disposable evidence targets"
```

### Task 2: Credential-Safe Full Clone and Mandatory Cleanup Runner

**Files:**
- Create: `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`
- Modify: `backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs`
- Modify: `package.json`

**Interfaces:**
- Consumes Task 1 guards.
- Produces command:

```powershell
Invoke-MrxDisposableEvidence.ps1 \
  -Mode Preflight|Execute \
  -SourceSettings backend/src/IPCManagement.Api/appsettings.json \
  -EvidenceDirectory .artifacts/mrx-evidence
```

- Requires `IPC_MRX_SOURCE_CONNECTION_STRING` or an explicitly supplied run-owned MySQL defaults file; exact source database must be `ipcmanagement`.
- Produces `.artifacts/mrx-evidence/<run-id>/status.json`, `clone-manifest.json`, command logs with redacted arguments, and terminal status.
- Adds package script `evidence:mrx:mysql` that invokes the PowerShell runner without embedding credentials.

- [ ] **Step 1: Add failing runner contract tests**

Assert the script:

```text
requires exact ipcmanagement source
creates a unique absent evidence target without IF NOT EXISTS
dumps with single-transaction/routines/triggers/events/hex-blob/GTID-purged-OFF
requires the Dump completed marker
never places password values in command arguments or evidence
owns DROP only in finally and only after target ownership was recorded
reports BLOCKED_CLEANUP when exact-target removal cannot be proven
```

- [ ] **Step 2: Run and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxDisposableEvidenceContractTests" --no-restore
```

Expected: FAIL on missing runner.

- [ ] **Step 3: Implement `Preflight`**

Preflight validates tools, parses the source connection without printing secrets, generates the target/run ID, checks target absence, checks ports, and writes only redacted status. It performs no database creation or dump.

- [ ] **Step 4: Implement clone and manifest stages**

Use a run-owned temporary defaults file with restricted ACL. Capture source migration head/table inventory/row counts and bounded MRX checksums, execute `mysqldump`, verify completion/hash, create the absent target, restore, and compare the target pre-migration manifest.

- [ ] **Step 5: Implement exact-target cleanup in `finally`**

Stop only recorded child process IDs, drop only the target whose name/run ID match Task 1, confirm target absence, remove defaults/dump files, and write cleanup evidence. Never catch-and-downgrade cleanup failure.

- [ ] **Step 6: Run static tests and mutation-free preflight**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxDisposableEvidenceContractTests" --no-restore
npm run evidence:mrx:mysql -- --Mode Preflight
```

Expected: contract tests PASS; preflight either `READY` or a precise missing-input blocker; no database created.

- [ ] **Step 7: Commit if authorized**

```bash
git add scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs package.json
git commit -m "feat(mrx): add disposable MySQL evidence runner"
```

### Task 3: Migration, Relational Verification, and Query-Plan Decision

**Files:**
- Modify: `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`
- Create: `scripts/mrx-evidence/MrxRetainedHistoryQueries.sql`
- Modify: `backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs`
- Modify only if evidence proves need: `backend/src/IPCManagement.Api/Features/Reconciliation/Persistence/ReconciliationEntityConfigurations.cs`
- Create only if evidence proves need: `backend/src/IPCManagement.Api/Migrations/<timestamp>_IndexMrxRetainedHistoryQueries.cs`
- Create only if evidence proves need: matching Designer file
- Modify only if evidence proves need: `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs`
- Modify only if evidence proves need: `backend/tests/IPCManagement.Api.Tests/ReconciliationDailyPersistenceModelTests.cs`

**Interfaces:**
- Consumes the restored target and run-owned defaults file from Task 2.
- Applies current EF migration head through a child process whose `ConnectionStrings__DefaultConnection` and `IPC_TEST_CONNECTION_STRING` point only to the target.
- Produces `migration-evidence.json`, focused test logs, `query-plans.json`, and `indexDecision: NOT_NEEDED|REQUIRES_MIGRATION`.
- SQL file contains read-only `EXPLAIN FORMAT=JSON` statements for transaction page/count/export, provision lookup, active decisions/contributors, typed audit scope, and net issue projection.

- [ ] **Step 1: Add failing migration/query-plan contract tests**

Assert the runner requires both migration IDs, sets child-only target environment variables, rejects source connection reuse, runs read-only EXPLAIN SQL, and cannot emit `NOT_NEEDED` without every required plan result.

- [ ] **Step 2: Run and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxDisposableEvidenceContractTests" --no-restore
```

- [ ] **Step 3: Implement migration rehearsal**

Run EF update against the clone, then assert migration history contains:

```text
20261101112409_RetainMrxDecisionAndContributorHistory
20261101124531_RetainWeeklyMenuImportSnapshots
```

Run `has-pending-model-changes`, recovery contracts, focused MRX migration/model tests, and the environment-owned MySQL integration category against subordinate run-owned schemas where a test requires an empty database.

- [ ] **Step 4: Implement query-plan capture**

Substitute only validated run-owned database identifiers and fixed representative parameters. Record examined rows/access type/key/filesort indicators without credentials or row payloads.

- [ ] **Step 5: Execute the decision barrier**

- Existing indexes adequate: write `NOT_NEEDED`; create no migration.
- Defect proven: write `REQUIRES_MIGRATION`, stop before G1, and present the exact proposed index/property order for review.

- [ ] **Step 6: Conditional index RED→GREEN, only if required**

Write exact model-index tests, confirm RED, add the smallest justified mapping/migration, recreate a fresh clone from Stage 1, and rerun migration plus EXPLAIN. Do not continue using the already-mutated evidence database as final proof.

- [ ] **Step 7: Run contract and focused tests**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxDisposableEvidenceContractTests|FullyQualifiedName~ReconciliationDailyPersistenceModelTests|FullyQualifiedName~ReconciliationDashboardAndReportsTests" --no-restore
```

Expected: PASS; index decision backed by complete plans.

- [ ] **Step 8: Commit only the conditional index change if created and authorized**

```bash
git add backend/src/IPCManagement.Api/Features/Reconciliation/Persistence backend/src/IPCManagement.Api/Migrations backend/tests/IPCManagement.Api.Tests/ReconciliationDailyPersistenceModelTests.cs
git commit -m "perf(mrx): index retained history from MySQL evidence"
```

If `NOT_NEEDED`, record no index commit.

### Task 4: Prepared-Database G1 Harness

**Files:**
- Modify: `frontend/tests/e2e-mrx/core/globalSetup.ts`
- Modify: `frontend/tests/e2e-mrx/core/globalTeardown.ts`
- Modify: `frontend/tests/e2e-mrx/core/mysqlVerifier.ts`
- Modify: `frontend/tests/e2e-mrx/fixtures/mrxTest.ts`
- Modify: `frontend/tests/e2e-mrx/specs/g1-golden-path.spec.ts`
- Modify: `frontend/tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts`
- Modify: `backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs`

**Interfaces:**
- Consumes Task 1 `resolveMrxE2eDatabase` and Task 2 run-owned defaults file.
- Prepared mode variables:

```text
MRX_E2E_PREPARED_DATABASE=1
MRX_E2E_DATABASE=<run-owned target>
MRX_EVIDENCE_RUN_ID=<matching run ID>
IPC_MRX_MYSQL_DEFAULTS_FILE=<run-owned defaults file>
```

- In prepared mode, global setup performs no clone/drop; it may clean only the canonical G1 week in the target after guard validation.
- In prepared mode, global teardown stops run-owned processes and checks residuals but leaves database deletion to Task 2.

- [ ] **Step 1: Extend failing E2E owner tests**

Assert prepared setup/teardown:

```text
never references ipcmanagement for mutation
never CREATEs or DROPs the prepared database
uses defaults-extra-file rather than -p password arguments
rejects target/run mismatch before cleanup SQL
leaves legacy fixed-sandbox mode guarded and behaviorally unchanged
```

G1 assertions must compare create response, detail reload, replay, and DB `ADJUSTMENT` identity/quantity for the exact issue.

- [ ] **Step 2: Run and confirm RED**

```bash
npm run test:unit -w frontend -- --run tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxDisposableEvidenceContractTests" --no-restore
```

- [ ] **Step 3: Implement prepared setup and credential-safe MySQL calls**

Use `execFileSync`/argument arrays or `--defaults-extra-file`; remove plaintext password arguments from changed E2E owners. Outer runner passes target connection to Kestrel. Track spawned PIDs explicitly.

- [ ] **Step 4: Implement prepared teardown ownership**

Prepared teardown never drops the database. It checks residual customers, stops recorded PIDs, confirms no LISTEN owner, and returns control to the outer runner.

- [ ] **Step 5: Complete G1 persisted-evidence assertions**

Keep the current public UI/API flow. Assert provision collection non-empty, exact movement identity on detail/replay, exact issue-linked ADJUSTMENT in MySQL, and report/net-ledger agreement. No direct business mutation after initial canonical week cleanup.

- [ ] **Step 6: Run static E2E verification**

```bash
npm run lint -w frontend -- tests/e2e-mrx
npx playwright test --config frontend/tests/e2e-mrx/config/playwright.mrx.config.ts frontend/tests/e2e-mrx/specs/g1-golden-path.spec.ts --list
```

Expected: zero diagnostics and exactly one listed G1 test.

- [ ] **Step 7: Commit if authorized**

```bash
git add frontend/tests/e2e-mrx backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs
git commit -m "test(mrx): run G1 on prepared evidence database"
```

### Task 5: Outer Runner G1, Source Recheck, and Failure-Proof Cleanup

**Files:**
- Modify: `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`
- Modify: `backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs`
- Modify: `.planning/WORK.md`

**Interfaces:**
- Consumes Tasks 2–4.
- Outer runner starts G1 with prepared-mode environment, captures exit code/artifacts, rereads source migration/schema fingerprints, and always invokes exact cleanup.
- Produces terminal status `PASS|FAIL|NEEDS_EVIDENCE|BLOCKED_CLEANUP`.

- [ ] **Step 1: Add failing stage-order and cleanup tests**

Assert:

```text
migration and EXPLAIN succeed before G1 starts
source recheck occurs after G1 and before target drop
G1 failure still reaches exact-target cleanup
cleanup failure overrides prior PASS
PASS requires target absent, temp files absent and no LISTEN ports
```

- [ ] **Step 2: Run and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxDisposableEvidenceContractTests" --no-restore
```

- [ ] **Step 3: Implement stage orchestration**

Use explicit stage state, child exit-code checks, redacted evidence, and `try/finally`. Do not use warning-only catches for clone, migration, G1, source recheck, or cleanup.

- [ ] **Step 4: Run mutation-free contract verification**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxDisposableEvidenceContractTests|FullyQualifiedName~RecoveryScriptContractTests" --no-restore
npm run test:unit -w frontend -- --run tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts
npm run evidence:mrx:mysql -- --Mode Preflight
```

Expected: tests PASS; preflight truthful and mutation-free.

- [ ] **Step 5: Commit if authorized**

```bash
git add scripts/mrx-evidence backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs .planning/WORK.md
git commit -m "feat(mrx): orchestrate disposable evidence run"
```

### Task 6: Authorized Full-Clone Evidence Run

**Files:**
- Runtime output only: `.artifacts/mrx-evidence/<run-id>/` (ignored)
- Modify after run: `.planning/WORK.md`

**Interfaces:**
- Requires exact source credential environment already configured by the owner/operator.
- Executes the Task 5 runner in `Execute` mode.
- Must not proceed if preflight is not `READY`.

- [ ] **Step 1: Capture intake and verify authorization boundary**

```bash
git status --short --branch
git rev-parse HEAD
git diff --cached --name-only
npm run evidence:mrx:mysql -- --Mode Preflight
```

Expected: source `ipcmanagement`, generated absent target, all required tools/credentials READY, no database mutation yet.

- [ ] **Step 2: Execute the full evidence runner once**

```bash
npm run evidence:mrx:mysql -- --Mode Execute
```

Expected stages: source fingerprint → clone → pre-migration parity → migrations → relational tests → EXPLAIN decision → prepared G1 → aggregate gates → source recheck → target/temp/port cleanup.

- [ ] **Step 3: Stop at an index decision if required**

If status is `REQUIRES_MIGRATION`, do not call the run PASS. Return to Task 3 Step 6, then start a completely new evidence run.

- [ ] **Step 4: Verify cleanup independently**

Confirm target database count zero, no LISTEN owner on `5174/5263`, temporary defaults/dump files absent, source migration head unchanged, and evidence contains no credential values.

- [ ] **Step 5: Record exact evidence in WORK**

Record target/run ID, migration heads, test counts, EXPLAIN/index decision, G1 result, source comparison and cleanup. Never copy secrets or full production row data.

### Task 7: Final Repository Closure and Integration Decision

**Files:**
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/domain/material-reconciliation.md`
- Modify: `docs/FLOWS.md`
- Modify: `.planning/WORK.md`

**Interfaces:**
- Consumes Task 6 evidence.
- Produces final repository status while keeping provider archive/restore separately `NEEDS_EVIDENCE` until official inputs exist.

- [ ] **Step 1: Update canonical operational documentation**

Document the full-clone rehearsal command owner, source-read-only boundary, prepared G1 mode, index evidence decision, and exact cleanup expectations. Do not document credentials.

- [ ] **Step 2: Run mandatory verification gates**

```bash
npm run gen:api
npm run gen:api
npm run verify
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~RecoveryScriptContractTests|FullyQualifiedName~MrxDisposableEvidenceContractTests" --no-restore
dotnet ef migrations has-pending-model-changes --project backend/src/IPCManagement.Api --startup-project backend/src/IPCManagement.Api -- --no-connect
git diff --check
```

Expected: stable generated hashes, all gates PASS, no pending model changes, line-ending notices only.

- [ ] **Step 3: Run mandatory reviews and update WORK**

Use `ipc-test-audit`, `ipc-code-review`, and `ipc-ui-review`. Record the required semicolon format. Mark only live provider publication/restore as `NEEDS_EVIDENCE` if no official adapter was supplied.

- [ ] **Step 4: Inspect complete diff and excluded artifacts**

Verify no dump, defaults file, password, provider secret, `.artifacts` evidence payload, or database name outside allowed patterns is staged.

- [ ] **Step 5: Commit if current authorization includes repository commit**

```bash
git add scripts/mrx-evidence backend frontend package.json docs .planning/WORK.md
git commit -m "test(mrx): certify disposable MySQL evidence flow"
```

- [ ] **Step 6: Push only with explicit push authorization**

```bash
git push origin feature/ui-interaction-data-states
```

If push is not explicitly authorized at execution time, record `NOT_RUN`.
