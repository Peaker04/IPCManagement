# MRX Ponytail Audit Closure (A1–A10) — Design Spec

Date: 2026-11-08

**Document scope:** Requested spec and plan to close all ten Ponytail audit verdicts (`A1–A10`, corresponding to audit findings `1–10`) across the MRX (`MATERIAL_RECONCILIATION`) Backend and Frontend subsystem. Per `AGENTS.md` and `brainstorming` `<HARD-GATE>`, this document specifies the design and companion implementation plan only; product code edits and test runs require explicit owner approval of the plan. `.planning/WORK.md` remains the sole task-state owner.

**Plan:** [2026-11-08-mrx-audit-closure.md](../plans/2026-11-08-mrx-audit-closure.md)

## 1. Intent and Evidence

Following completion of `P1–P5` (`2026-11-08-mrx-ponytail-data-flow-integrity`), `T1–T5` (`2026-11-08-mrx-review-followthrough`), and `V1–V3` (`2026-11-08-mrx-verdict-closure`), a full-repo `/ponytail-audit` of MRX mode surfaced 10 remaining concrete issues (`1–10`, tracked here as `A1–A10`):

| ID | Group | Summary | Owner files |
|---|---|---|---|
| **A1** | Must fix (#1) | `/reconciliation` empty-state button passes `customerCode` (e.g. `"KA"`) into `?customerId=` when navigating to `/weekly-menu?view=mrx-batch`, triggering Backend `GuidHelper.ParseGuidString` HTTP 400 (`"CustomerId không hợp lệ."`), while `useReconciliationWorkspace` treats `?customerId=<UUID>` as `customerCode`. | `frontend/src/features/reconciliation/ReconciliationPage.tsx`, `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`, `frontend/src/__tests__/Reconciliation.test.tsx` |
| **A2** | Must fix (#2) | `ReconciliationBatchService.GetAsync` omits `weekStartDate` when calling `Map(...)`, returning `weekStartDate: null`. Opening `/reconciliation` on a Sunday (`2026-11-08`) or via a Dashboard `?batchId=<id>` deep-link (without `&date=`) keeps `serviceDate` on Sunday or a stale week, causing `mapBatchDtoToSummary` to filter `dailyReview.lines` to `[]` and show an empty state on an active batch. | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`, `frontend/src/api/mrxApi.ts`, `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`, `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs`, `frontend/src/__tests__/Reconciliation.test.tsx` |
| **A3** | Must fix (#3) | `useMrxBatchWorkspace.ts` only reads `customerId` and `weekStartDate` from `searchParams` at initial mount: `handleImportSuccess(scope)` and browser Back/Forward update URL query params without updating `customerId`/`weekStartDate` state, and Dashboard `amendmentId` deep-links (`/weekly-menu?view=mrx-batch&customerId=...&weekStartDate=...&amendmentId=<id>`) never auto-select the matching `reviewRequest` from `changeInbox`. | `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`, `frontend/src/__tests__/WeeklyMenu.test.tsx` |
| **A4** | Must fix (#4) | `MrxMultiCustomerPreparationWorkbench.tsx` defaults `activeDate` to `todayInBusinessTimezone()` (`2026-11-08` on Sunday); switching to Day mode (`range=day`) makes `isServiceDate(scopeDate)` false and rejects `queryFn`, trapping the user in an error state with no date selector to recover. | `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`, `frontend/src/__tests__/Warehouse.test.tsx` |
| **A5** | Should fix (#5) | `MrxTransactionHistoryQuery.cs` hardcodes `Reason = null` for all warehouse issue lines (`INITIAL_ISSUE` / `SUPPLEMENTAL_ISSUE`), dropping the mandatory `AuditLog` variance/supplemental reason from both the Transaction History API/Excel export and `ReconciliationTransactionsBranch.tsx`. | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxTransactionHistoryQuery.cs`, `frontend/src/features/reconciliation/branches/ReconciliationTransactionsBranch.tsx`, `backend/tests/IPCManagement.Api.Tests/ReconciliationReportsServiceTests.cs`, `frontend/src/__tests__/Reconciliation.test.tsx` |
| **A6** | Should fix (#6) | Raw technical codes and UUIDs leak into UI & Excel: `formatTransactionType` misses `'PHYSICAL_RETURN'`; `ReconciliationBatchService.ListSourceChangesAsync` and `ReconciliationReportsService.GetVarianceRegisterAsync` return raw user UUID strings instead of resolving `FullName ?? Username` from `context.Users`; `formatAuditActor` mislabels all `10000000-*` seeded users (Manager, Chef, Warehouse, Coordinator) as `'Quản trị viên (Admin)'`; `formatAuditEntity` and `formatAuditField` leave MRX C# entity/field names untranslated. | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`, `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`, `frontend/src/utils/formatters.ts`, `backend/tests/IPCManagement.Api.Tests/ReconciliationReportsServiceTests.cs`, `frontend/src/__tests__/Primitives.test.tsx` |
| **A7** | Should fix (#7) | `ReconciliationReportsService.GetVarianceRegisterAsync` applies `.Take(limit + 1)` on a collection-included query without `.OrderBy(...)` (emitting EF Core row-limiting warnings and non-deterministic truncation), and `GetCompletedRegisterCoreAsync` computes `WeekEndDate` as `WeekStartDate.AddDays(6)` (Sunday) instead of `WeekStartDate.AddDays(ServiceCalendar.ServiceDaysPerWeek - 1)` (`AddDays(5)`, Saturday). | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`, `backend/tests/IPCManagement.Api.Tests/ReconciliationReportsServiceTests.cs` |
| **A8** | Should fix (#8) | `ReconciliationDispositionModal.tsx` interpolates `requiredQuantity`, `issuedQuantity`, and `issuedRequiredDifference` as raw JS numbers instead of `<Num format="plain" decimals={6} />`, and retains a dead `issuedRequiredDifference < 0` preset branch even though MRX only disposes over-issued lines (`> 0`). | `frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx`, `frontend/src/__tests__/Reconciliation.test.tsx` |
| **A9** | Should fix (#9) | `ReconciliationSourceRevisionService.StageAffectedBatchesAsync` reads raw `user.Role.RoleCode` from DB (e.g. `"Manager"` or `"Admin"`) without normalizing through `MrxSourceChangeApplier.ResolveActorRole`, risking inconsistent `AppliedRole` stamps (`"Manager"` vs `"MANAGER"`). | `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationSourceRevisionService.cs`, `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs` |
| **A10** | Nice to have (#10) | `ReconciliationVariancesBranch.tsx` duplicates `formatUnitName` as local `formatCanonicalUnit`, and `useReconciliationWorkspace.ts` exports an unused `selectBatch` helper. | `frontend/src/features/reconciliation/branches/ReconciliationVariancesBranch.tsx`, `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts` |

## 2. Goals, Non-Goals, and Anti-Goals

- **Goals:**
  1. Make all MRX cross-route links (`/reconciliation` ↔ `/weekly-menu?view=mrx-batch`, Dashboard → `/reconciliation?batchId=...`, Dashboard → `/weekly-menu?view=mrx-batch&...&amendmentId=...`, Excel import scope transition) resolve the exact target customer, week, service date, and pending source-change request without HTTP 400 or blank tables.
  2. Make Sunday (`day === 0`) operations safe by default across `/reconciliation` and `/warehouse?view=mrx-preparation&range=day` so opening the app on a Sunday snaps to a valid service date (`Thứ Hai`–`Thứ Bảy`) instead of showing empty lines or a permanent error boundary.
  3. Preserve warehouse issue reasons (`AuditLog.Reason` on `InventoryIssueLine.IssuedQty`), human-readable user names (`FullName ?? Username`), and Vietnamese labels for transaction types, entities, fields, and modal numbers across UI and Excel/CSV reports.
  4. Make `GetVarianceRegisterAsync` deterministic at the SQL level (`OrderBy` before `Take`), align `GetCompletedRegisterCoreAsync` `WeekEndDate` with the 6-day service week (`AddDays(ServiceCalendar.ServiceDaysPerWeek - 1)`), normalize `actorRole` via `MrxSourceChangeApplier.ResolveActorRole`, and remove dead/duplicate code (`A8`, `A10`).
- **Non-Goals:**
  - Modifying `DEFAULT` mode workflows (`Purchasing`, `PO`, `Approvals`, `MenuAmendmentService.ExecuteCoreAsync` regeneration semantics).
  - Adding database migrations or changing database schema tables.
- **Anti-Goals:**
  - Do not override an explicit valid in-week `date` query parameter (`?batchId=B&date=2026-11-04`) when navigating to `/reconciliation` or `/warehouse`.
  - Do not fabricate fallback user names when an actor ID is genuinely absent from `context.Users`; fall back cleanly to the formatted UUID string or `'Hệ thống'`.

## 3. Global Constraints

- Preserve all inherited changes on `feature/ui-interaction-data-states` (`HEAD e0019978b2ce785945f4ea1a9514fc6bd0bde8f1`), empty git index, and the 2 running dev server background tasks (`task-166` Backend on `:5262`, `task-167` Frontend on `:5173`).
- `DEFAULT != MATERIAL_RECONCILIATION` (`DOM-MODE-1`).
- Single Styling Authority (`frontend/src/styles/index.css`) and existing primitives (`<Num />`, `<Badge />`, `<DataGrid />`).
- Emit **Scoped Pre-Code UI Gate Block** before editing any `.tsx` file during execution.
- Enforce `ipc-test-audit` (`Rule TA-1` to `TA-5`): real transport/router boundaries, zero component self-mocking, zero allowlist padding, fail-closed `fetch` boundary.

## 4. Technical Design

### 4.1 A1 & A2 — `/reconciliation` Customer UUID Resolution, `GetAsync` `WeekStartDate`, and Service Date Clamping (`FR-RECON`)

1. **Backend `ReconciliationBatchService.GetAsync` (`ReconciliationBatchService.cs:233-235`):**
   - Load `weekStartDate` alongside `customer` (either by extending `TryGetCustomerAsync` to `TryGetMenuScopeAsync(batch.MenuVersionId, token)` returning `(string? CustomerId, string? CustomerName, string? CustomerCode, DateOnly? WeekStartDate)?` from `context.Menuversions`, or falling back to `daily?.Dates.FirstOrDefault()?.ServiceDate`).
   - Pass `weekStartDate` into `Map(batch, actuals, dispositions, issued, batchLines, issueNotes, customer, weekStartDate)`.
   - Now `GET /api/reconciliation/batches/{id}` always returns `weekStartDate` (Monday) and `weekEndDate` (`weekStartDate.AddDays(5)`, Saturday), matching `ListAsync` and `ReconciliationBatchQueryProjector`.
2. **Frontend `mapBatchDtoToSummary` (`frontend/src/api/mrxApi.ts:94-100`) & `useReconciliationWorkspace.ts`:**
   - Define a helper `clampToServiceWeek(dateStr: string, weekStart?: string): string`:
     - If `dateStr` is a Sunday (`!isServiceDate(dateStr)`), clamp to `weekStart || weekStartFor(dateStr)` (Monday).
     - If `weekStart` is provided and `weekStartFor(dateStr) !== weekStart`, snap to `weekStart`.
   - In `useReconciliationWorkspace.ts`:
     - Initialize `initialDate`: if `!searchParams.get('date')`, clamp `snapshot?.serviceDate || sessionScope.serviceDate || todayInBusinessTimezone()` so if it is Sunday (`!isServiceDate(rawDate)`), it defaults to `weekStartFor(rawDate)` (Monday).
     - Customer parameter resolution (`lines 36-39, 160-168`): match `searchParams.get('customerId')` against **both** `c.customerCode` and `c.customerId` (`const matched = list.find(c => c.customerCode === param || c.customerId === param)`), setting `customerCode` to `matched.customerCode`.
     - When `mrxApi.getBatchSummary(batchId, serviceDate)` resolves (`lines 125-134` and `239-248`) or when `sortedItems` resolves (`lines 192-196`): if `result.weekStartDate` is present and (`weekStartFor(serviceDateRef.current) !== result.weekStartDate` or `!isServiceDate(serviceDateRef.current)`), update `setServiceDate(result.weekStartDate)` (and update URL `date` if `date` was not explicitly pinned to a valid service day of that batch).
     - In `mapBatchDtoToSummary(batch, serviceDate)` (`mrxApi.ts:94-100`): if `serviceDate && hasDailyDate`, filter by `line.serviceDate === serviceDate`; if that produces `0` lines **and** (`!isServiceDate(serviceDate)` or `(batch.weekStartDate && weekStartFor(serviceDate) !== batch.weekStartDate)`), fall back to `batch.weekStartDate || sourceLines[0]?.serviceDate` so the first render never flashes an artificial empty table while `serviceDate` state catches up.
3. **Frontend `ReconciliationPage.tsx:302`:**
   - Resolve `const selectedCustomerId = customers.find((c) => c.customerCode === customerCode)?.customerId || '';`
   - Navigate to `` `/weekly-menu?view=mrx-batch${selectedCustomerId ? '&customerId=' + selectedCustomerId : ''}${data?.weekStartDate ? '&weekStartDate=' + data.weekStartDate : ''}` ``.

### 4.2 A3 — `/weekly-menu?view=mrx-batch` Scope Sync on Import/Navigation & `amendmentId` Deep-Link (`FR-MENU`)

1. **`handleImportSuccess` (`frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts:156-177`):**
   - When `scope` is passed:
     - Call `setCustomerId(scope.customerId)` and `setWeekStartDate(scope.weekStartDate)`.
     - If `scope.customerId === customerId && scope.weekStartDate === weekStartDate`, call `invalidateQuantityPreview()` and `void loadSource(true)`.
2. **URL `searchParams` synchronization (`useMrxBatchWorkspace.ts`):**
   - Add a `useEffect` watching `searchParams`:
     - Extract `urlCustomerId = searchParams.get('customerId')` and `urlWeek = searchParams.get('weekStartDate')`.
     - When `!isSubmitting`:
       - If `urlCustomerId` is present and differs from `customerId`, resolve against `customers` (matching `c.customerId === urlCustomerId || c.customerCode === urlCustomerId`, or using `urlCustomerId` directly if it is a UUID and `customers` hasn't loaded yet) and call `setCustomerId(resolvedId)`.
       - If `urlWeek && isIsoDate(urlWeek) && urlWeek !== weekStartDate`, call `setWeekStartDate(urlWeek)`.
3. **Dashboard `amendmentId` deep-link (`useMrxBatchWorkspace.ts:213-220`):**
   - When `changeInbox` loads (or `searchParams.get('amendmentId')` changes), if `amendmentId` is present in `searchParams`, find `const target = changeInbox.find(item => item.menuAmendmentId === amendmentId)` and if found, call `setReviewRequest((current) => current ?? target)`.

### 4.3 A4 — Sunday Clamping on Multi-Customer Preparation Day View (`FR-WH`)

1. **`MrxMultiCustomerPreparationWorkbench.tsx:24-26` and `MrxPrepHeaderBranch.tsx:39`:**
   - In `MrxMultiCustomerPreparationWorkbench.tsx`:
     - Compute `rawDate = [serviceDate, searchParams.get('date'), sessionScope.serviceDate].find(isIsoDate) || todayInBusinessTimezone()`.
     - If `!searchParams.get('date') && !isServiceDate(rawDate)` (i.e. default date landed on Sunday without an explicit `?date=` override), clamp `activeDate = weekStartFor(rawDate)` (Monday).
   - In `MrxPrepHeaderBranch.tsx:39`:
     - When `activeDate` is not a service date (`!isServiceDate(activeDate)`), pass `activeDate={weekStart}` to `MrxDailyDateTabsBranch` so switching from "Cả tuần" to a day tab highlights Monday cleanly.

### 4.4 A5 — Preserve Warehouse Issue `Reason` in Transaction History Query, Excel, and UI (`FR-RECON` / `FR-REP`)

1. **Backend `MrxTransactionHistoryQuery.cs:83`:**
   - Replace `Reason = null` on the `issues` projection with:
     ```csharp
     Reason = context.Auditlogs
         .Where(audit => audit.EntityName == nameof(Models.Entities.InventoryIssueLine)
             && audit.FieldName == nameof(Models.Entities.InventoryIssueLine.IssuedQty)
             && audit.EntityId == line.IssueLineId)
         .OrderByDescending(audit => audit.ChangedAt)
         .Select(audit => audit.Reason)
         .FirstOrDefault(),
     ```
   - This automatically populates `Reason` in:
     - `GET /api/reconciliation/reports/transactions-history` (`MrxTransactionHistoryRowDto.Reason`),
     - `GET /api/reconciliation/reports/transactions-history/xlsx` (`MrxReportWorkbookExporter.TransactionsAsync` column `"Lý do"`), and
     - `GET /api/reconciliation/reports/transactions-history/csv` (`MrxReportCsvStreamWriter.WriteTransactionsHistoryAsync`).
2. **Frontend `ReconciliationTransactionsBranch.tsx:23-76`:**
   - Add a `'reason'` column (`header: 'Lý do'`, `width: '18%'`, `minWidth: '140px'`) rendering `<span className="text-xs text-slate-600 truncate block" title={row.reason ?? ''}>{row.reason || '—'}</span>` (adjusting column widths so total remains 100%).

### 4.5 A6 — Resolve Human Actor Names in Backend & Complete Vietnamese Formatters (`FR-RECON` / `FR-REP`)

1. **Backend `ReconciliationBatchService.ListSourceChangesAsync` (`ReconciliationBatchService.cs:297-314`):**
   - Collect all distinct actor `byte[]` IDs across `audits.Select(a => a.ChangedBy)` and `adjustments.Select(a => a.AdjustedBy)`.
   - Query `context.Users.AsNoTracking()` for those IDs into a dictionary `actorNames` (`Convert.ToHexString(u.UserId) -> u.FullName ?? u.Username`).
   - Populate `ReconciliationSourceChangeDto.Actor` with `actorNames.GetValueOrDefault(Convert.ToHexString(audit.ChangedBy)) ?? GuidHelper.ToGuidString(audit.ChangedBy)` (and similarly for `adjustment.AdjustedBy`).
2. **Backend `ReconciliationReportsService.GetVarianceRegisterAsync` (`ReconciliationReportsService.cs:194-197, 257`):**
   - Collect distinct `disp.DisposedBy` `byte[]` IDs from `dailyDispositions.Values`.
   - Query `context.Users.AsNoTracking()` into `disposedByNames` (`Convert.ToHexString(u.UserId) -> u.FullName ?? u.Username`).
   - Populate `MrxVarianceRegisterRowDto.DisposedBy` (`line 257`) with `disp?.DisposedBy is null ? null : disposedByNames.GetValueOrDefault(Convert.ToHexString(disp.DisposedBy)) ?? GuidHelper.ToGuidString(disp.DisposedBy)`.
3. **Frontend `frontend/src/utils/formatters.ts`:**
   - `formatTransactionType`: map both `'RETURN'` and `'PHYSICAL_RETURN'` to `'Hoàn trả'`.
   - `formatAuditActor`: remove the overly broad `|| actor.includes('10000000-')` check that mislabeled Manager (`10000000-...-0002`), Coordinator, Chef, and Warehouse seeded users as `'Quản trị viên (Admin)'`; keep only exact `'10000000-0000-0000-0000-000000000001'` or case-insensitive `'admin'`, and add mappings for the standard seeded UUIDs (`...0002` → `'Quản lý (Manager)'`, `...0003` → `'Điều phối viên'`, `...0004` → `'Bếp trưởng'`, `...0005` → `'Thủ kho'`) as a fallback when an older raw UUID is encountered.
   - `formatAuditArea`: add `'bom'` → `'Định mức BOM'`, `'demand'` → `'Nhu cầu vật tư'`, `'purchase'` → `'Mua hàng'`.
   - `formatAuditEntity`: add `'MenuVersion'` → `'Phiên bản thực đơn'`, `'QuantityImportBatch'` → `'Đợt nhập số suất'`, `'MenuItem'` → `'Món trong thực đơn'`, `'MealQuantityPlanLine'` → `'Dòng kế hoạch suất ăn'`, `'Menu'` → `'Thực đơn'`, `'DishBom'` → `'Định mức món (BOM)'`, `'BomAdjustment'` → `'Điều chỉnh BOM'`, `'MenuAmendment'` → `'Yêu cầu sửa thực đơn'`, `'InventoryIssueLine'` → `'Dòng xuất kho'`, `'InventoryReturn'` → `'Phiếu hoàn trả kho'`, `'InventoryReturnLine'` → `'Dòng hoàn trả kho'`, `'ReconciliationDisposition'` / `'ReconciliationDailyDisposition'` → `'Xử lý chênh lệch'`, `'ReconciliationSourceRevision'` → `'Bản sửa nguồn đối soát'`.
   - `formatAuditField`: add `'IssuedQty'` → `'Số lượng thực xuất'`, `'Validity'` → `'Hiệu lực giải trình'`, `'QuantityAndWaste'` → `'Định lượng & hao hụt'`, `'FinalServings'` → `'Tổng số suất chốt'`, `'SavoryServings'` → `'Số suất Mặn'`, `'VegetarianServings'` → `'Số suất Chay'`, `'DishId'` → `'Món ăn'`, `'BreakGlassExecute'` → `'Thực thi khẩn cấp'`, `'ConfirmedServings'` → `'Số suất xác nhận'`.

### 4.6 A7 — Deterministic Ordering in `GetVarianceRegisterAsync` & 6-Day `WeekEndDate` in `GetCompletedRegisterCoreAsync` (`FR-REP`)

1. **`ReconciliationReportsService.GetVarianceRegisterAsync` (`ReconciliationReportsService.cs:179-184`):**
   - Change `var end = weekStartDate.Value.AddDays(6);` to `var end = weekStartDate.Value.AddDays(ServiceCalendar.ServiceDaysPerWeek - 1);` (or keep `<= weekStartDate.Value.AddDays(6)` for filter inclusiveness, while adding deterministic ordering).
   - Before `if (maximumDailyLines is int limit) query = query.Take(limit + 1);`, apply:
     ```csharp
     query = query.OrderBy(d => d.ServiceDate).ThenBy(d => d.DailyLineId);
     ```
2. **`ReconciliationReportsService.GetCompletedRegisterCoreAsync` (`ReconciliationReportsService.cs:389-390`):**
   - Compute `var weekStart = mv?.WeekStartDate ?? DateOnly.FromDateTime(b.CreatedAt);`
   - Compute `var weekEnd = weekStart.AddDays(ServiceCalendar.ServiceDaysPerWeek - 1);` (`AddDays(5)`, Saturday), matching `ReconciliationBatchQueryProjector.cs:61` and `ReconciliationBatchService.cs:672`.

### 4.7 A8, A9, A10 — Disposition Modal Formatting, Source Revision Role Normalization, and Lean Cleanup (`FR-RECON`)

1. **A8 (`frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx:161-185, 245-257`):**
   - Import `Num` from `../../components/ui/num`.
   - Render `l.issuedRequiredDifference`, `primaryLine.requiredQuantity`, `primaryLine.issuedQuantity`, and `primaryLine.issuedRequiredDifference` using `<Num value={...} format="plain" decimals={6} />` (preserving `+` prefix when `> 0` and `'—'` when `null`).
   - Remove the dead `primaryLine.issuedRequiredDifference != null && primaryLine.issuedRequiredDifference < 0 ? [...] :` branch in preset buttons, keeping only the 4 over-issued presets (`'Chấp nhận hao hụt thực tế'`, `'Điều chỉnh định lượng BOM kỳ tới'`, `'Đã xuất bù thực tế trong ca'`, `'Sai số đo lường lúc xuất kho'`).
2. **A9 (`backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationSourceRevisionService.cs:108-112`):**
   - Normalize `rawRole` via `MrxSourceChangeApplier.ResolveActorRole([rawRole])` so `MrxRevisionStamp.ActorRole` is always canonical `"ADMIN"` or `"MANAGER"`.
3. **A10 (`ReconciliationVariancesBranch.tsx:12-19, 61` & `useReconciliationWorkspace.ts:288-292, 381`):**
   - In `ReconciliationVariancesBranch.tsx`: delete local `formatCanonicalUnit`, import `formatUnitName` from `../../../utils/formatters`, and use `{ row.canonicalUnitName ? formatUnitName(row.canonicalUnitName) : '' }`.
   - In `useReconciliationWorkspace.ts`: delete the unused `selectBatch` function and remove it from the returned object (`selectBatchById` remains the single batch selector).

## 5. Acceptance Criteria (`AC-A1` to `AC-A10`)

- **`AC-A1`:** Clicking `"Chuyển đến Chuẩn bị lô đối soát"` on `/reconciliation` when a customer is selected navigates to `/weekly-menu?view=mrx-batch&customerId=<UUID>` (never passing `customerCode`), and navigating to `/reconciliation?customerId=<UUID>` selects the matching customer's `customerCode`.
- **`AC-A2`:** `ReconciliationBatchService.GetAsync` populates `WeekStartDate` and `WeekEndDate` (`WeekStartDate.AddDays(5)`). Opening `/reconciliation` on a Sunday (`2026-11-08`) or via `/reconciliation?batchId=<id>` without `&date=` snaps `serviceDate` to the batch's `weekStartDate` and renders that Monday's review lines instead of an empty state.
- **`AC-A3`:** Calling `handleImportSuccess({ customerId, weekStartDate })` or navigating via URL search params on `/weekly-menu?view=mrx-batch` updates `customerId` and `weekStartDate` state immediately and fetches the new scope; when `?amendmentId=<id>` is present in the URL, `reviewRequest` auto-selects the matching item from `changeInbox`.
- **`AC-A4`:** Opening `/warehouse?view=mrx-preparation&range=day` on a Sunday (`2026-11-08`) without an explicit `?date=` clamps `activeDate` to Monday (`2026-11-02`) and loads Monday's preparation data without rejecting `queryFn`.
- **`AC-A5`:** `MrxTransactionHistoryQuery` populates `Reason` for `INITIAL_ISSUE` / `SUPPLEMENTAL_ISSUE` lines from `AuditLog` (`EntityName == "InventoryIssueLine"`, `FieldName == "IssuedQty"`), and `ReconciliationTransactionsBranch` renders the `"Lý do"` column.
- **`AC-A6`:** `formatTransactionType('PHYSICAL_RETURN')` returns `'Hoàn trả'`; `ListSourceChangesAsync` and `GetVarianceRegisterAsync` return resolved user names (`FullName ?? Username`); `formatAuditActor` no longer mislabels `10000000-...-0002` as Admin; `formatAuditEntity` and `formatAuditField` translate all MRX audit entities and fields to Vietnamese.
- **`AC-A7`:** `GetVarianceRegisterAsync` orders by `ServiceDate, DailyLineId` before `.Take(limit + 1)`, and `GetCompletedRegisterCoreAsync` returns `WeekEndDate = WeekStartDate.AddDays(5)`.
- **`AC-A8`:** `ReconciliationDispositionModal` formats quantities and differences with `<Num format="plain" decimals={6} />` (`0,125` instead of `0.125`) and contains only the 4 over-issued preset buttons.
- **`AC-A9`:** `ReconciliationSourceRevisionService.StageAffectedBatchesAsync` normalizes the user's role code via `MrxSourceChangeApplier.ResolveActorRole` (`"Manager"` → `"MANAGER"`).
- **`AC-A10`:** `ReconciliationVariancesBranch.tsx` uses `formatUnitName` from `utils/formatters.ts` and `useReconciliationWorkspace.ts` no longer exports unused `selectBatch`.
