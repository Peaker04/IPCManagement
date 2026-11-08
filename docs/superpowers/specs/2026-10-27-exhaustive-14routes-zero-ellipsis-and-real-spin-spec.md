# Spec: Exhaustive 14-Route Conformance, Zero-Ellipsis Column Layout & Real Spin Lifecycle

- **Scope:** All 14 Canonical Routes & 25 Surfaces across IPCManagement (`frontend/src/features/*`, `frontend/src/components/*`)
- **Standards:** SAP Fiori / IBM Carbon / Nielsen Norman Group (NN/g 150ms Doherty Threshold) / SWR 3-Level Refreshing / Zero-CLS Enterprise Design
- **Architecture Limits:** Strictly $\le 600$ lines per source file; strictly $\le 1500$ lines per test file (`node scripts/check-architecture-growth.mjs`).

---

## 1. Problem Statement & Functional Requirements

The visual audit on Chromium revealed three core defect clusters:
1. **Mock Refresh Timers (AI Slop):** `ReconciliationPage.tsx` and `MrxBatchWorkbench.tsx` use artificial `setTimeout(() => setIsRefreshing(false), 300)` timers instead of synchronizing with the real asynchronous API Promise lifecycle.
2. **Ellipsis Truncation on Enterprise Tables:** In `reconciliationColumns.tsx`, column widths summed to 124%, and with CSS `table-fixed` and `overflow-hidden text-ellipsis`, long Vietnamese uppercase column headers (`NHU CẦU ĐÃ KHÓA`, `ĐÃ XUẤT THEO SỔ`, `CHÊNH LỆCH XUẤT`, `TRẠNG THÁI DÒNG`) were cut off with ellipses (`...`). Furthermore, unit names displayed raw `"Kilogram"` instead of standard `"kg"`.
3. **Leaked Developer Jargon & English Enums:** UI strings contained raw backend enums (`INITIAL_ISSUE`, `WEEK_COMPLETE`), technical terms (`append-only`, `stock movement`, `Rule DOM-MODE-1`, `theo dữ liệu Backend`), and enabled CSV download buttons on empty tables.

---

## 2. Design Invariants & Contracts

### 2.1. Real Spin Lifecycle (No Artificial Timers)
- The refresh spinner must reflect actual network activity.
- Remove all `setTimeout(..., 300)`.
- Tie `isRefreshing` strictly to `try { await queryFn(); } finally { setIsRefreshing(false); }` or directly to `stateProps.isFetching`.

### 2.2. Zero-Ellipsis Table Geometry
- Rebalance column width percentages to exact 100%.
- Assign explicit `minWidth` ($135\text{px}-145\text{px}$) to every column header containing multi-word Vietnamese phrases.
- Provide `minWidth="min-w-[1140px]"` on `DataGrid` in `ReconciliationPage.tsx` so the table container accommodates all columns without clipping headers.
- Format all units via `formatCanonicalUnit` (`Kilogram` $\rightarrow$ `kg`, `Gram` $\rightarrow$ `g`).

### 2.3. Enterprise Microcopy & Zero AI Slop
- Map all transaction types to localized Vietnamese Badges (`Xuất ban đầu`, `Xuất bổ sung`, `Hoàn trả kho`).
- Replace technical jargon with domain-appropriate enterprise wording.
- Disable CSV export buttons when `rows.length === 0`.
- Standardize `WorkspaceHeader` with consistent breadcrumbs across all 14 routes.

---

## 3. Verification Criteria

1. Zero occurrences of `setTimeout` for UI spinning states.
2. 0 column headers truncated with ellipses on standard 1440x900 resolution.
3. 0 occurrences of `INITIAL_ISSUE`, `WEEK_COMPLETE`, `(Audit Trail)`, or `stock movement` in rendered UI text.
4. All 37 physical modules verified in Gate A.
5. All 24 Vitest test files pass 100%.
6. All 63 Playwright browser tests pass 100%.
7. All 1,419 Backend C# tests pass 100%.
