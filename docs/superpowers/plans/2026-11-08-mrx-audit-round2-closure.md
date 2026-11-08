# MRX Ponytail Audit Closure Round 2 (B1–B8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. `.planning/WORK.md` is the sole task-state owner.

**Goal:** Close all eight Round 2 Ponytail audit findings (`B1–B8`, covering Must fix `#1–#3`, Should fix `#4–#7`, and Nice to have `#8`) across the MRX Backend and Frontend.

**Architecture:** Apply surgical fixes at canonical owners in three self-contained tasks: (1) Backend source-change lineage (`MrxSourceChangeApplier.cs`, `ReconciliationBatchService.cs`) and report exporters/queries (`ReconciliationReportsService.cs`, `MrxReportWorkbookExporter.cs`, `MrxReportCsvStreamWriter.cs`), (2) Frontend `/reconciliation` line detail modal & unit formatter (`ReconciliationLineDetailModal.tsx`, `ReconciliationLinesBranch.tsx`, `reconciliationColumns.tsx`) plus `/chef` and `/warehouse` off-page batch header labels (`MrxCookingWorkbench.tsx`, `MrxCookingHeaderBranch.tsx`, `MrxDailyHeaderBranch.tsx`, `MrxDailyIssueWorkbench.tsx`), and (3) Frontend `/weekly-menu` quantity inspection scope restoration (`MrxQuantityInspectionPage.tsx`) and `/` dashboard timezone + URL filter persistence (`ReconciliationDashboardPage.tsx`) followed by `.planning/WORK.md` closure and full verification gates.

**Tech Stack:** .NET 10, Entity Framework Core, xUnit, FluentAssertions, React 19, TypeScript, React Router, Vitest, Testing Library.

**Spec:** [2026-11-08-mrx-audit-round2-closure-design.md](../specs/2026-11-08-mrx-audit-round2-closure-design.md)

## Global Constraints

- Preserve all inherited changes on `feature/ui-interaction-data-states` (`HEAD e0019978b2ce785945f4ea1a9514fc6bd0bde8f1`), empty git index, and zero destructive git operations.
- Keep running background dev servers (`task-166` Backend `:5262`, `task-167` Frontend `:5173`) intact.
- `DEFAULT != MATERIAL_RECONCILIATION` (`DOM-MODE-1`).
- Single Styling Authority (`frontend/src/styles/index.css`) and existing UI primitives (`<Num />`, `<Badge />`, `<DataGrid />`).
- Emit **Scoped Pre-Code UI Gate Block** in chat before modifying any `.tsx` file.
- Enforce `ipc-test-audit` (`Rule TA-1` to `TA-5`): mock only at transport/API boundary, zero component self-mocking, zero allowlist padding, fail-closed unit-test network boundary.
- Do not stage, commit, push, run DB migrations, or install packages unless explicitly authorized by the owner.

## Review Focus

1. Applying a dish-only MRX source amendment via `MrxSourceChangeApplier` on an existing batch must produce source-change rows in `ReconciliationBatchService.ListSourceChangesAsync` (including `MenuSchedule` `DishId` change and `MenuAmendment` `Status` audit). Pin in Task 1 (`MrxMenuAmendmentTests.cs` / `ReconciliationServiceTests.cs`).
2. Exporting Variance Register CSV/XLSX, Transaction History CSV, and Batch XLSX must output Vietnamese labels (`"Xuất ban đầu"`, `"Xuất thừa"`, `"Chấp nhận chênh lệch"`, `"Chờ giải trình"`) and `MrxReportWorkbookExporter.BatchAsync` must omit the 3 null purchasing columns. Pin in Task 1 (`ReconciliationDashboardAndReportsTests.cs`).
3. Opening `ReconciliationLineDetailModal` on `/reconciliation` for a line with `requiredQuantity: 0.0004`, `issuedQuantity: 0.0009`, `issuedRequiredDifference: 0.0005`, `status: 'NEEDS_REVIEW'` must display `0,0004`, `0,0009`, `+0,0005`, `"Chờ giải trình"`, and clicking `"Xử lý chênh lệch"` must open `ReconciliationDispositionModal`. Pin in Task 2 (`Reconciliation.test.tsx`).
4. Navigating to `/weekly-menu?view=mrx-materials` without `?customerId=` or `?weekStartDate=` query params must fall back to `workspaceSessionStore` / first customer + `currentWeekStart()` and load `getWeeklySource` instead of stopping at `"Chọn khách hàng và tuần bắt đầu"`. Pin in Task 3 (`WeeklyMenu.test.tsx`).
5. Selecting a customer or period filter on `ReconciliationDashboardPage` (`/`) must persist `customerId` and `period` in URL search params and compute `THIS_MONTH` / `THIS_YEAR` bounds from `todayInBusinessTimezone()`. Pin in Task 3 (`Reconciliation.test.tsx`).

---

### Task 1: Backend Source-Change Dish Lineage, Report CSV/XLSX Vietnamese Labels, and Variance Week-End / Actor Helper Consolidation (B1, B4, B7)

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxSourceChangeApplier.cs:129-135`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs:276-305`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs:177-208, 279-303, 358-366, 482-496`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxReportWorkbookExporter.cs:16-35, 106-110`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxReportCsvStreamWriter.cs:16-34`
- Test: `backend/tests/IPCManagement.Api.Tests/MrxMenuAmendmentTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs`

**Interfaces:**
- Consumes: `ServiceCalendar.ServiceDaysPerWeek`
- Produces:
  - `MrxSourceChangeApplier.ApplyCoreAsync` records `AuditLog` (`EntityName = nameof(MenuSchedule)`, `FieldName = "DishId"`) when `row.DishChanged == true`.
  - `ReconciliationBatchService.ListSourceChangesAsync` includes `MenuVersion` audits across all `ReconciliationSourceRevision` versions, `MenuAmendment` audits, `ReconciliationSourceRevision` audits, and `MenuSchedule` audits across all batch versions.
  - `MrxReportWorkbookExporter.TransactionLabel`, `VarianceTypeLabel`, `DispositionCategoryLabel`, `LineStatusLabel` used across `MrxReportWorkbookExporter`, `MrxReportCsvStreamWriter`, and `ReconciliationReportsService.BuildVarianceRegisterCsv`.
  - `MrxReportWorkbookExporter.BatchAsync` exports 9 MRX columns (without `"Đã mua"`, `"Mua - nhu cầu"`, `"Mua - xuất"`).

- [ ] **Step 1: Write failing Backend tests in `MrxMenuAmendmentTests.cs` and `ReconciliationDashboardAndReportsTests.cs`**
- [ ] **Step 2: Run focused Backend tests to verify RED**
- [ ] **Step 3: Implement Backend fixes in `MrxSourceChangeApplier.cs`, `ReconciliationBatchService.cs`, `ReconciliationReportsService.cs`, `MrxReportWorkbookExporter.cs`, and `MrxReportCsvStreamWriter.cs`**
- [ ] **Step 4: Run Backend test suites to verify GREEN**

---

### Task 2: Frontend `ReconciliationLineDetailModal` 6-Decimal & Disposition Wiring, Off-Page Batch Header Labels, and Unit Formatter Cleanup (B2, B6, B8)

**Files:**
- Modify: `frontend/src/components/workbench/ReconciliationLineDetailModal.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationLinesBranch.tsx:137-141`
- Modify: `frontend/src/features/reconciliation/reconciliationColumns.tsx:10-18, 60`
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx:33-38, 175-185`
- Modify: `frontend/src/features/chef/branches/MrxCookingHeaderBranch.tsx:45-55`
- Modify: `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx:11-31, 69-79`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx:173-179`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `formatUnitName` from `frontend/src/utils/formatters.ts`, `MRX_STATUS_LABELS` from `frontend/src/constants/mrxConstants.ts`
- Produces:
  - `ReconciliationLineDetailModal` renders 6-decimal quantities (`format="plain" decimals={6}`), Vietnamese status labels (`statusLabels[line.status]`), formatted unit (`formatUnitName(line.unit)`), and triggers `onOpenDisposition(line)` when clicking `"Xử lý chênh lệch"`.
  - `MrxCookingHeaderBranch` and `MrxDailyHeaderBranch` render customer + week label when the active batch is outside the current catalog page.

- [ ] **Step 1: Write failing Frontend test in `Reconciliation.test.tsx`**
- [ ] **Step 2: Run Vitest on `Reconciliation.test.tsx` to verify RED**
- [ ] **Step 3: Emit Scoped Pre-Code UI Gate Block and implement fixes in `ReconciliationLineDetailModal.tsx`, `ReconciliationLinesBranch.tsx`, `reconciliationColumns.tsx`, `MrxCookingWorkbench.tsx`, `MrxCookingHeaderBranch.tsx`, `MrxDailyHeaderBranch.tsx`, and `MrxDailyIssueWorkbench.tsx`**
- [ ] **Step 4: Run Vitest on `Reconciliation.test.tsx` and `Warehouse.test.tsx` to verify GREEN**

---

### Task 3: Frontend `MrxQuantityInspectionPage` Scope Restoration, `ReconciliationDashboardPage` Business Timezone & URL Filter Sync, and `.planning/WORK.md` Verification Closure (B3, B5)

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx:71-109`
- Modify: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx:40-62, 168-178, 209-213`
- Modify: `.planning/WORK.md`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `workspaceSessionStore` from `frontend/src/store/workspaceSessionStore.ts`, `currentWeekStart`, `isWeekStartDate`, `todayInBusinessTimezone` from `frontend/src/utils/dates.ts`
- Produces:
  - `MrxQuantityInspectionPage` restores `customerId` and `weekStartDate` from `workspaceSessionStore` / first customer + `currentWeekStart()` when opened from the sidebar without URL params.
  - `ReconciliationDashboardPage` syncs `customerId`, `period`, and `page` with URL `searchParams` and computes `THIS_MONTH` / `THIS_YEAR` from `todayInBusinessTimezone()`.

- [ ] **Step 1: Write failing Frontend tests in `WeeklyMenu.test.tsx` and `Reconciliation.test.tsx`**
- [ ] **Step 2: Run focused Vitest tests to verify RED**
- [ ] **Step 3: Emit Scoped Pre-Code UI Gate Block and implement fixes in `MrxQuantityInspectionPage.tsx` and `ReconciliationDashboardPage.tsx`**
- [ ] **Step 4: Run full Backend test suites, Frontend unit tests, `npm run lint:fe`, `npm run build:fe`, and update `.planning/WORK.md`**
