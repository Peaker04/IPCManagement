# MRX Visual Integrity & Human-Language Adapter Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix date input truncation, eliminate duplicate sub-headers across reconciliation reports, map all raw C# enums and technical GUIDs to human language, resolve false empty states and zombie buttons in warehouse station, and enforce consistent material name casing.

**Architecture:**
1. Fix flexbox sizing on `VietnameseDateInput` across all MRX station headers (`min-w-[160px] shrink-0`), resolving the squished year (`21/09/202`) and handling `date=ALL` gracefully.
2. Remove secondary stacked header bars from `ReconciliationVariancesBranch`, `ReconciliationTransactionsBranch`, and `ReconciliationAuditBranch`, elevating CSV download buttons and sub-tabs directly to `TelemetrySubbar`.
3. Create centralized human-language formatting helpers in `frontend/src/utils/formatters.ts` to map transaction types (`SUPPLEMENTAL_ISSUE` $\rightarrow$ `Xuất bổ sung`), units (`Kilogram` $\rightarrow$ `kg`), audit actors (GUID $\rightarrow$ Admin name), areas (`Coordination` $\rightarrow$ `Điều phối`), and entities (`MealQuantityPlan` $\rightarrow$ `Kế hoạch suất ăn`).
4. Suppress zombie issue buttons when `lines.length === 0` in `MrxDailyHeaderBranch.tsx`, and map appropriate empty state icons (`Boxes`, `CalendarX`).
5. Apply title-case normalization to all displayed ingredient names.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-mrx-visual-integrity-and-human-language-adapter-spec.md`

## Global Constraints
- `DOM-MODE-1`: Zero modification to DEFAULT-only workflows.
- Architecture Limits: 0 FE files > 600 lines (`node scripts/check-architecture-growth.mjs`), sub-tree branches $\le 250$ lines.
- Zero ad-hoc styling tokens: Use existing `index.css` design system tokens.

---

### Task 1: Fix Date Input Truncation & `date=ALL` Handling

**Files:**
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx`
- Modify: `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Test: `frontend/src/__tests__/ZeroJitterHeaderGeometry.test.tsx`

- [ ] **Step 1: Write/verify unit test for Date Input dimensions**
  Verify that date inputs maintain `min-w-[160px] shrink-0` and do not get squished by neighboring dropdowns.
- [ ] **Step 2: Update header context selector flexbox**
  Ensure date input has `min-w-[160px] w-40 shrink-0` and does not display `'ALL'` as a raw text string.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/ZeroJitterHeaderGeometry.test.tsx` and verify 100% PASS.

---

### Task 2: Eliminate Layer Cake Duplicate Sub-Headers

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationVariancesBranch.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationTransactionsBranch.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationAuditBranch.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Step 1: Write/verify test for single Subbar rule**
  Ensure report views have exactly one 44px Subbar and no stacked secondary title divs.
- [ ] **Step 2: Remove secondary title divs and elevate actions to `TelemetrySubbar`**
  Move CSV download triggers and sub-tabs to `TelemetrySubbar` right/left controls.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Reconciliation.test.tsx` and verify 100% PASS.

---

### Task 3: Build Human-Language Adapter & Eliminate Raw C# Enums / GUIDs

**Files:**
- Create/Modify: `frontend/src/utils/formatters.ts`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationTransactionsBranch.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationAuditBranch.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationVariancesBranch.tsx`
- Modify: `frontend/src/components/workbench/MrxBatchDishesModal.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] **Step 1: Write unit tests for human-language formatters**
  Verify conversion of transaction types, units, audit actors, and exception messages.
- [ ] **Step 2: Implement formatters and apply across report branches and modal**
  Replace all raw enums with human-readable localized Vietnamese domain terms.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Reconciliation.test.tsx` and verify 100% PASS.

---

### Task 4: Clean False Empty States & Zombie Buttons in Warehouse Station

**Files:**
- Modify: `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

- [ ] **Step 1: Update action button visibility logic**
  Hide "Điền đủ toàn bộ" and "Xác nhận xuất kho" when `lines.length === 0`.
- [ ] **Step 2: Map appropriate empty icon (`Boxes` or `CalendarX`)**
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Warehouse.test.tsx` and verify 100% PASS.

---

### Task 5: Full Stack Verification & Quality Gate Audit

**Files:**
- Verify: Full codebase

- [ ] **Step 1: Run pre-commit quality gate (`npm run precommit:verify`)**
- [ ] **Step 2: Run Playwright E2E browser tests (`npx playwright test`)**
- [ ] **Step 3: Verify architecture growth limits (`node scripts/check-architecture-growth.mjs`)**
- [ ] **Step 4: Update `.planning/WORK.md`**
