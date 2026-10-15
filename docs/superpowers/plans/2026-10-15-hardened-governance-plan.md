# Hardened Governance & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all hardened governance fixes from `docs/SPEC-HARDENED-GOVERNANCE.md`: eliminate Rule D6 typography violations (all text >= 12px), enforce Rule D7 single primary button on `/approvals`, add `prefers-reduced-motion` and motion timing <= 150ms (`NFR-UI-05`), clean test logs in `setup.ts`, implement route-level code splitting (`React.lazy`), and verify with `npm run verify`.

**Architecture:** 5-Layer Governance Model (`AGENTS.md`). Single CSS authority with flat tokens (`index.css`), 10 UI primitives + 5 flat workbench composites, pure one-way dependency flow, live ASP.NET Core Kestrel API client with `AbortSignal`, and `<StateBoundary>` managing 6 UI states.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS v4, `@base-ui/react/popover`, `lucide-react`, `@testing-library/react`, Vitest, ASP.NET Core .NET 9.

**Spec:** `docs/SPEC-HARDENED-GOVERNANCE.md`

## Global Constraints
- Zero Text < 12px (Rule D6): Every label, badge, tooltip, and number must be at least `text-xs` (`12px`). Zero occurrences of `text-[11px]` or `text-[10px]`.
- Single Primary Action (Rule D7): Exactly one `variant="default"` primary button per view/panel.
- Motion Timing <= 150ms & Reduced Motion (NFR-UI-05): Max transition duration 150ms; `@media (prefers-reduced-motion: reduce)` must disable all animations and transitions.
- Route-level Code Splitting (NFR-PERF-01): `App.tsx` uses `React.lazy()` + `<Suspense>` to reduce entry bundle size below 250 kB.
- Test Log Hygiene (Rule TA-2 / Cleanliness): `setup.ts` mocks `window.alert` to ensure zero JSDOM noise during test runs.

## Review Focus
1. **Zero Text < 12px**: `rg "text-\[1[01]px\]|text-\[9px\]|text-\[8px\]" frontend/src/` must return exactly 0 results.
2. **Single Primary on Approvals**: Visual inspection of `ApprovalPage.tsx` shows only the `WorkspaceHeader` button has `variant="default"`.
3. **Reduced Motion Support**: `frontend/src/styles/index.css` must include `@media (prefers-reduced-motion: reduce)` targeting all elements with `0.01ms` duration.
4. **Clean Test Logs**: Running `npm run test:fe:unit` must produce 0 lines of `Not implemented: Window's alert() method`.
5. **Code Splitting & Bundle Build**: Running `npm run build:fe` creates split chunks for operational routes and builds with 0 errors.

---

### Task 1: Eliminate Rule D6 Typography Violations (Font Floor >= 12px)

**Files:**
- Modify: `frontend/src/features/weekly-menu/views/WeeklyScheduleView.tsx:64`
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx:120,229`
- Modify: `frontend/src/features/auth/LoginPage.tsx:134`
- Modify: `frontend/src/components/workbench/AppShell.tsx:273`
- Modify: `frontend/src/components/ui/badge.tsx:21`
- Modify: `frontend/src/components/ui/identifier-text.tsx:50`
- Modify: `frontend/src/components/ui/tabs.tsx:67,78`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

**Interfaces:**
- Consumes: Tailwind `text-xs` (`12px`)
- Produces: UI components with font sizes strictly >= 12px.

- [ ] **Step 1: Replace all `text-[11px]` and `text-[10px]` with `text-xs` across all 9 locations**
- [ ] **Step 2: Run verification scan for `< 12px` font sizes**
  Run: `rg "text-\[1[01]px\]|text-\[9px\]|text-\[8px\]" frontend/src/`
  Expected: 0 matches.
- [ ] **Step 3: Run unit tests to verify no layout/visual regression**
  Run: `npm run test:unit -w frontend -- src/__tests__/Primitives.test.tsx src/__tests__/AppShell.test.tsx`
  Expected: PASS
- [ ] **Step 4: Commit**
  `git commit -m "fix(typography): enforce Rule D6 font floor >= 12px across all surfaces"`

---

### Task 2: Enforce Rule D7 Single Primary Action on `/approvals`

**Files:**
- Modify: `frontend/src/features/approvals/ApprovalPage.tsx:358`
- Test: `frontend/src/__tests__/Approvals.test.tsx`

**Interfaces:**
- Consumes: `<Button variant="outline">`
- Produces: `<ApprovalPage>` where only `WorkspaceHeader` contains the primary `bg-slate-900` action.

- [ ] **Step 1: Edit `frontend/src/features/approvals/ApprovalPage.tsx`**
  Change the button in the detail panel from `variant="default"` to `variant="outline"`.
- [ ] **Step 2: Run approvals unit test**
  Run: `npm run test:unit -w frontend -- src/__tests__/Approvals.test.tsx`
  Expected: PASS
- [ ] **Step 3: Commit**
  `git commit -m "fix(approvals): enforce Rule D7 single primary action on WorkspaceHeader"`

---

### Task 3: Implement Reduced Motion & Standardize Motion Timing (NFR-UI-05)

**Files:**
- Modify: `frontend/src/styles/index.css`
- Modify: `frontend/src/components/workbench/AppShell.tsx:107`

**Interfaces:**
- Consumes: `@media (prefers-reduced-motion: reduce)`, Tailwind `duration-150 ease-out`
- Produces: Accessible motion system respecting user OS preferences and capping all transitions at 150ms.

- [ ] **Step 1: Add `@media (prefers-reduced-motion: reduce)` block to `frontend/src/styles/index.css`**
- [ ] **Step 2: Change Sidebar transition in `AppShell.tsx` from `duration-200` to `duration-150 ease-out`**
- [ ] **Step 3: Run AppShell unit test**
  Run: `npm run test:unit -w frontend -- src/__tests__/AppShell.test.tsx`
  Expected: PASS
- [ ] **Step 4: Commit**
  `git commit -m "feat(a11y): add prefers-reduced-motion query and cap transition duration at 150ms (NFR-UI-05)"`

---

### Task 4: Test Log Hygiene & Cleanliness

**Files:**
- Modify: `frontend/src/test/setup.ts`

**Interfaces:**
- Consumes: `vi.spyOn(window, 'alert')`
- Produces: Clean Vitest test runs with zero JSDOM warning noise.

- [ ] **Step 1: Add `vi.spyOn(window, 'alert').mockImplementation(() => {})` in `frontend/src/test/setup.ts`**
- [ ] **Step 2: Run all unit tests and inspect stdout for zero alert warnings**
  Run: `npm run test:fe:unit`
  Expected: 0 lines of `Not implemented: Window's alert() method`.
- [ ] **Step 3: Commit**
  `git commit -m "test(setup): mock window.alert to ensure clean test logs"`

---

### Task 5: Route-level Code Splitting & AbortSignal Support (NFR-PERF-01)

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `React.lazy()`, `React.Suspense`, `AbortSignal`
- Produces: Split bundle architecture with fallback skeleton, reducing entry chunk size.

- [ ] **Step 1: Add `signal?: AbortSignal` support in `src/api/client.ts`**
- [ ] **Step 2: Convert 12 operational routes in `src/App.tsx` to `React.lazy()` wrapped in `<Suspense>`**
- [ ] **Step 3: Run frontend build and verify chunk separation**
  Run: `npm run build:fe`
  Expected: Multiple route chunks created; entry chunk significantly smaller.
- [ ] **Step 4: Run all frontend unit tests to verify lazy loading renders cleanly**
  Run: `npm run test:fe:unit`
  Expected: 16/16 test files pass.
- [ ] **Step 5: Commit**
  `git commit -m "perf(bundle): implement route-level code splitting and AbortSignal support (NFR-PERF-01)"`

---

### Task 6: Full Pipeline Verification & Remote Push

**Files:**
- Modify: `.planning/WORK.md`

**Interfaces:**
- Consumes: Complete codebase
- Produces: 100% GREEN on `npm run verify`, clean git status, pushed to remote.

- [ ] **Step 1: Run full verification pipeline**
  Run: `npm run verify`
  Expected: All 11 checks PASS.
- [ ] **Step 2: Push commit to remote origin**
  `git push origin feature/greenfield-fe-3zone-workbench`
- [ ] **Step 3: Update `.planning/WORK.md`**
