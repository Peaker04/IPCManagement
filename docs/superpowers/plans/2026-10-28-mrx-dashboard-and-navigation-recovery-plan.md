# MRX Dashboard Recovery, Sidebar IA Standardization & Action Bridges Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the executive MRX Dashboard at `/`, implement dynamic active-only disclosure expansion in `AppShell.tsx`, standardize sidebar terminology to reflect the closed-loop MRX lifecycle, and wire inter-station action bridges between Warehouse, Kitchen, and Reconciliation.

**Architecture:**
1. Build `ReconciliationDashboardPage.tsx` using `WorkspaceFrame`, displaying live KPI cards from `mrxApi.getOperationalSummary()`, an interactive 4-step lifecycle pipeline, and recent batches from `mrxApi.getBatchPage()`.
2. Update `App.tsx` and `routeRegistry.ts` so `/` is eligible in both `DEFAULT` and `MATERIAL_RECONCILIATION` modes.
3. Update `AppShell.tsx` to dynamically initialize `expandedParents` based on `location.pathname`, collapsing inactive groups by default.
4. Add bidirectional action bridges across stations: Warehouse $\leftrightarrow$ Reconciliation, Reconciliation $\leftrightarrow$ Chef cooking.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-mrx-dashboard-and-navigation-recovery-spec.md`

## Global Constraints
- `DOM-MODE-1`: MRX mode isolation strictly preserved. Default dashboard (`DashboardPage`) renders when `operationalMode === 'DEFAULT'`; `ReconciliationDashboardPage` renders when `operationalMode === 'MATERIAL_RECONCILIATION'`.
- Architecture Limits: 0 FE files > 600 lines (`node scripts/check-architecture-growth.mjs`), sub-tree branches $\le 250$ lines.
- Zero ad-hoc styling tokens: Use existing `index.css` design system tokens.

## Review Focus
1. **MRX Root Navigation**: Navigating to `/` in MRX mode renders `ReconciliationDashboardPage` with live KPI cards and batch list.
2. **Sidebar Collapse**: Inactive sidebar parent disclosures must remain closed by default; only the active parent disclosure may be open.
3. **Cross-Station Links**: "Xem lịch sử giao dịch kho →" in Warehouse Daily navigates directly to `/reconciliation?view=transactions`.
4. **No Regressions**: Pre-commit Gate A-E and all 63 Playwright browser tests must pass.

---

### Task 1: Build `ReconciliationDashboardPage.tsx`

**Files:**
- Create: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/routes/routeRegistry.ts`
- Test: `frontend/src/__tests__/Dashboard.test.tsx`

- [ ] **Step 1: Write unit test in `Dashboard.test.tsx`**
  Verify that when `operationalMode === 'MATERIAL_RECONCILIATION'`, `/` renders `ReconciliationDashboardPage` with KPI cards and interactive 4-step pipeline.
- [ ] **Step 2: Create `ReconciliationDashboardPage.tsx`**
  Implement `ReconciliationDashboardPage` using `WorkspaceFrame.Root`, `WorkspaceHeader`, 4 executive KPI cards, 4-step pipeline cards, and `DataGrid` for active batches.
- [ ] **Step 3: Update `App.tsx` and `routeRegistry.ts`**
  - Allow `/` in `modes: ['DEFAULT', 'MATERIAL_RECONCILIATION']` in `routeRegistry.ts`.
  - In `App.tsx`, render `ReconciliationDashboardPage` for MRX mode instead of redirecting.
- [ ] **Step 4: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Dashboard.test.tsx` and verify 100% PASS.

---

### Task 2: Implement Smart Active-Only Sidebar Collapse in `AppShell.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/AppShell.tsx`
- Test: `frontend/src/__tests__/AppShell.test.tsx`

- [ ] **Step 1: Write unit test in `AppShell.test.tsx`**
  Verify that only the disclosure group matching the active route is expanded by default, and others are collapsed.
- [ ] **Step 2: Update `AppShell.tsx` initialization**
  Replace hardcoded `true` with path-matching function:
  `'weekly-menu': location.pathname.startsWith('/weekly-menu')`, etc.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/AppShell.test.tsx` and verify 100% PASS.

---

### Task 3: Standardize MRX Navigation Labels in `routeRegistry.ts`

**Files:**
- Modify: `frontend/src/routes/routeRegistry.ts`
- Test: `frontend/src/__tests__/RouteNavigationIntegrity.test.tsx`

- [ ] **Step 1: Write/verify test in `RouteNavigationIntegrity.test.tsx`**
  Verify that MRX navigation leaves and labels accurately reflect the standardized workflow.
- [ ] **Step 2: Update titles & labels in `routeRegistry.ts`**
  Apply the approved IA terminology for MRX routes.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/RouteNavigationIntegrity.test.tsx` and verify 100% PASS.

---

### Task 4: Implement Inter-Station Action Bridges

**Files:**
- Modify: `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationLinesBranch.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Step 1: Add Warehouse $\rightarrow$ Transactions shortcut**
  In `MrxDailyHeaderBranch.tsx`, add an action button `"Xem lịch sử kho"` linking to `/reconciliation?view=transactions`.
- [ ] **Step 2: Add Reconciliation $\rightarrow$ Cooking shortcut**
  In `ReconciliationLinesBranch.tsx` or `ReconciliationHeaderBranch.tsx`, add shortcut linking to `/chef?view=mrx-cooking&batchId={id}`.
- [ ] **Step 3: Run Vitest unit tests**
  Run `npm run test:fe:unit -- src/__tests__/Warehouse.test.tsx src/__tests__/Reconciliation.test.tsx` and verify 100% PASS.

---

### Task 5: Full Stack Verification & Quality Gate Audit

**Files:**
- Verify: Full codebase

- [ ] **Step 1: Run pre-commit quality gate**
  Execute `npm run precommit:verify` (All 5 Gates: modules, forbidden patterns, architecture limits, build, 221+ Vitest tests).
- [ ] **Step 2: Run Playwright E2E browser tests**
  Execute `npx playwright test` (All 63 browser tests PASS).
- [ ] **Step 3: Verify architecture growth limits**
  Execute `node scripts/check-architecture-growth.mjs` (0 FE files > 600 lines).
- [ ] **Step 4: Update `.planning/WORK.md`**
  Record execution evidence, test results, and return task status to `IDLE`.
