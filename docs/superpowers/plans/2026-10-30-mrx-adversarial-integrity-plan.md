# MRX Adversarial Integrity & Persistence Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate schedule drift, surface inventory auto-adjustments, harden return delta lineage mapping, and enforce concurrency freshness on dispositions across the MRX lifecycle.

**Architecture:** Frontend and Backend guardrails enforcing batch immutability beyond DRAFT, transparent warehouse shortage alerts, resilient source delta resolution, and optimistic concurrency locks.

**Tech Stack:** React 19, TypeScript, C# 13, ASP.NET Core (.NET 9), EF Core 9, MySQL 9.5, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-mrx-adversarial-integrity-spec.md`

## Global Constraints

- `DOM-MODE-1`: MRX mode operates isolated from DEFAULT mode; master data remains unmerged.
- `TA-1 to TA-5`: Backend-grounded fixtures only; zero mock APIs; zero synthetic fake fallbacks.
- `Tree Architecture Limits`: Frontend files $\le 350$ lines (hard limit 600 lines).
- `UI Tokens`: Zero ad-hoc colors or inline styles outside `frontend/src/styles/index.css`.

## Review Focus

- Attempting to edit schedule servings while batch is `TRANSFERRED` or `IN_PROGRESS` is rejected with 409 Conflict.
- "Chỉnh sửa lịch tuần" button is disabled on `MrxBatchWorkbench` when batch is not `DRAFT`.
- Auto-adjusted stock shortages in `ReconciliationInventoryIssueCreator` are surfaced in receipt details.
- Multi-issue `RETURN` deltas in `MrxSourceDeltaWorkbench` map cleanly without throwing unhandled exceptions.
- Concurrent supplemental issues during disposition review trigger a graceful 409 refresh prompt.

---

### Task 1: Schedule Edit Lockdown When Batch Has Progressed Beyond DRAFT

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx:180-195`
- Modify: `backend/src/IPCManagement.Api/Features/Coordination/Services/MealQuantityPlanService.cs:115-140`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: `backend/tests/IPCManagement.Api.Tests/MealQuantityPlansControllerTests.cs`

**Interfaces:**
- Consumes: `batch.status` from `useMrxBatchWorkspace`, `Reconciliationbatches` in `IpcManagementContext`.
- Produces: Disabled state on `[Chỉnh sửa lịch tuần]` with explanatory title; 409 Conflict rejection in `UpsertQuickServingsAsync`.

- [ ] **Step 1: Write failing frontend unit test in `WeeklyMenu.test.tsx`**
  Assert that when `batch.status` is `'TRANSFERRED'` or `'IN_PROGRESS'`, the "Chỉnh sửa lịch tuần" button is disabled and has title attribute explaining that edits must use Source Change.

- [ ] **Step 2: Run frontend test to verify it fails**
  Run: `npm --prefix frontend run test:unit -- src/__tests__/WeeklyMenu.test.tsx`
  Expected: FAIL because button is currently always enabled when `source` is present.

- [ ] **Step 3: Implement schedule edit lockdown in `MrxBatchWorkbench.tsx`**
  Update `MrxBatchWorkbench.tsx` line 183 to check `const isScheduleEditDisabled = Boolean(batch && batch.status !== 'DRAFT');` and disable the button with tooltip.

- [ ] **Step 4: Implement backend guard in `MealQuantityPlanService.cs`**
  In `UpsertQuickServingsAsync`, query `_context.Reconciliationbatches` for the customer and week. If status $\in$ `['TRANSFERRED', 'IN_PROGRESS', 'COMPLETED']`, throw `BusinessRuleException("Lô đối soát đã bàn giao sang Kho hoặc đang đối chiếu. Không thể sửa trực tiếp số suất KHSX. Vui lòng gửi yêu cầu 'Điều chỉnh nguồn MRX'.")`.

- [ ] **Step 5: Run tests and verify PASS**
  Run: `npm --prefix frontend run test:unit -- src/__tests__/WeeklyMenu.test.tsx`
  Expected: PASS.

---

### Task 2: Transparent Inventory Shortage & Auto-Adjustment Badging

**Files:**
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx:120-160`
- Modify: `frontend/src/components/workbench/ReconciliationIssueDetailModal.tsx:40-90`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Consumes: Issue lines from `useMrxDailyWorkspace`, audit logs or adjustment metadata.
- Produces: Amber warning badge `[Đã tự động bù tồn kho: +X kg]` when issue exceeds available initial stock.

- [ ] **Step 1: Write failing test in `Warehouse.test.tsx`**
  Verify that when an issue line indicates auto-adjustment or when shortage occurred, an amber badge is displayed.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implement auto-adjustment badge in `ReconciliationIssueDetailModal.tsx`**
  Render an amber badge next to ingredients that required stock adjustment.

- [ ] **Step 4: Run test and verify PASS**
  Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
  Expected: PASS.

---

### Task 3: Robust Multi-Issue Return Lineage Mapping in Source Delta Workbench

**Files:**
- Modify: `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx:90-120`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Consumes: `mrxApi.getIssues(delta.batchId)`
- Produces: Resilient issue line matching for `RETURN` delta resolution.

- [ ] **Step 1: Write failing test in `Warehouse.test.tsx`**
  Test that when multiple issues exist for a date, `MrxSourceDeltaWorkbench` finds the matching issue line with positive issued balance without throwing.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implement multi-issue lookup in `MrxSourceDeltaWorkbench.tsx`**
  Update the lookup to filter issue lines with `issuedQty >= delta.deltaQuantity` or take the latest valid issue line.

- [ ] **Step 4: Run test and verify PASS**
  Run: `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx`
  Expected: PASS.

---

### Task 4: Concurrency Freshness Guard on Daily Line Dispositions

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationActualService.cs:115-135`
- Modify: `frontend/src/features/reconciliation/ReconciliationDispositionModal.tsx:80-110`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs`

**Interfaces:**
- Consumes: `SetReconciliationDispositionRequest.ExpectedVersion`
- Produces: 409 Conflict if underlying issue quantity has changed since line review began.

- [ ] **Step 1: Write failing test in `Reconciliation.test.tsx`**
  Verify that when disposition API returns 409 Conflict due to concurrent issue changes, `ReconciliationDispositionModal` keeps user draft input intact and displays retry action.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix frontend run test:unit -- src/__tests__/Reconciliation.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implement netIssued freshness verification in `ReconciliationActualService.cs`**
  In `SetDailyDispositionAsync`, verify that `netIssued` matches the snapshot value or validate against the expected batch version.

- [ ] **Step 4: Run test and verify PASS**
  Run: `npm --prefix frontend run test:unit -- src/__tests__/Reconciliation.test.tsx`
  Expected: PASS.

---

### Task 5: End-to-End Verification & MySQL Persistence Audit

**Files:**
- Execute: `scripts/run-mrx-live-e2e-mutation-lifecycle.mjs`
- Execute: `npm run precommit:verify`
- Execute: `npm run test:e2e:mrx`

- [ ] **Step 1: Run pre-commit quality gate**
  Run: `npm run precommit:verify`
  Verify: 100% PASS on all 5 gates.

- [ ] **Step 2: Run MRX Universal Matrix suite**
  Run: `npm run test:e2e:mrx`
  Verify: 13/13 test cases pass on `ipc_mrx_e2e_sandbox`.

- [ ] **Step 3: Run live Chrome mutation lifecycle script with MySQL verification**
  Run: `node scripts/run-mrx-live-e2e-mutation-lifecycle.mjs`
  Verify: 28 sequential screenshots captured and all MySQL row counts & values audited.
