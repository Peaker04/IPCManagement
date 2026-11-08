# Native Tree Architecture & Full MRX Surface Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate backend idle API storms, eradicate rapid skeleton flickering via NN/g Doherty threshold deferral, eliminate asynchronous badge layout jumps via reserved anchor slots, and complete 100% decomposition of all MRX routes into a decoupled 4-tier Native Tree Architecture.

**Architecture:** Enforce strict `useEffect` dependency purity to douse all infinite network loops. Wire `useDeferredSkeleton` (150ms delay, 250ms min duration) into all state boundaries to eliminate sub-150ms skeleton strobe. Introduce Frame-0 reserved badge anchor slots (`min-w-[110px] h-8`) across all MRX headers to prevent horizontal element shifting. Fully decompose all remaining monolithic MRX routes (`/chef?view=mrx-cooking`, `/warehouse?view=mrx-preparation`, `/warehouse?view=mrx-issues`, and `ReconciliationReportTables.tsx`) into focused sub-tree branches ($\le 250$ lines each).

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, Playwright, .NET 9 Kestrel.

**Spec:** `docs/superpowers/specs/2026-10-28-tree-architecture-native-modernization-spec.md`

## Global Constraints

- **Operational Mode Isolation (`DOM-MODE-1`)**: Strict isolation between `DEFAULT` and `MATERIAL_RECONCILIATION`; zero DEFAULT API calls or pages rendered in MRX mode.
- **Architecture Limits**: Strictly $\le 600$ lines per source file; strictly $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`). Target decomposed sub-tree branches at $\le 250$ lines.
- **Zero-Strobe & Zero-Skeleton Invariant**: Zero full-page skeleton flickers during in-session subview tab switching; 0ms Render #1 hydration from cache preserved.
- **Cognitive Latency Deferral**: Zero skeleton rendered for operations resolving within $\le 150\text{ms}$; once displayed, skeletons hold for $\ge 250\text{ms}$ minimum duration.
- **Zero-Trust Verification**: Evidence before assertions always. Every status claim must be backed by live command execution output.

## Review Focus

- **Input Class 1: Idle User Inactivity:** User opens `/reconciliation` or `/warehouse?view=mrx-daily` and remains completely idle for 60 seconds; backend log shows exactly 0 additional HTTP requests.
- **Input Class 2: In-Session Cache Navigation:** User switches rapidly between tabs ("Rà soát dòng ngày" $\rightarrow$ "Sổ chênh lệch" $\rightarrow$ "Lịch sử kho"); zero skeleton table renders because cached data resolves in $< 50\text{ms}$.
- **Input Class 3: Asynchronous Badge Mounting:** Cold load on `/chef?view=mrx-cooking` or `/reconciliation`; Select dropdowns and Date inputs remain at exact 0px horizontal shift when badge fades in.
- **Input Class 4: All 10 MRX Surfaces Operational:** Navigating through all 10 MRX surfaces renders 100% healthy, isolated branch components without crashes or console errors.
- **Input Class 5: Slow Network Degradation:** When API response is delayed by 300ms, skeleton mounts after 150ms and remains visible for at least 250ms, transitioning smoothly without visual strobe.

---

## Tasks

### Task 1: Eradicate Backend Idle API Storm & Enforce Dependency Purity

**Files:**
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`
- Modify: `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`
- Test: `frontend/src/__tests__/NetworkStabilityAndIdlePurity.test.tsx`

**Deliverable:** Complete eradication of cyclic re-render loops. Removing `data` from dependency arrays and making URL search param updates strictly event-driven.

- [ ] **Step 1: Write failing regression test in `NetworkStabilityAndIdlePurity.test.tsx`**
  - Verify that rendering `ReconciliationPage` or `MrxDailyIssueWorkbench` in an idle state triggers exactly one batch fetch and zero recurring background GET requests.
- [ ] **Step 2: Run test to confirm failure**
  - Run `npm run test:fe:unit -- src/__tests__/NetworkStabilityAndIdlePurity.test.tsx`.
- [ ] **Step 3: Fix `useReconciliationWorkspace.ts`**
  - Remove `data` from `[batchId, serviceDate, customerCode]` effect dependencies.
  - Remove recursive `setSearchParams` inside query resolution callbacks.
- [ ] **Step 4: Fix `useMrxDailyWorkspace.ts` and `useMrxBatchWorkspace.ts`**
  - Guard `setSearchParams` to run only when date/batch has genuinely changed via user action.
- [ ] **Step 5: Run test to verify pass**
  - Run `npm run test:fe:unit -- src/__tests__/NetworkStabilityAndIdlePurity.test.tsx`.

---

### Task 2: Integrate Cognitive Latency Deferral into State Boundaries

**Files:**
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Modify: `frontend/src/components/workbench/LocalizedBoundary.tsx`
- Test: `frontend/src/__tests__/useDeferredSkeleton.test.ts`
- Test: `frontend/src/__tests__/WorkspaceFrame.test.tsx`

**Deliverable:** Wire `useDeferredSkeleton` (150ms delay threshold, 250ms min duration) into all state boundaries, guaranteeing zero rapid skeleton flashes for sub-150ms cache or fast network responses.

- [ ] **Step 1: Write failing tests verifying deferred skeleton behavior in `WorkspaceFrame.test.tsx`**
  - When `isLoading=true` for 50ms, skeleton is suppressed (0ms visual flicker).
  - When `isLoading=true` for 200ms, skeleton displays and persists for at least 250ms.
- [ ] **Step 2: Run test to confirm failure**
  - Run `npm run test:fe:unit -- src/__tests__/WorkspaceFrame.test.tsx`.
- [ ] **Step 3: Wire `useDeferredSkeleton` into `StateBoundary.tsx`**
  - Replace raw `isLoading` with `const showSkeleton = useDeferredSkeleton(isLoading, 150, 250)`.
- [ ] **Step 4: Wire `useDeferredSkeleton` into `LocalizedBoundary.tsx`**
  - Suppress localized table skeleton if data arrives within 150ms.
- [ ] **Step 5: Run test to verify pass**
  - Run `npm run test:fe:unit -- src/__tests__/WorkspaceFrame.test.tsx`.

---

### Task 3: Implement Reserved Header Geometry & Zero-Jitter Badge Anchors

**Files:**
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx`
- Modify: `frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx`
- Modify: `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`
- Test: `frontend/src/__tests__/ZeroJitterHeaderGeometry.test.tsx`

**Deliverable:** Eliminate asynchronous horizontal layout jumps by wrapping status badges in reserved anchor slot containers (`min-w-[110px] h-8 flex items-center shrink-0`), guaranteeing 0px horizontal shift.

- [ ] **Step 1: Write unit test in `ZeroJitterHeaderGeometry.test.tsx`**
  - Verify that header selectors maintain identical bounding box / offsetLeft whether `batchStatus` is null or populated.
- [ ] **Step 2: Run test to confirm failure**
  - Run `npm run test:fe:unit -- src/__tests__/ZeroJitterHeaderGeometry.test.tsx`.
- [ ] **Step 3: Update `ReconciliationHeaderBranch.tsx`**
  - Wrap status badge in a reserved anchor slot with `animate-in fade-in duration-150`.
- [ ] **Step 4: Update `MrxBatchHeaderBranch.tsx` and `MrxDailyHeaderBranch.tsx`**
  - Enforce identical reserved slot geometry across all workbench headers.
- [ ] **Step 5: Run test to verify pass**
  - Run `npm run test:fe:unit -- src/__tests__/ZeroJitterHeaderGeometry.test.tsx`.

---

### Task 4: Complete Decomposition of Remaining MRX Routes (100% Coverage)

**Files:**
- Create: `frontend/src/features/chef/branches/MrxCookingHeaderBranch.tsx` (~110 lines)
- Create: `frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx` (~170 lines)
- Refactor: `frontend/src/features/chef/MrxCookingWorkbench.tsx` (reduce from 370 lines to $\le 160$ lines)
- Create: `frontend/src/features/warehouse/branches/MrxPrepHeaderBranch.tsx` (~90 lines)
- Create: `frontend/src/features/warehouse/branches/MrxPrepAllocationsBranch.tsx` (~160 lines)
- Refactor: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx` (reduce from 325 lines to $\le 160$ lines)
- Create: `frontend/src/features/warehouse/branches/MrxDeltaHeaderBranch.tsx` (~80 lines)
- Create: `frontend/src/features/warehouse/branches/MrxDeltaTableBranch.tsx` (~140 lines)
- Refactor: `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx` (reduce from 280 lines to $\le 150$ lines)
- Test: `frontend/src/__tests__/Chef.test.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Deliverable:** Complete 100% Tree Architecture coverage across all remaining MRX surfaces. Eliminate the 280px header explosion in `MrxCookingWorkbench.tsx` and ensure every module is $\le 200$ lines.

- [ ] **Step 1: Inspect existing tests in `Chef.test.tsx` and `Warehouse.test.tsx`**
- [ ] **Step 2: Decompose `MrxCookingWorkbench.tsx`**
  - Extract `MrxCookingHeaderBranch.tsx` with reserved slot for shift selector and version badge.
  - Extract `MrxCookingDishListBranch.tsx` for recipe groups and ingredient rows.
  - Refactor `MrxCookingWorkbench.tsx` into a lean orchestrator ($\le 160$ lines).
- [ ] **Step 3: Decompose `MrxMultiCustomerPreparationWorkbench.tsx`**
  - Extract `MrxPrepHeaderBranch.tsx` and `MrxPrepAllocationsBranch.tsx`.
  - Refactor `MrxMultiCustomerPreparationWorkbench.tsx` into an orchestrator ($\le 160$ lines).
- [ ] **Step 4: Decompose `MrxSourceDeltaWorkbench.tsx`**
  - Extract `MrxDeltaHeaderBranch.tsx` and `MrxDeltaTableBranch.tsx`.
  - Refactor `MrxSourceDeltaWorkbench.tsx` into an orchestrator ($\le 150$ lines).
- [ ] **Step 5: Run unit tests to verify pass**
  - Run `npm run test:fe:unit -- src/__tests__/Chef.test.tsx src/__tests__/Warehouse.test.tsx`.

---

### Task 5: Decompose Monolithic Report Tables (`ReconciliationReportTables.tsx` 517 lines)

**Files:**
- Create: `frontend/src/features/reconciliation/branches/ReconciliationVariancesBranch.tsx` (~130 lines)
- Create: `frontend/src/features/reconciliation/branches/ReconciliationTransactionsBranch.tsx` (~120 lines)
- Create: `frontend/src/features/reconciliation/branches/ReconciliationAuditBranch.tsx` (~130 lines)
- Create: `frontend/src/features/reconciliation/branches/ReconciliationCompletedBranch.tsx` (~120 lines)
- Refactor: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx` (reduce from 517 lines to $\le 80$ lines)
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Deliverable:** The monolithic 517-line `ReconciliationReportTables.tsx` decomposed into 4 autonomous, single-responsibility branch components with independent data grids and download handlers.

- [ ] **Step 1: Extract `ReconciliationVariancesBranch.tsx`**
- [ ] **Step 2: Extract `ReconciliationTransactionsBranch.tsx`**
- [ ] **Step 3: Extract `ReconciliationAuditBranch.tsx`**
- [ ] **Step 4: Extract `ReconciliationCompletedBranch.tsx`**
- [ ] **Step 5: Refactor `ReconciliationReportTables.tsx` into a clean tab router ($\le 80$ lines)**
- [ ] **Step 6: Run test suite & architecture growth check**
  - Run `npm run test:fe:unit -- src/__tests__/Reconciliation.test.tsx`.
  - Run `node scripts/check-architecture-growth.mjs`.

---

### Task 6: Full-Stack Verification & Live Audit

**Files:**
- Script: `scripts/verify-precommit-gate.mjs`
- Test: `npx playwright test`
- Test: `dotnet test backend/IPCManagement.slnx`

**Deliverable:** 100% green verification across all unit, integration, browser, and backend suites proving that the Tree Architecture decomposition preserves complete behavioral equivalence.

- [ ] **Step 1: Execute Enterprise Pre-Commit Verification Gate**
  - Run `npm run precommit:verify` (Gates A-E: 37 physical modules, 0 forbidden patterns, 0 files > 600 lines, Vite build clean, 27+ Vitest suites / 220+ tests PASS).
- [ ] **Step 2: Run Full Playwright Browser Test Suite**
  - Run `npx playwright test` (63/63 tests PASS in $\le 1.5$ minutes).
- [ ] **Step 3: Run Full Backend Test Suite**
  - Run `dotnet test backend/IPCManagement.slnx` (1,419 tests PASS).
- [ ] **Step 4: Verify Zero Idle Backend Requests**
  - Observe backend Kestrel logs while frontend is idle on `http://127.0.0.1:5173` for 60 seconds; confirm 0 incoming requests.
- [ ] **Step 5: Update WORK.md & Documentation**
  - Record complete verification evidence and transition to `IDLE`.
