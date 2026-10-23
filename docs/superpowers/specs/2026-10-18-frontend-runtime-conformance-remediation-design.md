# Frontend Runtime Conformance Remediation Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner review  
**Scope:** Frontend navigation, operational-mode isolation, runtime query/loading behavior, UI architecture integrity, accessibility, responsive workbenches, and conformance evidence.

## 1. Intent

The current frontend has a real 3-zone workbench foundation, but several contracts are inventories rather than runtime owners. This program turns the declared architecture into production behavior and replaces percentage claims based only on already-declared screens with capability-, actor-, mode-, and state-based evidence.

The program must not create synthetic data, fake success, or new write surfaces merely to improve coverage. `DEFAULT != MATERIAL_RECONCILIATION` remains absolute. Backend policy and persisted data remain authoritative.

## 2. Source-backed baseline

The audit established:

- The sidebar exposes the 23 declared workbench surfaces, but 119 operation-grain capabilities currently have no `surfaceId`; all FR assessments remain `PARTIAL` in `docs/conformance-contracts.json`.
- `AppShell` filters navigation by route role only. `operationalMode` is displayed but does not participate in leaf eligibility, so DEFAULT and MRX workflow destinations are mixed.
- `admin.cache` and `admin.diagnostics` are counted as full screens without matching runtime contracts: cache has an unregistered local destructive action; diagnostics hardcodes runtime facts and does not call a health authority.
- `scopedQuery.ts` has no production caller. Its current hook does not initiate cold fetches, ignores `staleTime`, does not pass/own an `AbortSignal`, and cannot retain a previous key's data during pagination/filter changes.
- Route-specific skeleton geometry is used for lazy chunk loading only. Feature API loading falls back to generic StateBoundary geometry because production pages do not pass `loadingGeometry`.
- Modal and dirty-navigation dialogs do not trap/restore focus or inert the background.
- `index.css` defines semantic tokens, but components predominantly use physical Tailwind color utilities.
- Split master-detail pages do not adapt to supported tablet widths.
- AGENTS, DESIGN, UI-KIT, route-screen coverage, defect register, and runtime dimensions disagree.

## 3. Goals

1. Make one canonical navigation contract own route, leaf, role, permission, mode, capability, surface, and label metadata.
2. Present distinct DEFAULT and MRX navigation trees while retaining explicitly shared master/system surfaces.
3. Measure coverage from canonical requirements and capabilities, not from the number of screens already implemented.
4. Make query state determine loading UX consistently across first load, warm navigation, tabs, pagination, filtering, refresh, mutation, errors, and empty results.
5. Use route-resolved geometry for both lazy-module and API-data cold loading.
6. Remove or fail-close unsupported support pages rather than mapping unrelated capabilities to them.
7. Complete dialog focus lifecycle, tablet workbench adaptation, and semantic styling ownership.
8. Preserve current DTO truth, server pagination, stale-response safety, RBAC, and DOM-MODE-1.

## 4. Non-goals

- No new Backend endpoint, migration, seed, import, or database mutation.
- No automatic exposure of the 119 capabilities without surfaces.
- No one-tab-per-controller navigation.
- No package installation or replacement state-management framework.
- No visual redesign beyond corrections required by existing Quiet Operational rules.
- No conversion of blocked/partial writes to READY without Backend concurrency and policy authority.
- No live mode switch or production data mutation as part of automated verification.

## 5. Canonical navigation model

Extend the existing route registry rather than creating a fourth inventory.

```ts
type OperationalModeEligibility = 'SHARED' | 'DEFAULT' | 'MATERIAL_RECONCILIATION';

interface RouteLeafDef {
  id: string;
  to: string;
  label: string;
  surfaceId: string;
  capabilityIds: string[];
  allowedRoles?: string[];
  permissions?: string[];
  modes: OperationalModeEligibility[];
  readiness: 'READY' | 'PARTIAL' | 'BLOCKED';
}

interface RouteDef {
  path: string;
  title: string;
  frCode: string;
  allowedRoles?: string[];
  permissions?: string[];
  modes: OperationalModeEligibility[];
  leaves?: RouteLeafDef[];
}
```

A pure resolver must return visible routes/leaves from `{user, permissions, operationalMode}`. `AppShell` and `RoleGuard` consume the same resolver. Backend authorization remains final.

### 5.1 DEFAULT tree

May include Dashboard, Weekly Menu DEFAULT views, Meal Orders, Approvals, Purchasing, DEFAULT Warehouse, DEFAULT Chef, DEFAULT Reports, and authorized shared administration.

### 5.2 MRX tree

Must not expose DEFAULT Purchasing, DEFAULT MaterialDemand/KHSX, DEFAULT Chef, or DEFAULT reports. MRX work objects are grouped by operator journey:

1. Source and freeze.
2. Daily warehouse issue.
3. Cooking export.
4. Actuals and dispositions.
5. Completion and MRX audit.

Only existing READY surfaces are navigable. Missing surfaces remain explicit gaps in the capability matrix; they are not placeholder pages.

### 5.3 Shared tree

Shared master data and authorized system-mode settings may appear in both modes. Sharing the navigation destination does not merge workflow queries, commands, lineage, or audit families.

## 6. Support page ruling

### 6.1 Diagnostics

`admin.diagnostics` must be hidden/removed until it consumes an authorized health/runtime contract. It must not display hardcoded database, server, URL, proxy, or authentication health facts. If reintroduced, every measurement includes source, timestamp, loading/error/retry state, and no secrets.

### 6.2 Browser cache

`admin.cache` is not a business capability. Remove it from primary N6 business navigation. If retained as an Admin support action, register it as an explicit local action, explain exact keys, require confirmation, preserve the authenticated session, and immediately re-fetch server mode. The UI must never render DEFAULT as authority while a mode snapshot is unresolved.

## 7. Query and loading state contract

### 7.1 Required state model

```ts
type QueryPhase =
  | 'idle'
  | 'cold-loading'
  | 'ready'
  | 'refreshing'
  | 'transitioning'
  | 'error-without-data'
  | 'error-with-data'
  | 'empty';
```

The query owner distinguishes data presence from network activity. `isLoading` must never stand for both cold load and background refresh.

### 7.2 Loading UX matrix

| Situation | Required behavior |
|---|---|
| First page open, no data | Route-resolved skeleton in content region only |
| First visit to an unloaded route | Route-resolved Suspense skeleton until module resolves; API cold load continues with identical geometry |
| Return to a route with fresh cache | Render cached data immediately; no skeleton and no request |
| Return to a route with stale cache | Render cached data immediately and refresh in background |
| First visit to a tab/key without cache | Skeleton only in the tab's content work object |
| Return to an opened tab | Render cached tab data; background refresh only when stale |
| Table page 1 → 2 | Use cached page 2 if present; otherwise keep page 1 temporarily with explicit “Đang tải trang 2” state |
| Filter/search change | Keep prior rows temporarily, visibly mark scope as updating, and prevent old scope from being mistaken for final data |
| Manual Refresh | Keep content; show compact refresh progress in the Refresh control/subbar |
| Form submit | Keep page context; pending state and duplicate-submit guard belong to submit button/action region |
| Refresh fails with prior data | Keep prior data and show a non-destructive inline error with retry |
| Cold request fails | Error state with retry; no table and no synthetic rows |
| Successful response is empty | Empty/prerequisite/filter-empty state; never skeleton |
| Permission/mode conflict | Resolve to permission-denied or mode-blocked state; never generic error or empty |

### 7.3 Scoped query requirements

The existing zero-dependency engine may remain only if it becomes the production owner. It must:

- auto-fetch an enabled cold query;
- return `idle` when disabled;
- honor `staleTime`;
- deduplicate exact in-flight keys;
- partition by mode, actor/role, scope, and query key;
- preserve the last observed data across key changes when `keepPreviousData` is true;
- pass an AbortSignal and ignore aborted results;
- retain data on refresh failure;
- expose `isInitialLoading`, `isFetching`, `isRefetching`, `isPreviousData`, and `refetch` without contradictory combinations;
- clear/invalidate mode-owned entries on a confirmed mode transition;
- avoid persisting business payloads to localStorage.

Adoption starts with Reports because it exercises tabs, filters, pagination, refresh, empty and error states. Admin Data follows after the owner contract is proven. Other pages migrate only when their distinct behavior is covered.

## 8. Loading geometry ownership

`workbenchSurfaceRegistry` remains the geometry authority. Add a route-level hook/context returning the resolved surface. Both `RouteWorkbenchLoadingFallback` and `StateBoundary` use the same geometry. Feature pages must not copy column/row literals.

A test must reproduce and reject the two-stage mismatch: route Suspense split/matrix skeleton followed by a generic six-column API skeleton.

## 9. StateBoundary responsibilities

`StateBoundary` renders presentation from explicit query state; it does not infer cold vs refresh from one overloaded boolean. It owns:

- cold skeleton;
- permission/mode/error/empty/partial/write-reconciliation presentation;
- non-destructive refresh error;
- previous-data updating overlay/banner.

It does not own fetching, cache keys, pagination, or mutations.

## 10. Mutation UX

Mutations use a separate pending state. Submit buttons expose `disabled`, `aria-busy`, and stable pending copy. Existing page data stays visible. Conflict/permission feedback remains local to the mutation and must not replace a successful read work object.

## 11. Accessibility

Use one shared dialog lifecycle owner for Modal and dirty-navigation decisions:

- initial focus;
- Tab/Shift+Tab containment;
- Escape behavior respecting dirty state;
- background inertness;
- focus restoration;
- one blocking overlay;
- cleanup on unmount.

Tablet sidebars and split views must provide keyboard-equivalent close/back behavior.

## 12. Responsive workbench

Desktop retains split 60/40 or 65/35. At supported tablet widths where the master becomes unusable, show one pane at a time: list first, detail drill-in, explicit Back to list. Data tables retain horizontal scrolling, sticky header, and identifier column without compressing both panes into an unusable layout.

## 13. Styling ownership

`frontend/src/styles/index.css` remains the single color-token authority. Shared components migrate from physical Tailwind colors to semantic token-backed utilities/classes. Migration starts at AppShell, StateBoundary, Modal, DataGrid and ActionGuard; feature pages inherit rather than creating new token families.

## 14. Coverage and evidence model

Replace “25/25 screens = 100% product coverage” with four metrics:

1. Requirement coverage.
2. Capability-to-surface coverage.
3. Actor × mode eligibility coverage.
4. Surface × runtime-state coverage.

Every missing surface remains `NO_SURFACE`, `PARTIAL`, `BLOCKED`, or `BACKEND_CAPABILITY_GAP`. No allowlist or placeholder page may turn it green.

Tests must prove behavior at the strongest owner boundary:

- pure resolver tests for route/leaf eligibility;
- real component DOM tests for cold/warm/refresh/transition/error/empty;
- API mocks only at network boundary with exact C# DTO fixtures;
- Playwright for focus, geometry continuity, tablet pane behavior, and DEFAULT/MRX navigation;
- no test that only asserts registry counts or copied arrays.

## 15. Acceptance criteria

- DEFAULT and MRX sidebar trees contain no cross-mode workflow leaves.
- Unknown/unauthorized deep links fail closed before feature API fetch.
- Diagnostics and cache no longer inflate business-screen coverage.
- Reports proves every row of the loading UX matrix applicable to tabs, pagination, filters and refresh.
- Cold API loading uses the same route geometry as Suspense loading.
- Warm cache navigation never shows a skeleton.
- Refresh/pagination/filter failures retain prior data with truthful updating/error feedback.
- Successful empty responses render Empty State.
- Submit pending state is local and duplicate-safe.
- Modal and dirty-navigation focus lifecycle passes keyboard/browser tests.
- Tablet Approvals/Purchasing provide usable single-pane flow.
- Semantic token migration leaves no physical color authority in shared components except documented technical exceptions.
- Conformance reports show capability and actor-mode gaps without claiming full product completion.
- Unit, lint, dependency, build, conformance, focused Playwright, and zero-fake/test-audit gates pass.

## 16. Deferred decisions

- Exact MRX leaf labels beyond currently delivered capabilities require Owner approval against the bounded MRX workflow before implementation.
- Whether support diagnostics returns later depends on an authorized Backend health contract.
- Capability write surfaces remain deferred until Backend concurrency and permission contracts are READY.
