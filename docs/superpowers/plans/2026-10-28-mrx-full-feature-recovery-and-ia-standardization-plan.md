# MRX Full Feature Recovery, IA Standardization & Navigation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore complete feature parity with the legacy codebase for the Material Reconciliation (`MATERIAL_RECONCILIATION`) subsystem, enforce clean collapsed-by-default Sidebar Information Architecture (IA), update terminology across all routes, restore the executive MRX Dashboard, return the warehouse issue history view to Warehouse station, and add detailed recipe BOM breakdowns for Chef cooking.

**Architecture:**
1. Update `routeRegistry.ts` with standardized MRX lifecycle naming.
2. In `AppShell.tsx`, default all disclosure groups to collapsed (`false`), auto-expanding only when explicitly toggled or route matches.
3. In `ReconciliationDashboardPage.tsx`, wire scope filters (Customer + Period) with live KPIs and recent batch navigation.
4. In `MrxDailyIssueWorkbench.tsx`, restore the issue history view (movement) alongside daily demand so warehouse staff can inspect recent issue vouchers in-place.
5. In `MrxCookingDishListBranch.tsx`, render detailed BOM per serving and waste rate percent breakdown for every dish.
6. In `ReconciliationDispositionModal.tsx`, surface historical disposition trail when reviewing differences.
7. Deduplicate all remaining status and role constants into `constants/mrxConstants.ts`.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Playwright, Vitest.

## Global Constraints
- `DOM-MODE-1`: MRX mode isolation strictly preserved.
- Architecture Limits: 0 FE files > 600 lines (`node scripts/check-architecture-growth.mjs`), sub-tree branches $\le 250$ lines.
- Zero ad-hoc CSS tokens outside `index.css`.

---

### Task 1: Standardize Sidebar IA & Terminology in `routeRegistry.ts` & `AppShell.tsx`

**Files:**
- Modify: `frontend/src/routes/routeRegistry.ts`
- Modify: `frontend/src/components/workbench/AppShell.tsx`
- Test: `frontend/src/__tests__/AppShell.test.tsx`
- Test: `frontend/src/__tests__/RouteNavigationIntegrity.test.tsx`

- [ ] **Step 1: Update group titles and labels in `routeRegistry.ts`**
- [ ] **Step 2: Ensure `AppShell.tsx` initializes all disclosure groups as collapsed by default**
- [ ] **Step 3: Run Vitest unit tests for AppShell & RouteNavigationIntegrity**

---

### Task 2: Enhance Executive MRX Dashboard (`ReconciliationDashboardPage.tsx`)

**Files:**
- Modify: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`
- Test: `frontend/src/__tests__/Dashboard.test.tsx`

- [ ] **Step 1: Add time period filter (Toàn thời gian, Năm nay, Tháng này)**
- [ ] **Step 2: Connect live KPI computation to selected period and customer**
- [ ] **Step 3: Run Vitest unit test for Dashboard**

---

### Task 3: Restore Issue History View to Warehouse Station (`MrxDailyIssueWorkbench.tsx`)

**Files:**
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

- [ ] **Step 1: Add view toggle (Định lượng xuất ca / Lịch sử phiếu xuất) in `MrxDailyIssueWorkbench.tsx`**
- [ ] **Step 2: Embed issue history table with DocumentCodeCell and voucher inspection modal**
- [ ] **Step 3: Run Vitest unit test for Warehouse**

---

### Task 4: Enhance Chef Cooking Breakdown with BOM & Waste Rates

**Files:**
- Modify: `frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`

- [ ] **Step 1: Render BOM per serving, waste rate percent, and total quantity in dish cards**
- [ ] **Step 2: Run Vitest unit test for Chef**

---

### Task 5: Enhance Reconciliation Disposition with Previous Trail

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Step 1: Surface existing disposition details and notes when editing an existing line**
- [ ] **Step 2: Run Vitest unit test for Reconciliation**

---

### Task 6: Full Stack Verification & Quality Gate Audit

**Files:**
- Verify: Full codebase

- [ ] **Step 1: Run pre-commit quality gate (`npm run precommit:verify`)**
- [ ] **Step 2: Run Playwright E2E browser tests (`npx playwright test`)**
- [ ] **Step 3: Verify architecture growth limits (`node scripts/check-architecture-growth.mjs`)**
- [ ] **Step 4: Update `.planning/WORK.md`**
