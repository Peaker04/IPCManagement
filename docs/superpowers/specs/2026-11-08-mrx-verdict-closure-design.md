# MRX Verdict Closure (V1–V3) — Design Spec

Date: 2026-11-08

**Document scope:** Requested spec and plan to close the three Ponytail review verdicts (`V1–V3`) identified after inspecting `2026-11-08-mrx-ponytail-data-flow-integrity` (`P1–P5`) and `2026-11-08-mrx-review-followthrough` (`T1–T5`). Per `AGENTS.md` and `brainstorming` `<HARD-GATE>`, this document proposes the design and plan only; product code edits and test runs require explicit owner approval of the plan. `.planning/WORK.md` remains the sole task-state owner.

**Plan:** [2026-11-08-mrx-verdict-closure.md](../plans/2026-11-08-mrx-verdict-closure.md)

## 1. Intent and Evidence

The Ponytail review verified that all core data-flow and display chains in `P1–P5` and `T1–T5` work end-to-end, and surfaced three bounded follow-up items (`V1–V3`):

| ID | Severity | Finding | Owner files |
|---|---|---|---|
| **V1** | Should fix | Switching to an uncached batch via a batch-only URL (`/warehouse?view=mrx-daily&batchId=B` without `date`) or before catalog metadata is available falls back to the previous batch's `selectedDate`, leaving the new batch stuck on an out-of-range service date (`Ngày đã chọn nằm ngoài tuần của lô`). | `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`, `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`, `frontend/src/__tests__/Warehouse.test.tsx` |
| **V2** | Should fix | `.planning/WORK.md` line 10 (`F2 / AC3 (T2)`) cites non-existent symbols (`BuildCustomerColumns`, `preparation.AggregatedLines`, `menus.MenuCustomers`, `SUP-OTHER`, `SUP-NONE`) instead of the actual exporter implementation (`RegisterCustomer`, `customerDefinitionsById`, `detailRows`, `ReconciliationKitchenExportService.GetAsync`) and actual test cases (`"Nhà cung cấp Rau Sạch"`, `"Nhà cung cấp Không Khớp"`). | `.planning/WORK.md` |
| **V3** | Nice to have | `MrxSupplementalIssueModal.tsx` line 237 interpolates `${m.canonicalQtyPerServing ?? '—'}` directly as a raw JS number, causing sub-micro rates (`0.0000004`) to render in scientific notation (`4e-7 kg/suất`) instead of Vietnamese locale (`0,0000004 kg/suất`) via `<Num format="rate" />`. | `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx`, `frontend/src/__tests__/Warehouse.test.tsx` |

## 2. Goals, Non-Goals, and Anti-Goals

- **Goals:**
  1. Ensure batch switches without an explicit target date resolve cleanly to the target batch's first service date (`source.dates[0].serviceDate`) once loaded, never leaking the previous batch's service date into `selectedDate` or URL `?date=`.
  2. Format per-serving rates inside `MrxSupplementalIssueModal` using `<Num value={m.canonicalQtyPerServing} format="rate" />` so all three canonical per-serving rate displays (Chef cooking table, Dish Inspector modal, and Supplemental by-dish breakdown) render identical Vietnamese locale numbers (`0,0000004`).
  3. Reconcile the `F2 / AC3 (T2)` technical receipt in `.planning/WORK.md` with the exact C# methods and test cases in `ReconciliationPreparationWorkbookExporter.cs` and `ReconciliationPreparationWorkbookTests.cs`.
- **Non-Goals:**
  - Changing backend endpoints, DTOs, EF migrations, or workbook builder contracts.
  - Modifying `P1–P5` or `T1–T5` business rules (`DOM-MODE-1`, 6-decimal final quantity rounding, sticky unknown-write lock, fail-closed test fetch boundary).
- **Anti-Goals:**
  - Do not remount `WarehousePage` or `MrxDailyIssueWorkbench` by URL search key (which would destroy pending/outcome-unknown write protection).
  - Do not overwrite an explicit URL `date` parameter when one is intentionally supplied (`?batchId=B&date=2026-11-02`).

## 3. Global Constraints

- Preserve all 31 existing modified files on `feature/ui-interaction-data-states` (`HEAD e0019978b2ce785945f4ea1a9514fc6bd0bde8f1`), empty index, and zero untracked test artifacts.
- `DEFAULT != MATERIAL_RECONCILIATION` (`DOM-MODE-1`).
- Single Styling Authority (`frontend/src/styles/index.css`) and existing UI primitives (`<Num format="rate" />`).
- Emit **Scoped Pre-Code UI Gate Block** before any `.tsx` edit during execution.
- Follow `ipc-test-audit` (`Rule TA-1` to `TA-5`): real router/hook boundary, no self-mocking, zero allowlist padding.

## 4. Technical Design by Verdict

### 4.1 V1 — Uncached Batch Switch Without URL `date` (`FR-WH`)

- **Current behavior:**
  - In `useMrxDailyWorkspace.ts:120-128`, when `routeMismatch && !scopeLocked` runs for a batch change without `explicitDate`, `nextDate` computes:
    ```ts
    const nextDate = (targetDaily?.batchId === targetBatchId ? targetDaily.dates[0]?.serviceDate : undefined)
      || batchSummary?.weekStartDate
      || selectedDate;
    ```
    When `targetBatchId` is neither in `serverStateCache` nor in the current `batches` page (e.g., navigating via `/warehouse?view=mrx-daily&batchId=batch-unlisted`), `nextDate` falls back to `selectedDate` (the old batch's service date). Then `resolveActiveDate(source)` sees `selectedDate` is non-empty, checks `source.dates.some(d => d.serviceDate === candidate)`, and while `source` is still `null` (loading), `activeDate` stays equal to the old batch's date. Even worse, in `MrxDailyIssueWorkbench.tsx:192-200`, `onSelectBatch` falls back to `activeDate` and writes `next.set('date', newDate)` into `searchParams`, which makes `urlDate` non-null and forces `resolveActiveDate` (`line 133: if (urlDate === selectedDate && urlDate) return candidate;`) to lock onto the old batch's date even after `source` loads!
- **Design fix:**
  1. In `useMrxDailyWorkspace.ts:120-128`: when `explicitBatchId && explicitBatchId !== activeBatchId` and `!explicitDate`, compute:
     ```ts
     const nextDate = (targetDaily?.batchId === targetBatchId ? targetDaily.dates[0]?.serviceDate : undefined)
       || batchSummary?.weekStartDate
       || '';
     setActiveDate(nextDate);
     ```
  2. In `useMrxDailyWorkspace.ts:131-136` (`resolveActiveDate`): when `candidate` is `''`, `!source?.dates.length` returns `''`, and once `source` loads with `dates.length > 0`, `!candidate` is not in `source.dates`, so it returns `source.dates[0].serviceDate`.
  3. In `MrxDailyIssueWorkbench.tsx:192-200` (`onSelectBatch`): compute `knownDate = cachedForNew?.daily?.dates[0]?.serviceDate || b?.weekStartDate || ''`. Call `setActiveDate(knownDate)`. In `setSearchParams`, if `knownDate` is non-empty, `next.set('date', knownDate)`; otherwise `next.delete('date')` so the URL does not pin the previous batch's date.
- **Acceptance (`AC-V1`):** Navigating on the same mounted `MrxDailyIssueWorkbench` from `batch-a` (`2026-10-19`) to an uncached `batch-unlisted` via a batch-only URL (`/warehouse?view=mrx-daily&batchId=batch-unlisted`, no `date` param) resolves `activeDate` and the `Ngày xuất kho` input to `batch-unlisted`'s first service date (`02/11/2026`) once its daily payload arrives, and subsequent initial issue submission posts `issueDate: '2026-11-02'`.

### 4.2 V2 — Truthful Technical Receipt in `.planning/WORK.md` (`Governance`)

- **Current issue:** `.planning/WORK.md` lines 9–10 describe `F2 / AC3 (T2)` using symbol names from an earlier draft (`BuildCustomerColumns`, `preparation.AggregatedLines`, `menus.MenuCustomers`, `SUP-OTHER`, `SUP-NONE`).
- **Design fix:** Replace lines 9–10 of `.planning/WORK.md` with the exact production symbols in `ReconciliationPreparationWorkbookExporter.cs` (`RegisterCustomer(customerDefinitionsById, ...)` unioning `detailRows` and `query.IncludeMenus` batches via `ReconciliationKitchenExportService.GetAsync`, populating `0m` in `customerQtys` for menu-only customers) and the exact test cases in `ReconciliationPreparationWorkbookTests.cs` (`GetWorkbookAsync_Filters_By_Supplier_Name_Maintaining_Parity` with `"Nhà cung cấp Rau Sạch"`, Customer B on `"Dầu Ăn Đa Nguồn"`, `"Món Khách A"` / `"Món Khách B"`, and unmatched supplier `"Nhà cung cấp Không Khớp"`).
- **Acceptance (`AC-V2`):** Every method name, property name, and test literal cited in `.planning/WORK.md` for T1–T5 exists verbatim in the repository.

### 4.3 V3 — Vietnamese Rate Formatting in `MrxSupplementalIssueModal.tsx` (`FR-WH` / `T3`)

- **Current behavior:** `MrxSupplementalIssueModal.tsx:237` renders:
  ```tsx
  {m.ingredientName} ({m.canonicalQtyPerServing ?? '—'} {m.canonicalUnitName || 'Chưa rõ đơn vị'}/suất)
  ```
  For `canonicalQtyPerServing = 0.0000004`, JS string interpolation produces `Thịt bò (4e-7 kg/suất)`.
- **Design fix:** Replace `{m.canonicalQtyPerServing ?? '—'}` with `<Num value={m.canonicalQtyPerServing} format="rate" />`:
  ```tsx
  {m.ingredientName} (<Num value={m.canonicalQtyPerServing} format="rate" /> {m.canonicalUnitName || 'Chưa rõ đơn vị'}/suất)
  ```
  Update the caller inventory note in `.planning/WORK.md` line 14 to reflect that all three canonical rate displays (`MrxCookingDishListBranch.tsx`, `MrxBatchDishesModal.tsx`, and `MrxSupplementalIssueModal.tsx`) now use `<Num format="rate" />`.
- **Acceptance (`AC-V3`):** In `Warehouse.test.tsx` (`supplemental by-dish preserves six decimals...`), when `rate = 0.0000004`, the dialog displays `0,0000004` (and never `4e-7`) for the per-serving rate alongside `0,0004` for the total quantity.

## 5. Builder Self-Check Summary

Reviewed this design against `AGENTS.md`, `docs/DESIGN.md`, and the connected callers:
- **Answered by codebase:** `VietnameseDateInput` already accepts `value=""` when no date is resolved yet (`activeDate === 'ALL' ? ... : activeDate`), and `canSubmit` already checks `isServiceDate(activeDate)` which returns `false` for `''`, keeping submission safely disabled while the uncached batch is loading.
- **Minor calls settled in design:** `onSelectBatch` deletes `date` from `URLSearchParams` only when neither cached daily dates nor `b.weekStartDate` is available; for normal catalog batches where `b.weekStartDate` exists, URL `?date=` continues to be set immediately.
- **Owner approval gate:** No product files or tests have been modified in this turn. Implementation awaits owner approval of the companion plan.
