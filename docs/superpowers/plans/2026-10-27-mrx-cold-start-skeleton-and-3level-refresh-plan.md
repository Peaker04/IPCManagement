# MRX Cold-Start Skeleton Normalization & 3-Level Refreshing Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 150ms cognitive delay skeleton deferral, 2px top micro-progress bar, 3-level refreshing patterns, and non-destructive error handling across all IPCManagement workbenches, verifying with 100% test passes.

**Architecture:** Implement `useDeferredSkeleton` hook enforcing the 150ms Doherty Threshold and 250ms min-duration; upgrade `StateBoundary.tsx` with a top 2px micro-progress bar and non-destructive error ribbons; ensure all MRX workbenches consume `useWorkbenchQuery` state props cleanly; audit through unit, integration, and live Playwright suites.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-mrx-cold-start-skeleton-and-3level-refresh-spec.md`

## Global Constraints

- Operational Mode Isolation (`DOM-MODE-1`): DEFAULT != MATERIAL_RECONCILIATION.
- Architecture limits: Strict $\le 600$ lines per FE source file; $\le 1500$ lines per test file.
- Zero-CLS & Zero-Skeleton Strobe: 0ms cache hydration on Render #1.
- No orphan code: Any hook or utility must have active production callers.

## Review Focus

- Fast network (<150ms) initial load: Skeleton must not flash for 1 frame.
- Background revalidation: Table must retain 100% opacity with a 2px micro-bar along top edge.
- Filter switch (context pivot): Table must be `opacity-70 pointer-events-none` with 2px micro-bar.
- Manual refresh failure: Stale table data must stay visible with an inline warning ribbon and retry button.
- Re-visiting station: Cache hit must render instantaneously with zero layout collapse.

---

### Task 1: Implement `useDeferredSkeleton` (150ms Doherty Threshold & Min-Duration Gate)

**Files:**
- Create: `frontend/src/hooks/useDeferredSkeleton.ts`
- Modify: `frontend/src/hooks/index.ts`
- Test: `frontend/src/__tests__/useDeferredSkeleton.test.ts`

- [ ] Write unit test `frontend/src/__tests__/useDeferredSkeleton.test.ts` testing:
  1. Does not show skeleton if `isLoading` resolves in <150ms.
  2. Shows skeleton if `isLoading` stays true for $\ge 150$ms.
  3. Enforces minimum duration ($250$ms) once skeleton is shown to prevent visual jerk.
- [ ] Implement `frontend/src/hooks/useDeferredSkeleton.ts`.
- [ ] Export `useDeferredSkeleton` in `frontend/src/hooks/index.ts`.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/useDeferredSkeleton.test.ts` and verify all tests pass.

---

### Task 2: Upgrade `StateBoundary.tsx` with 3-Level Refreshing Patterns & 2px Top Micro-Progress Bar

**Files:**
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

- [ ] Integrate `useDeferredSkeleton` into `StateBoundary` for `isLoading && !hasExistingData`.
- [ ] Add 2px Top Micro-Progress Bar (`h-0.5 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400 animate-pulse absolute top-0 left-0 right-0 z-30`) when `(isFetching && hasExistingData) || isPreviousData`.
- [ ] Refine Level 1 background revalidation: Keep table at 100% opacity without dimming when just revalidating same context.
- [ ] Refine Level 2 context pivot: Keep table at `opacity-70 pointer-events-none` when `isPreviousData` is true.
- [ ] Refine Level 3 manual refresh: Ensure inline error ribbon keeps existing data visible when `error && hasExistingData`.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Primitives.test.tsx` and verify all tests pass.

---

### Task 3: Verify Architecture Limits, Types, & Pre-Commit Quality Gates

**Files:**
- Audit: All modified files
- Script: `scripts/verify-precommit-gate.mjs`

- [ ] Run `node scripts/check-architecture-growth.mjs` to verify zero files exceed 600 lines.
- [ ] Run `npm --prefix frontend run build` to verify clean TypeScript compilation and Vite build.
- [ ] Run `npm run precommit:verify` to verify all 5 pre-commit quality gates pass.

---

### Task 4: Comprehensive E2E Verification & Live MutationObserver Audit

**Files:**
- Script: `scripts/test-live-user-click-skeleton.mjs`
- Tests: `frontend/tests/browser/*.spec.ts`

- [ ] Run `node scripts/test-live-user-click-skeleton.mjs` to verify 0 skeleton flashes, 0 empty state flashes, and 0 layout shifts across all 12 MRX links.
- [ ] Run `npx playwright test` to verify all 63 browser tests pass 100%.
- [ ] Run `dotnet test backend/IPCManagement.slnx` to verify backend integrity.
- [ ] Update `.planning/WORK.md` and log completed verification evidence.
