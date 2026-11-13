# MRX Ponytail Audit Closure Round 3 (D1–D8) — Design Spec

Date: 2026-11-09

**Document scope:** Spec and companion implementation plan to close all eight actionable Ponytail audit findings (`D1–D8`, corresponding to Round 3 MRX end-to-end audit findings `#1–#8`: Must fix `#1–#4`, Should fix `#5–#8`; Nice-to-have `#9` legacy `SUPPLEMENTAL_ISSUE`/`RETURN_REQUIRED` delta handlers is explicitly retained in code because active Phase 30 contract tests `Phase30WarehouseReturnFamilyTests` and `ReconciliationPreparationWorkbookTests` pin those branches). `.planning/WORK.md` remains the sole task-state owner.

**Plan:** [2026-11-09-mrx-audit-round3-closure.md](../plans/2026-11-09-mrx-audit-round3-closure.md)

## 1. Intent and Evidence

Following completion of the Unified Auth & Performance Closure (`M1–M6` + `P1–P8`), an end-to-end `/ponytail-audit` across the `MATERIAL_RECONCILIATION` (MRX) Backend and Frontend surfaced 8 remaining concrete functional bugs (`D1–D8`):

| ID | Group | Summary | Owner files |
|---|---|---|---|
| **D1** | Must fix (#1) | `MenuScheduleService.UpdateMenuScheduleRulesAsync`, `UpdateMenuScheduleVersionAsync`, and `RollbackMenuVersionAsync` lack `MrxReconBatchGuard.AnyBatchAsync` checks (unlike `MealQuantityPlanService` and `WeeklyMenuBulkEditService`). Calling `POST /api/coordination/menu-versions/rollback` or `PATCH /api/coordination/menu-schedules/{id}/rules` when an MRX `ReconciliationBatch` exists mutates `MenuSchedule.MenuPrice` or supersedes the `MenuVersion` referenced by `batch.MenuVersionId` without recomputing the batch, stranding `/weekly-menu` on `409 Conflict` (`MRX_SOURCE_STALE`). | `backend/src/IPCManagement.Api/Features/Coordination/Services/MenuScheduleService.cs`, `backend/src/IPCManagement.Api/Features/Coordination/Controllers/MenuSchedulesController.cs`, `backend/tests/IPCManagement.Api.Tests/MrxMenuAmendmentTests.cs` |
| **D2** | Must fix (#2) | `MrxMenuAmendmentCoordinator.SubmitMrxAsync` delegates to `MenuAmendmentService.CreateAsync` (the `DEFAULT` mode pipeline), which queries `Materialrequests` / `Purchaserequests` and creates `MenuAmendmentReconciliationCase` / `ServiceRunDecisionItem` rows, while `GetMrxInboxAsync` returns all `Menuamendments` with `Status == "PENDING_REVIEW" || "RECONCILIATION_REQUIRED"` without filtering out `DEFAULT`-mode amendments (where `AffectedReconciliationBatchIds` have no MRX `CurrentSavoryServings`/`NewSavoryServings` snapshot). | `backend/src/IPCManagement.Api/Features/SampleData/Services/MrxMenuAmendmentCoordinator.cs`, `backend/tests/IPCManagement.Api.Tests/MrxSourceChangeApplierTests.cs` |
| **D3** | Must fix (#3) | On `/weekly-menu`, approving a pending source change via `decideSourceChange` (`useMrxBatchWorkspace.ts`) or re-importing into the same `customerId` + `weekStartDate` (`handleImportSuccess`) calls `loadSource()`, which updates `source.menuVersionId` and `batch.version`. However, `useMrxSourceEdit` (`MrxBatchWorkbench.tsx:82`) only reloads when `[customerId, weekStartDate, enabled]` changes (`Boolean(source)` remains `true`), leaving `MrxSourceEditGrid` displaying stale dishes/servings and holding the old `editScope.menuVersionId` / `editScope.batchVersion`, so the next edit fails with `409 Conflict`. | `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts`, `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`, `frontend/src/__tests__/WeeklyMenu.test.tsx` |
| **D4** | Must fix (#4) | `MrxEditScopeQuery.GetAsync` loads `Mealquantityplanlines` without filtering by `batch.QuantityImportBatchId` (unlike `MrxSourceChangeApplier.LoadScopeAsync` at line 307 which filters `importId == null \|\| item.QuantityPlan.ImportBatchId == importId`). When a schedule has an older/other-batch `MealQuantityPlanLine` with a newer or tied `UpdatedAt`, `GET /api/reconciliation/weekly-menu/edit-scope` returns different `SavoryServings`/`VegetarianServings` from what `MrxSourceChangeApplier` compares against, triggering false `409 Conflict` (`"Số suất nguồn đã thay đổi kể từ lúc xem trước."`). | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxEditScopeQuery.cs`, `backend/tests/IPCManagement.Api.Tests/MrxSourceChangeApplierTests.cs` |
| **D5** | Should fix (#5) | `ReconciliationPreparationWorkbookExporter.GetWorkbookAsync` sums gross `Inventoryissuelines.IssuedQty` directly instead of using `ReconciliationNetIssueProjection` (which subtracts confirmed `InventoryReturns` with `ReceivedAt != null`, as `ReconciliationPreparationService.GetWorkbenchAsync` does). An over-issued line returned to exact quantity shows `EXACT` (`Đủ`) in the UI but exports as `OVER_ISSUED` (`Xuất vượt`) in the Preparation Workbook. | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationPreparationWorkbookExporter.cs`, `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs` |
| **D6** | Should fix (#6) | On `/reconciliation`, `useReconciliationWorkspace.handleComplete` updates `data` after `mrxApi.completeBatch` succeeds, but does not update `batches` state, `serverStateCache` (`mrx_recon_*`, `mrx_raw_batch_*`, `mrx_batches_*`), or `invalidateMrxCaches()`; and `handleRefresh` only deletes `mrx_raw_batch_${batchId}` without calling `invalidateMrxCaches()`, leaving other dates and report tabs stale. | `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`, `frontend/src/__tests__/Reconciliation.test.tsx` |
| **D7** | Should fix (#7) | In `ReconciliationDispositionModal.tsx`, if bulk saving (`isBulk = true`) succeeds on lines `1..K` and fails on line `K+1`, `onSaved()` is not called, so if the user closes and reopens the modal, `succeededLineIds` resets and retrying sends stale `expectedVersion` for line 1, failing immediately with `409 Conflict`. Also, bulk chips at line 161 use `key={l.dailyLineId}` which is `undefined` for legacy weekly lines. | `frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx`, `frontend/src/__tests__/Reconciliation.test.tsx` |
| **D8** | Should fix (#8) | `ReconciliationBatchQueryProjector.ListDishesAsync` (`GET /api/reconciliation/batches/{id}/dishes`) groups `scopes` by `{ ServiceDate, FrozenShiftName, FrozenServings }` without `FrozenMenuVariant` and hardcodes `SavoryServings = FrozenServings, VegetarianServings = 0`. If a dish appears in both Savory and Vegetarian variants in the same shift with equal servings (e.g. 50 Savory + 50 Vegetarian), they collapse into a single 50-serving scope, and vegetarian dishes always report `VegetarianServings = 0`. | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchQueryProjector.cs`, `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs` |

## 2. Technical Design

### 2.1 D1, D2, D4, D5, D8 — Backend Mode Guard, MRX Amendment Submission, Edit-Scope Quantity Plan Filtering, Preparation Net Issue Parity, and Dish Scope Projection

1. **`MenuScheduleService.cs` & `MenuSchedulesController.cs` (`D1`):**
   - In `MenuScheduleService.UpdateMenuScheduleRulesAsync` (`line 100`), `UpdateMenuScheduleVersionAsync` (`line 160`), and `RollbackMenuVersionAsync` (`line 276`), check `if (await MrxReconBatchGuard.AnyBatchAsync(_context, weekStartDate, customerId, CancellationToken.None)) throw new BusinessRuleException(MrxReconBatchGuard.BatchExistsMessage);`.
   - In `MenuSchedulesController.RollbackMenuVersionAsync` and `UpdateMenuScheduleVersionAsync`, catch `BusinessRuleException ex` and return `BadRequest(ApiResponse.FailResult(ex.Message))` (matching `UpdateMenuScheduleRulesAsync`, without changing controller action signatures so `Phase30FinalOracleContracts` remains 100% intact).
2. **`MrxMenuAmendmentCoordinator.cs` (`D2`):**
   - In `SubmitMrxAsync(CreateMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)`:
     - Validate `RequireMrxBaseVersion(request)` and `actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được người tạo thay đổi thực đơn.");`.
     - Call `var preview = await gateway.PreviewAsync(request, cancellationToken);` directly (validating MRX day locks, base version, and savory/vegetarian servings without touching `DEFAULT`-mode `Materialrequests`, `Purchaserequests`, `MenuAmendmentReconciliationCase`, or `ServiceRunDecisionItem`).
     - Persist `MenuAmendment` with `Status = "PENDING_REVIEW"`, `BaseMenuVersionId = GuidHelper.ParseGuidString(request.ExpectedBaseMenuVersionId)`, `ImpactSnapshotJson = JsonSerializer.Serialize(result)`, `Lines = preview.ImpactLines.Select(...)`, and an `AuditLog` entry (`BusinessArea = "Reconciliation"`, `EntityName = nameof(MenuAmendment)`, `FieldName = "Status"`, `NewValue = "PENDING_REVIEW"`).
   - In `GetMrxInboxAsync`:
     - Filter `MapMrxInboxItem` results to amendments that belong to MRX (`item.BaseMenuVersionId != null` and `result.ImpactLines.All(line => line.NewSavoryServings != null || line.CurrentSavoryServings != null || line.NewDishId != line.OldDishId)` and `!result.RequiresReconciliation`).
3. **`MrxEditScopeQuery.cs` (`D4`):**
   - In `MrxEditScopeQuery.GetAsync`, load `Mealquantityplanlines` with `Include(item => item.Mealquantityplanlines).ThenInclude(line => line.QuantityPlan)`.
   - When selecting `quantity` for each `shiftGroup` (`lines 65-67`), filter by `line => batch?.QuantityImportBatchId == null || line.QuantityPlan?.ImportBatchId != null && line.QuantityPlan.ImportBatchId.AsSpan().SequenceEqual(batch.QuantityImportBatchId)` before `.OrderByDescending(item => item.UpdatedAt).FirstOrDefault()`, matching `MrxSourceChangeApplier.LoadScopeAsync`.
4. **`ReconciliationPreparationWorkbookExporter.cs` (`D5`):**
   - Replace the manual `existingIssues` gross sum (`lines 73-83`) with `ReconciliationNetIssueProjection`:
     ```csharp
     var netIssues = await new ReconciliationNetIssueProjection(context).LoadByDailyLineIdsAsync(
         dailyLines.Select(line => line.DailyLineId).ToList(), token);
     var issueLinesByDailyLineId = netIssues.ToDictionary(
         item => item.Key,
         item => item.Value.NetIssuedQuantity,
         StringComparer.Ordinal);
     ```
5. **`ReconciliationBatchQueryProjector.cs` (`D8`):**
   - In `ListDishesAsync` (`lines 120-124`), group `scopes` by `{ ServiceDate = dailyLinesById[Convert.ToHexString(item.Contributor.DailyLineId!)].ServiceDate, ShiftName = item.Contributor.FrozenShiftName! }`.
   - Within each `(ServiceDate, ShiftName)` group, deduplicate contributors by `(FrozenMenuVariant ?? string.Empty, FrozenServings!.Value)`:
     - `savoryServings = variantGroups.Where(v => !string.Equals(v.Variant, "vegetarian", StringComparison.OrdinalIgnoreCase)).Sum(v => v.Servings)`
     - `vegetarianServings = variantGroups.Where(v => string.Equals(v.Variant, "vegetarian", StringComparison.OrdinalIgnoreCase)).Sum(v => v.Servings)`
     - `frozenServings = savoryServings + vegetarianServings`
     - Construct `new ReconciliationBatchDishScopeDto(group.Key.ServiceDate.ToString("yyyy-MM-dd"), group.Key.ShiftName, frozenServings, savoryServings, vegetarianServings)`.

### 2.2 D3, D6, D7 — Frontend `useMrxSourceEdit` Version Sync, `useReconciliationWorkspace` Completion/Refresh Cache Sync, and `ReconciliationDispositionModal` Partial Bulk Recovery

1. **`useMrxSourceEdit.ts` & `MrxBatchWorkbench.tsx` (`D3`):**
   - Add `sourceVersionKey?: string` to `useMrxSourceEdit(scope: { customerId: string; weekStartDate: string; enabled?: boolean; sourceVersionKey?: string })` and include `scope.sourceVersionKey` in `load`'s `useCallback` dependencies (`[scope.customerId, scope.enabled, scope.weekStartDate, scope.sourceVersionKey]`).
   - In `MrxBatchWorkbench.tsx:82`, pass `sourceVersionKey: `${source?.menuVersionId ?? ''}:${batch?.version ?? source?.activeBatch?.version ?? ''}`` so whenever `decideSourceChange`, `handleImportSuccess`, or `handleRefresh` updates `source.menuVersionId` or `batch.version`, `useMrxSourceEdit` automatically reloads the fresh `editScope` and draft.
2. **`useReconciliationWorkspace.ts` (`D6`):**
   - In `handleRefresh` (`lines 156-166`), call `invalidateMrxCaches()` before reloading `loadData()` or `reports.reloadReport()`.
   - In `handleComplete` (`lines 285-300`), after `const completed = await mrxApi.completeBatch(data.batchId, data.version);`:
     - Call `invalidateMrxCaches();`.
     - Compute `const summary = mapBatchDtoToSummary(completed, serviceDate); setData(summary);`.
     - Update `setBatches((current) => current.map((item) => item.batchId === completed.batchId ? { ...item, status: completed.status, version: completed.version } : item));`.
     - Write `serverStateCache.set(`mrx_raw_batch_${completed.batchId}`, completed);` and `serverStateCache.set(`mrx_recon_${completed.batchId}_${serviceDate}`, summary);`.
3. **`ReconciliationDispositionModal.tsx` (`D7`):**
   - Track a local ref `let anySucceeded = false;` inside `handleSave`. If `onConflict` or `onError` fires and `anySucceeded` is `true`, call `await onSaved()` in the background so parent `lines` update their `disposition` state (and `unresolved` shrinks to only the remaining unresolved lines if the user closes and reopens bulk disposition).
   - Change chip key at line 161 from `key={l.dailyLineId}` to `key={l.dailyLineId || l.id || l.materialCode}`.

## 3. Acceptance Criteria Matrix (`AC-D1` to `AC-D8`)

- **AC-D1:** Calling `UpdateMenuScheduleRulesAsync`, `UpdateMenuScheduleVersionAsync`, or `RollbackMenuVersionAsync` on a customer + week that already has an MRX `ReconciliationBatch` throws `BusinessRuleException` (`MrxReconBatchGuard.BatchExistsMessage`) without mutating `MenuSchedule` or `MenuVersion`.
- **AC-D2:** `SubmitMrxAsync` validates via `MrxSourceChangeApplier.PreviewAsync` without creating `DEFAULT`-mode `MenuAmendmentReconciliationCase` / `ServiceRunDecisionItem` rows, and `GetMrxInboxAsync` excludes `DEFAULT`-mode `RECONCILIATION_REQUIRED` amendments.
- **AC-D3:** Approving a pending source change in `MrxPendingRequestsPanel` on `/weekly-menu` automatically reloads `useMrxSourceEdit` with the new `menuVersionId` and `batchVersion`.
- **AC-D4:** `MrxEditScopeQuery.GetAsync` filters `Mealquantityplanlines` by `batch.QuantityImportBatchId` when an MRX batch exists, returning exact parity with `MrxSourceChangeApplier.LoadScopeAsync`.
- **AC-D5:** `ReconciliationPreparationWorkbookExporter.GetWorkbookAsync` uses net issued quantity (`ReconciliationNetIssueProjection`, subtracting confirmed `InventoryReturns`) when computing `IssueStatus`.
- **AC-D6:** Completing a batch on `/reconciliation` updates both `data.status` and the `batches` header selector list to `'COMPLETED'` and invalidates stale MRX caches; clicking `"Làm mới"` invalidates all `mrx_*` cache entries.
- **AC-D7:** In `ReconciliationDispositionModal`, if a bulk disposition partially succeeds before a conflict/error on a later line, `onSaved()` refreshes the parent lines so closing and reopening bulk disposition does not resend already-saved lines with stale `expectedVersion`.
- **AC-D8:** `ReconciliationBatchQueryProjector.ListDishesAsync` preserves separate `SavoryServings` and `VegetarianServings` and sums total servings across variants when a dish appears in both Savory and Vegetarian in the same shift.
