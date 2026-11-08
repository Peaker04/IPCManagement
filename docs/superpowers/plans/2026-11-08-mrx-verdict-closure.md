# MRX Verdict Closure (V1–V3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not execute before owner approval; `.planning/WORK.md` is the sole task-state owner.

**Goal:** Close all three Ponytail review verdicts (`V1` uncached batch-only URL date resolution, `V2` truthful `WORK.md` technical receipt for T2, and `V3` Vietnamese locale rate formatting in `MrxSupplementalIssueModal`) without breaking any existing `P1–P5` or `T1–T5` guarantees.

**Architecture:** Apply surgical owner-level fixes in `useMrxDailyWorkspace.ts`, `MrxDailyIssueWorkbench.tsx`, and `MrxSupplementalIssueModal.tsx`, extend the existing `Warehouse.test.tsx` regression cases at the real router/API boundary, and reconcile `.planning/WORK.md` with the exact C# and TypeScript symbols.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library, Playwright (`BROWSER_FIXTURE`).

**Spec:** [2026-11-08-mrx-verdict-closure-design.md](../specs/2026-11-08-mrx-verdict-closure-design.md)

## Global Constraints

- Preserve all 31 existing modified files on `feature/ui-interaction-data-states` (`HEAD e0019978b2ce785945f4ea1a9514fc6bd0bde8f1`), empty git index, and zero destructive git operations.
- `DEFAULT != MATERIAL_RECONCILIATION` (`DOM-MODE-1`).
- Single Styling Authority (`frontend/src/styles/index.css`) and existing `<Num format="rate" />` primitive; no new UI components or CSS tokens.
- Emit **Scoped Pre-Code UI Gate Block** in chat before modifying any `.tsx` file.
- Enforce `ipc-test-audit` (`Rule TA-1` to `TA-5`): mock only at `apiClient`/`mrxApi` transport boundary, zero self-mocking, zero allowlist padding, and fail-closed unit-test network boundary (`setup.ts`).
- Do not stage, commit, push, run DB migrations, or restart processes unless explicitly authorized by the owner.

## Review Focus

1. Navigating from `batch-a` (`2026-10-19`) to an uncached `batch-unlisted` (`2026-11-02`) via `/warehouse?view=mrx-daily&batchId=batch-unlisted` (no `date` query parameter) must resolve `activeDate` to `2026-11-02` once `getWarehouseDaily('batch-unlisted')` resolves, rather than staying stuck on `2026-10-19`. Pin in Task 1 (`Warehouse.test.tsx`).
2. While `getWarehouseDaily('batch-unlisted')` is still in flight after a batch-only URL change, `canSubmit` must remain `false` (`isServiceDate('') === false`) so no issue POST can fire with an empty or stale date. Pin in Task 1 (`Warehouse.test.tsx`).
3. Opening `MrxSupplementalIssueModal` in `by-dish` mode for a material with `canonicalQtyPerServing = 0.0000004` must render `0,0000004` (never `4e-7`) and `canonicalQtyPerServing = null` must still render `—`. Pin in Task 2 (`Warehouse.test.tsx`).
4. Every C# method, property, and test string cited in `.planning/WORK.md` for `F2 / AC3 (T2)` and `F3 / AC4 (T3)` must exist in the codebase (`Select-String` verification). Pin in Task 3.

---

### Task 1: Resolve uncached batch switch without URL `date` and verify at router boundary (V1 / AC-V1)

**Files:**
- Modify: `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts:120-128`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx:192-201`
- Test: `frontend/src/__tests__/Warehouse.test.tsx:1183-1201`

**Interfaces:**
- Consumes: `useMrxDailyWorkspace({ batchId, serviceDate })` in `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`
- Produces: Unchanged hook return signature; `activeDate` resolves to `''` during an uncached batch-only transition and snaps to `daily.dates[0].serviceDate` when `daily` loads.

- [ ] **Step 1: Emit Scoped Pre-Code UI Gate Block in chat**

Before editing `.tsx` files, output the mandatory `Scoped Pre-Code UI Gate Block` for route `/warehouse` (`MrxDailyIssueWorkbench`, `MrxSupplementalIssueModal`).

- [ ] **Step 2: Extend `same_mounted_history_targets_the_visible_batch` in `frontend/src/__tests__/Warehouse.test.tsx` to fail on batch-only URL navigation**

In `frontend/src/__tests__/Warehouse.test.tsx:1184-1189`, change the navigation to `batch-unlisted` to omit `&date=2026-11-02` first:

```tsx
    // Explicit URL target missing from current catalog page without &date= param resolves to target batch's first service date (not stale batch-b date)
    await act(async () => {
      await router.navigate('/warehouse?view=mrx-daily&batchId=batch-unlisted');
    });
    expect(await screen.findByText('Cá lô ngoài trang 1')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ngày xuất kho' })).toHaveValue('02/11/2026');
```

- [ ] **Step 3: Run focused test to verify RED**

Run: `npm run test:fe:unit -- --run src/__tests__/Warehouse.test.tsx -t "same_mounted_history_targets_the_visible_batch"`
Expected: FAIL — `Unable to find an element with the text: Cá lô ngoài trang 1` (or `Ngày xuất kho` still has value `26/10/2026` from `batch-b` because `selectedDate` fell back to `2026-10-26`).

- [ ] **Step 4: Update `useMrxDailyWorkspace.ts` and `MrxDailyIssueWorkbench.tsx` to avoid falling back to the previous batch's date**

In `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts:120-128`, replace `|| selectedDate` with `|| ''`:

```ts
    } else if (explicitBatchId && explicitBatchId !== activeBatchId) {
      const cachedTarget = serverStateCache.get<MrxDailyCachedPayload>(`mrx_daily_${targetBatchId}`)?.data;
      const targetDaily = cachedTarget?.daily ?? cachedTarget?.data?.daily;
      const batchSummary = batches.find((item) => item.batchId === targetBatchId);
      const nextDate = (targetDaily?.batchId === targetBatchId ? targetDaily.dates[0]?.serviceDate : undefined)
        || batchSummary?.weekStartDate
        || '';
      setActiveDate(nextDate);
    }
```

In `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx:192-200`, only set `date` in `searchParams` when the new batch's date is known from cache or catalog summary, and delete `date` otherwise:

```tsx
            const cachedForNew = serverStateCache.get<{ daily: MrxWarehouseDaily | null; history: MrxIssuePage | null }>(`mrx_daily_${newId}`)?.data;
            const newDate = cachedForNew?.daily?.dates[0]?.serviceDate || b?.weekStartDate || '';
            setActiveDate(newDate);
            setSearchParams((curr) => {
              const next = new URLSearchParams(curr);
              next.set('batchId', newId);
              if (newDate) next.set('date', newDate);
              else next.delete('date');
              return next;
            });
```

- [ ] **Step 5: Run focused test to verify GREEN**

Run: `npm run test:fe:unit -- --run src/__tests__/Warehouse.test.tsx -t "same_mounted_history_targets_the_visible_batch"`
Expected: PASS (`1 passed`).

---

### Task 2: Render per-serving rate with `<Num format="rate" />` in `MrxSupplementalIssueModal.tsx` (V3 / AC-V3)

**Files:**
- Modify: `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx:236-238`
- Test: `frontend/src/__tests__/Warehouse.test.tsx:730-849`

**Interfaces:**
- Consumes: `<Num value={...} format="rate" />` from `frontend/src/components/ui/num.tsx`
- Produces: Vietnamese locale rate text (`0,0000004`) inside `MrxSupplementalIssueModal` by-dish material breakdown.

- [ ] **Step 1: Add rate display assertion to `supplemental by-dish preserves six decimals...` in `frontend/src/__tests__/Warehouse.test.tsx`**

In `frontend/src/__tests__/Warehouse.test.tsx:730-737` and `835`, assert the formatted per-serving rate for `rate = 0.0000004`:

```tsx
    if (!unmapped && rate === 0.0000004) {
      expect(within(screen.getByRole('dialog')).getByText('0,0000004', { exact: true })).toBeVisible();
      expect(within(screen.getByRole('dialog')).queryByText(/4e-7/i)).not.toBeInTheDocument();
    }
```

- [ ] **Step 2: Run focused test to verify RED**

Run: `npm run test:fe:unit -- --run src/__tests__/Warehouse.test.tsx -t "supplemental by-dish preserves six decimals"`
Expected: FAIL on `rate = 0.0000004` (`Unable to find an element with the text: 0,0000004`, because the modal currently renders `Thịt bò (4e-7 kg/suất)`).

- [ ] **Step 3: Replace raw interpolation with `<Num value={m.canonicalQtyPerServing} format="rate" />` in `MrxSupplementalIssueModal.tsx`**

In `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx:236-238`:

```tsx
                        <span className="font-medium text-slate-800">
                          {m.ingredientName} (<Num value={m.canonicalQtyPerServing} format="rate" /> {m.canonicalUnitName || 'Chưa rõ đơn vị'}/suất)
                        </span>
```

- [ ] **Step 4: Run focused test to verify GREEN**

Run: `npm run test:fe:unit -- --run src/__tests__/Warehouse.test.tsx -t "supplemental by-dish preserves six decimals"`
Expected: PASS (`6 passed`).

---

### Task 3: Reconcile `.planning/WORK.md` technical receipts and run integrated verification (V2 / AC-V2)

**Files:**
- Modify: `.planning/WORK.md:2-33`

**Interfaces:**
- Consumes: Actual C# symbols in `ReconciliationPreparationWorkbookExporter.cs` / `ReconciliationPreparationWorkbookTests.cs` and FE symbols in `useMrxDailyWorkspace.ts` / `MrxDailyIssueWorkbench.tsx` / `MrxSupplementalIssueModal.tsx`.
- Produces: Truthful, symbol-verified `.planning/WORK.md` top entry.

- [ ] **Step 1: Verify symbol mismatch in `.planning/WORK.md`**

Run: `Select-String -Path ".planning/WORK.md" -Pattern "BuildCustomerColumns|AggregatedLines|MenuCustomers|SUP-OTHER|SUP-NONE"`
Expected: Matches line 10 of `.planning/WORK.md` (confirming the stale symbols are present).

- [ ] **Step 2: Update `.planning/WORK.md` top section (`MRX review follow-through (T1–T5 / AC1–AC7) — 2026-11-08`)**

Update:
1. **F1 / AC1–AC2 (T1):** Note that batch switches without a URL `date` fall back to `''` (`onSelectBatch` deletes `date` from `URLSearchParams` when unknown) so `resolveActiveDate` snaps to `source.dates[0].serviceDate` once loaded.
2. **F2 / AC3 (T2):** Replace `BuildCustomerColumns(preparation, menus)` / `preparation.AggregatedLines` / `menus.MenuCustomers` / `SUP-OTHER` / `SUP-NONE` with the actual implementation: `RegisterCustomer(customerDefinitionsById, ...)` in `ReconciliationPreparationWorkbookExporter.cs` unioning `detailRows` and `query.IncludeMenus` batches (loaded via `ReconciliationKitchenExportService.GetAsync`), populating `0m` in `customerQtys` for menu-only customers, and verified in `ReconciliationPreparationWorkbookTests.GetWorkbookAsync_Filters_By_Supplier_Name_Maintaining_Parity` (`"Nhà cung cấp Rau Sạch"`, Customer B on `"Dầu Ăn Đa Nguồn"`, `"Món Khách A"` / `"Món Khách B"`, and unmatched supplier `"Nhà cung cấp Không Khớp"`).
3. **F3 / AC4 (T3):** Update caller inventory receipt (line 14) and owners list (line 12) to include `MrxSupplementalIssueModal.tsx` using `<Num value={m.canonicalQtyPerServing} format="rate" />`.

- [ ] **Step 3: Verify zero stale symbols remain in `.planning/WORK.md` and run full verification gates**

Run:
```powershell
Select-String -Path ".planning/WORK.md" -Pattern "BuildCustomerColumns|MenuCustomers|SUP-OTHER|SUP-NONE"
npm run test:fe:unit -- --run src/__tests__/Warehouse.test.tsx src/__tests__/RouteNavigationIntegrity.test.tsx src/__tests__/Chef.test.tsx src/__tests__/Reconciliation.test.tsx src/__tests__/Primitives.test.tsx
npm run build:fe
npm run lint:fe
git diff --check
git status --short --branch
```
Expected: `Select-String` returns empty; all FE unit suites, `build:fe`, `lint:fe`, and `git diff --check` exit `0`; `git status --short --branch` shows only the 31 tracked modified files with empty index.
