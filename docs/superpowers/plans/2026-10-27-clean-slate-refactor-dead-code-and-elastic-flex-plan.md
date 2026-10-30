# Clean Slate Refactor: Dead-Code Elimination, Test-Audit Decoupling & Elastic Flexbox Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cleanly eliminate 21 orphan files (~45 kB dead code), prune `Primitives.test.tsx` down to < 500 lines, decouple brittle exact-text test assertions, and upgrade rigid flexbox layouts into fluid, elastic enterprise workbenches.

**Architecture:** Purge dead code across `hooks/`, `components/workbench/`, `components/ui/`, and `utils/`. Refactor `WorkspaceHeader.tsx` and `DataGrid` column definitions with the "Fixed-Numeric + Elastic-Entity" pattern. Decouple hardcoded string assertions in test suites.

**Tech Stack:** React 19, Tailwind CSS, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-clean-slate-refactor-dead-code-and-elastic-flex-spec.md`

---

## File Structure & Cleanup Manifest

### Files to Delete (21 Orphan Files)
- `frontend/src/hooks/useDebouncedAbortableQuery.ts`
- `frontend/src/hooks/useMutationLock.ts`
- `frontend/src/hooks/useOptimisticMutation.ts`
- `frontend/src/hooks/useRealtimeRowFlash.ts`
- `frontend/src/hooks/useRecordPermissions.ts`
- `frontend/src/hooks/useSmartPolling.ts`
- `frontend/src/hooks/useSwrQuery.ts`
- `frontend/src/hooks/useDeepDirtyTracking.ts`
- `frontend/src/hooks/useFormDependencyGraph.ts`
- `frontend/src/components/workbench/BatchSummaryPanel.tsx`
- `frontend/src/components/workbench/ConflictResolutionModal.tsx`
- `frontend/src/components/workbench/LazyHydratedCell.tsx`
- `frontend/src/components/workbench/StateAuditTimeline.tsx`
- `frontend/src/components/workbench/WidgetBoundary.tsx`
- `frontend/src/components/ui/bulk-action-bar.tsx`
- `frontend/src/components/ui/draft-restorable-banner.tsx`
- `frontend/src/components/ui/editable-field.tsx`
- `frontend/src/components/ui/form-field.tsx`
- `frontend/src/components/ui/textarea.tsx`
- `frontend/src/utils/rfc7807ErrorMapper.ts`
- `frontend/src/utils/domainStateMachine.ts`

### Files to Update
- `frontend/src/hooks/index.ts`: Remove deleted exports.
- `frontend/src/components/ui/index.ts`: Remove deleted exports.
- `frontend/src/components/workbench/index.ts`: Remove deleted exports.
- `frontend/src/__tests__/Primitives.test.tsx`: Prune dead code tests down to < 500 lines.
- `frontend/src/components/workbench/WorkspaceHeader.tsx`: Implement elastic fluid context selectors.
- `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`: Implement elastic entity column widths.
- `frontend/src/features/chef/MrxCookingWorkbench.tsx`: Implement elastic entity column widths.
- `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`: Implement elastic entity column widths.
- `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`: Implement elastic entity column widths.

---

## Tasks

### Task 1: Purge 21 Dead Code Files and Update Barrel Exports
- [ ] Delete the 9 dead hook files in `frontend/src/hooks/`.
- [ ] Delete the 5 dead workbench component files in `frontend/src/components/workbench/`.
- [ ] Delete the 5 dead UI primitive files in `frontend/src/components/ui/`.
- [ ] Delete the 2 dead utility files in `frontend/src/utils/`.
- [ ] Update `frontend/src/hooks/index.ts`, `frontend/src/components/ui/index.ts`, and `frontend/src/components/workbench/index.ts` to export only active production primitives.

### Task 2: Prune `Primitives.test.tsx` to Core Active Primitives
- [ ] Remove test suites for deleted dead components (`useDeepDirtyTracking`, `useFormDependencyGraph`, `WidgetBoundary`, `FormField`, `EditableField`, `BulkActionBar`, `DraftRestorableBanner`).
- [ ] Verify `Primitives.test.tsx` line count drops from 1,187 to < 500 lines.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Primitives.test.tsx` to verify all retained primitive tests pass.

### Task 3: Upgrade `WorkspaceHeader.tsx` to Elastic Fluid Context Selectors
- [ ] In `WorkspaceHeader.tsx`, remove hardcoded rigid width clamps and replace with `min-w-[140px] max-w-[240px] flex-1 sm:flex-initial`.
- [ ] Verify controls gracefully shrink and wrap without triggering horizontal clipping on viewports between 1024px and 1280px.

### Task 4: Upgrade DataGrid Columns to "Fixed-Numeric + Elastic-Entity"
- [ ] Update column definitions in `MrxDailyIssueWorkbench.tsx`, `MrxCookingWorkbench.tsx`, `MrxBatchWorkbench.tsx`, and `ReconciliationReportTables.tsx`.
- [ ] Assign fixed min-widths to numeric/date/status columns (`w-24 min-w-[96px]`, `w-28 min-w-[112px]`) with `shrink-0`.
- [ ] Assign `flex-1 min-w-[200px]` to primary descriptive columns (Ingredient Name, Dish Name).

### Task 5: Decouple Brittle Test Assertions
- [ ] Update tests in `Reconciliation.test.tsx`, `FullMrxModernizationSmoke.test.tsx`, and `Chef.test.tsx` to assert semantic elements and accessibility roles rather than fragile exact-sentence strings.
- [ ] Verify tests pass reliably without forcing artificial fallback strings into production components.

### Task 6: Full Verification & Quality Gates
- [ ] Run `npm run build -w frontend` to prove 0 TypeScript and Vite bundling errors.
- [ ] Run `node scripts/check-architecture-growth.mjs` verifying all FE files < 600 lines and all test files < 1500 lines.
- [ ] Run `node scripts/test-live-user-click-skeleton.mjs` verifying 0 skeleton, 0 empty, 0 layout collapse flashes across all 12 MRX links.
- [ ] Run full enterprise verification gate: `npm run precommit:verify` (100% PASS across all suites).
