# Clean Slate Refactor: Dead-Code Elimination, Test-Audit Decoupling & Elastic Flexbox Layouts Specification

- **Feature Code**: `ARCH-CLEAN-SLATE-01` / `UX-ELASTIC-FLEX-01`
- **Canonical Design Contract**: `docs/DESIGN.md` (Sections 1–6, Rules `D1–D9`, `T1–T16`, `C1–C6`, `UXR-01–05`, `NFR-UI-01–05`)
- **Audit Invariants**: `.pi/skills/ipc-test-audit/SKILL.md` (Rules `TA-1` through `TA-5`)
- **Creation Date**: 2026-10-27
- **Status**: APPROVED & LOCKED

---

## 1. Problem Statement & Motivation

### 1.1. Technical Debt & Orphan Code (AI Slop)
Past development cycles produced **21 orphan files** (~45 kB) in `frontend/src/` that have **zero production callers**:
- 7 dead custom query/polling hooks (`useDebouncedAbortableQuery`, `useMutationLock`, `useOptimisticMutation`, `useRealtimeRowFlash`, `useRecordPermissions`, `useSmartPolling`, `useSwrQuery`).
- 2 dead tracking hooks (`useDeepDirtyTracking`, `useFormDependencyGraph`) only imported by `Primitives.test.tsx`.
- 5 dead workbench composites (`BatchSummaryPanel`, `ConflictResolutionModal`, `LazyHydratedCell`, `StateAuditTimeline`, `WidgetBoundary`).
- 5 dead UI primitives (`bulk-action-bar`, `draft-restorable-banner`, `editable-field`, `form-field`, `textarea`).
- 2 dead utility files (`rfc7807ErrorMapper`, `domainStateMachine`).

These files violate the core repository invariant in `docs/superpowers/specs/2026-10-22-mrx-production-runtime-closure-design.md:39`:
> *"Any code that only exists to be imported by its own unit test is classified as AI SLOP and is strictly prohibited."*

`Primitives.test.tsx` grew to **1,187 lines** purely to maintain tautological tests for these dead components, creating cognitive overhead and slowing down test runners.

### 1.2. Rigid, "Thô cứng" Flexbox Layouts
1. **Header Clamping**: `WorkspaceHeader` and its selector controls rely on static rigid widths (`w-44 sm:w-52 shrink-0`, `w-48 sm:w-56 shrink-0`, `w-72 font-medium`). On screens between $1024\text{px}$ and $1280\text{px}$, controls trigger horizontal clipping or an awkward inner scrollbar (`overflow-x-auto no-scrollbar`).
2. **Fixed Percentage Table Columns**: Data columns use static percentages (`width: '28%'`, `width: '16%'`) without minimum pixel widths. On smaller viewports, Vietnamese text truncates abruptly; on wide $2K$ monitors, numbers are separated from their context by excessive whitespace.

### 1.3. Fragile Exact-Text Assertions in Test Suites
Tests currently assert brittle exact strings (`expect(await screen.findByText('Chưa có nguồn thực đơn đã phát hành'))`, `expect(screen.getByText(/Phiên bản lô:/i))`). When UI microcopy is optimized or shortened for compact density, tests fail despite correct business behavior.

---

## 2. Architectural Design & Solutions

### 2.1. Clean Slate Refactor (Net-Negative Codebase)
1. Delete all 21 dead files.
2. Clean barrel exports in `frontend/src/hooks/index.ts`, `frontend/src/components/ui/index.ts`, and `frontend/src/components/workbench/index.ts`.
3. Prune `Primitives.test.tsx` by deleting test suites that only test dead code, reducing its size from 1,187 lines to **< 500 lines**.

### 2.2. Elastic Enterprise Flexbox Architecture
1. **Fluid Context Selectors (`WorkspaceHeader.tsx`)**:
   - Replace rigid fixed widths with elastic bounds:
     `min-w-[140px] max-w-[240px] flex-1 sm:flex-initial`
   - Selectors smoothly adapt to available header whitespace without triggering horizontal scroll or clipping.
2. **"Fixed-Numeric + Elastic-Entity" DataGrid Layout**:
   - Numeric and metadata columns: Fixed pixel width with `shrink-0` (`w-24 min-w-[96px]` for numbers, `w-28 min-w-[112px]` for dates and status).
   - Entity description columns (Ingredient Name, Dish Name): Elastic `flex-1 min-w-[200px]` absorbing remaining whitespace.
   - Preserves `T7` (frozen column & sticky header) and `T8` (compact density 36–40px).

### 2.3. Semantic Test-Audit Decoupling
1. Refactor brittle tests in `Reconciliation.test.tsx`, `FullMrxModernizationSmoke.test.tsx`, and `Chef.test.tsx` to assert semantic roles, `data-testid`, and accessible labels (`aria-label`) rather than hardcoded full-sentence strings.
2. Free production components to deliver clean, natural Vietnamese microcopy.
