# MRX 6-Pillar Experience Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 6-pillar MRX experience hardening: contextual domain empty-state icons, root login landing (`/`), scrollbar-gutter stability, text-only sidebar leaves with smart active collapse, concise microcopy trimming, and centralized constants.

**Architecture:**
1. Upgrade `StateBoundary.tsx` and `DataGrid.tsx` to dynamically resolve domain-appropriate Lucide icons (`Boxes`, `Warehouse`, `ChefHat`, `Scale`, `SearchX`, `FileClock`) based on `emptyScenario` and optional `emptyIcon`.
2. Update `navigationEligibility.ts` to return `/` as the authoritative landing path in `MATERIAL_RECONCILIATION` mode.
3. Add `scrollbar-gutter: stable;` in `index.css` to permanently reserve scrollbar width and eradicate 17px horizontal shifts.
4. Keep sidebar leaves text-only with vertical guideline in `AppShell.tsx`, and standardize group titles in `routeRegistry.ts`.
5. Trim verbose microcopy in Subbars and headers down to crisp 4–7 word phrases.
6. Create `frontend/src/constants/mrxConstants.ts` to deduplicate status and shift dictionaries.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-mrx-6pillar-experience-hardening-spec.md`

## Global Constraints
- `DOM-MODE-1`: Zero modification to DEFAULT-only workflows.
- Architecture Limits: 0 FE files > 600 lines (`node scripts/check-architecture-growth.mjs`), sub-tree branches $\le 250$ lines.
- Zero ad-hoc CSS tokens outside `index.css`.

## Review Focus
1. **Empty State Icons**: Verify that empty screens show `<Boxes />`, `<Warehouse />`, `<Scale />`, `<SearchX />`, `<FileClock />` instead of `<Inbox />`.
2. **Login Landing**: Logging in via `/login` must navigate to `/` (`ReconciliationDashboardPage`), not `/weekly-menu?view=mrx-batch`.
3. **Scrollbar Gutter**: Switching from short pages to tall pages must produce 0px horizontal shift.
4. **Text-Only Leaves**: Sidebar leaves must remain clean text without inline leaf icons.
5. **No Regressions**: All 221+ Vitest tests and all 63 Playwright browser tests must pass.

---

### Task 1: Contextual Domain Empty-State Icons in `StateBoundary.tsx` & `DataGrid.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Modify: `frontend/src/components/workbench/DataGrid.tsx`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

- [ ] **Step 1: Write/verify unit test for contextual empty icons**
  Verify that `StateBoundary` and `DataGrid` render scenario/domain-appropriate icons.
- [ ] **Step 2: Update `StateBoundary.tsx` and `DataGrid.tsx`**
  - Add `emptyIcon?: LucideIcon` to `StateBoundaryProps` and `DataGridProps`.
  - Dynamically resolve `SearchX` for `filter-empty`, `FileClock` for `prerequisite-blocked`, `Boxes` for default/batches, or custom domain icons.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Primitives.test.tsx` and verify 100% PASS.

---

### Task 2: Root Login Landing in `navigationEligibility.ts`

**Files:**
- Modify: `frontend/src/routes/navigationEligibility.ts`
- Modify: `frontend/src/__tests__/Auth.test.tsx`
- Test: `frontend/src/__tests__/Auth.test.tsx`

- [ ] **Step 1: Update `Auth.test.tsx` to assert landing at `/`**
  Update tests in `Auth.test.tsx` to assert that logging in under `MATERIAL_RECONCILIATION` navigates to `/` (the executive MRX Dashboard).
- [ ] **Step 2: Update `resolveLandingPath` in `navigationEligibility.ts`**
  Return `'/'` when `mode === 'MATERIAL_RECONCILIATION'`.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Auth.test.tsx` and verify 100% PASS.

---

### Task 3: Zero Inter-Page Layout Shift (`scrollbar-gutter: stable;`)

**Files:**
- Modify: `frontend/src/styles/index.css`
- Test: `scripts/test-all-cold-starts.mjs`

- [ ] **Step 1: Add `scrollbar-gutter: stable;` to `index.css`**
  Declare `scrollbar-gutter: stable;` on `html, body` and scrollable containers.
- [ ] **Step 2: Verify zero horizontal layout shift during navigation**
  Verify that switching between routes produces 0px horizontal jitter.

---

### Task 4: Standardize Clean Sidebar IA (Text-Only Leaves & Clean Titles)

**Files:**
- Modify: `frontend/src/routes/routeRegistry.ts`
- Test: `frontend/src/__tests__/AppShell.test.tsx`
- Test: `frontend/src/__tests__/RouteNavigationIntegrity.test.tsx`

- [ ] **Step 1: Update navigation titles and labels in `routeRegistry.ts`**
  Standardize group and leaf titles according to the approved MRX lifecycle hierarchy.
- [ ] **Step 2: Verify text-only leaf rendering in `AppShell.tsx`**
  Confirm that leaves render cleanly under the vertical guideline without leaf icons.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/AppShell.test.tsx src/__tests__/RouteNavigationIntegrity.test.tsx` and verify 100% PASS.

---

### Task 5: Trim Verbose Microcopy Across MRX Stations

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationTransactionsBranch.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationAuditBranch.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationCompletedBranch.tsx`
- Modify: `frontend/src/features/admin/AdvancedSettingsPage.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Step 1: Trim verbose notes and paragraphs**
  Replace wordy sentences with crisp, functional 4–7 word enterprise labels.
- [ ] **Step 2: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Reconciliation.test.tsx` and verify 100% PASS.

---

### Task 6: Centralized Constants in `constants/mrxConstants.ts`

**Files:**
- Create: `frontend/src/constants/mrxConstants.ts`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Step 1: Create `frontend/src/constants/mrxConstants.ts`**
  Export `MRX_STATUS_LABELS`, `MRX_STATUS_VARIANTS`, and `MRX_SHIFT_LABELS`.
- [ ] **Step 2: Deduplicate imports in feature controllers**
  Import constants from `constants/mrxConstants.ts`.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Reconciliation.test.tsx` and verify 100% PASS.

---

### Task 7: Full Stack Verification & Quality Gate Audit

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
