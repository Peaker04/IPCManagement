# MRX Final 5-Verdict Closure (`L1`–`L5`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the final 5 seam-flash and multi-render waterfall edge cases (`L1`–`L5`) across `/chef?view=mrx-cooking`, `/admin-data?view=ingredients|dishes`, `/settings/approval-rules`, `/warehouse?view=mrx-deltas`, and `/reconciliation?view=variances|transactions|audit` to bring all 18 MRX route/view leaves to 100% zero seam-flash compliance.

**Architecture:** Keep `<SplitView>` and `<DataGrid>` sticky `<thead>` headers permanently mounted (`tableCount = 1`) during filter-empty, search-empty, and tab-empty states by delegating empty recovery messaging into the split pane / `<DataGrid emptyState={...} />` body (`L1`–`L4`), keep `<TelemetrySubbar>` numeric pills mounted on Frame 0 (`L3`, `L4`), and pre-warm report-tab cache entries inside `getBatchPage.then` before committing `setBatchId(selected)` on interactive customer switches (`L5`).

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library.

**Spec:** [`docs/superpowers/specs/2026-11-09-mrx-final-5-verdicts-closure-design.md`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/docs/superpowers/specs/2026-11-09-mrx-final-5-verdicts-closure-design.md)

## Global Constraints

- **Single Styling Authority:** Zero ad-hoc CSS files or inline styles; use existing semantic Tailwind tokens in `frontend/src/styles/index.css`.
- **Operational Mode Isolation (`DOM-MODE-1`):** `DEFAULT != MATERIAL_RECONCILIATION`. Do not alter `DEFAULT` mode workflows.
- **Anti-Tautology (`TA-1..TA-4`):** Every task starts with a failing test (`RED`) against the real component tree and verifies the fix (`GREEN`).

## Review Focus

1. **`/chef?view=mrx-cooking` shift/search filter empty recovery (`L1`):** Clicking `"Xem tất cả ca"` or `"Xóa tìm trong phiếu nấu"` inside the kept-alive `<SplitView>` must restore all dish groups and re-enable `"In phiếu nấu"` while `"Tải CSV cả lô"` / `"Tải Excel cả lô"` remain enabled throughout.
2. **`/admin-data?view=ingredients|dishes` true-empty vs search-empty distinction (`L2`):** When `searchKeyword` is empty (`!keyword`) and `totalCount === 0`, `<StateBoundary>` must still render `"Chưa có danh mục nguyên liệu"` / `"Chưa có danh mục món ăn"` without breaking existing empty-catalog tests; when `keyword` is non-empty and `items.length === 0`, `<DataGrid>` and its `<thead>` must stay mounted (`tableCount = 1`).
3. **`/settings/approval-rules` tab switch with `0` rules (`L3`):** Switching to a document-type tab with `0` rules must keep `<DataGrid>` `<thead>` mounted (`tableCount = 1`) and allow clicking `"Làm mới quy tắc"` to re-fetch `adminApi.getApprovalRules()`.
4. **`/warehouse?view=mrx-deltas` cold load & zero-row delta table (`L4`):** `Tổng số thay đổi:` must be present in `<TelemetrySubbar>` even while `getSourceDeltas` is still pending (`'—'`), and `<DataGrid>` `<thead>` must stay mounted when `items.length === 0`.
5. **`/reconciliation` customer switch on `variances`, `transactions`, and `audit` tabs (`L5`):** If the prefetched report API call rejects during a customer switch, `useReconciliationWorkspace` must still commit `setBatches` and `setBatchId(selected)` so `useReconciliationReports` surfaces the error cleanly without hanging the batch selector.

---

### Task 1: `L1` — Keep `<SplitView>` & Ingredient `<table>`/`<thead>` Mounted on Filter/Search Empty in `/chef?view=mrx-cooking`

**Files:**
- Modify: [`frontend/src/features/chef/MrxCookingWorkbench.tsx:260-282`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/MrxCookingWorkbench.tsx#L260-L282)
- Modify: [`frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx:23-60`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx#L23-L60)
- Test: [`frontend/src/__tests__/Chef.test.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/__tests__/Chef.test.tsx)

**Interfaces:**
- Consumes: `DishGroup` in `MrxCookingDishListBranch.tsx`
- Produces: `MrxCookingDishListBranchProps.emptyFilterState?: { title: string; description: string; actionLabel: string; onAction: () => void }`

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/Chef.test.tsx`**

```tsx
// In 'groups cooking by menu variant and recovers a shift with no dishes without changing whole-batch exports' (L247-256):
await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lọc theo ca nấu' }), 'AFTERNOON');
expect(screen.getByRole('heading', { name: 'Không có món cho ca đã chọn' })).toBeVisible();
expect(screen.getByRole('table')).toBeInTheDocument();
expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/Chef.test.tsx`
Expected: FAIL with `Unable to find an accessible element with the role "table"` when `AFTERNOON` is selected.

- [ ] **Step 3: Implement `emptyFilterState` in `MrxCookingDishListBranch.tsx` and `MrxCookingWorkbench.tsx`**

In `MrxCookingWorkbench.tsx`:
- Change `<StateBoundary isEmpty={stateProps.isEmpty || isLegacyLineageMissing}>` (removing `|| isFilteredEmpty`).
- Pass `emptyFilterState={isFilteredEmpty ? { title: queryText ? 'Không có món khớp tìm kiếm' : 'Không có món cho ca đã chọn', description: 'Xóa tìm kiếm hoặc chọn ca khác. Tệp tải xuống vẫn gồm cả lô.', actionLabel: queryText ? 'Xóa tìm trong phiếu nấu' : 'Xem tất cả ca', onAction: () => (queryText ? setSearchTerm('') : setSelectedShift('ALL')) } : undefined}` to `<MrxCookingDishListBranch>`.

In `MrxCookingDishListBranch.tsx`:
- When `groups.length === 0`, render `emptyFilterState` (with `<h3>{emptyFilterState.title}</h3>`, `<p>{emptyFilterState.description}</p>`, and `<Button onClick={emptyFilterState.onAction}>{emptyFilterState.actionLabel}</Button>`) inside `SplitView`'s `master` pane, and render the Dish Header shell + `<table>`/`<thead>` with an empty-state `<tr><td colSpan={5}>` inside `SplitView`'s `detail` pane.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/Chef.test.tsx`
Expected: PASS (`16/16` tests in `Chef.test.tsx`).

---

### Task 2: `L2` & `L3` — Keep `<DataGrid>` Sticky `<thead>` Mounted on Search/Tab Empty in `/admin-data` & `/settings/approval-rules`

**Files:**
- Modify: [`frontend/src/features/admin/branches/AdminCatalogBranch.tsx:253-280`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/branches/AdminCatalogBranch.tsx#L253-L280)
- Modify: [`frontend/src/features/admin/ApprovalRulesPage.tsx:71-88`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/ApprovalRulesPage.tsx#L71-L88)
- Test: [`frontend/src/__tests__/AdminData.test.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/__tests__/AdminData.test.tsx)

**Interfaces:**
- Consumes: `DataGridProps.emptyState` from `frontend/src/components/workbench/DataGrid.tsx`
- Produces: Persistent `<table>` and `<thead className="sticky top-0 z-20 ...">` on `/admin-data?view=ingredients|dishes` search-empty and `/settings/approval-rules` tab-empty states.

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/AdminData.test.tsx`**

```tsx
it('L2 & L3: keeps DataGrid table and sticky thead mounted when catalog search returns 0 items or when switching to an empty approval-rules tab', async () => {
  ingredientResponse.mockImplementation(async (params) =>
    params?.searchKeyword
      ? { items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false }
      : mockIngredientsPage1
  );
  const { unmount } = renderPage('/admin-data?view=ingredients&q=KhongCo');
  expect(await screen.findByText('Không tìm thấy danh mục phù hợp')).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Mã nguyên liệu' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Xóa từ khóa tìm kiếm' }));
  expect(await screen.findByText('Gạo tẻ ST25')).toBeInTheDocument();
  unmount();

  vi.spyOn(adminApi, 'getApprovalRules').mockResolvedValue([
    { ruleId: 'R-01', ruleName: 'Duyệt PO', documentType: 'purchase-order', minAmount: 0, maxAmount: 1000000, approverRole: 'Manager', slaHours: 24, isActive: true },
  ]);
  const { ApprovalRulesPage } = await import('../features/admin/ApprovalRulesPage');
  render(<AuthProvider><ApprovalRulesPage /></AuthProvider>);
  expect(await screen.findByText('Duyệt PO')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: /Điều chỉnh thực đơn/i }));
  expect(await screen.findByText('Chưa có quy tắc phê duyệt')).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Mã quy tắc' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/AdminData.test.tsx`
Expected: FAIL with `Unable to find an accessible element with the role "table"` when `q=KhongCo` returns `0` items.

- [ ] **Step 3: Implement `isFilterEmpty` in `AdminCatalogBranch.tsx` and `emptyState` in `ApprovalRulesPage.tsx`**

In `AdminCatalogBranch.tsx`:
- Compute `const isFilterEmpty = Boolean(keyword) && stateProps.isEmpty && !needsPageCorrection;`.
- Pass `isEmpty={stateProps.isEmpty && !needsPageCorrection && !isFilterEmpty}` to `<StateBoundary>`.
- Pass `emptyState={filterEmptyState}` to `<DataGrid<IngredientItem>>` and `<DataGrid<DishItem>>`.

In `ApprovalRulesPage.tsx`:
- Pass `isEmpty={false}` to `<StateBoundary>` and pass `emptyState` (with `"Chưa có quy tắc phê duyệt"`, `"Chưa thiết lập quy tắc phê duyệt cho loại chứng từ này."`, and `<Button variant="outline" size="xs" onClick={loadData}>Làm mới quy tắc</Button>`) to `<DataGrid>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/AdminData.test.tsx`
Expected: PASS.

---

### Task 3: `L4` — Keep `TelemetrySubbar` Pill & `<DataGrid>` Sticky `<thead>` Mounted in `/warehouse?view=mrx-deltas`

**Files:**
- Modify: [`frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx:55-68`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx#L55-L68)
- Modify: [`frontend/src/features/warehouse/branches/MrxDeltaTableBranch.tsx:1-11`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/branches/MrxDeltaTableBranch.tsx#L1-L11)
- Test: [`frontend/src/__tests__/Warehouse.test.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/__tests__/Warehouse.test.tsx)

**Interfaces:**
- Consumes: `DataGridProps.emptyState`
- Produces: Frame-0 `Tổng số thay đổi:` pill in `TelemetrySubbar` and persistent `<DataGrid>` `<table>`/`<thead>` when `items.length === 0`.

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/Warehouse.test.tsx`**

```tsx
it('L4: MrxSourceDeltaWorkbench renders Tổng số thay đổi pill on initial loading frame and keeps DataGrid table mounted when items.length === 0', async () => {
  let resolveDeltas!: (val: Awaited<ReturnType<typeof mrxApi.getSourceDeltas>>) => void;
  vi.spyOn(mrxApi, 'getSourceDeltas').mockReturnValueOnce(new Promise((r) => { resolveDeltas = r; }));

  renderWarehouse('/warehouse?view=mrx-deltas');
  expect(screen.getByText(/Tổng số thay đổi:/)).toBeInTheDocument();

  await act(async () => {
    resolveDeltas({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });
  });

  expect(await screen.findByText('Chưa có lịch sử thay đổi nguồn')).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/Warehouse.test.tsx`
Expected: FAIL because `Tổng số thay đổi:` is not rendered before `resolveDeltas` and `table` is unmounted when `items` is `[]`.

- [ ] **Step 3: Update `MrxSourceDeltaWorkbench.tsx` and `MrxDeltaTableBranch.tsx`**

- In `MrxSourceDeltaWorkbench.tsx`, always render `telemetryPills={<span className="text-xs">Tổng số thay đổi: <strong className="inline-block min-w-[3ch] text-right font-mono tabular-nums text-slate-900">{displayed ? <Num value={displayed.totalCount} /> : '—'}</strong></span>}` and pass `isEmpty={false}` to `<StateBoundary>`.
- In `MrxDeltaTableBranch.tsx`, pass `emptyState` with `"Chưa có lịch sử thay đổi nguồn"` and `"Các thay đổi nguồn và dữ liệu tương thích cũ được giữ nguyên để tra cứu."` to `<DataGrid>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/Warehouse.test.tsx`
Expected: PASS.

---

### Task 4: `L5` — Atomic Customer Switch on Report Tabs (`variances`, `transactions`, `audit`) in `/reconciliation`

**Files:**
- Modify: [`frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:30-35,118-128,277-295`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts#L277-L295)
- Test: [`frontend/src/__tests__/Reconciliation.test.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/__tests__/Reconciliation.test.tsx)

**Interfaces:**
- Consumes: `mrxApi.getVarianceRegister`, `mrxApi.getTransactionsHistory`, `mrxApi.getAuditTrail`, `mrxApi.getSourceChanges`, `serverStateCache`
- Produces: Pre-warmed `mrx_report_${user?.userId}_${operationalMode}_${reportTab}_${subTab}_${selected}_1` cache entry before `setBatches(sortedItems)` and `setBatchId(selected)` commit on interactive customer switches.

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/Reconciliation.test.tsx`**

```tsx
it('L5: switching customer while on ?view=variances pre-warms getVarianceRegister before committing new batch options so header and variance table flip atomically in 1 render', async () => {
  serverStateCache.clearAll();
  let resolveKh2Variances!: (val: MrxVarianceRegisterReport) => void;
  vi.mocked(weeklyMenuApi.getCustomers).mockResolvedValue([
    { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    { customerId: 'customer-2', customerCode: 'KH2', customerName: 'Khách hàng 2' },
  ]);
  vi.mocked(mrxApi.getBatchPage).mockImplementation(async (params) => ({
    items: [{
      batchId: params?.customerId === 'customer-2' ? 'b-kh2' : 'b-dav',
      customerId: params?.customerId || 'customer-1',
      customerCode: params?.customerId === 'customer-2' ? 'KH2' : 'DAV',
      customerName: params?.customerId === 'customer-2' ? 'Khách hàng 2' : 'Draxlmaier',
      weekStartDate: '2026-10-19',
      weekEndDate: '2026-10-25',
      status: 'IN_PROGRESS',
      version: 1,
      createdAt: '2026-10-19T00:00:00Z',
    }],
    totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
  }));
  vi.spyOn(mrxApi, 'getVarianceRegister').mockImplementation((bId) => {
    if (bId === 'b-kh2') {
      return new Promise((r) => { resolveKh2Variances = r; });
    }
    return Promise.resolve({
      rows: [{
        batchId: 'b-dav', customerName: 'Draxlmaier', serviceDate: '2026-10-19', shiftName: 'Ca sáng',
        ingredientCode: 'NL-1', ingredientName: 'Thịt bò DAV', canonicalUnitName: 'kg',
        requiredQuantity: 10, issuedQuantity: 11, difference: 1, varianceType: 'OVER_ISSUED',
        dispositionCategory: 'ACCEPTED_VARIANCE', dispositionReason: 'Lệch DAV', disposedBy: 'u-1',
        disposedAt: '2026-10-19T07:00:00Z', issueNotes: [],
      }],
      totalCount: 1,
    });
  });

  renderReconciliation('/reconciliation?view=variances&customerId=customer-1&batchId=b-dav&date=2026-10-19');
  expect(await screen.findByText('Thịt bò DAV')).toBeInTheDocument();

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'KH2');
  await waitFor(() => expect(mrxApi.getVarianceRegister).toHaveBeenCalledWith('b-kh2'));
  // While b-kh2 variance report is still pending, header batch option must NOT have flipped to KH2 · 19/10/2026 ahead of the table!
  expect(screen.queryByRole('option', { name: 'KH2 · 19/10/2026' })).not.toBeInTheDocument();
  expect(screen.getByText('Thịt bò DAV')).toBeInTheDocument();

  await act(async () => {
    resolveKh2Variances({
      rows: [{
        batchId: 'b-kh2', customerName: 'Khách hàng 2', serviceDate: '2026-10-19', shiftName: 'Ca sáng',
        ingredientCode: 'NL-2', ingredientName: 'Cá hồi KH2', canonicalUnitName: 'kg',
        requiredQuantity: 5, issuedQuantity: 6, difference: 1, varianceType: 'OVER_ISSUED',
        dispositionCategory: 'ACCEPTED_VARIANCE', dispositionReason: 'Lệch KH2', disposedBy: 'u-1',
        disposedAt: '2026-10-19T07:00:00Z', issueNotes: [],
      }],
      totalCount: 1,
    });
  });
  expect(await screen.findByText('Cá hồi KH2')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'KH2 · 19/10/2026' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/Reconciliation.test.tsx -t "L5:"`
Expected: FAIL because `KH2 · 19/10/2026` is committed before `resolveKh2Variances` resolves.

- [ ] **Step 3: Pre-warm report cache inside `getBatchPage.then` in `useReconciliationWorkspace.ts`**

In `useReconciliationWorkspace.ts`:
- Read `const { hasRole, user, operationalMode } = useAuth();` and track `auditSubTabRef = useRef(auditSubTab)`, `userRef = useRef(user?.userId)`, `modeRef = useRef(operationalMode)`.
- Inside `getBatchPage.then`, when `selected && hasUserSwitchedScopeRef.current && (activeReportTabRef.current === 'variances' || activeReportTabRef.current === 'transactions' || activeReportTabRef.current === 'audit')`:
  - Compute `const reportTab = activeReportTabRef.current; const subTab = reportTab === 'audit' ? auditSubTabRef.current : ''; const reportCacheKey = \`mrx_report_${userRef.current}_${modeRef.current}_${reportTab}_${subTab}_${selected}_1\`;`
  - If `!serverStateCache.get(reportCacheKey)?.data`, await the matching report call (`getVarianceRegister`, `getTransactionsHistory`, `getSourceChanges`, or `getAuditTrail`) inside a `try/catch` and store the result in `serverStateCache.set(reportCacheKey, ...)` before `if (ignore) return;` and `setBatches(sortedItems)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/Reconciliation.test.tsx`
Expected: PASS.

---

### Task 5: Full-Suite Verification & `.planning/WORK.md` Closure

**Files:**
- Modify: [`.planning/WORK.md`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/.planning/WORK.md)

- [ ] **Step 1: Run Frontend & Backend verification suites**

Run:
- `npx vitest run src/__tests__/Chef.test.tsx src/__tests__/AdminData.test.tsx src/__tests__/Warehouse.test.tsx src/__tests__/Reconciliation.test.tsx src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxDashboard.test.tsx src/__tests__/Primitives.test.tsx`
- `npm run lint`
- `npm run build`

Expected: `0` test failures, `0` lint errors, and clean production build.

- [ ] **Step 2: Update `.planning/WORK.md` to `IDLE` with `L1`–`L5` verification evidence**
