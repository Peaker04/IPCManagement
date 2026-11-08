# MRX Role-Based Native Tree Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a fully decoupled, zero-jitter, 4-tier Native Tree Architecture across all 10 stations of the Material Reconciliation (`MATERIAL_RECONCILIATION`) subsystem and its 2 shared administrative surfaces, eliminating skeleton flickering, badge jumping, and cold-reload layout shifts.

**Architecture:**
Decompose each MRX station into single-responsibility sub-tree branches under `<WorkspaceFrame.Root>`, enforce synchronous 0ms Render #1 cache hydration through dual-tier L1 (RAM) + L2 (`sessionStorage`) SWR caching, lock header geometry with reserved badge and action anchor slots, and isolate operational mode integrity under `DOM-MODE-1`.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-mrx-role-based-native-tree-architecture-spec.md`

## Global Constraints
- **Operational Mode Isolation (`DOM-MODE-1`)**: Strict separation between `DEFAULT` and `MATERIAL_RECONCILIATION`. Zero DEFAULT route pollution.
- **Architecture Limits**: All frontend source files strictly $\le 600$ lines (`node scripts/check-architecture-growth.mjs`), sub-tree branches $\le 250$ lines.
- **Zero-CLS**: Every station header is fixed at 56px (`h-14`), Subbar is fixed at 44px (`h-11`), reserved badge slots are fixed at `min-w-[110px]` / `min-w-[140px]`.
- **Zero Tautological Tests**: Adhere strictly to `ipc-test-audit` invariants (TA-1 to TA-5).

## Review Focus
1. **Coordinator Station (`/weekly-menu?view=mrx-batch`)**: When switching customers or weeks, secondary and primary action buttons must not cause the action bar to jump horizontally.
2. **Warehouse Station (`/warehouse?view=mrx-daily`)**: Switching between the 7 weekday tabs must never unmount the header or flash an intermediary skeleton.
3. **Head Chef Station (`/chef?view=mrx-cooking`)**: Switching shifts (Morning/Afternoon) must filter recipes instantly with 0ms transition.
4. **Reconciliation Auditor (`/reconciliation`)**: Switching between all 5 subviews (`lines`, `variances`, `transactions`, `audit`, `completed`) must retain the fixed 44px Subbar without vertical jumping, and F5 must never flash `(Chưa có lô đối soát)` or 0 counts in queue cards.
5. **Shared Surfaces (`/admin-data`, `/settings/advanced`)**: Badge count changes must never push search inputs or adjacent controls.

---

### Task 1: Role 1 — Coordinator Station (`/weekly-menu?view=mrx-batch`) Stabilization

**Files:**
- Modify: `frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [ ] **Step 1: Write/update unit test in `WeeklyMenu.test.tsx`**
  Verify that `MrxBatchHeaderBranch` action container retains stable width and structure when `batch` and `primaryAction` mount asynchronously.
- [ ] **Step 2: Stabilize action button container in `MrxBatchHeaderBranch.tsx`**
  Wrap action buttons in a stable flex layout with fixed alignment so asynchronous mounting of "Món ăn trong lô", "Xem thay đổi", and primary action does not cause horizontal layout shifts.
- [ ] **Step 3: Run Vitest unit test**
  Run `npm run test:fe:unit -- src/__tests__/WeeklyMenu.test.tsx` and verify 100% PASS.

---

### Task 2: Role 2 — Warehouse Stations (`/warehouse?view=mrx-daily|prep|issues`) Stabilization

**Files:**
- Modify: `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`
- Modify: `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

- [ ] **Step 1: Write/update unit tests in `Warehouse.test.tsx`**
  Verify that `MrxDailyHeaderBranch` reserved badge slot preserves geometry and that weekday tab navigation renders synchronously.
- [ ] **Step 2: Harden Header and Actions across Warehouse stations**
  - Lock reserved action button slot in `MrxDailyHeaderBranch.tsx` so "Xuất bổ sung ca" / "Điền đủ" does not shift button positions.
  - Verify L2 cache rehydration in `useMrxDailyWorkspace.ts` for active date and batch selection.
- [ ] **Step 3: Run Vitest unit tests**
  Run `npm run test:fe:unit -- src/__tests__/Warehouse.test.tsx` and verify 100% PASS.

---

### Task 3: Role 3 — Head Chef Station (`/chef?view=mrx-cooking`) Stabilization

**Files:**
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx`
- Modify: `frontend/src/features/chef/branches/MrxCookingHeaderBranch.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`

- [ ] **Step 1: Write/update unit test in `Chef.test.tsx`**
  Verify that shift filter changes render recipe groups synchronously without header shift or telemetry jitter.
- [ ] **Step 2: Harden Chef cooking station layout**
  - Verify `min-w-[110px]` badge anchor in `MrxCookingHeaderBranch.tsx`.
  - Ensure Subbar telemetry pills maintain fixed dimensions.
- [ ] **Step 3: Run Vitest unit tests**
  Run `npm run test:fe:unit -- src/__tests__/Chef.test.tsx` and verify 100% PASS.

---

### Task 4: Role 4 — Reconciliation Auditor (`/reconciliation`) Stabilization

**Files:**
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationQueueCards.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Step 1: Write/update unit tests in `Reconciliation.test.tsx`**
  Verify that on initial mount / reload, `batches` and `operationalSummary` are populated immediately from L2 cache without flashing empty placeholders or 0 counts.
- [ ] **Step 2: Harden `useReconciliationWorkspace.ts` and Queue Cards**
  - Initialize `batches` from `serverStateCache.get('mrx_batches_' + customerId)`.
  - Initialize `operationalSummary` from `serverStateCache.get('mrx_operational_summary')`.
  - Ensure `ReconciliationQueueCards` holds steady 48px height with zero count jumping.
- [ ] **Step 3: Run Vitest unit tests**
  Run `npm run test:fe:unit -- src/__tests__/Reconciliation.test.tsx` and verify 100% PASS.

---

### Task 5: Role 5 — Shared Administrative Surfaces (`/admin-data`, `/settings/advanced`) Stabilization

**Files:**
- Modify: `frontend/src/features/admin/AdminDataPage.tsx`
- Modify: `frontend/src/features/admin/AdvancedSettingsPage.tsx`
- Test: `frontend/src/__tests__/AdminData.test.tsx`
- Test: `frontend/src/__tests__/AdvancedSettings.test.tsx`

- [ ] **Step 1: Write/update unit tests for Admin Data and Advanced Settings**
  Verify that badge slots on both pages are enclosed in fixed-width containers (`min-w-[140px]`, `min-w-[220px]`) and wrapped in `<WorkspaceFrame.Root>` and `<WorkspaceFrame.Body>`.
- [ ] **Step 2: Standardize Admin Data and Advanced Settings**
  - Wrap both pages in compound `WorkspaceFrame.Root` + `WorkspaceFrame.Body`.
  - Lock badge anchor slot dimensions.
- [ ] **Step 3: Run Vitest unit tests**
  Run `npm run test:fe:unit -- src/__tests__/AdminData.test.tsx src/__tests__/AdvancedSettings.test.tsx` and verify 100% PASS.

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
