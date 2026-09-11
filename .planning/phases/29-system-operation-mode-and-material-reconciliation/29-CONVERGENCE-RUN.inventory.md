# Code Context

## Files Retrieved
1. `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-SPEC.md` (lines 1-184) — locked OPM/MRC/CLR authority and evidence requirements.
2. `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-CONTEXT.md` (lines 1-217) — D-01..D-42, especially D-34..D-38 clarity ownership.
3. `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-REVISION-RUN.patterns.md` (lines 1-390) — current architecture mapping, direct-save baseline and hygiene proposal.
4. `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-REVISION-RUN.check1.md` (lines 1-211) — six current blockers; query enforcement, initialization, provisional clarity scope and secret command are relevant here.
5. `docs/DASHBOARD-UI-RULES.md` (lines 1-486) — normative lowest-owner/evidence rules, language, identifier, table and query-state contracts.
6. `docs/UI-UX-EXECUTION-HARNESS.md` (lines 1-83) — source/DOM/test evidence requirement; `NEEDS_EVIDENCE` cannot authorize production edits.
7. `frontend/tests/uiAuditInventory.ts` (lines 1-55) — 13-route, region, state, actor and viewport identity inventory.
8. `frontend/tests/uiAuditFixtureRegistry.ts` (lines 1-24) — known-bad/known-clean oracle fixture registry.
9. `frontend/tests/uiAuditOracleRegistry.ts` (lines 1-59) — 32 measured rule IDs and exact table/query/hierarchy/accessibility expectations.
10. `frontend/tests/uiAuditRemediationReconciliation.ts` (lines 1-75) — selected Phase 28 authority: actionable FAIL must be zero; 47,208 findings remain `NEEDS_EVIDENCE`.
11. `frontend/tests/uiSourceOwnershipManifest.ts` (lines 1-108) — exact route-page source owners and closure diagnostics.
12. `frontend/tests/presentationSurfaceInventory.test.ts` (lines 1-94) — current production inventory: 55 owners, 50 tables, 34 dialogs, 7 switchers; 64 action owners/225 actions.
13. `frontend/tests/queryBoundaryInventory.ts` (lines 1-76) — explicit exceptional query owners and required markers.
14. `backend/src/IPCManagement.Api/OpenApi/ApiContractServiceCollectionExtensions.cs` (lines 9-31) — the concrete MVC registration seam (`AddControllers`).
15. `backend/src/IPCManagement.Api/Program.cs` (lines 99-198, 328-455) — DI, authorization policies, startup invariant check and request pipeline ending in `MapControllers`.
16. `backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs` (lines 1-217) — existing independent permission policy/token authority.
17. `backend/src/IPCManagement.Api/Data/Transactions/IEfTransactionRunner.cs` (lines 1-18) and `EfTransactionRunner.cs` (lines 1-80) — mutation transaction/commit seam.
18. `backend/src/IPCManagement.Api/Features/Inventory/Services/OperationalWarehouseResolver.cs` (lines 1-68) — fail-closed exact-cardinality singleton read precedent.
19. `backend/src/IPCManagement.Api/Migrations/20260824161853_EnforceSingleOperationalWarehouse.cs` (lines 1-47) — MySQL nullable computed discriminator + unique index precedent.
20. `backend/tests/IPCManagement.Api.Tests/MySqlOperationalWarehouseInvariantTests.cs` (lines 1-116) and `OperationalWarehouseInvariantTests.cs` (lines 1-145) — schema and zero/multiple/mismatch fail-closed tests.

## Key Code

### Evidence-authorized clarity candidates

**Exact current result: zero project-wide production clarity candidates are authorized for editing.**

The selected immutable Phase 28 reconciliation authority permits no actionable `FAIL`: `uiAuditRemediationReconciliation.ts` throws on every non-legacy FAIL and locks the selected run to actionable FAIL `0`, `NEEDS_EVIDENCE 47,208`, `UNRESOLVED 0`. `MEMORY.md` independently records the same gate. Under the canonical harness, `NEEDS_EVIDENCE` is not permission to edit production. Therefore an exact candidate-to-production-file list is empty; inventing route files from CLR prose would violate D-34/D-38 and the execution harness.

The 112 retained Admin raw findings are explicitly `NON_ACTIONABLE_RAW_RETAINED`, not candidates. Severity: **blocker** if any plan treats them or the 47,208 `NEEDS_EVIDENCE` rows as authorized fixes.

### Bounded clarity slices (all below 15 declared files)

These are prerequisite/evidence slices, not production-remediation slices.

#### Slice C0 — authority and row materialization (9 files; read/test/planning only)

1. `frontend/tests/uiAuditInventory.ts`
2. `frontend/tests/uiAuditFixtureRegistry.ts`
3. `frontend/tests/uiAuditOracleRegistry.ts`
4. `frontend/tests/uiAuditContract.ts`
5. `frontend/tests/uiAuditBaselineReconciliation.ts`
6. `frontend/tests/uiAuditRemediationReconciliation.ts`
7. `frontend/tests/uiSourceOwnershipManifest.ts`
8. `frontend/tests/presentationSurfaceInventory.test.ts`
9. `frontend/tests/queryBoundaryInventory.ts`

Purpose: emit exact CLR-01/02/03 rows with production `sourceFile`/`sourceSymbol`, oracle and disposition. Stop unless a measured row is `ACTIONABLE_FAIL`.

#### Slice C1 — current route owner closure (7 production owners + 2 tests; evidence only)

1. `frontend/src/features/dashboard/pages/DashboardPage.tsx`
2. `frontend/src/features/projects/pages/WeeklyMenuPage.tsx`
3. `frontend/src/features/reports/pages/ReportsPage.tsx`
4. `frontend/src/features/coordination/pages/CoordinationPage.tsx`
5. `frontend/src/features/chef/pages/ChefDashboardPage.tsx`
6. `frontend/src/features/approvals/pages/ApprovalPage.tsx`
7. `frontend/src/features/purchasing/pages/PurchasingPage.tsx`
8. `frontend/tests/uiSourceOwnershipManifest.ts`
9. `frontend/tests/uiSourceOwnershipContract.test.ts`

#### Slice C2 — remaining route owner closure (6 production owners + 2 tests; evidence only)

1. `frontend/src/features/warehouse/pages/WarehousePage.tsx`
2. `frontend/src/app/pages/AdminDataPage.tsx`
3. `frontend/src/features/admin/pages/ApprovalRulesPage.tsx`
4. `frontend/src/features/admin/pages/AdvancedDisplaySettingsPage.tsx`
5. `frontend/src/features/auth/pages/LoginPage.tsx`
6. `frontend/src/features/auth/pages/ForbiddenPage.tsx`
7. `frontend/tests/uiSourceOwnershipManifest.ts`
8. `frontend/tests/uiSourceOwnershipContract.test.ts`

These page mappings are exact current ownership coverage, **not findings**. Lower feature/shared owners must come from measured row attribution before a remediation slice is materialized.

#### Slice C3 — shared CLR candidate seams, conditional only (8 production/test files)

1. `frontend/src/lib/workflowConfig.ts` — centralized user-facing enum/status vocabulary.
2. `frontend/src/lib/formatters.ts` — centralized value/date/quantity formatting.
3. `frontend/src/styles/components/tables.css` — `.ipc-data-table` fixed-layout contract.
4. `frontend/src/components/ui/table.tsx` — shared semantic table primitive.
5. `frontend/tests/presentationSurfaceInventory.test.ts`
6. `frontend/tests/uiAuditOracleRegistry.ts`
7. `frontend/tests/uiAuditHierarchyTokenContainer.test.ts`
8. `frontend/tests/uiAuditTableQueryInteraction.test.ts`

Only include a production file from C3 when emitted evidence names its exact symbol as lowest owner. Current authorized count remains zero.

### Backend protected query/request pipeline seam

Concrete recommended seam (fixes checker blocker 1):

- Registration owner: `backend/src/IPCManagement.Api/OpenApi/ApiContractServiceCollectionExtensions.cs`, where `services.AddControllers()` already centralizes MVC setup. Add the global mode-operation filter/convention here rather than scattering controller calls.
- Pipeline owner/order: `backend/src/IPCManagement.Api/Program.cs`; authentication, rate limiting and authorization precede `app.MapControllers()`. A mode operation filter must execute for protected MVC actions and use endpoint/action metadata, while anonymous root/health/auth/bootstrap and mode mutation receive explicit neutral/self-management dispositions.
- Metadata/registry owner: a single backend operation-key registry plus attribute/convention binding every protected query and command. Existing `Security/AuthorizationPolicies.cs` remains independent; mode check must not grant permissions.
- Runtime filter contract: resolve metadata → read validated singleton → reject excluded operation → allow existing permission/domain handling. API tests must cover excluded reads, retained reads with missing permission, neutral endpoints, and missing/invalid mode fail-closed.
- Mutation-only second fence: deepen `IEfTransactionRunner`/`EfTransactionRunner` with `ExecuteProtectedAsync(operationKey, expectedModeVersion, ...)`; re-read untracked mode after domain saves and before the transaction delegate returns to commit. The request filter alone cannot close the race.

Bounded backend slice Q1 (8 files):

1. `backend/src/IPCManagement.Api/OpenApi/ApiContractServiceCollectionExtensions.cs`
2. `backend/src/IPCManagement.Api/Program.cs`
3. `backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs`
4. new operation metadata attribute file
5. new operation eligibility registry file
6. new MVC mode filter file
7. new request-pipeline matrix test file
8. new operation-registry closure test file

Bounded backend slice Q2 (4 files):

1. `backend/src/IPCManagement.Api/Data/Transactions/IEfTransactionRunner.cs`
2. `backend/src/IPCManagement.Api/Data/Transactions/EfTransactionRunner.cs`
3. focused transaction fence test
4. protected mutation owner inventory/closure test

### Deterministic singleton initialization precedent

The operational-warehouse precedent provides **cardinality enforcement and fail-closed validation**, but deliberately does not initialize data:

- Migration uses nullable computed `OperationalSingletonKey = CASE WHEN IsOperationalActive THEN 1 ELSE NULL END` plus unique index, allowing many inactive rows but at most one active row.
- `OperationalWarehouseResolver.ResolveAsync` queries up to two candidates and rejects zero, multiple, missing configured row and configured/active mismatch.
- `Program.cs` validates the invariant at startup.
- `MySqlOperationalWarehouseInvariantTests` explicitly asserts the migration contains no `InsertDataOperation`/`UpdateDataOperation`.

Therefore Phase 29 cannot claim initialization by copying this migration. Required deterministic initialization seam:

1. schema migration creates a fixed-key mode table/check/version, without ambiguous environment fallback;
2. a reviewed idempotent activation command runs after migration with exact preconditions: zero rows → insert one `DEFAULT`; one valid row → no-op; multiple/invalid rows → fail closed;
3. startup/read service continues exact-cardinality validation;
4. tests prove fresh initialization, rerun non-duplication, multiple/invalid rejection, rollback/postflight inclusion.

Severity: **blocker** until an executable initialization owner and tests are declared.

### Safe repository secret/hygiene command

Baseline-proven high-confidence command (Bash, exits 0 on current tracked repository):

```bash
if git grep -nE '(BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{10,})' -- . ':(exclude).artifacts/**' ':(exclude)frontend/test-results/**'; then
  echo 'high-confidence secret found' >&2
  exit 1
else
  exit 0
fi
```

Pair with:

```bash
test -z "$(git diff --cached --name-only)"
test -z "$(git status --porcelain=v1 -- .planning/phases/29-system-operation-mode-and-material-reconciliation | grep '^??')"
git diff --check
```

The scanner is intentionally high-confidence. It does not claim comprehensive entropy/credential detection; CI or a dedicated scanner should remain the broader defense.

## Architecture

Phase 28 inventories define route × region × state × actor × viewport identities and apply 32 rule oracles. Measured evidence may override fallback only for an exact identity. The remediation reconciler rejects actionable FAIL and preserves unsupported identities as `NEEDS_EVIDENCE`. Consequently Phase 29 must first extend these registries to CLR-specific rows, then materialize production slices only from exact measured lowest-owner attribution.

Backend mode enforcement has two layers: a global MVC request/query gate at the existing controller registration/pipeline seam, followed independently by current permission authorization; protected mutations additionally use the EF transaction runner for pre-commit revalidation. The operation-mode singleton combines database cardinality, deterministic one-time/idempotent initialization and runtime exact-cardinality validation.

## Start Here

Open `frontend/tests/uiAuditRemediationReconciliation.ts` first. It proves why the current authorized clarity production worklist is empty and prevents converting `NEEDS_EVIDENCE` into speculative edits. For the backend blocker, open `backend/src/IPCManagement.Api/OpenApi/ApiContractServiceCollectionExtensions.cs` next; it is the concrete global MVC registration seam missing from the existing plans.

## Review Findings

- **blocker:** no evidence-authorized production clarity candidate currently exists; Plan 29-12 must not carry provisional route/shared files as fixes.
- **blocker:** backend protected reads have no current mode-aware request-pipeline enforcement seam in executable plans.
- **blocker:** the current singleton precedent enforces at-most-one/fail-closed but does not initialize the required exactly-one mode row.
- **high:** any CLR inventory must preserve initial empty, filtered empty, load error, permission denial, mode unavailability and stale-data states; concise copy must not collapse meanings.
- **high:** shared seams are conditional candidates only; owner attribution must name exact symbols before edits.
- **medium:** the high-confidence secret command exits 0 now but is not a substitute for a dedicated entropy/history scanner.

## Residual Risks

- The ignored historical Phase 28 combined JSON was not present in the current checkout; counts are attested by tracked reconciliation code and `MEMORY.md`, not re-derived from the absent ignored artifact.
- Exact feature/shared production clarity slices cannot be known until CLR-specific measured rows are emitted. This is a deliberate stop condition, not permission to guess.
- A global MVC filter needs explicit metadata closure tests so unannotated protected controllers cannot silently bypass mode enforcement.
- The initializer must be operationally ordered after migration and before protected traffic; a migration-only unique constraint gives at-most-one, not exactly-one.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Concrete file/line-grounded findings identify zero currently authorized clarity edits, bounded evidence slices, the MVC and EF protected-operation seams, deterministic singleton precedent/gap, and a baseline-proven hygiene command; blockers/high/medium severity and residual risks are recorded."
    }
  ],
  "changedFiles": [
    ".planning/phases/29-system-operation-mode-and-material-reconciliation/29-CONVERGENCE-RUN.inventory.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "baseline high-confidence git grep secret negative assertion",
      "result": "passed",
      "summary": "Exited 0 on the current tracked baseline."
    }
  ],
  "validationOutput": [
    "Tracked Phase 28 reconciliation authority locks actionable FAIL to zero and NEEDS_EVIDENCE to 47,208.",
    "All proposed slices declare fewer than 15 files.",
    "Concrete backend request seam is AddControllers in ApiContractServiceCollectionExtensions plus Program middleware/MapControllers ordering; mutation race seam is EfTransactionRunner.",
    "Operational warehouse precedent proves at-most-one and fail-closed behavior but explicitly contains no data initialization."
  ],
  "residualRisks": [
    "Ignored combined Phase 28 evidence JSON was absent, so tracked code and MEMORY attest the locked counts.",
    "No exact feature/shared clarity remediation file may be approved until CLR-specific measured owner rows exist.",
    "High-confidence grep does not replace a comprehensive secret/entropy/history scanner."
  ],
  "noStagedFiles": true,
  "diffSummary": "Added one read-only Phase 29 convergence inventory planning artifact; no production, test, runtime, database or GitNexus changes.",
  "reviewFindings": [
    "blocker: frontend/tests/uiAuditRemediationReconciliation.ts - current authority exposes zero actionable clarity production candidates",
    "blocker: backend/src/IPCManagement.Api/OpenApi/ApiContractServiceCollectionExtensions.cs - plans do not yet wire mode enforcement into the protected MVC query/request pipeline",
    "blocker: backend/src/IPCManagement.Api/Migrations/20260824161853_EnforceSingleOperationalWarehouse.cs - precedent enforces at-most-one but intentionally performs no initialization",
    "high: frontend/tests/uiAuditInventory.ts - 47,208 NEEDS_EVIDENCE findings cannot be promoted to fixes without exact oracle evidence"
  ],
  "manualNotes": "No GitNexus, browser, runtime or database mutation was used. The required output artifact is the only written file."
}
```
