# MRX Ponytail Audit Closure (A1–A10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not execute before owner approval; `.planning/WORK.md` is the sole task-state owner.

**Goal:** Close all ten Ponytail audit findings (`A1–A10`, covering Must fix `#1–#4`, Should fix `#5–#9`, and Nice to have `#10`) across the MRX Backend and Frontend without breaking any existing `P1–P5`, `T1–T5`, or `V1–V3` invariants.

**Architecture:** Apply surgical owner-level fixes in four coherent tasks: (1) Backend batch/report/revision services (`ReconciliationBatchService.cs`, `MrxTransactionHistoryQuery.cs`, `ReconciliationReportsService.cs`, `ReconciliationSourceRevisionService.cs`), (2) Frontend `/reconciliation` navigation, Sunday/batch-week clamping, transaction reason column, disposition modal formatting, and lean cleanup, (3) Frontend `/weekly-menu?view=mrx-batch` scope sync & `amendmentId` deep-link plus `/warehouse?view=mrx-preparation` Sunday clamping, and (4) Vietnamese audit/transaction formatters (`formatters.ts`) plus `.planning/WORK.md` receipt reconciliation and full verification gates.

**Tech Stack:** .NET 8, Entity Framework Core, xUnit, FluentAssertions, React 19, TypeScript, React Router, Vitest, Testing Library.

**Spec:** [2026-11-08-mrx-audit-closure-design.md](../specs/2026-11-08-mrx-audit-closure-design.md)

## Global Constraints

- Preserve all inherited changes on `feature/ui-interaction-data-states` (`HEAD e0019978b2ce785945f4ea1a9514fc6bd0bde8f1`), empty git index, and zero destructive git operations.
- Keep running background dev servers (`task-166` Backend `:5262`, `task-167` Frontend `:5173`) intact; when running `dotnet test`, build or test without killing the running dev server (or use `--no-build` only after a clean build if the binary is unlocked; note `dotnet test` compiles `IPCManagement.Api.Tests` cleanly if `IPCManagement.Api` is not file-locked or by passing `-p:UseSharedCompilation=true`).
- `DEFAULT != MATERIAL_RECONCILIATION` (`DOM-MODE-1`).
- Single Styling Authority (`frontend/src/styles/index.css`) and existing UI primitives (`<Num />`, `<Badge />`, `<DataGrid />`).
- Emit **Scoped Pre-Code UI Gate Block** in chat before modifying any `.tsx` file.
- Enforce `ipc-test-audit` (`Rule TA-1` to `TA-5`): mock only at transport/API boundary, zero component self-mocking, zero allowlist padding, fail-closed unit-test network boundary.
- Do not stage, commit, push, run DB migrations, or install packages unless explicitly authorized by the owner.

## Review Focus

1. Opening `/reconciliation` on a Sunday (`2026-11-08`) or via `/reconciliation?batchId=<id>` (without `&date=`) for a batch whose `weekStartDate` is `2026-11-02` must snap `serviceDate` to `2026-11-02` and display Monday's review lines instead of an empty table. Pin in Task 1 (`ReconciliationServiceTests.cs`) and Task 2 (`Reconciliation.test.tsx`).
2. Clicking `"Chuyển đến Chuẩn bị lô đối soát"` on `/reconciliation` when customer `DAV` (`customerId: 'customer-1'`) is selected must navigate to `/weekly-menu?view=mrx-batch&customerId=customer-1` (never `?customerId=DAV`), and opening `/reconciliation?customerId=customer-1` must resolve `customerCode` to `'DAV'`. Pin in Task 2 (`Reconciliation.test.tsx`).
3. Calling `handleImportSuccess({ customerId: 'customer-2', weekStartDate: '2026-11-09' })` on `/weekly-menu?view=mrx-batch` must update both URL query params and active `customerId`/`weekStartDate` state so `getWeeklySource('customer-2', '2026-11-09')` is fetched immediately; opening `/weekly-menu?view=mrx-batch&customerId=customer-1&weekStartDate=2026-10-19&amendmentId=amend-1` must auto-select `amend-1` from `changeInbox`. Pin in Task 3 (`WeeklyMenu.test.tsx`).
4. Opening `/warehouse?view=mrx-preparation&range=day` on a Sunday (`2026-11-08`) without an explicit `?date=` must clamp `scopeDate` to Monday `2026-11-02` and call `getPreparation('2026-11-02', undefined, false, ...)` instead of rejecting with an error boundary. Pin in Task 3 (`Warehouse.test.tsx`).
5. Warehouse issue lines with an `AuditLog` reason (`EntityName == "InventoryIssueLine"`, `FieldName == "IssuedQty"`) must return that `Reason` in `GetTransactionsHistoryAsync` / `StreamTransactionsHistoryExportAsync` and render it in `ReconciliationTransactionsBranch.tsx`, while `formatAuditActor('10000000-0000-0000-0000-000000000002')` must not mislabel Manager as `'Quản trị viên (Admin)'`. Pin in Task 1 (`ReconciliationDashboardAndReportsTests.cs`), Task 2 (`Reconciliation.test.tsx`), and Task 4 (`Primitives.test.tsx`).

---

### Task 1: Backend MRX Batch `WeekStartDate`, Transaction `Reason`, Actor Name Resolution, Deterministic Variance/Completed Reports, and Role Normalization (A2, A5, A6, A7, A9)

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs:233-236, 297-315, 680-690`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxTransactionHistoryQuery.cs:80-85`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs:177-185, 194-197, 255-259, 386-392`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationSourceRevisionService.cs:106-114`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs`

**Interfaces:**
- Consumes: `MrxSourceChangeApplier.ResolveActorRole(IEnumerable<string>)`, `ServiceCalendar.ServiceDaysPerWeek`
- Produces:
  - `ReconciliationBatchService.GetAsync(string id, CancellationToken token)` populates `WeekStartDate` and `WeekEndDate` (`WeekStartDate.AddDays(5)`).
  - `ReconciliationBatchService.ListSourceChangesAsync(string id, CancellationToken token)` populates `Actor` with `user.FullName ?? user.Username` (falling back to UUID string if user row not found).
  - `MrxTransactionHistoryQuery` populates `Reason` on `INITIAL_ISSUE` / `SUPPLEMENTAL_ISSUE` rows from `context.Auditlogs`.
  - `ReconciliationReportsService.GetVarianceRegisterAsync` orders `dailyLines` by `ServiceDate, DailyLineId` before `.Take(limit + 1)` and resolves `DisposedBy` to `user.FullName ?? user.Username`.
  - `ReconciliationReportsService.GetCompletedRegisterCoreAsync` computes `WeekEndDate = WeekStartDate.AddDays(ServiceCalendar.ServiceDaysPerWeek - 1)` (`AddDays(5)`).
  - `ReconciliationSourceRevisionService.StageAffectedBatchesAsync` normalizes `actorRole` via `MrxSourceChangeApplier.ResolveActorRole([rawRole])`.

- [ ] **Step 1: Write failing Backend tests in `ReconciliationDashboardAndReportsTests.cs` and `ReconciliationServiceTests.cs`**

In `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs`:
1. In `TransactionsHistory_Returns_Issues_And_Returns_With_Zero_Fabricated_Prices` (`lines 241-274`), seed an `AuditLog` for `issueLineId` (`EntityName = nameof(InventoryIssueLine)`, `EntityId = issueLineId`, `FieldName = nameof(InventoryIssueLine.IssuedQty)`, `Reason = "Xuất bù hao hụt sơ chế"`) and assert:
   ```csharp
   exportRows.Should().Contain(r => r.TransactionType == "INITIAL_ISSUE" && r.DocumentCode == "PX-MRX-HIST" && r.Reason == "Xuất bù hao hụt sơ chế");
   ```
2. In `VarianceRegister_subtracts_received_returns_and_ignores_invalidated_disposition` (`lines 379-410`), add a second active disposition or check an active disposition's `DisposedBy` resolves the user's `FullName` (not raw UUID), and in `CompletedRegister_requires_positive_evidence_but_not_retained_zero_evidence` (`line 521`), assert `row.WeekEndDate.Should().Be(row.WeekStartDate.AddDays(5));`.

In `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs`:
1. Add assertions in `GetAsync` / `ListSourceChangesAsync` tests (or a focused test `GetAsync_Populates_WeekStartDate_And_ListSourceChanges_Resolves_Actor_FullName_And_StageAffectedBatches_Normalizes_Manager_Role`) verifying:
   - `batchDto.WeekStartDate` equals `menuVersion.WeekStartDate` and `batchDto.WeekEndDate` equals `menuVersion.WeekStartDate.AddDays(5)`.
   - `ListSourceChangesAsync` returns `actor` as the user's `FullName` instead of raw UUID.
   - `StageAffectedBatchesAsync` with a user whose `Role.RoleCode = "Manager"` stamps `AppliedRole = "MANAGER"`.

- [ ] **Step 2: Run focused Backend tests to verify RED**

Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~TransactionsHistory_Returns_Issues_And_Returns_With_Zero_Fabricated_Prices|FullyQualifiedName~CompletedRegister_requires_positive_evidence_but_not_retained_zero_evidence|FullyQualifiedName~GetAsync_Populates_WeekStartDate"`
Expected: FAIL on `r.Reason == "Xuất bù hao hụt sơ chế"`, `row.WeekEndDate` (`AddDays(6)` vs `AddDays(5)`), and `batchDto.WeekStartDate` (`null`).

- [ ] **Step 3: Implement Backend fixes in `ReconciliationBatchService.cs`, `MrxTransactionHistoryQuery.cs`, `ReconciliationReportsService.cs`, and `ReconciliationSourceRevisionService.cs`**

1. In `ReconciliationBatchService.cs`:
   - Update `TryGetCustomerAsync` (`lines 680-689`) to also read `mv.WeekStartDate` (or add `TryGetWeekStartDateAsync(byte[] menuVersionId, CancellationToken token)`), and pass `weekStartDate` into `Map(batch, actuals, dispositions, issued, batchLines, issueNotes, customer, weekStartDate)` at `line 234`.
   - In `ListSourceChangesAsync` (`lines 297-314`), load user names for `audits.Select(a => a.ChangedBy).Concat(adjustments.Select(a => a.AdjustedBy)).Distinct()` from `context.Users.AsNoTracking()` and map `Actor` to `actorNames.GetValueOrDefault(Convert.ToHexString(id)) ?? GuidHelper.ToGuidString(id)`.
2. In `MrxTransactionHistoryQuery.cs:83`:
   - Populate `Reason` on `issues`:
     ```csharp
     Reason = context.Auditlogs
         .Where(audit => audit.EntityName == nameof(Models.Entities.InventoryIssueLine)
             && audit.FieldName == nameof(Models.Entities.InventoryIssueLine.IssuedQty)
             && audit.EntityId == line.IssueLineId)
         .OrderByDescending(audit => audit.ChangedAt)
         .Select(audit => audit.Reason)
         .FirstOrDefault(),
     ```
3. In `ReconciliationReportsService.cs`:
   - In `GetVarianceRegisterAsync` (`line 183`), add `query = query.OrderBy(d => d.ServiceDate).ThenBy(d => d.DailyLineId);` before `if (maximumDailyLines is int limit) query = query.Take(limit + 1);`.
   - In `GetVarianceRegisterAsync` (`lines 194-197, 257`), load user names for `dailyDispositions.Values.Select(d => d.DisposedBy).Distinct(ByteArrayComparer.Instance)` from `context.Users.AsNoTracking()` and map `disp.DisposedBy` to `disposedByNames.GetValueOrDefault(Convert.ToHexString(disp.DisposedBy)) ?? GuidHelper.ToGuidString(disp.DisposedBy)`.
   - In `GetCompletedRegisterCoreAsync` (`lines 389-390`), compute `var weekStart = mv?.WeekStartDate ?? DateOnly.FromDateTime(b.CreatedAt);` and pass `weekStart, weekStart.AddDays(ServiceCalendar.ServiceDaysPerWeek - 1)`.
4. In `ReconciliationSourceRevisionService.cs:108-112`:
   - Wrap the queried `RoleCode` with `var actorRole = MrxSourceChangeApplier.ResolveActorRole([rawRole]);`.

- [ ] **Step 4: Run focused Backend tests to verify GREEN**

Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationDashboardAndReportsTests|FullyQualifiedName~ReconciliationServiceTests"`
Expected: PASS (`0 failed`).

---

### Task 2: Frontend `/reconciliation` Customer UUID Link, Sunday & Deep-Link Date Clamping, Transaction Reason Column, Disposition Modal `<Num />`, and Lean Cleanup (A1, A2, A5, A8, A10)

**Files:**
- Modify: `frontend/src/api/mrxApi.ts:94-101`
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:13, 35-40, 50-57, 125-135, 160-169, 191-198, 239-249, 288-293, 375-390`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx:300-303`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationTransactionsBranch.tsx:23-77`
- Modify: `frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx:1-15, 160-185, 245-267`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationVariancesBranch.tsx:7-20, 60-65`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `isServiceDate`, `weekStartFor` from `frontend/src/utils/dates.ts`; `<Num />` from `frontend/src/components/ui/num.tsx`; `formatUnitName` from `frontend/src/utils/formatters.ts`.
- Produces:
  - `mapBatchDtoToSummary(batch, serviceDate)` falls back to `batch.weekStartDate || sourceLines[0]?.serviceDate` when `serviceDate` filters `sourceLines` to `0` items and `serviceDate` is outside the service week (`!isServiceDate(serviceDate)` or `weekStartFor(serviceDate) !== batch.weekStartDate`).
  - `useReconciliationWorkspace` clamps default Sunday `initialDate` to Monday `weekStartFor(...)`, matches `?customerId=` against both `customerId` and `customerCode`, snaps `serviceDate` to `result.weekStartDate` when `serviceDate` is Sunday or in another week, and removes unused `selectBatch`.
  - `ReconciliationPage` passes `selectedCustomerId` (`UUID`) instead of `customerCode` to `/weekly-menu?view=mrx-batch`.
  - `ReconciliationTransactionsBranch` renders the `"Lý do"` (`row.reason`) column.
  - `ReconciliationDispositionModal` renders quantities with `<Num format="plain" decimals={6} />` and removes the dead `< 0` preset branch.

- [ ] **Step 1: Emit Scoped Pre-Code UI Gate Block in chat**

Before editing any `.tsx` files, output the mandatory `Scoped Pre-Code UI Gate Block` for `/reconciliation`, `/weekly-menu`, and `/warehouse`.

- [ ] **Step 2: Write failing Frontend tests in `frontend/src/__tests__/Reconciliation.test.tsx`**

Add tests in `frontend/src/__tests__/Reconciliation.test.tsx` asserting:
1. When `/reconciliation?customerId=cust-uuid-1` is opened on a Sunday (`2026-11-08`) or when an empty batch state is shown for customer `DAV` (`customerId: 'cust-uuid-1'`), clicking `"Chuyển đến Chuẩn bị lô đối soát"` navigates to `/weekly-menu?view=mrx-batch&customerId=cust-uuid-1` (not `customerId=DAV`), and when `getBatchSummary` returns `weekStartDate: '2026-09-21'` with lines on `'2026-09-21'` while the initial date was Sunday `'2026-09-27'`, `serviceDate` snaps to `'2026-09-21'` and renders `'Thịt đùi heo tươi'` instead of empty state.
2. In `ReconciliationDispositionModal`, decimal quantities (`requiredQuantity: 10.125`, `issuedQuantity: 10.5`, `issuedRequiredDifference: 0.375`) render with Vietnamese commas (`10,125`, `10,5`, `+0,375`), and in `ReconciliationTransactionsBranch`, `row.reason` (`"Xuất bù hao hụt sơ chế"`) is visible in the `"Lý do"` column.

- [ ] **Step 3: Run focused Frontend test to verify RED**

Run: `npm run test:fe:unit -- --run src/__tests__/Reconciliation.test.tsx`
Expected: FAIL on the new assertions.

- [ ] **Step 4: Implement fixes in `mrxApi.ts`, `useReconciliationWorkspace.ts`, `ReconciliationPage.tsx`, `ReconciliationTransactionsBranch.tsx`, `ReconciliationDispositionModal.tsx`, and `ReconciliationVariancesBranch.tsx`**

1. In `frontend/src/api/mrxApi.ts:94-100`:
   - Import `isServiceDate, weekStartFor` from `../utils/dates`.
   - When `serviceDate && hasDailyDate`: filter `sourceLines` by `line.serviceDate === serviceDate`. If `matched.length === 0 && sourceLines.length > 0 && (!isServiceDate(serviceDate) || (batch.weekStartDate && weekStartFor(serviceDate) !== batch.weekStartDate))`, fall back to `const fallbackDate = batch.weekStartDate || sourceLines[0]?.serviceDate; lines = sourceLines.filter(l => l.serviceDate === fallbackDate);`.
2. In `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`:
   - Import `isServiceDate` alongside `todayInBusinessTimezone, weekStartFor`.
   - For `initialCode` (`line 36`) and customer load (`line 164`): resolve `const urlCustomerParam = searchParams.get('customerId') || '';` against `c.customerCode === urlCustomerParam || c.customerId === urlCustomerParam`.
   - For `initialDate` (`line 51`): if `!searchParams.get('date')`, compute `const candidateDate = snapshot?.serviceDate || sessionScope.serviceDate || todayInBusinessTimezone(); const initialDate = isServiceDate(candidateDate) ? candidateDate : weekStartFor(candidateDate);`.
   - In `loadData` (`line 131`), catalog effect (`line 193`), and batch summary effect (`line 245`): if `summary.weekStartDate && (weekStartFor(date) !== summary.weekStartDate || !isServiceDate(date))`, call `setServiceDate(summary.weekStartDate)`.
   - Remove unused `selectBatch` (`lines 288-292` and return object `line 381`).
3. In `frontend/src/features/reconciliation/ReconciliationPage.tsx:302`:
   - Resolve `const selectedCustomerId = customers.find((c) => c.customerCode === customerCode)?.customerId || '';` and navigate to `` `/weekly-menu?view=mrx-batch${selectedCustomerId ? '&customerId=' + selectedCustomerId : ''}` ``.
4. In `frontend/src/features/reconciliation/branches/ReconciliationTransactionsBranch.tsx:23-76`:
   - Add column `{ id: 'reason', header: 'Lý do', width: '16%', minWidth: '140px', cell: (row) => <span className="text-xs text-slate-600 truncate block" title={row.reason ?? ''}>{row.reason || '—'}</span> }` and adjust widths (`doc: '16%'`, `ingredient: '18%'`, `actor: '14%'`).
5. In `frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx`:
   - Import `Num` from `../../components/ui/num`.
   - Format `l.issuedRequiredDifference`, `primaryLine.requiredQuantity`, `primaryLine.issuedQuantity`, and `primaryLine.issuedRequiredDifference` with `<Num value={...} format="plain" decimals={6} />`.
   - Remove the dead `primaryLine.issuedRequiredDifference != null && primaryLine.issuedRequiredDifference < 0 ? [...] :` branch (`lines 246-251`).
6. In `frontend/src/features/reconciliation/branches/ReconciliationVariancesBranch.tsx`:
   - Replace local `formatCanonicalUnit` with `formatUnitName` from `../../../utils/formatters`.

- [ ] **Step 5: Run focused Frontend test to verify GREEN**

Run: `npm run test:fe:unit -- --run src/__tests__/Reconciliation.test.tsx`
Expected: PASS.

---

### Task 3: Frontend `/weekly-menu?view=mrx-batch` Scope Sync & `amendmentId` Deep-Link, plus `/warehouse?view=mrx-preparation` Sunday Clamping (A3, A4)

**Files:**
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts:35-41, 156-177, 213-221`
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx:24-27`
- Modify: `frontend/src/features/warehouse/branches/MrxPrepHeaderBranch.tsx:20, 37-40`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Consumes: `isIsoDate`, `isServiceDate`, `weekStartFor` from `frontend/src/utils/dates.ts`
- Produces:
  - `useMrxBatchWorkspace` updates `customerId` and `weekStartDate` state on `handleImportSuccess(scope)` and on URL `searchParams` changes, and auto-opens `reviewRequest` when `searchParams.get('amendmentId')` matches an item in `changeInbox`.
  - `MrxMultiCustomerPreparationWorkbench` clamps non-service default `activeDate` (Sunday) to `weekStartFor(rawDate)` (Monday) when `?date=` is not explicitly set in URL.

- [ ] **Step 1: Write failing Frontend tests in `WeeklyMenu.test.tsx` and `Warehouse.test.tsx`**

1. In `frontend/src/__tests__/WeeklyMenu.test.tsx`:
   - Add a test verifying that opening `/weekly-menu?view=mrx-batch&customerId=customer-1&weekStartDate=2026-10-19&amendmentId=amend-99` with `getSourceChangeInbox` returning `[{ menuAmendmentId: 'amend-99', customerId: 'customer-1', customerName: 'Draxlmaier', weekStartDate: '2026-10-19', status: 'PENDING_REVIEW', reason: 'Đổi món trưa', createdAt: '2026-10-19T01:00:00Z', requiresReconciliation: true, hasPurchaseOrder: false, hasReceipt: false, hasIssue: false, affectedDemandCount: 0, affectedPurchaseRequestCount: 0, affectedReconciliationBatchIds: [], impactLines: [] }]` for a Manager user automatically opens the review modal/request for `'Đổi món trưa'`, and navigating URL search params to `?view=mrx-batch&customerId=customer-2&weekStartDate=2026-10-26` triggers `getWeeklySource('customer-2', '2026-10-26')`.
2. In `frontend/src/__tests__/Warehouse.test.tsx`:
   - Add a test verifying that rendering `MrxMultiCustomerPreparationWorkbench` (`serviceDate="2026-11-08"`, a Sunday) on `/warehouse?view=mrx-preparation&range=day` clamps `scopeDate` to Monday `'2026-11-02'` and calls `mrxApi.getPreparation('2026-11-02', undefined, false, expect.anything())` without throwing the Sunday error.

- [ ] **Step 2: Run focused Frontend tests to verify RED**

Run: `npm run test:fe:unit -- --run src/__tests__/WeeklyMenu.test.tsx src/__tests__/Warehouse.test.tsx -t "amend-99|Sunday"`
Expected: FAIL on both new tests.

- [ ] **Step 3: Implement fixes in `useMrxBatchWorkspace.ts`, `MrxMultiCustomerPreparationWorkbench.tsx`, and `MrxPrepHeaderBranch.tsx`**

1. In `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`:
   - In `handleImportSuccess(scope)` (`lines 156-177`): call `setCustomerId(scope.customerId)` and `setWeekStartDate(scope.weekStartDate)` in addition to updating `searchParams`.
   - Add an effect syncing URL `searchParams` (`customerId` and `weekStartDate`) when `!isSubmitting`:
     ```ts
     const urlCustomerId = searchParams.get('customerId');
     const urlWeekStart = searchParams.get('weekStartDate');
     useEffect(() => {
       if (isSubmitting) return;
       if (urlCustomerId) {
         const matched = customers.find((c) => c.customerId === urlCustomerId || c.customerCode === urlCustomerId);
         const nextCustId = matched ? matched.customerId : urlCustomerId;
         if (nextCustId !== customerId) setCustomerId(nextCustId);
       }
       if (urlWeekStart && isIsoDate(urlWeekStart) && urlWeekStart !== weekStartDate) {
         setWeekStartDate(urlWeekStart);
       }
     }, [urlCustomerId, urlWeekStart, customers, customerId, weekStartDate, isSubmitting]);
     ```
   - In the `changeInbox` effect (`lines 213-220`) or a companion effect watching `[changeInbox, searchParams]`:
     ```ts
     const amendmentIdParam = searchParams.get('amendmentId');
     useEffect(() => {
       if (!amendmentIdParam || changeInbox.length === 0) return;
       const matched = changeInbox.find((item) => item.menuAmendmentId === amendmentIdParam);
       if (matched) setReviewRequest((current) => current ?? matched);
     }, [amendmentIdParam, changeInbox]);
     ```
2. In `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx:24-27`:
   - Compute:
     ```ts
     const explicitUrlDate = searchParams.get('date');
     const rawDate = [explicitUrlDate, serviceDate, sessionScope.serviceDate].find(isIsoDate) || todayInBusinessTimezone();
     const activeDate = !explicitUrlDate && !isServiceDate(rawDate) ? weekStartFor(rawDate) : rawDate;
     ```
3. In `frontend/src/features/warehouse/branches/MrxPrepHeaderBranch.tsx`:
   - Pass `activeDate={isServiceDate(activeDate) ? activeDate : weekStart}` to `MrxDailyDateTabsBranch`.

- [ ] **Step 4: Run focused Frontend tests to verify GREEN**

Run: `npm run test:fe:unit -- --run src/__tests__/WeeklyMenu.test.tsx src/__tests__/Warehouse.test.tsx`
Expected: PASS.

---

### Task 4: Complete Vietnamese Formatters (`formatters.ts`), Update `.planning/WORK.md`, and Run Full Verification Gates (A6, Integrated Exit)

**Files:**
- Modify: `frontend/src/utils/formatters.ts:48-132`
- Modify: `.planning/WORK.md:2-35`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

**Interfaces:**
- Consumes: `formatTransactionType`, `formatAuditActor`, `formatAuditArea`, `formatAuditEntity`, `formatAuditField` in `frontend/src/utils/formatters.ts`
- Produces: Complete Vietnamese translations for `PHYSICAL_RETURN`, seeded actor UUIDs (without mislabeling non-admins as Admin), and MRX audit entities/fields; updated `.planning/WORK.md` top entry.

- [ ] **Step 1: Write failing unit tests in `frontend/src/__tests__/Primitives.test.tsx`**

Add a test in `frontend/src/__tests__/Primitives.test.tsx` asserting:
- `formatTransactionType('PHYSICAL_RETURN')` returns `'Hoàn trả'`.
- `formatAuditActor('10000000-0000-0000-0000-000000000001')` returns `'Quản trị viên (Admin)'`, while `formatAuditActor('10000000-0000-0000-0000-000000000002')` returns `'Quản lý (Manager)'` (not `'Quản trị viên (Admin)'`).
- `formatAuditEntity('ReconciliationDailyDisposition')` returns `'Xử lý chênh lệch'`, `formatAuditEntity('InventoryIssueLine')` returns `'Dòng xuất kho'`, `formatAuditEntity('BomAdjustment')` returns `'Điều chỉnh BOM'`.
- `formatAuditField('IssuedQty')` returns `'Số lượng thực xuất'`, `formatAuditField('Validity')` returns `'Hiệu lực giải trình'`, `formatAuditField('QuantityAndWaste')` returns `'Định lượng & hao hụt'`.

- [ ] **Step 2: Run focused test to verify RED**

Run: `npm run test:fe:unit -- --run src/__tests__/Primitives.test.tsx -t "PHYSICAL_RETURN|formatAudit"`
Expected: FAIL (`formatTransactionType('PHYSICAL_RETURN')` returns `'PHYSICAL_RETURN'`, `formatAuditActor('...0002')` returns `'Quản trị viên (Admin)'`).

- [ ] **Step 3: Implement formatter mappings in `frontend/src/utils/formatters.ts`**

Update `formatTransactionType`, `formatAuditActor`, `formatAuditArea`, `formatAuditEntity`, and `formatAuditField` in `frontend/src/utils/formatters.ts` per Spec §4.5.3.

- [ ] **Step 4: Run focused test to verify GREEN**

Run: `npm run test:fe:unit -- --run src/__tests__/Primitives.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update `.planning/WORK.md` and run full Frontend & Backend verification gates**

Update the top entry of `.planning/WORK.md` to record the `A1–A10` Ponytail Audit Closure receipts alongside `T1–T5` and `V1–V3`, then run:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationDashboardAndReportsTests|FullyQualifiedName~ReconciliationServiceTests|FullyQualifiedName~MrxMenuAmendmentTests"
npm run test:fe:unit -- --run src/__tests__/Reconciliation.test.tsx src/__tests__/WeeklyMenu.test.tsx src/__tests__/Warehouse.test.tsx src/__tests__/Primitives.test.tsx src/__tests__/RouteNavigationIntegrity.test.tsx src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts
npm run build:fe
npm run lint:fe
git diff --check
git status --short --branch
```
Expected: All Backend and Frontend test suites, `build:fe`, `lint:fe`, and `git diff --check` exit `0`; `git status --short --branch` has an empty index and preserves all running dev servers.
