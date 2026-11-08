# MRX Review Residual Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the recovery execution defect, production-query evidence gap, unbounded MRX CSV exports, raw paging inputs, and inherited recovery-secret exposure found by the post-implementation review.

**Architecture:** Preserve the existing recovery, reconciliation report, typed audit and disposable-evidence owners. Add one deterministic PowerShell single-row parser used by real recovery callers, feed 7-Zip secrets through redirected standard input, generate audit EXPLAIN SQL from `MrxAuditScopeQuery` itself, and stream transaction/audit CSV rows directly to the HTTP response via `IAsyncEnumerable` without materializing the full retained history.

**Tech Stack:** PowerShell 5.1, ASP.NET Core 9, EF Core/Pomelo MySQL, xUnit/FluentAssertions, existing disposable-MySQL runner.

**Spec:** `docs/superpowers/specs/2026-11-01-mrx-data-integrity-and-five-year-retention-design.md`

## Global Constraints

- Preserve `DEFAULT != MATERIAL_RECONCILIATION` and typed persisted MRX lineage.
- Do not add a speculative index; rerun exact production-query EXPLAIN before any index decision.
- CSV exports the complete filtered scope, but must remain bounded/streaming.
- No provider upload, restore, database mutation, package installation, dependency, generated-file hand edit, push or deployment.
- Tests must exercise executable behavior; source inspection is retained only for irreversible secret/target safety invariants.
- `.planning/WORK.md` remains the sole task-state owner.

## Review Focus

- A single MySQL output row must remain a complete row rather than its first character; Task 1 owns the executable regression.
- Archive encryption secrets must never occur in process arguments or inherited-readable temporary files; Task 1 owns the safety contract.
- Audit plan evidence must include every production lineage branch and be generated from the EF query; Task 2 owns the drift and evidence tests.
- Transaction/audit exports must preserve full filtered ordering and CSV bytes while avoiding full-list and full-file memory materialization; Task 3 owns the streaming tests.
- Negative/oversized report paging must normalize to `1..100` without 500s or unbounded allocations; Task 3 owns the request/service tests.

---

### Task 1: Recovery Row Parsing and Secret-Safe Process Execution

**Files:**
- Modify: `scripts/database-recovery/RestoreOracle.ps1`
- Modify: `scripts/database-recovery/Invoke-DatabaseRecovery.ps1`
- Modify: `backend/tests/IPCManagement.Api.Tests/RecoveryScriptContractTests.cs`

**Interfaces:**
- Produces: `Get-RequiredSingleMySqlRow([object[]]$Rows, [string]$Label) -> string` for all scalar/one-row recovery queries.
- Produces: `Invoke-SevenZipWithPassword` that passes no secret in arguments and supplies one password line through redirected standard input.
- Preserves: existing provider adapter, receipt, manifest and restore-oracle contracts.

- [ ] **Step 1: Write failing executable parser and secret-boundary tests**

Extend `RecoveryScriptContractTests` so PowerShell executes `Get-RequiredSingleMySqlRow` with `"12`t345678"` and asserts the complete row is returned, while zero/multiple rows fail. Add a source-level security contract that rejects `-p$encryptionPassword`, requires redirected standard input, and requires restricted ACL handling for the MySQL defaults file.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~RecoveryScriptContractTests
```

Expected: FAIL because the parser and secret-safe 7-Zip owner do not exist and the old password argument remains.

- [ ] **Step 3: Implement the smallest owner-level repair**

Add `Get-RequiredSingleMySqlRow` to `RestoreOracle.ps1`; route MRX metrics, table counts and database-existence checks through it. Replace direct 7-Zip invocations with a `ProcessStartInfo` helper whose argument list contains `-p` only where prompting is required and whose redirected stdin supplies the password; test/extract calls omit a literal password argument and consume redirected stdin. Restrict the run-owned defaults file ACL and preserve cleanup in `finally`.

- [ ] **Step 4: Verify GREEN and run PowerShell syntax checks**

Run the focused test command and parse both scripts with the PowerShell parser. Expected: all recovery tests PASS and zero parser errors.

### Task 2: Production-Equivalent Typed Audit EXPLAIN

**Files:**
- Create: `backend/tests/IPCManagement.Api.Tests/MrxAuditQueryPlanCaptureTests.cs`
- Modify: `scripts/mrx-evidence/MrxRetainedHistoryQueries.sql`
- Modify: `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`
- Modify: `backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs`

**Interfaces:**
- Produces: an evidence-owned generated SQL file derived from `MrxAuditScopeQuery.Apply(...).OrderByDescending(...).Take(25).ToQueryString()`.
- Consumes: `MRX_AUDIT_PLAN_SQL_OUTPUT` only in the disposable evidence runner; no production API/test seam.
- Preserves: seven total retained-history plans and the existing `NOT_NEEDED | REQUIRES_MIGRATION` decision barrier.

- [ ] **Step 1: Write failing query-shape and runner contracts**

Add a test that builds the real EF query without opening a database, verifies every supported MRX entity/table branch is present, and writes executable `EXPLAIN FORMAT=JSON` SQL only when the evidence output environment variable is supplied. Update runner contracts to require generated typed-audit SQL and reject the two-branch handwritten mirror.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxAuditQueryPlanCaptureTests|FullyQualifiedName~MrxDisposableEvidenceContractTests"
```

Expected: FAIL because production-query capture is absent and the runner still reads the reduced audit plan.

- [ ] **Step 3: Generate and consume the exact EF audit plan**

Implement the evidence test/capture owner, remove `typed_audit_scope` from the handwritten SQL file, and have the outer runner invoke the capture test into its run-owned temp directory before plan analysis. Feed the generated SQL through the same MySQL JSON validation, full-scan threshold and decision output as the six remaining static plans.

- [ ] **Step 4: Verify GREEN without database mutation**

Run the focused tests. Generate the audit SQL into a temporary path and verify it contains `EXPLAIN FORMAT=JSON` plus all typed lineage joins/subqueries; remove the temporary output.

### Task 3: Bounded MRX CSV Streaming and Paging Normalization

**Files:**
- Create: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxReportCsvStreamWriter.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxTransactionHistoryQuery.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationReportsController.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs`
- Modify if generated output changes: `frontend/src/shared/api/contracts/openapi.json`
- Modify if generated output changes: `frontend/src/shared/api/contracts/schema.ts`

**Interfaces:**
- Produces: `IAsyncEnumerable<MrxTransactionHistoryRowDto>` and `IAsyncEnumerable<MrxAuditTrailRowDto>` export streams with cancellation and deterministic existing ordering.
- Produces: `MrxReportCsvStreamWriter.WriteTransactionsAsync` and `WriteAuditAsync` writing UTF-8 BOM/header/escaped rows directly to a destination stream.
- Consumes: `PagedRequestDto` for completed and audit table endpoints, enforcing page `>=1` and page size `1..100`.
- Removes: full-scope `IReadOnlyList` export materialization and transaction/audit `byte[]` CSV builders from public request paths.

- [ ] **Step 1: Write failing stream and paging regressions**

Replace the current full-list export assertions with consumption of the real async query streams and direct writing to a `MemoryStream`; assert identical full filtered rows, ordering, CSV escaping/header and absence of price fields. Add request/service tests proving negative page values normalize to page 1 and oversized page size to 100.

- [ ] **Step 2: Run report tests and confirm RED**

Run:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter FullyQualifiedName~ReconciliationDashboardAndReportsTests
```

Expected: FAIL because async export streams/writer do not exist and raw paging is not normalized.

- [ ] **Step 3: Implement streaming owners and normalized request contracts**

Use EF `AsAsyncEnumerable().WithCancellation(...)` over the existing ordered transaction query. Stream audit rows from the shared typed query while preserving actor-name fallback without loading the whole audit result. Write CSV incrementally with one `StreamWriter` and `leaveOpen: true`. Set response content type/disposition and await the writer against `Response.Body`. Route completed/audit paging through `PagedRequestDto`.

- [ ] **Step 4: Verify GREEN and generated-contract parity**

Run the report tests, related audit-scope tests and `npm run gen:api` twice. Generated hashes must be stable; generated files must only change through the generator.

### Task 4: Documentation, Review and Aggregate Verification

**Files:**
- Modify: `docs/OPERATIONS.md`
- Modify: `docs/domain/material-reconciliation.md`
- Modify: `.planning/WORK.md`

**Interfaces:**
- Records: exact closed findings, query-plan status and provider evidence status without relabeling repository proof as provider certification.

- [ ] **Step 1: Update canonical operational documentation**

Document secret-safe recovery invocation, exact generated audit-plan evidence, bounded CSV exports and normalized paging. Keep provider publication/restore `NEEDS_EVIDENCE` until an authorized live drill.

- [ ] **Step 2: Run mandatory focused and aggregate gates**

Run recovery/evidence/report/audit focused suites, Release build, API generation stability, `npm run verify`, EF pending-model check and `git diff --check`.

- [ ] **Step 3: Run mandatory reviews**

Apply `ipc-test-audit` and `test-audit` to all changed tests, `ipc-code-review` to the complete diff, and verify no UI/CSS behavior changed. Record the mandated semicolon-format decisions in WORK.

- [ ] **Step 4: Close lifecycle truthfully**

Mark each criterion `PASS`, `FAIL`, `NEEDS_EVIDENCE` or `BLOCKED`. Return WORK to `IDLE`. Do not commit or push without current explicit authorization.
