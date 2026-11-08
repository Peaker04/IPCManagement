# Repository Verification Debt Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repository verification path green by resolving the MRX architecture-growth regression, all 118 current Frontend ESLint diagnostics and all three dependency violations without changing observable business behavior or weakening guardrails.

**Architecture:** Move the Warehouse revision read projection to one internal Reconciliation query owner; relocate cross-feature BOM composites to the existing shared composite layer; break the weekly-menu type-only cycle with a sibling type owner. Repair lint debt in bounded root-cause batches, using the currently failing architecture/lint/dependency commands as RED and existing strongest-boundary behavior tests as regression owners.

**Tech Stack:** ASP.NET Core 9, EF Core, xUnit, React 19, TypeScript, ESLint flat config, dependency-cruiser, Vitest/Testing Library, Playwright/Chrome.

**Spec:** `docs/superpowers/specs/2026-10-31-repository-verification-debt-remediation-design.md`

## Global Constraints

- Preserve `DEFAULT != MATERIAL_RECONCILIATION`, API/DTO shapes, RBAC, audit lineage, database schema, transactions and existing user-visible behavior.
- No dependency installation, lint-rule disablement, architecture baseline increase, dependency allowlist/exemption padding, fake API fallback, test-only production seam, new styling token or duplicate component.
- Use `.planning/WORK.md` as the sole task-state owner; do not create another execution ledger.
- Continue in the existing dirty feature workspace; preserve inherited modifications and untracked files.
- Do not mutate `ipcmanagement`; G6 mutations use only `ipc_mrx_e2e_sandbox` on ports `5174/5263` with teardown.
- Do not stage, commit or push without separate Owner authorization.
- Test edits follow `ipc-test-audit`: Backend/generated DTO-shaped fixtures, no component/hook under test mocked, no skip/todo/allowlist padding.
- A lint-only mechanical change gets no new test when an existing owner test already protects behavior. Any newly exposed state/error transition receives one smallest owner test and must be observed RED before implementation.

## Review Focus

1. **Warehouse revision projection:** InMemory/SQLite/relational paths still return the latest applied actor/time/role per service date; owned by `ReconciliationServiceTests.Warehouse_daily_exposes_last_revision_for_changed_day`.
2. **BOM composite moves:** Admin and Weekly Menu still open, preview, commit and edit BOM through the same callbacks; owned by existing BOM modal/Admin/Weekly Menu tests.
3. **Async effect repairs:** initial loading, retry, scope changes and stale-response cancellation remain distinct; owned by page/hook tests named in each task.
4. **Query error repairs:** API rejection renders error/retry rather than ordinary empty state; each affected operational owner gets or retains one strongest-boundary assertion.
5. **Browser acceptance:** direct source edit, persisted reload, locked dates, coordinator approval and apply-vs-issue race remain valid in permanent G6.

---

### Task 1: Extract Warehouse Revision Projection

**Files:**
- Create: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationWarehouseRevisionQuery.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs:100-220`
- Verify: `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs`
- Modify: `.planning/WORK.md`

**Interfaces:**
- Produces internal `ReconciliationWarehouseRevisionQuery.GetLatestByDateAsync(byte[] batchId, CancellationToken token)` returning `IReadOnlyDictionary<DateOnly, ReconciliationWarehouseRevisionStamp>`.
- `ReconciliationWarehouseRevisionStamp` contains `AppliedAt`, `AppliedByName`, `AppliedByRole`.
- `ReconciliationBatchService.GetWarehouseDailyAsync` remains the only caller and its public signature/DTO stay unchanged.

- [ ] **Step 1: Record Task 1 EXECUTE and exact allowed owners in `.planning/WORK.md`**

Record that the existing behavior test and strict architecture gate are the regression owners; no new public interface or DI registration is authorized.

- [ ] **Step 2: Verify RED behavior/growth baseline**

Run:

```bash
npm run check:architecture-growth
npm run test:be -- --filter "FullyQualifiedName~ReconciliationServiceTests.Warehouse_daily_exposes_last_revision_for_changed_day"
```

Expected: architecture command FAILS with `ReconciliationBatchService` 715 → 770; behavior test PASSES.

- [ ] **Step 3: Move the coherent revision read code without changing it**

Create the internal query/record from the approved design. Move provider probing, revisions/deltas/users reads and latest-per-date ordering from `ReconciliationBatchService`. The service constructs the internal query with its existing context and maps stamps into the existing DTO.

- [ ] **Step 4: Verify GREEN at behavior and architecture boundaries**

Run:

```bash
npm run test:be -- --filter "FullyQualifiedName~ReconciliationServiceTests.Warehouse_daily_exposes_last_revision_for_changed_day"
npm run check:architecture-growth
npm run test:architecture-growth
```

Expected: focused tests PASS; strict growth and growth-contract tests exit 0.

- [ ] **Step 5: Checkpoint without committing**

Record line counts, tests and architecture result in WORK.

---

### Task 2: Restore Frontend Dependency Direction

**Files:**
- Create: `frontend/src/features/weekly-menu/mrxBatchPreviewTypes.ts`
- Modify: `frontend/src/features/weekly-menu/MrxBatchPreviewSection.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxShiftDishesModal.tsx`
- Move: `frontend/src/features/admin/DishBomEditorModal.tsx` → `frontend/src/components/workbench/DishBomEditorModal.tsx`
- Move: `frontend/src/features/admin/DishBomBatchImportModal.tsx` → `frontend/src/components/workbench/DishBomBatchImportModal.tsx`
- Modify callers under `frontend/src/features/admin/branches/AdminBomBranch.tsx`, `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`, `frontend/src/components/workbench/MrxBatchDishesModal.tsx`
- Modify tests: `frontend/src/__tests__/AdminBomBranch.test.tsx`, `DishBomBatchImportModal.test.tsx`, `DishBomEditorModal.test.tsx`, and any import paths found by `rg`

**Interfaces:**
- `PlanSummaryItem` and `ShiftDishDetail` move unchanged to a sibling type-only module.
- Both BOM component names and prop interfaces remain unchanged; only their canonical module paths move.
- No compatibility re-export wrapper remains under `features/admin`.

- [ ] **Step 1: Verify dependency RED and caller inventory**

Run:

```bash
npm run depcruise:fe
rg -n "DishBomBatchImportModal|DishBomEditorModal|PlanSummaryItem|ShiftDishDetail" frontend/src frontend/tests
```

Expected: exactly the three known violations are reported; caller list is captured before moving files.

- [ ] **Step 2: Move preview types and BOM composites**

Use real file moves, update relative imports and migrate every caller/test. Do not change rendered copy, API calls, callbacks, state or styling.

- [ ] **Step 3: Verify behavior and dependency GREEN**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/AdminBomBranch.test.tsx src/__tests__/DishBomBatchImportModal.test.tsx src/__tests__/DishBomEditorModal.test.tsx src/__tests__/WeeklyMenu.test.tsx
npm run depcruise:fe
npm run build -w frontend
```

Expected: selected tests and build PASS; dependency-cruiser reports zero current violations.

- [ ] **Step 4: Regenerate dependency baseline only if it shrinks**

Run the baseline generator to a temporary file, compare counts/content, and replace `.dependency-cruiser-known-violations.json` only when the result removes resolved entries and adds none. Do not use baseline generation to hide a new violation.

- [ ] **Step 5: Checkpoint without committing**

Record moved owners, tests and zero dependency violations in WORK.

---

### Task 3: Remove Explicit `any`, Dead Symbols and Playwright Hook False Positives

**Files:**
- Modify tests: `AdminBomBranch.test.tsx`, `AdminCustomersBranch.test.tsx`, `BomApi.test.ts`, `DishBomBatchImportModal.test.tsx`, `DishBomEditorModal.test.tsx`, `FullMrxModernizationSmoke.test.tsx`, `NetworkStabilityAndIdlePurity.test.tsx`, `useWorkbenchQuery.test.ts`
- Modify production: `features/admin/branches/AdminCatalogBranch.tsx`, `features/warehouse/branches/MrxPrepAllocationsBranch.tsx`, `features/weekly-menu/hooks/useMrxBatchWorkspace.ts`, `hooks/useWorkbenchQuery.ts`
- Modify unused-symbol owners: `components/workbench/StateBoundary.tsx`, `features/dashboard/ReconciliationDashboardPage.tsx`, `features/reconciliation/branches/ReconciliationTransactionsBranch.tsx`, `ReconciliationVariancesBranch.tsx`, `features/weekly-menu/branches/MrxBatchHeaderBranch.tsx`
- Modify E2E harness: `tests/e2e-mrx/core/globalSetup.ts`, `tests/e2e-mrx/fixtures/mrxTest.ts`

**Interfaces:**
- Replace `any` with existing generated/API types, `unknown`, React/Vitest types or smallest structural types; do not add casts that merely rename `any`.
- Rename Playwright fixture callback parameter `use` to `fixtureUse`; fixture names and behavior remain unchanged.

- [ ] **Step 1: Verify RED for this diagnostic cluster**

Run ESLint over the listed files. Expected: 27 `no-explicit-any`, six unused-symbol, five rules-of-hooks and one empty-pattern diagnostics from the frozen inventory.

- [ ] **Step 2: Repair tests and production types mechanically**

Use generated/request/response types where available. Use `unknown` plus narrowing at trust boundaries. Remove dead parameters only when no caller contract requires them; otherwise name and consume the real value.

- [ ] **Step 3: Repair Playwright fixture names**

Rename the callback function parameter and calls only; do not disable React Hooks rules or change fixture lifecycle.

- [ ] **Step 4: Verify focused behavior and lint GREEN**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/AdminBomBranch.test.tsx src/__tests__/AdminCustomersBranch.test.tsx src/__tests__/BomApi.test.ts src/__tests__/DishBomBatchImportModal.test.tsx src/__tests__/DishBomEditorModal.test.tsx src/__tests__/FullMrxModernizationSmoke.test.tsx src/__tests__/NetworkStabilityAndIdlePurity.test.tsx src/__tests__/useWorkbenchQuery.test.ts
npx eslint <all Task 3 files>
```

Expected: tests PASS and Task 3 files report zero diagnostics.

- [ ] **Step 5: Checkpoint without committing**

---

### Task 4: Remove Silent Empty Catches and Debug Logging

**Files:**
- Modify: `frontend/src/hooks/useClientDraftPersistence.ts`
- Modify: `frontend/src/store/offlineMutationQueue.ts`
- Modify: `frontend/src/store/serverStateCache.ts`
- Modify: `frontend/src/store/workspaceUiState.ts`
- Modify browser tests: `frontend/tests/browser/live-data-display-audit.spec.ts`, `matrix-full-coverage-audit.spec.ts`, `responsive-design-system-audit.spec.ts`
- Modify E2E harness: `frontend/tests/e2e-mrx/core/globalSetup.ts`, `globalTeardown.ts`

**Interfaces:**
- Best-effort storage cleanup may still ignore an unavailable browser store, but each catch states that boundary and retains in-memory behavior.
- Debug console output is removed; real errors remain observable through existing state/rejection/test failure channels.

- [ ] **Step 1: Verify RED**

Run ESLint over Task 4 files. Expected: 14 `no-empty` and seven `no-console` diagnostics.

- [ ] **Step 2: Classify each catch/log before editing**

For each site record one of: intentional best-effort cleanup, must propagate, or must update existing error state. Do not introduce a logger abstraction.

- [ ] **Step 3: Implement the smallest classification-preserving repairs**

Add a concise comment only for intentional best-effort catches; otherwise preserve/route the error. Remove debug logs that have no consumer.

- [ ] **Step 4: Verify behavior and lint GREEN**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/NetworkStabilityAndIdlePurity.test.tsx src/__tests__/Render1CacheHitVerification.test.tsx src/__tests__/MrxSourceEditFoundation.test.ts
npx eslint <all Task 4 files>
```

Expected: tests PASS and Task 4 files report zero diagnostics.

- [ ] **Step 5: Checkpoint without committing**

---

### Task 5: Give Operational Queries Real Error Ownership

**Files:**
- Modify: `frontend/src/features/admin/branches/AdminCatalogBranch.tsx`
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`
- Test: extend existing `AdminData.test.tsx`, `Warehouse.test.tsx`, or `WeeklyMenu.test.tsx` only where the current owner lacks an API-error/retry assertion.

**Interfaces:**
- Each query consumer reads `isError/error` and renders/returns the existing error state owner rather than ordinary empty data.
- No API call, cache key or mutation body changes.

- [ ] **Step 1: Audit existing owner coverage**

For each of the five warnings, name the current rendered or hook-level error path and its strongest existing test. If a test already rejects the API and asserts error/retry, retain it; otherwise add one smallest case at the page boundary.

- [ ] **Step 2: Verify any new test RED**

Run only newly extended owner tests. Expected: FAIL because the rejection currently becomes an empty/prerequisite state.

- [ ] **Step 3: Wire query error state to the existing owner**

Do not merely destructure `isError`; ensure the error is consumed by `StateBoundary`, `QueryErrorAlert`, `InlineBanner` or the hook result used by the page.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/AdminData.test.tsx src/__tests__/Warehouse.test.tsx src/__tests__/WeeklyMenu.test.tsx
npx eslint <all Task 5 files and changed tests>
```

Expected: tests PASS and all five `ipc/no-swallowed-query-error` warnings are gone.

- [ ] **Step 5: Checkpoint without committing**

---

### Task 6: Repair Page and Modal Effect Ownership

**Files:**
- Modify: `frontend/src/components/workbench/DataGrid.tsx`
- Modify Admin: `features/admin/ApprovalRulesPage.tsx`, moved `components/workbench/DishBomEditorModal.tsx`, `features/admin/branches/AdminBomBranch.tsx`, `AdminCustomersBranch.tsx`
- Modify pages: `features/approvals/ApprovalPage.tsx`, `features/chef/ChefDashboardPage.tsx`, `features/coordination/MealOrdersPage.tsx`, `features/dashboard/DashboardPage.tsx`, `ReconciliationDashboardPage.tsx`, `features/purchasing/PurchasingPage.tsx`, `features/reports/ReportsPage.tsx`, `features/warehouse/WarehousePage.tsx`, `features/weekly-menu/WeeklyMenuPage.tsx`
- Modify Reconciliation: `features/reconciliation/ReconciliationDispositionModal.tsx`, `useReconciliationReports.ts`
- Tests: existing `AdminData`, `ApprovalRules`, `Approvals`, `Chef`, `Dashboard`, `MealOrders`, `Purchasing`, `Reconciliation`, `Reports`, `Warehouse`, `WeeklyMenu`, and `Primitives` suites as applicable.

**Interfaces:**
- Preserve initial load, explicit refresh, scope/filter reset, cancellation and modal reopen behavior.
- Effects synchronize with network/DOM only; synchronous state transitions move to initialization, scope-key identity or user-event owners.

- [ ] **Step 1: Establish focused behavioral baselines**

Run the listed page/component test files before editing. Expected: PASS.

- [ ] **Step 2: Verify lint RED for Task 6 files**

Expected: page/modal subset of `set-state-in-effect` and `exhaustive-deps` diagnostics.

- [ ] **Step 3: Repair one owner at a time**

For each owner: classify initial load, prop reset or user-event reset; make the smallest behavior-preserving change; rerun its owner test immediately. Do not bundle multiple unverified pages into one edit.

- [ ] **Step 4: Verify the complete Task 6 group GREEN**

Run all listed owner tests and ESLint over Task 6 files. Expected: tests PASS and zero Task 6 diagnostics.

- [ ] **Step 5: Checkpoint without committing**

---

### Task 7: Repair Core Hook Ref, Cache and Purity Ownership

**Files:**
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`
- Modify: `frontend/src/hooks/useDeferredSkeleton.ts`
- Modify: `frontend/src/hooks/useOperationalRecovery.ts`
- Modify: `frontend/src/hooks/useWorkbenchQuery.ts`
- Tests: `frontend/src/__tests__/Reconciliation.test.tsx`, `Render1CacheHitVerification.test.tsx`, `useDeferredSkeleton.test.ts`, `useOperationalRecovery.test.tsx`, `useWorkbenchQuery.test.ts`, `MrxSourceEditFoundation.test.ts`

**Interfaces:**
- Refs are never read/written during render.
- Cache hydration remains synchronous through state initialization/keyed state, not an effect.
- Network effects preserve abort/ignore semantics and MRX visible-tab force refetch.
- Deferred skeleton timing preserves delay and minimum-visible-duration contracts without render-time `Date.now()`.

- [ ] **Step 1: Run owner tests as baseline**

Expected: all listed tests PASS before refactor.

- [ ] **Step 2: Verify lint RED**

Expected: seven ref diagnostics, core-hook set-state/effect dependency findings and one purity finding.

- [ ] **Step 3: Refactor one hook through RED/GREEN behavior checks**

Use existing owner tests. If a lint-driven change exposes an unowned stale-cache, scope-switch or timing behavior, add one minimal test, observe it fail for the intended reason, then implement.

- [ ] **Step 4: Verify hook group GREEN**

Run all Task 7 tests and ESLint over Task 7 files. Expected: PASS and zero diagnostics.

- [ ] **Step 5: Checkpoint without committing**

---

### Task 8: Stabilize Shared Component and Fast Refresh Ownership

**Files:**
- Modify/split: `frontend/src/components/ui/button.tsx`
- Modify/split: `frontend/src/components/workbench/WorkspaceFrame.tsx`
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Modify/split: `frontend/src/store/workspaceScopeContext.tsx`
- Update real callers found by `rg`
- Tests: `frontend/src/__tests__/Primitives.test.tsx`, `WorkspaceFrame.test.tsx`, `WorkspaceScopeContext.test.tsx`, operational page contract tests that render `StateBoundary`

**Interfaces:**
- Component names, variants, contexts, hooks and import behavior remain available to all real callers after migration.
- Render-created components in `StateBoundary` become stable top-level components without changing six-state rendering.
- No compatibility file is kept solely for tests.

- [ ] **Step 1: Verify lint RED and caller inventory**

Expected: three Fast Refresh findings plus StateBoundary immutability/static-component findings.

- [ ] **Step 2: Split only the mixed exports required by Fast Refresh**

Move constants/hooks/types to focused sibling modules and migrate real imports. Lift dynamic component definitions in StateBoundary to stable owners.

- [ ] **Step 3: Verify behavior and lint GREEN**

Run shared primitive/workbench tests, operational contract tests, TypeScript build and ESLint over Task 8 files.

- [ ] **Step 4: Checkpoint without committing**

---

### Task 9: Full Static, Unit and Build Convergence

**Files:**
- Modify only defects proven by the gates in Tasks 1–8.
- Modify: `.planning/WORK.md`

- [ ] **Step 1: Run full Frontend lint**

```bash
npm run lint:fe
```

Expected: exit 0 with zero errors and zero warnings. If diagnostics remain, map each to its owning task; do not disable rules.

- [ ] **Step 2: Run dependency and architecture gates**

```bash
npm run depcruise:fe
npm run check:architecture-growth
npm run test:architecture-growth
```

Expected: all exit 0; no expanded baseline.

- [ ] **Step 3: Run full Backend verification**

```bash
dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj -c Release --no-restore
npm run test:be
```

Expected: Release build 0 errors/warnings; all executable tests PASS with only environment-owned integration skip explicitly reported.

- [ ] **Step 4: Run full Frontend verification**

```bash
npm run test:fe:unit
npm run build:fe
```

Expected: all Vitest files/tests PASS and production build exits 0.

- [ ] **Step 5: Run aggregate repository gate**

```bash
npm run verify
```

Expected: exit 0 through every command. A failure keeps lifecycle in VERIFY.

- [ ] **Step 6: Run `git diff --check` and confirm no staged files**

Expected: no whitespace errors; line-ending notices may be reported; staged list empty.

---

### Task 10: Browser Evidence, Reviews and Closure

**Files:**
- Permanent G6 changes only if an approved observable assertion must be corrected: `frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts`
- Temporary/ignored evidence instrumentation only for actual zoom attempt; remove after run.
- Modify: `.planning/WORK.md`

- [ ] **Step 1: Run permanent headed G6**

```bash
npm run test:e2e:mrx:g6 -- --headed
```

Expected: 1/1 PASS; login, open/locked dates, persistence/reload, Coordinator approval and apply-vs-issue race pass; teardown reports residual customers 0, ports stopped and sandbox dropped.

- [ ] **Step 2: Make one bounded actual Chrome 200% attempt**

Use a dedicated Chrome profile/process and OS/browser zoom. A PASS requires physical/effective viewport and `devicePixelRatio` proving real zoom plus usable MRX grid → review → grid. Do not use viewport/device emulation as actual-zoom evidence. Remove temporary probe/instrumentation afterward.

- [ ] **Step 3: Verify process/database hygiene**

Expected: no listeners on `5174/5263`; `ipc_mrx_e2e_sandbox` schema count 0; no temporary capture markers in permanent G6.

- [ ] **Step 4: Perform mandatory reviews**

Apply `ipc-test-audit`, `ipc-code-review`, and `ipc-ui-review`. Record each in required format:

```text
Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact
```

Any Critical/Important finding is fixed with the same RED→GREEN rules and relevant gates rerun.

- [ ] **Step 5: Close truthfully**

Set PASS/FAIL/NEEDS_EVIDENCE/BLOCKED per criterion in `.planning/WORK.md`. Return to `IDLE` only when all code/static/runtime gates pass. A Windows-only actual-zoom capture failure remains explicitly `NEEDS_EVIDENCE` or `BLOCKED` and is not relabeled.

- [ ] **Step 6: Do not commit**

Leave all work unstaged until the Owner separately authorizes commit/push.
