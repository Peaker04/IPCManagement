# MRX Frontend Architecture Audit Closure (E1–E9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. `.planning/WORK.md` is the sole task-state owner.

**Goal:** Close all nine MRX Frontend Architecture Ponytail Audit findings (`E1–E9`, covering Must fix `#1–#4`, Should fix `#5–#8`, and Nice to have `#9`) across all MRX Frontend routes.

**Architecture:** Execute surgical updates at canonical Frontend owners in two self-contained tasks: (1) SWR Cache & Snapshot Coherence (`E1`, `E2`, `E6`, `E9`) across `mrxCacheInvalidation.ts`, `useWorkbenchQuery.ts`, `useReconciliationWorkspace.ts`, `useMrxSourceEdit.ts`, `MrxCookingWorkbench.tsx`, `MrxBatchDishesModal.tsx`, and `ReconciliationIssueDetailModal.tsx`; and (2) URL-as-SSOT Synchronization, Smooth Unkeyed Scope Switching, and Component-Level `DOM-MODE-1` Guards (`E3`, `E4`, `E5`, `E7`, `E8`) across `WeeklyMenuPage.tsx`, `useMrxBatchWorkspace.ts`, `useReconciliationWorkspace.ts`, `MrxCookingWorkbench.tsx`, `WarehousePage.tsx`, and `ChefDashboardPage.tsx`, followed by full Vitest/lint/build verification and `.planning/WORK.md` closure.

**Tech Stack:** React 19, TypeScript, React Router, Vitest, Testing Library.

**Spec:** [2026-11-09-mrx-fe-architecture-closure-design.md](../specs/2026-11-09-mrx-fe-architecture-closure-design.md)

## Global Constraints

- Preserve all inherited changes on `main` (`HEAD bbd55009a77a6e83f79027a7784deb4b7f323928`), empty git index, and zero destructive git operations.
- `DEFAULT != MATERIAL_RECONCILIATION` (`DOM-MODE-1`).
- Single Styling Authority (`frontend/src/styles/index.css`) and existing UI primitives.
- Emit **Scoped Pre-Code UI Gate Block** in chat before modifying any `.tsx` file.
- Enforce `ipc-test-audit` (`Rule TA-1` to `TA-5`): mock only at transport/API boundary, zero component self-mocking, zero allowlist padding, fail-closed unit-test network boundary.
- Do not stage, commit, push, run DB migrations, or install packages unless explicitly authorized by the owner.

## Review Focus

1. Calling `invalidateMrxCaches()` after a disposition or warehouse issue must evict the reconciliation workspace snapshot (`'snapshot:mrx_reconciliation'` and legacy `'snapshot:reconciliation'`) so remounting `/reconciliation` never renders stale pre-mutation lines on Render #1. Pin in Task 1 (`Reconciliation.test.tsx`).
2. Switching `useWorkbenchQuery` from `cacheKey="mrx_test_a"` to `"mrx_test_b"` and back to warm `"mrx_test_a"`, then advancing time past the 60s TTL and re-rendering, must keep rendering `"mrx_test_a"`'s data (`isPreviousData === false`) instead of reverting to `"mrx_test_b"`. Pin in Task 1 (`Render1CacheHitVerification.test.tsx`).
3. Navigating on `/reconciliation` when `searchParams` changes `?customerId=customer-2` while mounted must switch `customerCode` to `customer-2`, and selecting `customer-2` via `handleSelectCustomer` must write `customerId=customer-2` into `searchParams` and reset `lineStatusFilter` to `'ALL'`. Pin in Task 2 (`Reconciliation.test.tsx`).
4. Importing a menu or switching week/customer on `/weekly-menu?view=mrx-batch` (`WeeklyMenuPage`) must update scope in-place without unmounting `<MrxBatchWorkbench />` or re-fetching `weeklyMenuApi.getCustomers()` / `adminApi.getDishes()`. Pin in Task 2 (`WeeklyMenu.test.tsx`).
5. Navigating to `/warehouse?view=mrx-daily` or `/chef?view=mrx-cooking` when `operationalMode === 'DEFAULT'` must redirect to `/forbidden`, and clicking `/chef?view=mrx-cooking` (without `batchId`) after viewing `?batchId=batch-2` must retain `batch-2` and sync `?batchId=batch-2` to the URL. Pin in Task 2 (`Warehouse.test.tsx` and `Chef.test.tsx`).

---

### Task 1: SWR Cache & Snapshot Coherence, Dish Catalog Caching, and Modal Read Caching (E1, E2, E6, E9)

**Files:**
- Modify: `frontend/src/api/mrxCacheInvalidation.ts:1-7`
- Modify: `frontend/src/hooks/useWorkbenchQuery.ts:197-206`
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:33, 76-85, 290-314`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts:33-53`
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx:41-46`
- Modify: `frontend/src/components/workbench/MrxBatchDishesModal.tsx:32-63, 88-94`
- Modify: `frontend/src/components/workbench/ReconciliationIssueDetailModal.tsx:26-56`
- Test: `frontend/src/__tests__/Render1CacheHitVerification.test.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `serverStateCache` from `frontend/src/store/serverStateCache.ts`
- Produces:
  - `invalidateMrxCaches()` clears `'mrx_'`, `'snapshot:mrx_'`, and `'snapshot:reconciliation'`.
  - `useReconciliationWorkspace` uses `'snapshot:mrx_reconciliation'`, checks `serverStateCache.get(reconCacheKey)` before snapshot fallback, and updates the snapshot inside `handleComplete`.
  - `useWorkbenchQuery` updates `setDataState(payload)` and `setResolvedCacheKey(cacheKey)` on warm-cache `cacheKey` transitions so TTL expiry never reverts to the previous key's `stateData`.
  - `useMrxSourceEdit` caches `DishOption[]` under `'mrx_catalog_dishes'` in `serverStateCache`.
  - `MrxBatchDishesModal` and `ReconciliationIssueDetailModal` cache responses under `mrx_batch_dishes_${batchId}` and `mrx_issue_detail_${issueId}` in `serverStateCache`.

- [x] **Step 1: Write failing tests for `E1`, `E2`, `E6`, and `E9` in `Render1CacheHitVerification.test.tsx`, `Reconciliation.test.tsx`, and `WeeklyMenu.test.tsx`**
- [x] **Step 2: Run focused Vitest suites to verify RED**
- [x] **Step 3: Emit Scoped Pre-Code UI Gate Block and implement fixes in `mrxCacheInvalidation.ts`, `useWorkbenchQuery.ts`, `useReconciliationWorkspace.ts`, `useMrxSourceEdit.ts`, `MrxCookingWorkbench.tsx`, `MrxBatchDishesModal.tsx`, and `ReconciliationIssueDetailModal.tsx`**
- [x] **Step 4: Run focused Vitest suites to verify GREEN**

---

### Task 2: URL-as-SSOT Synchronization, Smooth Unkeyed Scope Switching, and Component-Level `DOM-MODE-1` Guards (E3, E4, E5, E7, E8)

**Files:**
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:36-45, 327-368`
- Modify: `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx:58-63`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts:156-190`
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx:33-40, 65-110`
- Modify: `frontend/src/features/chef/ChefDashboardPage.tsx:29-46`
- Modify: `frontend/src/features/warehouse/WarehousePage.tsx:26-53`
- Modify: `.planning/WORK.md`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Consumes: Task 1 cache/snapshot primitives
- Produces:
  - `useReconciliationWorkspace` synchronizes `customerCode` and `lineStatusFilter` with `searchParams` (`customerId`, `lineStatus`), writes `customerId` to `searchParams` in `handleSelectCustomer`, and clears `lineStatus` when switching batches.
  - `WeeklyMenuPage` renders `<MrxBatchWorkbench />` without a remount `key`, keeping the workbench mounted across customer/week changes and menu imports.
  - `MrxCookingWorkbench` syncs `fallbackBatchId` with `urlBatchId` and restores `?batchId=` in `searchParams` when navigating to `/chef?view=mrx-cooking` without a query param.
  - `WarehousePage` and `ChefDashboardPage` redirect `?view=mrx-*` to `/forbidden` when `operationalMode !== 'MATERIAL_RECONCILIATION'`.

- [x] **Step 1: Write failing tests for `E3`, `E4`, `E5`, `E7`, and `E8` in `Reconciliation.test.tsx`, `WeeklyMenu.test.tsx`, `Chef.test.tsx`, and `Warehouse.test.tsx`**
- [x] **Step 2: Run focused Vitest suites to verify RED**
- [x] **Step 3: Emit Scoped Pre-Code UI Gate Block and implement fixes in `useReconciliationWorkspace.ts`, `WeeklyMenuPage.tsx`, `useMrxBatchWorkspace.ts`, `MrxCookingWorkbench.tsx`, `ChefDashboardPage.tsx`, and `WarehousePage.tsx`**
- [x] **Step 4: Run full Vitest suites, `npm run lint`, `npm run build`, and `git diff --check` to verify GREEN and update `.planning/WORK.md`**
