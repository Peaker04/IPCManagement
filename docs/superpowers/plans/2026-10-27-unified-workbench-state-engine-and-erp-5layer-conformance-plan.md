# Unified Workbench State Engine & ERP 5-Layer Conformance Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eradicate patchwork state logic across all 14 routes and 12 MRX subviews by building a unified `useWorkbenchQuery` hook enforcing the 5-layer state machine, synchronous Render #1 SWR hydration, and atomic parameter transitions.

**Architecture:** Create a canonical `useWorkbenchQuery` hook in `frontend/src/hooks/useWorkbenchQuery.ts` that unifies `serverStateCache`, snapshots, `keepPreviousData`, and normalized `<StateBoundary {...stateProps}>` output. Migrate the 7 core MRX workbenches onto this single state engine, proving 100% compliance via unit state tests and live Playwright MutationObserver.

**Tech Stack:** React 19, TypeScript, Vitest, Playwright, Tailwind CSS, SWR RAM Cache.

**Spec:** `docs/superpowers/specs/2026-10-27-unified-workbench-state-engine-and-erp-5layer-conformance-spec.md`

---

## File Structure & Responsibilities

| File Path | Role & Responsibility | Max Lines |
| :--- | :--- | :---: |
| `frontend/src/hooks/useWorkbenchQuery.ts` | **NEW**: Canonical 5-layer state engine, SWR caching, snapshot persistence, and atomic transitions | < 200 lines |
| `frontend/src/__tests__/useWorkbenchQuery.test.ts` | **NEW**: Unit test proving all 5 layers (L1–L5) and transitions in isolation | < 250 lines |
| `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx` | Daily warehouse station: refactored to consume `useWorkbenchQuery` | < 595 lines |
| `frontend/src/features/chef/MrxCookingWorkbench.tsx` | Cooking sheet station: refactored to consume `useWorkbenchQuery` | < 450 lines |
| `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx` | Batch prep station: refactored to consume `useWorkbenchQuery` | < 580 lines |
| `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx` | Multi-customer prep: refactored to consume `useWorkbenchQuery` | < 380 lines |
| `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx` | Delta queue: refactored to consume `useWorkbenchQuery` | < 320 lines |
| `frontend/src/features/reconciliation/ReconciliationPage.tsx` | Reconciliation workbench: refactored to consume `useWorkbenchQuery` | < 595 lines |
| `frontend/src/features/admin/AdminDataPage.tsx` | Catalog administration: refactored to consume `useWorkbenchQuery` | < 400 lines |

---

## Tasks

### Task 1: Build the Canonical `useWorkbenchQuery` Hook
- [ ] Create `frontend/src/hooks/useWorkbenchQuery.ts`.
- [ ] Implement synchronous Render #1 cache derivation from `serverStateCache` (`snapshotKey` or `cacheKey`).
- [ ] Implement atomic `keepPreviousData`: parameter transitions preserve `data` while activating `isFetching = true`.
- [ ] Implement mathematically disjoint 5-layer state output (`L1_HYDRATED_READY`, `L2_ERROR_OR_BLOCKED`, `L3_BOOTSTRAPPING_OR_LOADING`, `L4_NO_SCOPE_AVAILABLE`, `L5_EMPTY_DATASET`).
- [ ] Export normalized `stateProps` directly compatible with `<StateBoundary {...stateProps}>`.

### Task 2: Author Focused Unit Tests for `useWorkbenchQuery`
- [ ] Create `frontend/src/__tests__/useWorkbenchQuery.test.ts`.
- [ ] Test Case 1: L1 Hydrated Ready — cache hit synchronously initializes `data` with `isLoading: false`, `hasExistingData: true`.
- [ ] Test Case 2: L2 Error/Blocked — 409 legacy compatibility error correctly surfaces without skeleton flash.
- [ ] Test Case 3: L3 Bootstrapping — empty cache + catalog loading yields `isLoading: true`, `hasExistingData: false`, `isEmpty: false`.
- [ ] Test Case 4: L4 No Scope Available — catalog loaded + empty scope ID yields `isEmpty: true`, `isLoading: false`.
- [ ] Test Case 5: L5 Empty Dataset — valid scope + 0 rows yields honest empty state with `hasExistingData: true`.
- [ ] Test Case 6: Parameter Transition — changing `cacheKey` retains previous data with `isFetching: true` until resolution.

### Task 3: Migrate Core MRX Workbenches onto `useWorkbenchQuery`
- [ ] Refactor `MrxDailyIssueWorkbench.tsx` to consume `useWorkbenchQuery`.
- [ ] Refactor `MrxCookingWorkbench.tsx` to consume `useWorkbenchQuery`.
- [ ] Refactor `MrxBatchWorkbench.tsx` to consume `useWorkbenchQuery`.
- [ ] Verify file line counts remain strictly under 600 lines (`node scripts/check-architecture-growth.mjs`).

### Task 4: Migrate Satellite MRX Workbenches onto `useWorkbenchQuery`
- [ ] Refactor `MrxMultiCustomerPreparationWorkbench.tsx` to consume `useWorkbenchQuery`.
- [ ] Refactor `MrxSourceDeltaWorkbench.tsx` to consume `useWorkbenchQuery`.
- [ ] Refactor `AdminDataPage.tsx` to consume `useWorkbenchQuery` with isolated subview keys.
- [ ] Ensure `ReconciliationPage.tsx` lines-tab and report-tabs cleanly interface with the canonical engine.

### Task 5: Full Verification & Quality Gates
- [ ] Run `npm run build -w frontend` to prove 0 TypeScript and bundling errors.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/useWorkbenchQuery.test.ts` and `src/__tests__/MrxFiveLayerStateMachine.test.tsx`.
- [ ] Run `node scripts/test-live-user-click-skeleton.mjs` verifying 0 skeleton, 0 empty, 0 layout collapse flashes across all 12 MRX sidebar links.
- [ ] Run full enterprise quality gate: `npm run precommit:verify` (25+ test suites, 100% PASS, strict architecture limits).
