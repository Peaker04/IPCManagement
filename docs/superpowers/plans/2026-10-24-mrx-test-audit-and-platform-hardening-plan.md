# MRX Test-Audit, Platform Invariants & Responsive Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all P0 platform flaws (dual API authority, cross-date state contamination, Zero-CLS violation), enforce strict P1 test-audit gates (Rule TA-1 C# DTO grounding, Rule TA-2 network boundary mocking, Rule TA-4 4-scenario coverage), stabilize P2 responsive geometry, and expand P3 multi-line supplemental issuing.

**Architecture:** Unified `mrxApi.ts` OpenAPI contract client, 3-Zone Flat Workbench (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`), date-isolated local state reducers, and real C# DTO fixtures.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, Playwright, ASP.NET Core Kestrel.

**Spec:** `docs/superpowers/specs/2026-10-24-mrx-test-audit-and-platform-hardening-spec.md`

## Global Constraints

- Strict Operational Mode Isolation (`DOM-MODE-1`): Zero DEFAULT API mutation in MRX mode.
- File Size Invariant: Every frontend file must remain strictly under 600 lines (`check-architecture-growth.mjs`).
- Chef View Invariant: Chef view (`/chef?view=mrx-cooking`) is strictly preserved as-is (read-only sanitized cooking sheet with CSV/XLSX exports).
- Single Styling Authority: All styling via semantic tokens in `frontend/src/styles/index.css` and Tailwind primitives.
- Test-Audit Invariant: Enforce Rule TA-1 to TA-5. Mocks must operate at the network boundary (`apiClient`).

## Review Focus

1. **State Isolation Between Dates**: Selecting a different date in `MrxDailyIssueWorkbench` must completely wipe previous date's entered quantities and initialize the newly selected date's exact lines.
2. **Zero-CLS on Network Error**: In `ReconciliationPage`, triggering a simulated network rejection must not clear the table to null or cause layout jump; it must display an inline alert while preserving table visibility at `opacity-70`.
3. **C# DTO Grounding**: Verify all mock data in tests uses PascalCase-derived C# property names (`BatchLineId`, `IngredientCode`, `CanonicalUnitName`, `IssueNotes`) rather than client-invented aliases.
4. **Responsive Accessibility**: On a 1024x768 screen, all controls in `WorkspaceHeader` and `TelemetrySubbar` must remain clickable without horizontal scrolling or clipping.

---

### Task 1: Unify API Authority & Fix Platform Invariants in MRX Subsystem (P0)

**Files:**
- Modify: `frontend/src/api/mrxApi.ts`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`

- [ ] **Step 1.1**: Update `mrxApi.ts` to export full C# DTO shapes (`ReconciliationBatchDto`, `ReconciliationLineDto`, `ReconciliationDailyReviewDto`) and ensure `mrxApi.getBatch` returns the complete batch with `dailyReview`.
- [ ] **Step 1.2**: In `ReconciliationPage.tsx`, migrate away from `reconciliationApi.getReconciliationSummary` to `mrxApi.getBatch`. Eliminate `setData(null)` on query error to uphold Zero-CLS (`RULE-FEEDBACK-01..04`). Add proper `isFetching` tracking.
- [ ] **Step 1.3**: In `MrxDailyIssueWorkbench.tsx`, fix cross-date state contamination: when `activeDate` changes or when switching dates, reset `quantities` and `reasons` strictly to the newly selected date's `requiredQuantity`.
- [ ] **Step 1.4**: Verify line count of `ReconciliationPage.tsx` and `MrxDailyIssueWorkbench.tsx` remains strictly `< 600`.

---

### Task 2: Ground Fixtures in Real C# DTOs & Enforce Test-Audit Network Boundary (P1)

**Files:**
- Modify: `frontend/src/test/fixtures.ts`
- Modify: `frontend/src/__tests__/Reconciliation.test.tsx`
- Modify: `frontend/src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts`

- [ ] **Step 2.1**: Update `frontend/src/test/fixtures.ts` so `MOCK_RECONCILIATION_BATCH_DTO` matches C# `ReconciliationBatchDto` 100% (`batchLineId`, `ingredientCode`, `ingredientName`, `canonicalUnitName`, `frozenTolerance`, `issueNotes`, `dailyReview.weeklyStatus`).
- [ ] **Step 2.2**: In `frontend/src/__tests__/Reconciliation.test.tsx`, rewrite tests to mock at the `apiClient` network boundary rather than spying on client service transformation functions.
- [ ] **Step 2.3**: Add explicit test coverage for all 4 behavioral scenarios (Rule TA-4):
  - Scenario 1: Success render with real C# DTO.
  - Scenario 2: Prerequisite-blocked empty state when no batch exists.
  - Scenario 3: Error state with retry action, verifying existing data is preserved (Zero-CLS).
  - Scenario 4: RBAC 403 authorization failure with permission-denied boundary.
- [ ] **Step 2.4**: Run `npm run test:fe:unit` and verify all tests pass.

---

### Task 3: Root-Cause Responsive Geometry Stabilization (P2)

**Files:**
- Modify: `frontend/src/components/workbench/WorkspaceHeader.tsx`
- Modify: `frontend/src/components/workbench/TelemetrySubbar.tsx`
- Modify: `frontend/src/components/workbench/DataGrid.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`

- [ ] **Step 3.1**: In `WorkspaceHeader.tsx` and `TelemetrySubbar.tsx`, remove `.no-scrollbar` suppression and implement responsive flex layouts with priority wrapping for screens `< 1280px`.
- [ ] **Step 3.2**: In `DataGrid.tsx`, replace hardcoded `min-w-[800px]` with fluid responsive minimum widths that adapt to parent containers (e.g. SplitView master columns).
- [ ] **Step 3.3**: Ensure all select dropdowns use fluid responsive widths (`w-40 sm:w-48 lg:w-56`).
- [ ] **Step 3.4**: Run automated 5-viewport Playwright probe (1920, 1440, 1366, 1280, 1024) to verify 0 horizontal window overflow and 0 clipped buttons.

---

### Task 4: Multi-Line Supplemental Issuing Recovery (P3)

**Files:**
- Modify: `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`

- [ ] **Step 4.1**: Upgrade `MrxSupplementalIssueModal.tsx` to support adding multiple ingredients into a staging table before submission.
- [ ] **Step 4.2**: In `MrxDailyIssueWorkbench.tsx`, submit all staged supplemental lines atomically in one `mrxApi.createIssue` call.
- [ ] **Step 4.3**: Verify file sizes remain strictly `< 600 lines`.

---

### Task 5: Comprehensive Verification & Regression Safety

- [ ] **Step 5.1**: Run `npm run lint:fe && npm run depcruise:fe && npm run build:fe`.
- [ ] **Step 5.2**: Run `npm run check:architecture-growth && npm run check:conformance-contracts`.
- [ ] **Step 5.3**: Run `npm run test:fe:unit` (167+ tests).
- [ ] **Step 5.4**: Run Playwright runtime conformance suite (`conformance-runtime.spec.ts`).
- [ ] **Step 5.5**: Run full-path 7-day 4-actor operational lifecycle test on isolated sandbox DB (`run-mrx-full-path-lifecycle-test.mjs`).
