# Unified Enterprise Workbench Architecture & 14-Route Conformance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the header and presentation architecture into a fixed-height 96px container, eradicate the "Layer Cake" anti-pattern and vertical jitter, establish a 3-tier semantic badge hierarchy, and verify across all 14 canonical routes and 5 standard viewports.

**Architecture:** Consolidate WorkspaceHeader and TelemetrySubbar into an immutable 96px 2-row layout across workbenches; integrate blocker alerts and queue counts into Row 2 as inline lozenges/chips; eliminate vertical layout shifts on tab switches and data hydration; persist session snapshots into `sessionStorage` for 0ms Render #1; verify with Vitest, Playwright, and live screenshot audits.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-unified-enterprise-workbench-architecture-and-14routes-spec.md`

## Global Constraints

- Operational Mode Isolation (`DOM-MODE-1`): DEFAULT != MATERIAL_RECONCILIATION.
- Architecture limits: Strictly $\le 600$ lines per FE source file; $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`).
- Zero-CLS: 0px layout shift between tab switches and async data hydration.
- No orphan code: All components and utilities must have active production callers.

## Review Focus

- Reconciliation Subview Switching: Switching between `lines` and `completed` must maintain exact 96px header height (0px vertical shift).
- Blocker Alert: Must render as an inline actionable chip in Row 2, not a stacked 36px bar that pushes the DataGrid down.
- Queue Cards: Must integrate cleanly as compact lozenges without eating 48px of separate vertical height.
- Hard Refresh (F5): Must resolve synchronously from storage at 0ms with zero skeleton flash.
- Table Row Capacity: Must display 18–25 rows per screen on standard desktop viewports.

---

### Task 1: Unify Header Architecture into 96px Fixed-Height Container on `/reconciliation`

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationQueueCards.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationBlockerStrip.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

- [ ] Consolidate `ReconciliationBlockerStrip` into an inline chip inside the Row 2 TelemetrySubbar so it does not inject a separate 36px bar into the vertical layout.
- [ ] Embed `ReconciliationQueueCards` as inline metric lozenges in Row 2 (or a compact collapsible drawer) so it does not add a 48px vertical strip above the subbar.
- [ ] Ensure `TelemetrySubbar` remains mounted across all tabs (including `completed`) with fixed height 40px, ensuring total header height is strictly 96px across all 5 subviews.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx` and verify all tests pass.

---

### Task 2: Streamline Multi-Station Workflows & Inline Resolution

**Files:**
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [ ] In `MrxDailyIssueWorkbench.tsx`, integrate day selector pills and status badges into a stable 40px Row 2 subbar, preventing vertical jumps when switching between days with and without initial issues.
- [ ] In `MrxMultiCustomerPreparationWorkbench.tsx`, move customer selection chips into a stable collapsible filter drawer or header bar so it does not inject 110px of vertical space into the DataGrid canvas.
- [ ] In `MrxBatchWorkbench.tsx`, consolidate lifecycle progress stepper and preview tabs into the 40px Row 2 bar.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx src/__tests__/WeeklyMenu.test.tsx` and verify all tests pass.

---

### Task 3: Enforce Three-Tier Semantic Status Hierarchy Across All 14 Routes

**Files:**
- Audit & Standardize: All 14 route entry points (`frontend/src/features/*`)
- Test: `frontend/src/__tests__/Primitives.test.tsx`
- Test: `frontend/src/__tests__/AppShell.test.tsx`

- [ ] Ensure Tier 1 Master Status Badge appears ONCE in Row 1 of WorkspaceHeader.
- [ ] Ensure Tier 2 Filter Scope Counts are embedded inside Row 2 Segmented Tabs.
- [ ] Ensure Tier 3 Row Status Lozenges are rendered cleanly in DataGrid cells.
- [ ] Remove any remaining redundant banner repeats across all routes.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Primitives.test.tsx src/__tests__/AppShell.test.tsx` and verify all tests pass.

---

### Task 4: Empirical Measurement & Live Screenshot Audits Across Viewports

**Files:**
- Script: `scripts/capture-all-canonical-routes.mjs`
- Script: `scripts/measure-route-5layers.mjs`

- [ ] Run `node scripts/measure-route-5layers.mjs --route reconciliation` to verify exact 96px header height and 0.0000 CLS.
- [ ] Execute `node scripts/capture-all-canonical-routes.mjs` across 1440p, 1280p, 1024p, and 390p viewports.
- [ ] Inspect captured screenshots with `read` tool to verify expanded row visibility and zero vertical layout shift.

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
