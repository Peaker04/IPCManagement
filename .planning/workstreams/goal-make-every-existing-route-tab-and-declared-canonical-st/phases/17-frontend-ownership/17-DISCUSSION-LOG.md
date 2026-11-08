# Phase 17: Frontend ownership - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 17-frontend-ownership
**Areas discussed:** endpoint ownership, layout ownership, dependency debt, page-model boundaries, verification

---

## Endpoint ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Multiple API slices | Give each feature an independent reducer/base query/cache namespace. | |
| One shared slice with feature injection | Keep one transport/cache owner and move endpoint definitions to feature-owned modules without hook/cache drift. | ✓ |
| Leave the monolith | Keep `workflowApi.ts` intact and only document ownership. | |

**User's choice:** Keep one `apiSlice`; do not drift endpoints, public hooks, cache keys/tags, or UI behavior.
**Notes:** This constraint was explicit in the resume request and Part F, so it was not re-asked.

---

## Layout ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Keep layout under shared components | Retain the existing reverse imports into app/auth/routes. | |
| Move layout to app ownership | Put the shell that coordinates store, auth, routes, and preload under `app/layout`. | ✓ |
| Duplicate shell pieces | Split visual and orchestration copies across app/shared. | |

**User's choice:** Move `MainLayout` to `app/layout` while preserving navigation and UI behavior.
**Notes:** Part F locks this ownership decision.

---

## Dependency debt

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the 54-entry baseline | Continue ignoring current reversals and only block new debt. | |
| Retire to zero | Resolve R1/R2/R3 ownership and keep only explicitly justified, owned, expiring exceptions. | ✓ |
| Weaken dependency rules | Adjust dependency-cruiser so the current graph passes. | |

**User's choice:** Resolve all 54 violations to a zero baseline, with strict metadata for any unavoidable exception.
**Notes:** Browser UAT todo is folded into verification; customer workbench todo is outside this phase.

---

## Page-model boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Big-bang rewrite | Redesign Admin and Reports state/UI while moving files. | |
| Panel/use-case extraction | Split existing models along current panel responsibilities after ownership stabilizes. | ✓ |
| Leave oversized models | Defer decomposition to the growth-gate phase. | |

**User's choice:** Split `useAdminDataPageModel` and `useReportsPageModel` by panel/use case without behavior drift.
**Notes:** Step 18 growth enforcement remains out of scope until Gate 17 is green.

---

## Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Static checks only | Stop after TypeScript/lint/dependency checks. | |
| Full structural and runtime gate | Run unit, lint, dependency, build, contract, backend regression, and three-viewport headed-browser checks. | ✓ |
| Mutating E2E reset | Reset/seed/import the lane and rerun the full business lifecycle. | |

**User's choice:** Run full gates and headed-browser verification without reset, seed, import, push, or preserved-lane mutation.
**Notes:** GitNexus upstream impact precedes every symbol edit and staged `detect_changes` precedes every commit.

## the agent's Discretion

- Exact module file names, compatibility re-export mechanics, shared contract placement, and atomic wave grouping, within the locked preservation constraints.

## Deferred Ideas

- Customer weekly-menu template workbench — new capability, outside Phase 17.
