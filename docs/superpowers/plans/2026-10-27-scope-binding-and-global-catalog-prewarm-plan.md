# Scope Binding, Entity Auto-Select & Global Catalog Pre-warm Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Scope Binding Invariant to prevent date-jump flickers, auto-select first entities in master-detail views, pre-warm customer catalogs globally at Frame 0, and verify across all 14 routes.

**Architecture:** Bind initial `serviceDate` strictly to `batch.weekStartDate` when calendar today is outside the batch scope; pre-warm `catalog_customers` in `authContext.tsx` with sessionStorage backing; default `selectedOrderId` to the first PO in `PurchasingPage.tsx`; verify with Vitest, Playwright, and cold-start MutationObserver test scripts.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-scope-binding-and-global-catalog-prewarm-spec.md`

## Global Constraints

- Operational Mode Isolation (`DOM-MODE-1`): DEFAULT != MATERIAL_RECONCILIATION.
- Architecture limits: Strictly $\le 600$ lines per FE source file; $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`).
- Zero-CLS: 0px layout shift on all data transitions.
- No orphan code: All components and utilities must have active production callers.

## Review Focus

- MrxDailyIssueWorkbench: Must NOT default date to calendar today if today is outside batch week; must initialize to batch date at 0ms.
- PurchasingPage: Detail panel on right must populate with the first PO's lines on load instead of displaying an empty placeholder.
- Global Catalog Pre-warm: `cachedCustomers` must be available at Frame 0 from `sessionStorage`.
- Full Suite Conformance: All 206+ unit tests and 63 Playwright tests must remain green.

---

### Task 1: Implement Global Customer Catalog Pre-warming in `authContext.tsx`

**Files:**
- Modify: `frontend/src/store/authContext.tsx`
- Test: `frontend/src/__tests__/Auth.test.tsx`

- [ ] In `authContext.tsx`, invoke `weeklyMenuApi.getCustomers()` on session load and persist to `serverStateCache.set('catalog_customers', ...)` with snapshot backing.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Auth.test.tsx` and verify all tests pass.

---

### Task 2: Implement Scope Binding Invariant in MRX Workbenches

**Files:**
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] In `MrxDailyIssueWorkbench.tsx`, compute effective service date purely: if calendar today is not in `batch.dates`, default to `batch.dates[0].serviceDate` or `batch.weekStartDate` at 0ms (never mutate state inside `queryFn`).
- [ ] In `MrxMultiCustomerPreparationWorkbench.tsx`, derive initial date from latest available batch week if today has no batches.
- [ ] In `ReconciliationPage.tsx`, resolve `serviceDate` synchronously from the selected batch's `weekStartDate`.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx src/__tests__/Reconciliation.test.tsx` and verify all tests pass.

---

### Task 3: Auto-Select First PO in `PurchasingPage.tsx`

**Files:**
- Modify: `frontend/src/features/purchasing/PurchasingPage.tsx`
- Test: `frontend/src/__tests__/Purchasing.test.tsx`

- [ ] In `PurchasingPage.tsx`, default `selectedOrderId` to `filteredOrders[0]?.purchaseOrderId` when no order is currently selected.
- [ ] Ensure the right detail panel renders the selected PO lines immediately on initial load.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Purchasing.test.tsx` and verify all tests pass.

---

### Task 4: Empirical Cold-Start & MutationObserver Verification

**Files:**
- Script: `scripts/test-all-cold-starts.mjs`
- Script: `scripts/reproduce-first-load-trace.mjs`

- [ ] Run `node scripts/test-all-cold-starts.mjs` to verify zero empty flashes and zero date jumps.
- [ ] Run `node scripts/reproduce-first-load-trace.mjs` to verify smooth atomic mounting.

---

### Task 5: Final Multi-Layer Verification & Pre-Commit Gates

**Files:**
- Script: `scripts/verify-precommit-gate.mjs`
- Script: `scripts/check-architecture-growth.mjs`

- [ ] Run `node scripts/check-architecture-growth.mjs` (strictly $\le 600$ lines per FE file).
- [ ] Run `npm run precommit:verify` (Gates A-E pass 100%).
- [ ] Run `npx playwright test` (63/63 browser tests pass 100%).
- [ ] Run `dotnet test backend/IPCManagement.slnx` (1,419 tests pass 100%).
- [ ] Update `.planning/WORK.md`.
