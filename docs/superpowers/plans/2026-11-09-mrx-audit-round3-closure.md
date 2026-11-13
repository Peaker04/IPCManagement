# MRX Ponytail Audit Closure Round 3 (D1–D8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. `.planning/WORK.md` is the sole task-state owner.

**Goal:** Close all eight Round 3 Ponytail audit findings (`D1–D8`, covering Must fix `#1–#4` and Should fix `#5–#8`) across the MRX Backend and Frontend.

**Architecture:** Apply surgical fixes at canonical owners in two self-contained tasks: (1) Backend MRX mode isolation in `MenuScheduleService` (`D1`), MRX-native `SubmitMrxAsync` & `GetMrxInboxAsync` in `MrxMenuAmendmentCoordinator` (`D2`), `QuantityImportBatchId` filtering in `MrxEditScopeQuery` (`D4`), net issued quantity parity in `ReconciliationPreparationWorkbookExporter` (`D5`), and Savory/Vegetarian scope aggregation in `ReconciliationBatchQueryProjector` (`D8`); and (2) Frontend `useMrxSourceEdit` reload synchronization after inbox approval / same-week import (`D3`), `useReconciliationWorkspace` batch list & cache synchronization on completion and refresh (`D6`), and `ReconciliationDispositionModal` partial-bulk refresh recovery (`D7`), followed by full verification gates and `.planning/WORK.md` closure.

**Tech Stack:** .NET 10, Entity Framework Core, xUnit, FluentAssertions, React 19, TypeScript, React Router, Vitest, Testing Library.

**Spec:** [2026-11-09-mrx-audit-round3-closure-design.md](../specs/2026-11-09-mrx-audit-round3-closure-design.md)

## Global Constraints

- Preserve all inherited changes on `main` (`HEAD bbd55009a77a6e83f79027a7784deb4b7f323928`), empty git index, and zero destructive git operations.
- Keep `Phase30FinalOracleContracts` controller mutation surface 100% intact (do not change controller constructor or action parameter signatures).
- `DEFAULT != MATERIAL_RECONCILIATION` (`DOM-MODE-1`).
- Single Styling Authority (`frontend/src/styles/index.css`) and existing UI primitives.
- Emit **Scoped Pre-Code UI Gate Block** in chat before modifying any `.tsx` file.
- Enforce `ipc-test-audit` (`Rule TA-1` to `TA-5`): mock only at transport/API boundary, zero component self-mocking, zero allowlist padding, fail-closed unit-test network boundary.
- Do not stage, commit, push, run DB migrations, or install packages unless explicitly authorized by the owner.

## Review Focus

1. Calling `MenuScheduleService.RollbackMenuVersionAsync` or `UpdateMenuScheduleRulesAsync` when an MRX `ReconciliationBatch` exists for that `(CustomerId, WeekStartDate)` must throw `BusinessRuleException` (`MrxReconBatchGuard.BatchExistsMessage`) and leave `MenuVersion` / `MenuSchedule` untouched. Pin in Task 1 (`MrxMenuAmendmentTests.cs`).
2. Submitting an MRX amendment via `MenuAmendmentService.SubmitMrxAsync` must not create `MenuAmendmentReconciliationCase` even if `DEFAULT`-mode `PurchaseOrders` exist in DB, and `GetMrxInboxAsync` must exclude `DEFAULT`-mode `RECONCILIATION_REQUIRED` amendments. Pin in Task 1 (`MrxSourceChangeApplierTests.cs`).
3. Calling `MrxEditScopeQuery.GetAsync` when a schedule has both an active batch's `MealQuantityPlanLine` (`ImportBatchId == batch.QuantityImportBatchId`) and a newer unattached `MealQuantityPlanLine` (`ImportBatchId == null`) must return the batch's `SavoryServings`/`VegetarianServings`. Pin in Task 1 (`MrxSourceChangeApplierTests.cs`).
4. Exporting a preparation workbook via `ReconciliationPreparationWorkbookExporter.GetWorkbookAsync` after an over-issued daily line (`Required = 4`, `Issued = 6`) has a confirmed `InventoryReturn` (`Quantity = 2`, `ReceivedAt != null`) must report `IssueStatus = "EXACT"` instead of `"OVER_ISSUED"`. Pin in Task 1 (`ReconciliationPreparationWorkbookTests.cs`).
5. Approving a pending MRX source change in `MrxBatchWorkbench` (`decideSourceChange`) must reload `mrxApi.getEditScope` so `MrxSourceEditGrid` reflects the new `menuVersionId` and `batchVersion`. Pin in Task 2 (`WeeklyMenu.test.tsx`).

---

### Task 1: Backend MRX Mode Guard, Native Amendment Submission, Edit-Scope Plan Line Filtering, Net Issue Workbook Parity, and Dish Variant Scope Projection (D1, D2, D4, D5, D8)

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Coordination/Services/MenuScheduleService.cs:94-105, 155-165, 270-285`
- Modify: `backend/src/IPCManagement.Api/Features/Coordination/Controllers/MenuSchedulesController.cs:67-100`
- Modify: `backend/src/IPCManagement.Api/Features/SampleData/Services/MrxMenuAmendmentCoordinator.cs:118-135`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxEditScopeQuery.cs:38-70`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationPreparationWorkbookExporter.cs:73-84`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchQueryProjector.cs:120-125`
- Test: `backend/tests/IPCManagement.Api.Tests/MrxMenuAmendmentTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/MrxSourceChangeApplierTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs`

**Interfaces:**
- Consumes: `MrxReconBatchGuard.AnyBatchAsync`, `ReconciliationNetIssueProjection.LoadByDailyLineIdsAsync`, `IMrxSourceChangeGateway.PreviewAsync`
- Produces:
  - `MenuScheduleService` blocks `UpdateMenuScheduleRulesAsync`, `UpdateMenuScheduleVersionAsync`, and `RollbackMenuVersionAsync` with `BusinessRuleException(MrxReconBatchGuard.BatchExistsMessage)` when an MRX batch exists.
  - `MrxMenuAmendmentCoordinator.SubmitMrxAsync` creates `PENDING_REVIEW` MRX amendments directly from `gateway.PreviewAsync`, and `GetMrxInboxAsync` filters to MRX amendments (`Status == "PENDING_REVIEW"` and `BaseMenuVersionId != null`).
  - `MrxEditScopeQuery.GetAsync` filters `Mealquantityplanlines` by `batch.QuantityImportBatchId` when `batch?.QuantityImportBatchId != null`.
  - `ReconciliationPreparationWorkbookExporter.GetWorkbookAsync` uses `ReconciliationNetIssueProjection` for `issueLinesByDailyLineId`.
  - `ReconciliationBatchQueryProjector.ListDishesAsync` aggregates `SavoryServings` and `VegetarianServings` by `FrozenMenuVariant` per `(ServiceDate, FrozenShiftName)`.

- [ ] **Step 1: Write failing Backend tests in `MrxMenuAmendmentTests.cs`, `MrxSourceChangeApplierTests.cs`, `ReconciliationPreparationWorkbookTests.cs`, and `ReconciliationServiceTests.cs`**
- [ ] **Step 2: Run focused Backend tests to verify RED**
- [ ] **Step 3: Implement Backend fixes in `MenuScheduleService.cs`, `MenuSchedulesController.cs`, `MrxMenuAmendmentCoordinator.cs`, `MrxEditScopeQuery.cs`, `ReconciliationPreparationWorkbookExporter.cs`, and `ReconciliationBatchQueryProjector.cs`**
- [ ] **Step 4: Run Backend test suites to verify GREEN**

---

### Task 2: Frontend `useMrxSourceEdit` Reload Sync, `useReconciliationWorkspace` Completion/Refresh Cache Sync, and `ReconciliationDispositionModal` Partial Bulk Recovery (D3, D6, D7)

**Files:**
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts:23-68`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx:82`
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:156-166, 285-300`
- Modify: `frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx:60-102, 161`
- Modify: `.planning/WORK.md`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `invalidateMrxCaches` from `frontend/src/api/mrxCacheInvalidation.ts`
- Produces:
  - `useMrxSourceEdit` accepts `sourceVersionKey?: string` and reloads `mrxApi.getEditScope` when `source.menuVersionId` or `batch.version` changes after inbox approval or same-week re-import.
  - `useReconciliationWorkspace.handleComplete` updates `batches` status to `'COMPLETED'`, invalidates stale MRX caches, and updates `mrx_raw_batch_*` / `mrx_recon_*`; `handleRefresh` calls `invalidateMrxCaches()`.
  - `ReconciliationDispositionModal` invokes `await onSaved()` when a bulk disposition partially succeeds before a conflict/error on a subsequent line, and keys bulk chips by `l.dailyLineId || l.id || l.materialCode`.

- [ ] **Step 1: Write failing Frontend tests in `WeeklyMenu.test.tsx` and `Reconciliation.test.tsx`**
- [ ] **Step 2: Run focused Vitest tests to verify RED**
- [ ] **Step 3: Emit Scoped Pre-Code UI Gate Block and implement Frontend fixes in `useMrxSourceEdit.ts`, `MrxBatchWorkbench.tsx`, `useReconciliationWorkspace.ts`, and `ReconciliationDispositionModal.tsx`**
- [ ] **Step 4: Run Vitest, lint, build, and Backend verification gates to verify GREEN and update `.planning/WORK.md`**
