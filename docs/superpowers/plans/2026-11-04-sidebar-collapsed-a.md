# Collapsed Sidebar A Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. No subagents, worktree changes or commits are authorized. Live checklist/evidence stays in `.planning/WORK.md`.

**Goal:** Fix collapsed header overlap, inconsistent navigation centering and missing user/logout footer without changing expanded or business behavior.

**Architecture:** Surgical changes within existing AppShell. Keep routing, role filtering, dirty-navigation, mode policy and logout authority in their existing owners.

**Tech Stack:** React/TypeScript, existing Tailwind utilities and Lucide icons, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-04-sidebar-collapsed-a-design.md`

## Global Constraints
- Collapsed width64px, expanded width240px; single collapsed header control40px, nav hit areas40×40.
- Preserve existing mobile overlay/trigger and guarded mode/logout behavior.
- No installs, delegates, resets, commits, DB actions, new primitives or CSS/token changes.
- Current owner instruction overrides automatic full-suite execution: select checks by task.

## Review Focus
- Expanded header and full user labels return after expanding.
- Direct and grouped links have identical collapsed geometry and accessible names.
- Non-admin cannot gain a mode settings link from the collapsed footer.
- Short viewport scrolls navigation, not footer offscreen.
- Logout invokes the existing real auth owner, not an inert icon or a new workflow.

## Task 1: Repair existing AppShell owner
**Modify:** `frontend/src/components/workbench/AppShell.tsx`
**Test:** `frontend/src/__tests__/AppShell.test.tsx`
**Consumes:** existing AppShell props, useAuth user/logout/hasRole, supplied navigation and dirty-navigation guard.
**Produces:** same API and commands, two properly rendered sidebar widths.

- [ ] Extend existing collapse/expand case to verify retained mode/profile/logout and single header control, named icon links and real logout; extend existing non-admin case for collapsed mode denial. No component or auth-owner mocks.
- [ ] Run `npm run test:fe:unit -- --run src/__tests__/AppShell.test.tsx --maxWorkers=1`; require an intended missing-footer/header regression failure.
- [ ] Conditionally render brand only when expanded; apply state-specific header/nav classes and keep a compact conditional footer layout mounted in both states.
- [ ] Rerun focused AppShell tests; require PASS with no weakened routing/draft tests.
- [ ] From frontend run `node ../node_modules/eslint/bin/eslint.js src/components/workbench/AppShell.tsx src/__tests__/AppShell.test.tsx` and `node ../node_modules/typescript/bin/tsc -b --pretty false`.
- [ ] Review diff, run scoped detector/diff check and confirm existing FE is still reachable. Do not claim browser geometry or business acceptance from DOM tests. Do not commit.
