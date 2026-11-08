# Kế Hoạch Thực Thi: Tinh Chỉnh Nghiệp Vụ & Khóa Rào Chắn Chống Điểm Nghẽn / Ngõ Cụt MRX (`MATERIAL_RECONCILIATION`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ hoàn toàn 5 điểm nghẽn và ngõ cụt nghiệp vụ trong chế độ Đối soát nguyên liệu (MRX), cho phép giải trình chênh lệch hai chiều (cả thừa và thiếu), bổ sung xuất kho bổ sung thủ công, tự động hóa kế hoạch số suất và hiển thị bằng chứng chặn minh bạch khi chốt đối soát.

**Architecture:** Nới lỏng chính sách kiểm tra chênh lệch trong `ReconciliationDailyIssuePolicy.cs` và `ReconciliationActualService.cs` của Backend C# để cho phép giải trình dòng xuất thiếu (`UNDER_ISSUED`) đạt `COMPLETE`. Bổ sung modal xuất bổ sung ca trên `MrxDailyIssueWorkbench.tsx`, mở nút giải trình dòng âm và thẻ cảnh báo điểm tắc luồng trên `ReconciliationPage.tsx`, và tự động hóa sinh số suất trên `MrxBatchWorkbench.tsx`.

**Tech Stack:** ASP.NET Core 9 (.NET 9), Entity Framework Core, React 19, TypeScript, Tailwind CSS, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-mrx-unblocking-and-rule-alignment-design.md`

## Global Constraints

- **`DOM-MODE-1`**: Giữ nguyên tính cách ly tuyệt đối giữa `DEFAULT` và `MATERIAL_RECONCILIATION`. Không làm rò rỉ dữ liệu hoặc route sang DEFAULT.
- **`RULE-MRX-01`**: Mọi chênh lệch (thừa hoặc thiếu) đều có thể được giải trình với danh mục `ACCEPTED_VARIANCE`.
- **`RULE-MRX-02`**: Tuần đạt `WEEK_COMPLETE` khi 100% ngày áp dụng đều đạt `COMPLETE` (mọi dòng hoặc EXACT hoặc đã có giải trình hợp lệ).
- **`UXR-02` & `BR-GLOBAL-04`**: Khi thao tác chốt lô bị chặn, giao diện bắt buộc hiển thị rõ nguyên nhân và nút dẫn đường, cấm ẩn nút câm lặng.
- **Rule TA-1 đến TA-5**: Fixture test bám sát C# DTO thật, không tạo dữ liệu giả lập trong production code.

## Review Focus

1. **Dòng xuất thiếu (`netIssued < required`) có giải trình hợp lệ**: Phải chuyển trạng thái dòng thành `RESOLVED`, cho phép ngày đạt `COMPLETE` và tuần đạt `WEEK_COMPLETE` để chốt sổ thành công.
2. **Lô có ngày không có suất ăn (`isApplicable === false`)**: Phải được bỏ qua khi tính toán tuần hoàn tất, không bị kẹt ở `IN_PROGRESS`.
3. **Thao tác xuất bổ sung khi đã có phiếu xuất đầu tiên**: Phải tạo `InventoryIssue` mới với `isSupplemental: true`, tăng aggregate sequence, không ghi đè phiếu cũ.
4. **Điều phối xuất bản thực đơn chưa có số suất**: Phải tự động sinh số suất `complete: true` qua quick-servings, không bị ném lỗi 400 `Phiên bản thực đơn chưa có nguồn số suất`.
5. **Thẻ cảnh báo tắc luồng (Blocker Resolution Strip)**: Phải hiển thị đúng danh sách ngày chưa xuất kho và dòng chưa giải trình khi tuần chưa đạt `WEEK_COMPLETE`.

---

### Task 1: Backend Policy Alignment — Bidirectional Variance Disposition & Daily/Weekly Completion

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationDailyIssuePolicy.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationActualService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationDailyLineagePolicyTests.cs`

**Interfaces:**
- Produces: `ReconciliationDailyIssuePolicy.ResolveLineStatus(decimal required, decimal? issued, bool hasDisposition)` returning `UNDER_ISSUED` with `HasValidDisposition = hasDisposition`.
- Produces: `ReconciliationActualService.SetDailyDispositionAsync` accepting dispositions for any line where `difference != 0`.

- [ ] **Step 1: Write failing unit test in `ReconciliationDailyLineagePolicyTests.cs`**

```csharp
[Fact]
public void UnderIssued_Line_With_Valid_Disposition_Allows_Daily_Complete()
{
    var underIssuedResolved = ReconciliationDailyIssuePolicy.ResolveLineStatus(50m, 45m, hasValidDisposition: true);
    Assert.Equal("UNDER_ISSUED", underIssuedResolved.QuantityStatus);
    Assert.True(underIssuedResolved.HasValidDisposition);

    var dailyStatus = ReconciliationDailyIssuePolicy.ResolveDailyStatus(new[] { underIssuedResolved });
    Assert.Equal("COMPLETE", dailyStatus);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~UnderIssued_Line_With_Valid_Disposition"`
Expected: FAIL with `Assert.True() Failure` or `Assert.Equal() Failure: Expected: COMPLETE, Actual: PARTIAL`

- [ ] **Step 3: Implement policy change in `ReconciliationDailyIssuePolicy.cs` & `ReconciliationActualService.cs`**

1. In `ReconciliationDailyIssuePolicy.cs`:
   - Pass `hasValidDisposition` to `UNDER_ISSUED`: `return difference switch { < 0 => new("UNDER_ISSUED", hasValidDisposition), > 0 => new("OVER_ISSUED", hasValidDisposition), _ => new("EXACT") };`
   - In `ResolveDailyStatus`: If a line is `UNDER_ISSUED` or `OVER_ISSUED` and `line.HasValidDisposition == true`, it is NOT partial. If any line is `UNTOUCHED`, return `PARTIAL`. If any line is `UNDER_ISSUED` or `OVER_ISSUED` and `!line.HasValidDisposition`, return `VARIANCE_REQUIRES_RESOLUTION` (hoặc `OVERAGE_REQUIRES_RESOLUTION` để tương thích). Otherwise return `COMPLETE`.
2. In `ReconciliationActualService.cs`:
   - Remove the check `if (lineStatus.QuantityStatus != "OVER_ISSUED") throw new InvalidOperationException(...)`.
   - Replace with: `if (lineStatus.QuantityStatus == "EXACT") throw new InvalidOperationException("Dòng xuất đúng định mức không cần xử lý chênh lệch.");`

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~UnderIssued_Line_With_Valid_Disposition"`
Expected: PASS

- [ ] **Step 5: Run all reconciliation policy and service tests**

Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~Reconciliation"`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/IPCManagement.Api/Features/Reconciliation/Services/ backend/tests/IPCManagement.Api.Tests/
git commit -m "fix(reconciliation-be): allow bidirectional disposition for under-issued lines and complete daily status"
```

---

### Task 2: Frontend Reconciliation Station — Under-Issue Disposition & Transparent Blocker Panel

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Produces: Action button "Xử lý chênh lệch" enabled for `row.issuedRequiredDifference < 0` when `data.status !== 'COMPLETED'`.
- Produces: Preset reason chips in `ReconciliationDispositionModal.tsx` for under-issue ("Tiết kiệm định lượng tại bếp", "Hao hụt thực tế thấp hơn định mức", "Xác nhận theo thực tế sử dụng").
- Produces: Blocker Resolution Strip rendering when `data.status === 'IN_PROGRESS'` and `data.weeklyStatus !== 'WEEK_COMPLETE'`.

- [ ] **Step 1: Write failing test in `Reconciliation.test.tsx`**

```tsx
it('renders action button for under-issued lines and displays blocker panel when week is incomplete', async () => {
  // test asserting button "Xử lý chênh lệch" exists on negative variance row
  // test asserting blocker resolution strip is visible explaining missing prerequisites
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Reconciliation.test.tsx`
Expected: FAIL on missing button for negative difference or missing blocker panel

- [ ] **Step 3: Implement under-issue disposition & blocker strip in `ReconciliationPage.tsx`**

1. In column `action`:
   Replace lines 343-346:
   ```tsx
   if (row.issuedRequiredDifference != null && row.issuedRequiredDifference !== 0) {
     return (
       <Button
         variant="default"
         size="xs"
         onClick={() => setSelectedDispositionLine(row)}
         aria-label={`Xử lý chênh lệch ${row.materialName}`}
         disabled={isCompleted}
       >
         Xử lý chênh lệch
       </Button>
     );
   }
   ```
2. In `ReconciliationDispositionModal.tsx`:
   Add preset reason chips tailored for under-issue when difference < 0 ("Tiết kiệm định lượng tại bếp", "Hao hụt thực tế thấp hơn định mức", "Xác nhận số lượng thực xuất").
3. In `ReconciliationPage.tsx`:
   When `data?.status === 'IN_PROGRESS'` and `data.weeklyStatus !== 'WEEK_COMPLETE'`, render an informative Blocker Resolution Strip right below `TelemetrySubbar`:
   - Lists dates that are not `COMPLETE`.
   - Lists count of unresolved variance lines.
   - Provides shortcut button to filter unresolved lines.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Reconciliation.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/reconciliation/ frontend/src/__tests__/Reconciliation.test.tsx
git commit -m "feat(reconciliation-fe): enable under-issue disposition and add blocker resolution strip"
```

---

### Task 3: Warehouse Station — Supplemental Issue Workflow in MRX Daily Workbench

**Files:**
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Produces: Button "Xuất bổ sung ca" when `hasInitialIssue === true`.
- Produces: Modal or inline input enabling warehouse staff to enter supplemental quantities and required variance reasons.
- Calls: `mrxApi.createIssue({ isSupplemental: true, ... })`.

- [ ] **Step 1: Write failing test in `Warehouse.test.tsx`**

```tsx
it('allows warehouse staff to trigger supplemental issue when initial issue is completed', async () => {
  // test asserting button "Xuất bổ sung ca" is available after initial issue
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement supplemental issue flow in `MrxDailyIssueWorkbench.tsx`**

1. Add state `isSupplementalMode` (or modal state).
2. When `hasInitialIssue === true`, render button:
   `<Button variant="default" size="default" onClick={() => setIsSupplementalOpen(true)}>Xuất bổ sung ca</Button>`
3. Add a modal or inline input allowing the user to select materials, enter positive extra quantity, and mandatory reason ("Bổ sung do phát sinh trong ca nấu").
4. Submit via `mrxApi.createIssue({ ... payload, isSupplemental: true })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx frontend/src/__tests__/Warehouse.test.tsx
git commit -m "feat(warehouse-fe): add supplemental issue workflow in mrx daily workbench"
```

---

### Task 4: Coordinator Station — Auto-Complete Servings & Seamless Post-Transfer Navigation

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Produces: `publishMenu` and `checkQuantities` ensuring `quick-servings` exists with `complete: true`.
- Produces: Post-transfer notification banner featuring a direct navigation CTA button `[Mở trạm Kho xuất ngày]` linking to `/warehouse?view=mrx-daily&batchId=...`.

- [ ] **Step 1: Write failing test in `WeeklyMenu.test.tsx`**

```tsx
it('auto-completes servings when publishing menu in MRX and displays warehouse handoff CTA', async () => {
  // test asserting quick-servings is called if quantity plan is missing
  // test asserting CTA button exists on transfer success banner
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/WeeklyMenu.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement auto-servings fallback and handoff CTA in `MrxBatchWorkbench.tsx`**

1. In `publishMenu`:
   After publishing menu schedule, query schedules and call `apiClient('/coordination/meal-quantity-plans/quick-servings', { method: 'POST', body: JSON.stringify({ customerId, serviceDate: s.serviceDate, shiftName: s.shiftName, servings: 100, complete: true }) })` for each schedule line.
2. In `transfer`:
   Render banner with CTA button:
   ```tsx
   <div role="status" className="px-4 py-2 text-sm border-b border-emerald-200 bg-emerald-50 text-emerald-800 flex items-center justify-between">
     <span>Đã bàn giao lô đối soát sang Kho nguyên liệu thành công.</span>
     <Button size="xs" variant="outline" onClick={() => navigate(`/warehouse?view=mrx-daily&batchId=${batch?.batchId}&date=${weekStartDate}`)}>
       Mở trạm Kho xuất ngày
     </Button>
   </div>
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/WeeklyMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx frontend/src/__tests__/WeeklyMenu.test.tsx
git commit -m "feat(coordinator-fe): auto-complete servings on publish and add direct warehouse handoff CTA"
```

---

### Task 5: Full Regression & Headed E2E Mutation Sandbox Verification

**Files:**
- Execute: `npm run verify`
- Execute: `node scripts/run-mrx-e2e-mutation-test.mjs`
- Documentation update: `.planning/WORK.md` and `docs/handoff/HANDOFF.md`

- [ ] **Step 1: Run full verification suite**

Run: `npm run verify`
Expected: ALL 12 gates PASS (1,368 BE tests, 159+ FE tests, strict architecture growth, lint, build, conformance contracts)

- [ ] **Step 2: Run Headed E2E Mutation Test Suite on Sandbox DB**

Run: `node scripts/run-mrx-e2e-mutation-test.mjs`
Expected: 8/8 stages PASS in under 40 seconds on live Chromium with zero UUIDs and clean DB drop

- [ ] **Step 3: Update documentation and ledger**

Update `.planning/WORK.md` and `docs/handoff/HANDOFF.md` recording the unblocking completion and return to `IDLE`.

- [ ] **Step 4: Commit & Push**

```bash
git add .planning/WORK.md docs/handoff/HANDOFF.md
git commit -m "chore(release): complete mrx workflow unblocking and rule alignment program"
git push origin feature/greenfield-fe-3zone-workbench
```
