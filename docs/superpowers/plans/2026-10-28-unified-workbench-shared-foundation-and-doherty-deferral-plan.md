# Unified Workbench Shared Foundation & NN/g Doherty Deferral Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eradicate rapid skeleton flickering (<150ms) via NN/g Doherty threshold deferral and eliminate ad-hoc duplicated UI styling across all MRX stations by introducing centralized compound components (`WorkspaceHeader.BadgeSlot`, `WorkspaceHeader.Actions`, and `DocumentCodeCell`).

**Architecture:**
1. Re-integrate `useDeferredSkeleton` (150ms delay, 250ms min duration) into `StateBoundary.tsx` to suppress skeleton flash during fast responses while guaranteeing steady 250ms hold when loading is prolonged.
2. Extend `WorkspaceHeader` with compound slots: `BadgeSlot` (`status`, `metric`, `mode`) and `Actions` to eliminate raw inline Tailwind classes.
3. Extract `DocumentCodeCell.tsx` into `components/workbench/` as the single authoritative component for clickable document codes and clipboard actions.
4. Refactor all MRX stations (`MrxBatch`, `MrxDaily`, `MrxCooking`, `Reconciliation`, `AdminData`, `AdvancedSettings`) onto the new shared foundation.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-unified-workbench-shared-foundation-and-doherty-deferral-spec.md`

## Global Constraints
- `DOM-MODE-1`: MRX mode isolation strictly preserved. Zero modification to DEFAULT-only workflows.
- Architecture Limits: 0 FE files > 600 lines (`node scripts/check-architecture-growth.mjs`), sub-tree branches $\le 250$ lines.
- Zero ad-hoc CSS tokens: Use only semantic tokens in `index.css`.

## Review Focus
1. **Fast Query (<150ms)**: Must NOT render `WorkbenchSkeleton` at all (0 skeleton frames).
2. **Slow Query (>150ms)**: Must render `WorkbenchSkeleton` and hold for at least 250ms.
3. **Badge Anchor Slot**: Must maintain fixed width whether badge is rendered or pending (`status`: 110px, `metric`: 140px, `mode`: 220px).
4. **Document Code Interaction**: Clicking code opens modal; clicking copy copies text with feedback and does NOT open modal.
5. **No Regressions**: Pre-commit Gate A-E and all 63 Playwright browser tests must pass.

---

### Task 1: Re-integrate NN/g Doherty Deferral in `StateBoundary.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Test: `frontend/src/__tests__/useDeferredSkeleton.test.ts`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

- [ ] **Step 1: Write/verify test for deferred skeleton suppression**
  Verify that when loading resolves in under 150ms, skeleton is suppressed, and when it exceeds 150ms, skeleton holds for at least 250ms.
- [ ] **Step 2: Update `StateBoundary.tsx` with `useDeferredSkeleton`**
  Re-wire `useDeferredSkeleton(Boolean(isLoading && !hasExistingData), skeletonDelay, 250)` so that initial cold queries do not flash skeleton rapidly.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/useDeferredSkeleton.test.ts src/__tests__/Primitives.test.tsx` and verify 100% PASS.

---

### Task 2: Build Centralized Compound Slots in `WorkspaceHeader.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/WorkspaceHeader.tsx`
- Test: `frontend/src/__tests__/ZeroJitterHeaderGeometry.test.tsx`

- [ ] **Step 1: Write unit tests for `WorkspaceHeader.BadgeSlot` and `WorkspaceHeader.Actions`**
  Add tests in `ZeroJitterHeaderGeometry.test.tsx` verifying that `BadgeSlot` maintains exact dimensions (`status`: 110px, `metric`: 140px, `mode`: 220px) and `Actions` renders stable flex container.
- [ ] **Step 2: Implement `BadgeSlot` and `Actions` on `WorkspaceHeader`**
  Export `HeaderBadgeSlot` and `HeaderActions` on `WorkspaceHeader`.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/ZeroJitterHeaderGeometry.test.tsx` and verify 100% PASS.

---

### Task 3: Build Centralized `DocumentCodeCell.tsx`

**Files:**
- Create: `frontend/src/components/workbench/DocumentCodeCell.tsx`
- Modify: `frontend/src/components/workbench/index.ts`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

- [ ] **Step 1: Write unit test for `DocumentCodeCell`**
  Verify that clicking the document code button invokes `onOpenDetail` and clicking the copy button copies to clipboard with `e.stopPropagation()`.
- [ ] **Step 2: Create `DocumentCodeCell.tsx` and export from barrel**
  Implement `DocumentCodeCell` with `<FileText size={12} />`, monospace underline text, and `<Copy size={12} />` toggle.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Primitives.test.tsx` and verify 100% PASS.

---

### Task 4: Refactor MRX & Shared Station Headers onto Centralized Slots

**Files:**
- Modify: `frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx`
- Modify: `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`
- Modify: `frontend/src/features/chef/branches/MrxCookingHeaderBranch.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx`
- Modify: `frontend/src/features/admin/AdminDataPage.tsx`
- Modify: `frontend/src/features/admin/AdvancedSettingsPage.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Step 1: Migrate `MrxBatchHeaderBranch.tsx` to `WorkspaceHeader.BadgeSlot` and `WorkspaceHeader.Actions`**
- [ ] **Step 2: Migrate `MrxDailyHeaderBranch.tsx` to `WorkspaceHeader.BadgeSlot` and `WorkspaceHeader.Actions`**
- [ ] **Step 3: Migrate `MrxCookingHeaderBranch.tsx` to `WorkspaceHeader.BadgeSlot` and `WorkspaceHeader.Actions`**
- [ ] **Step 4: Migrate `ReconciliationHeaderBranch.tsx` to `WorkspaceHeader.BadgeSlot` and `WorkspaceHeader.Actions`**
- [ ] **Step 5: Migrate `AdminDataPage.tsx` and `AdvancedSettingsPage.tsx` to `WorkspaceHeader.BadgeSlot` and `WorkspaceHeader.Actions`**
- [ ] **Step 6: Run Vitest unit tests across all feature modules**

---

### Task 5: Refactor `ReconciliationTransactionsBranch.tsx` to `DocumentCodeCell`

**Files:**
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationTransactionsBranch.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Step 1: Replace local inline `DocumentCodeCell` with shared import**
  Import `DocumentCodeCell` from `../../../components/workbench/DocumentCodeCell`.
- [ ] **Step 2: Run Vitest unit test**
  Run `npm run test:fe:unit -- src/__tests__/Reconciliation.test.tsx` and verify 100% PASS.

---

### Task 6: Full Stack Verification & Quality Gate Audit

**Files:**
- Verify: Full codebase

- [ ] **Step 1: Run pre-commit quality gate**
  Execute `npm run precommit:verify` (All 5 Gates: modules, forbidden patterns, architecture limits, build, 220+ Vitest tests).
- [ ] **Step 2: Run Playwright E2E browser tests**
  Execute `npx playwright test` (All 63 browser tests PASS).
- [ ] **Step 3: Verify architecture growth limits**
  Execute `node scripts/check-architecture-growth.mjs` (0 FE files > 600 lines).
- [ ] **Step 4: Update `.planning/WORK.md`**
  Record execution evidence, test results, and return task status to `IDLE`.
