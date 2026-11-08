# MRX Ponytail Audit Closure Round 2 (B1–B8) — Design Spec

Date: 2026-11-08

**Document scope:** Spec and companion implementation plan to close all eight Ponytail audit findings (`B1–B8`, corresponding to Round 2 audit findings `1–8`: Must fix `#1–#3`, Should fix `#4–#7`, Nice to have `#8`) across the MRX (`MATERIAL_RECONCILIATION`) Backend and Frontend subsystem. `.planning/WORK.md` remains the sole task-state owner.

**Plan:** [2026-11-08-mrx-audit-round2-closure.md](../plans/2026-11-08-mrx-audit-round2-closure.md)

## 1. Intent and Evidence

Following completion of `A1–A10` (`2026-11-08-mrx-audit-closure`), a second deep `/ponytail-audit` across all 182 MRX Backend and Frontend files surfaced 8 remaining concrete issues (`B1–B8`):

| ID | Group | Summary | Owner files |
|---|---|---|---|
| **B1** | Must fix (#1) | `ReconciliationBatchService.ListSourceChangesAsync` filters `AuditLog` only on `MenuVersionId == batch.MenuVersionId`, `MealQuantityPlanLine`, `MenuSchedule`, and `DishBom`, omitting `MenuAmendment` audits, `ReconciliationSourceRevision` audits, and historical `MenuVersionId`s (`PreviousMenuVersionId` / `AppliedMenuVersionId`), while `MrxSourceChangeApplier.ApplyCoreAsync` does not record per-dish `AuditLog` entries when `row.DishChanged == true`. Dish-only MRX source amendments vanish from the `"Nguồn & BOM"` tab on `/reconciliation?view=audit`. | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`, `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxSourceChangeApplier.cs`, `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs` |
| **B2** | Must fix (#2) | `ReconciliationLineDetailModal.tsx` renders `requiredQuantity`, `issuedQuantity`, and `diff` with `<Num format="quantity" decimals={3} />` (truncating sub-gram MRX quantities like `0.0004` to `0`), displays raw English `line.status` (`NEEDS_REVIEW`, `INCOMPLETE`, `MATCHED`), and is never passed `isCompleted` or `onOpenDisposition` from `ReconciliationLinesBranch.tsx` (leaving the `"Xử lý chênh lệch"` / `"Cập nhật giải trình"` CTA permanently hidden). | `frontend/src/components/workbench/ReconciliationLineDetailModal.tsx`, `frontend/src/features/reconciliation/branches/ReconciliationLinesBranch.tsx`, `frontend/src/__tests__/Reconciliation.test.tsx` |
| **B3** | Must fix (#3) | `MrxQuantityInspectionPage.tsx` (`/weekly-menu?view=mrx-materials` and `/weekly-menu?view=mrx-plans`) reads `customerId` and `weekStartDate` exclusively from URL query params without falling back to `workspaceSessionStore.getScope().weeklyMenuScope`, first customer, or `currentWeekStart()`. Clicking `"Định lượng nguyên liệu"` or `"Kế hoạch theo ca"` in the left sidebar always strands the user on `"Chọn khách hàng và tuần bắt đầu"`. | `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx`, `frontend/src/__tests__/WeeklyMenu.test.tsx` |
| **B4** | Should fix (#4) | Report CSV/XLSX exporters (`MrxReportCsvStreamWriter.cs`, `MrxReportWorkbookExporter.cs`, `ReconciliationReportsService.BuildVarianceRegisterCsv`) output raw English codes (`INITIAL_ISSUE`, `SUPPLEMENTAL_ISSUE`, `PHYSICAL_RETURN`, `OVER_ISSUED`, `UNDER_ISSUED`, `ACCEPTED_VARIANCE`, `InventoryIssueLine`, `IssuedQty`) instead of Vietnamese domain labels, and `MrxReportWorkbookExporter.BatchAsync` exports 3 purchasing columns (`"Đã mua"`, `"Mua - nhu cầu"`, `"Mua - xuất"`) that are always `null` in MRX daily lineage. | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxReportWorkbookExporter.cs`, `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxReportCsvStreamWriter.cs`, `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`, `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs` |
| **B5** | Should fix (#5) | `ReconciliationDashboardPage.tsx` computes `THIS_MONTH` and `THIS_YEAR` filter dates using browser-local `new Date()` (`getFullYear()`, `getMonth()`) instead of `todayInBusinessTimezone()` (`Asia/Ho_Chi_Minh`) and stores `selectedCustomerId`, `selectedPeriod`, and `page` only in local state instead of URL `searchParams` (so clicking `"Mở công việc"` then Browser Back resets all Dashboard filters). | `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`, `frontend/src/__tests__/Reconciliation.test.tsx` |
| **B6** | Should fix (#6) | `MrxCookingWorkbench.tsx` does not sync `fallbackBatchId` when `urlBatchId` changes on the same mounted component, and `MrxCookingHeaderBranch.tsx` / `MrxDailyHeaderBranch.tsx` render a generic `'Lô đang chọn (ngoài trang danh sách)'` fallback option when the deep-linked batch is on catalog page `>= 2` even when the loaded payload (`data` / `daily`) has `customerName` and `weekStartDate`. | `frontend/src/features/chef/MrxCookingWorkbench.tsx`, `frontend/src/features/chef/branches/MrxCookingHeaderBranch.tsx`, `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`, `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx` |
| **B7** | Should fix (#7) | `ReconciliationReportsService.GetVarianceRegisterAsync` filters `weekStartDate` with `AddDays(6)` (Sunday) instead of `AddDays(ServiceCalendar.ServiceDaysPerWeek - 1)` (`AddDays(5)`, Saturday), and `GetCompletedRegisterCoreAsync` queries `completedByIds.Contains(u.UserId)` without the EF InMemory `SequenceEqual` guard used by `GetVarianceRegisterAsync` and `LoadAuditActorNamesAsync`. | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`, `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs` |
| **B8** | Nice to have (#8) | `reconciliationColumns.tsx` defines a duplicate local `formatCanonicalUnit` function instead of importing `formatUnitName` from `frontend/src/utils/formatters.ts`. | `frontend/src/features/reconciliation/reconciliationColumns.tsx` |

## 2. Technical Design

### 2.1 B1 & B4 & B7 — Backend Source-Change Lineage, Report Exporters, and Service-Week / Actor Helpers (`FR-RECON` / `FR-REP`)

1. **`MrxSourceChangeApplier.ApplyCoreAsync` (`MrxSourceChangeApplier.cs:129-135`):**
   - When `row.DishChanged == true`, record an `AuditLog` entry via `AddAudit(actorId, now, nameof(MenuSchedule), row.Schedule.MenuScheduleId, "DishId", row.Dto.CurrentDishName ?? row.Dto.CurrentDishId, row.Dto.NewDishName ?? row.Dto.NewDishId, tracked.Reason);`.
2. **`ReconciliationBatchService.ListSourceChangesAsync` (`ReconciliationBatchService.cs:276-298`):**
   - Load `revisions = await context.Reconciliationsourcerevisions.AsNoTracking().Where(r => r.BatchId == batchId).ToListAsync(token);`.
   - Build `versionIds` containing `batch.MenuVersionId` plus all `revision.PreviousMenuVersionId` and `revision.AppliedMenuVersionId`.
   - Build `amendmentIds` from `revisions.Where(r => r.MenuAmendmentId != null).Select(r => r.MenuAmendmentId!).ToList()` and `revisionIds = revisions.Select(r => r.SourceRevisionId).ToList()`.
   - Include `MenuSchedule` IDs belonging to any `versionIds` (`context.Menuschedules.Where(s => versionIds.Contains(s.MenuVersionId)).Select(s => s.MenuScheduleId)`) in `menuScheduleIds`.
   - In the `AuditLog` filter (`lines 288-297`), include:
     - `(audit.EntityName == nameof(MenuVersion) && versionIds.Contains(audit.EntityId))`
     - `(audit.EntityName == nameof(MenuAmendment) && amendmentIds.Contains(audit.EntityId))`
     - `(audit.EntityName == nameof(ReconciliationSourceRevision) && revisionIds.Contains(audit.EntityId))`
3. **`MrxReportWorkbookExporter.cs`, `MrxReportCsvStreamWriter.cs`, and `ReconciliationReportsService.cs` (`B4`, `B7`):**
   - Extract shared label helpers in `MrxReportWorkbookExporter` (or internal `MrxReportLabels`):
     - `TransactionLabel`: `"INITIAL_ISSUE" => "Xuất ban đầu"`, `"SUPPLEMENTAL_ISSUE" => "Xuất bổ sung"`, `"PHYSICAL_RETURN" => "Nhập trả kho"`.
     - `VarianceTypeLabel`: `"OVER_ISSUED" => "Xuất thừa"`, `"UNDER_ISSUED" => "Xuất thiếu"`.
     - `DispositionCategoryLabel`: `"ACCEPTED_VARIANCE" => "Chấp nhận chênh lệch"`, `"RETURNED_TO_WAREHOUSE" => "Đã hoàn trả kho"`, `"VOLUME_ADJUSTMENT" => "Điều chỉnh định lượng"`, `"COOKING_WASTE" => "Hao hụt chế biến"`, `" SPOILAGE" / "SPOILAGE" => "Hư hỏng / Đổ bỏ"`, `"OTHER" => "Khác"`.
     - `StatusLabel`: `"MATCHED" => "Khớp định mức"`, `"NEEDS_REVIEW" => "Chờ giải trình"`, `"RESOLVED" => "Đã giải trình"`, `"INCOMPLETE" => "Chưa xuất đủ"`.
   - Use these labels in `MrxReportCsvStreamWriter.WriteTransactionsAsync`, `ReconciliationReportsService.BuildVarianceRegisterCsv`, `MrxReportWorkbookExporter.VariancesAsync`, and `MrxReportWorkbookExporter.BatchAsync`.
   - In `MrxReportWorkbookExporter.BatchAsync` (`lines 32-34`), remove the 3 unused purchasing columns (`"Đã mua"`, `"Mua - nhu cầu"`, `"Mua - xuất"`) so the exported MRX batch sheet matches the MRX domain contract (`["Mã nguyên liệu", "Nguyên liệu", "Đơn vị", "Nhu cầu", "Thực xuất", "Xuất - nhu cầu", "Trạng thái", "Xử lý", "Giải trình"]`).
   - In `ReconciliationReportsService.GetVarianceRegisterAsync` (`line 179`), use `var end = weekStartDate.Value.AddDays(ServiceCalendar.ServiceDaysPerWeek - 1);`.
   - Consolidate user-name resolution in `ReconciliationReportsService.cs` into a single `LoadUserNamesByIdsAsync(IReadOnlyCollection<byte[]> userIds, CancellationToken token)` method with the EF InMemory `SequenceEqual` check and call it from `GetVarianceRegisterAsync`, `GetCompletedRegisterCoreAsync`, and `LoadAuditActorNamesAsync`.

### 2.2 B2, B6 & B8 — Frontend `ReconciliationLineDetailModal`, Header Fallback Labels, and Column Unit Formatter (`FR-RECON` / `FR-CHEF` / `FR-WH`)

1. **`ReconciliationLineDetailModal.tsx` & `ReconciliationLinesBranch.tsx` (`B2`):**
   - Replace `format="quantity" decimals={3}` with `format="plain" decimals={6}` on `requiredQuantity`, `issuedQuantity`, and `diff`.
   - Format unit with `formatUnitName(line.unit)`.
   - Accept optional `statusLabels?: Record<string, string>` (defaulting to `MRX_STATUS_LABELS`) and render `line.disposition ? 'Đã giải trình' : (statusLabels[line.status] || line.status)`.
   - Only show the `"Xử lý chênh lệch"` / `"Cập nhật giải trình"` button when `!isCompleted && onOpenDisposition && ((diff != null && diff > 0) || Boolean(line.disposition))`.
   - In `ReconciliationLinesBranch.tsx:137-141`, pass `isCompleted={isCompleted}`, `statusLabels={statusLabels}`, and `onOpenDisposition={(line) => { setBulkLines(null); setSelectedDispositionLine(line); }}`.
2. **`MrxCookingWorkbench.tsx`, `MrxCookingHeaderBranch.tsx`, and `MrxDailyHeaderBranch.tsx` (`B6`):**
   - In `MrxCookingWorkbench.tsx`: add an effect syncing `urlBatchId` into `setBatchId(urlBatchId)` when `urlBatchId` is non-empty and differs from `fallbackBatchId`.
   - In `MrxCookingHeaderBranch.tsx:47-48`: when `batchId` is not in `batches`, format the fallback option label from `data` if `data?.batchId === batchId` (`${data.customerName} · ${toVietnameseDate(data.weekStartDate)}`), falling back to `'Lô đang chọn (ngoài trang danh sách)'`.
   - In `MrxDailyHeaderBranch.tsx` & `MrxDailyIssueWorkbench.tsx`: pass optional `activeBatchLabel?: string` (computed from `daily` when `daily?.batchId === activeBatchId`: `${daily.customerCode} - ${daily.customerName} (${toVietnameseDate(daily.dates[0]?.serviceDate ? weekStartFor(daily.dates[0].serviceDate) : '')})`) for the fallback option when `activeBatchId` is not in `batches`.
3. **`reconciliationColumns.tsx` (`B8`):**
   - Remove local `formatCanonicalUnit` and use `formatUnitName` from `../../utils/formatters`.

### 2.3 B3 & B5 — Frontend `MrxQuantityInspectionPage` Scope Restoration and `ReconciliationDashboardPage` Business Timezone & URL Filter Sync (`FR-MENU` / `FR-DASH`)

1. **`MrxQuantityInspectionPage.tsx` (`B3`):**
   - Read `sessionScope = workspaceSessionStore.getScope()`.
   - Resolve `customerId = params.get('customerId') || sessionScope.weeklyMenuScope?.customerId || sessionScope.customerId || workspace.customers.data?.[0]?.customerId || ''`.
   - Resolve `rawWeek = params.get('weekStartDate') || sessionScope.weeklyMenuScope?.weekStartDate || sessionScope.weekStartDate || ''`, and `weekStartDate = isWeekStartDate(rawWeek) ? rawWeek : currentWeekStart()`.
   - Sync resolved `customerId` and `weekStartDate` back to `params` (`replace: true`) when missing from the URL so deep-links and refresh stay deterministic, and update `workspaceSessionStore.setScope({ customerId, weekStartDate, weeklyMenuScope: { customerId, weekStartDate } })` when the user changes customer or week.
2. **`ReconciliationDashboardPage.tsx` (`B5`):**
   - Use `useSearchParams()` to initialize and sync `selectedCustomerId` (`searchParams.get('customerId') || 'ALL'`), `selectedPeriod` (`searchParams.get('period') || 'ALL'`), and `page` (`Math.max(1, Number(searchParams.get('page')) || 1)`).
   - Compute `year` and `month` in `filters` from `todayInBusinessTimezone()` (`const [year, monthOneBased] = todayInBusinessTimezone().split('-').map(Number); const month = monthOneBased - 1;`) instead of `new Date().getFullYear()` / `getMonth()`.

## 3. Acceptance Criteria Matrix (`AC-B1` to `AC-B8`)

- **AC-B1:** Executing a dish-only MRX source amendment via `MrxSourceChangeApplier` records a `MenuSchedule.DishId` audit log and `ListSourceChangesAsync` returns both dish-amendment and `MenuAmendment` / historical `MenuVersion` changes for the batch.
- **AC-B2:** `ReconciliationLineDetailModal` renders 6-decimal quantities (`0,0004`), Vietnamese status labels, and triggers `ReconciliationDispositionModal` when clicking `"Xử lý chênh lệch"` from `ReconciliationLinesBranch`.
- **AC-B3:** Navigating to `/weekly-menu?view=mrx-materials` or `/weekly-menu?view=mrx-plans` without query parameters automatically restores `customerId` and `weekStartDate` from session scope or defaults to the first customer and `currentWeekStart()`.
- **AC-B4:** MRX CSV/XLSX exports translate `TransactionType`, `VarianceType`, `DispositionCategory`, and line `Status` to Vietnamese labels and omit unused purchasing columns from `MrxReportWorkbookExporter.BatchAsync`.
- **AC-B5:** `ReconciliationDashboardPage` derives `THIS_MONTH` / `THIS_YEAR` bounds from `todayInBusinessTimezone()` and persists `customerId`, `period`, and `page` in URL search params across navigation.
- **AC-B6:** `MrxCookingWorkbench`, `MrxCookingHeaderBranch`, and `MrxDailyHeaderBranch` display the batch's customer and week label even when the active batch is outside page 1 of the batch catalog.
- **AC-B7:** `GetVarianceRegisterAsync` bounds `weekStartDate` to `AddDays(ServiceCalendar.ServiceDaysPerWeek - 1)` (`AddDays(5)`) and shares `LoadUserNamesByIdsAsync` across all three report queries.
- **AC-B8:** `reconciliationColumns.tsx` uses `formatUnitName` from `utils/formatters.ts` with zero duplicate unit formatting helper.
