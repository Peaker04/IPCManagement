# Exhaustive 14-Route Conformance, Zero-Ellipsis & Real Spin Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all artificial refresh timers, resolve table header ellipsis truncations, clean up leaked developer jargon across all 14 routes, and verify with exhaustive multi-viewport browser tests and image inspections.

**Architecture:** Wire refresh button spinners directly to the async Promise lifecycle; rebalance DataGrid column geometries with explicit minWidths and canonical unit formatters; replace raw enums with localized Badge mappers; capture and visually verify screenshots across all canonical routes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-exhaustive-14routes-zero-ellipsis-and-real-spin-spec.md`

## Global Constraints

- Operational Mode Isolation (`DOM-MODE-1`): DEFAULT != MATERIAL_RECONCILIATION.
- Architecture limits: Strictly $\le 600$ lines per FE source file; $\le 1500$ lines per test file.
- Zero-CLS & Zero-Skeleton Strobe: 0ms cache hydration on Render #1.
- No orphan code: Any hook or utility must have active production callers.

## Review Focus

- Manual refresh button: Must spin during actual fetch and stop immediately when API resolves, with 0 fake timeouts.
- Column headers in Reconciliation: All headers must display 100% full text without `...` on desktop viewports.
- Unit names: Must display `kg`, `g`, `cái`, never raw English strings like `Kilogram`.
- Transaction types: Must display localized Vietnamese badges (`Xuất ban đầu`, `Xuất bổ sung`, `Hoàn trả kho`).
- CSV export buttons: Must be disabled when table has 0 rows.

---

### Task 1: Eliminate Artificial Refresh Timers & Bind Real Spin Lifecycles

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [ ] In `ReconciliationPage.tsx`, replace `setTimeout(() => setIsRefreshing(false), 300)` with an `async / try / finally` block on `handleRefresh`.
- [ ] In `MrxBatchWorkbench.tsx`, replace `setTimeout(() => setIsRefreshing(false), 300)` with an `async / try / finally` block on `handleRefresh`.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx src/__tests__/WeeklyMenu.test.tsx` and verify all tests pass.

---

### Task 2: Zero-Ellipsis Column Layout & Canonical Unit Formatting

**Files:**
- Modify: `frontend/src/features/reconciliation/reconciliationColumns.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] In `reconciliationColumns.tsx`, balance column width percentages to exact 100% and add `minWidth` ($135\text{px}-145\text{px}$) to `required`, `issued`, `difference`, and `status`.
- [ ] In `reconciliationColumns.tsx`, wrap `row.unit` with `formatCanonicalUnit` to convert `Kilogram` $\rightarrow$ `kg`.
- [ ] In `ReconciliationPage.tsx`, ensure `<DataGrid>` passes `minWidth="min-w-[1140px]"`.
- [ ] In `ReconciliationReportTables.tsx`, format unit names with `formatCanonicalUnit` across variance, transaction, and completed tables.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx` and verify all tests pass.

---

### Task 3: Purge Leaked Developer Jargon & English Enums Across Surfaces

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`
- Modify: `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx`
- Modify: `frontend/src/features/admin/AdvancedSettingsPage.tsx`
- Modify: `frontend/src/features/auth/ForbiddenPage.tsx`
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`

- [ ] In `ReconciliationReportTables.tsx`, map `transactionType` to localized Badges: `Xuất ban đầu`, `Xuất bổ sung`, `Hoàn trả kho`.
- [ ] In `ReconciliationReportTables.tsx`, replace `WEEK_COMPLETE`, `append-only`, and `(Audit Trail)` with clean Vietnamese copy.
- [ ] In `ReconciliationReportTables.tsx`, disable CSV download buttons when record count is 0.
- [ ] In `MrxSourceDeltaWorkbench.tsx`, replace `stock movement` with `biến động tồn kho`.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx src/__tests__/Chef.test.tsx` and verify all tests pass.

---

### Task 4: Author Exhaustive 14-Route Screenshot Script & Perform Visual Inspections

**Files:**
- Create: `scripts/capture-all-canonical-routes.mjs`
- Capture: 25 screens across 14 routes
- Inspection: Inspect screenshots via `read` tool

- [ ] Create `scripts/capture-all-canonical-routes.mjs` mapping all 14 routes and subviews in both `DEFAULT` and `MATERIAL_RECONCILIATION` modes.
- [ ] Execute `node scripts/capture-all-canonical-routes.mjs`.
- [ ] Inspect captured screenshots using `read` to confirm zero truncation, zero raw enums, and clean layouts.

---

### Task 5: Final Cross-Layer Verification & Pre-Commit Gates

**Files:**
- Audit: All modified files
- Script: `scripts/verify-precommit-gate.mjs`

- [ ] Run `node scripts/check-architecture-growth.mjs` (0 files > 600 lines).
- [ ] Run `npm run precommit:verify` (Gates A-E pass 100%).
- [ ] Run `npx playwright test` (63/63 tests pass 100%).
- [ ] Run `dotnet test backend/IPCManagement.slnx` (1,419 tests pass 100%).
- [ ] Update `.planning/WORK.md`.
