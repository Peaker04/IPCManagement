# Phase 17: Frontend ownership - Research

**Researched:** 2026-07-29  
**Domain:** React/Vite frontend module ownership, RTK Query endpoint registration, dependency-cruiser DAG, and page-model decomposition  
**Confidence:** HIGH for repository facts; MEDIUM for the recommended boundary placement

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Endpoint ownership and compatibility
- **D-01:** Keep exactly one `apiSlice`, one base query/session-refresh pipeline, and one cache-tag registry. Feature-owned endpoint modules must inject into that shared slice rather than create independent API slices.
- **D-02:** Split `frontend/src/api/workflowApi.ts` by business owner without changing endpoint names, request shapes, query serialization, public hook names, tag types, provides/invalidates behavior, or import-time registration semantics.
- **D-03:** Add characterization checks before moving endpoints. The old public hook/export surface and generated OpenAPI TypeScript output must be compared deterministically after every slice.

### Layout and dependency ownership
- **D-04:** Move `MainLayout` from shared components to `frontend/src/app/layout`; app/store/router/auth orchestration belongs at the app composition layer. Preserve navigation, permission filtering, preload scheduling, responsive behavior, and route-loader cache behavior.
- **D-05:** Resolve `projects→coordination` through an explicit owner or a stable lower-level contract/API boundary. Do not introduce a replacement feature-to-feature import or duplicate endpoint/type definitions.
- **D-06:** Retire all 54 known dependency violations. The target is an empty baseline; any unavoidable exception must be explicit, narrowly scoped, and record a reason, owner, and expiry date.
- **D-07:** Treat the current dependency categories as separate atomic slices: 9 shared-to-feature/app reversals, 30 feature-to-feature imports, and 15 feature-to-app/router reversals. Do not hide debt by weakening or deleting dependency rules.

### Page-model decomposition
- **D-08:** Split `useAdminDataPageModel` and `useReportsPageModel` by existing panel/use-case boundaries only after endpoint/module ownership is stable. Keep the page shell and returned public model behavior stable.
- **D-09:** Extraction must not change query `skip` conditions, query args, mutation timing, toast/error behavior, pagination, permission/eligibility rendering, `QueryView` state semantics, refreshing/stale-data behavior, or DOM-visible UI.

### Atomic execution and verification
- **D-10:** Use small, reviewable commits ordered by dependency prerequisites and feature ownership. Before every symbol edit run GitNexus upstream impact; warn before HIGH/CRITICAL edits. Before every commit stage only the intended files and run GitNexus `detect_changes`.
- **D-11:** Run targeted tests after each slice and the full Phase 17 gate at closeout: frontend unit, lint, dependency-cruiser with zero unapproved baseline, production build/typecheck, deterministic OpenAPI/generated TypeScript, relevant backend regression, whitespace/secret checks, and three-viewport headed Chrome evidence against the real lane.
- **D-12:** Do not push, reset, seed, import, or mutate the preserved database lane. Browser verification may exercise read-only navigation/cache behavior and must preserve recorded E2E lineage.

### the agent's Discretion
- Exact endpoint-to-feature module file names, compatibility-barrel mechanics, and the dependency-safe location of shared Redux/auth contracts are delegated to research and planning, provided D-01 through D-12 remain true.
- Exact atomic commit count and plan wave grouping are delegated to the planner; each commit must remain independently testable and must not mix unrelated owners.

### Deferred Ideas (OUT OF SCOPE)

#### Reviewed Todos (not folded)
- **Build customer weekly-menu template workbench:** Deferred because it is a new product capability unrelated to structural frontend ownership and would violate the no-UI-behavior-drift boundary of Phase 17.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-17 | Explicit frontend endpoint/layout/page-model ownership and zero unapproved dependency debt. [VERIFIED: .planning/REQUIREMENTS.md] | Endpoint inventory, one-slice injection pattern, MainLayout/app composition map, 54-violation inventory, and decomposition boundaries below. |
| Preservation | No public API, route, cache, generated-contract, or UI drift; no database mutation. [VERIFIED: .planning/REQUIREMENTS.md] | Characterization gates, deterministic contract checks, browser read-only gate, and runtime-state inventory below. |
</phase_requirements>

## Summary

Phase 17 is a structural frontend refactor over a currently working React 19/Vite 8 app. `frontend/src/api/apiSlice.ts` is the only transport/cache/session owner today; `workflowApi.ts` injects one large endpoint object into it and exports **75 public hooks** plus the `workflowApi` object and domain types. [VERIFIED: codebase grep, `apiSlice.ts`, `workflowApi.ts`] Existing `adminApi.ts`, `authApi.ts`, `coordinationApi.ts`, and `dishCatalogApi.ts` already demonstrate the required `apiSlice.injectEndpoints` pattern. [VERIFIED: codebase grep]

The safe strategy is to characterize the old public surface first, then move endpoint groups one owner at a time into modules that call `apiSlice.injectEndpoints`. Keep `workflowCacheTags.ts` as the sole tag registry. Retain `src/api/workflowApi.ts` as a compatibility barrel that imports endpoint modules for deterministic registration and re-exports the old hooks/types while exposing the same shared `apiSlice` object as `workflowApi`; never create a second `createApi`, duplicate endpoint, or duplicate generated DTO. [VERIFIED: RTK Query module pattern in existing code; recommendation MEDIUM confidence]

Dependency debt is not one problem: the baseline is exactly 54 entries split into 9 R1 shared→feature reversals, 30 R2 feature→feature imports (mostly `projects/weekly-menu`→`coordination`), and 15 R3 feature→app/router imports. [VERIFIED: `.dependency-cruiser-known-violations.json`] Resolve those as separate slices, with the API/auth/store contract moves before feature imports and page-model extraction last. The page models are 727 lines (`useAdminDataPageModel`) and 575 lines (`useReportsPageModel`) and already have panel boundaries that can be extracted without changing their returned model shape. [VERIFIED: codebase line counts and source inspection]

**Primary recommendation:** characterize the old endpoint/export/cache contract, introduce feature-owned injectors behind a compatibility barrel, move shared auth/store contracts and `MainLayout` into app-safe locations, eliminate dependency debt by category, then split page models panel-by-panel with targeted tests after every atomic commit.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RTK Query transport, refresh/session retry, reducer and middleware | API / Backend-facing shared layer | App/store | `apiSlice.ts` owns `baseQueryWithAuthHandling`, reducerPath `api`, and middleware registration; all endpoint modules must inject into it. [VERIFIED: `frontend/src/api/apiSlice.ts`, `frontend/src/app/store.ts`] |
| Business endpoint declarations and public hooks | Feature | Shared API compatibility barrel | Endpoint behavior belongs to business owners; the compatibility barrel preserves legacy imports while registration remains on the shared slice. [VERIFIED: existing feature API modules; recommendation MEDIUM] |
| Cache tag registry and invalidation fan-out | Shared API | Feature endpoint modules | `workflowCacheTags.ts` contains the 22 workflow tag IDs and source-tag arrays used by multiple endpoint groups; duplication would change cache behavior. [VERIFIED: `frontend/src/api/workflowCacheTags.ts`, source inspection] |
| Route composition, auth/permission orchestration, navigation preload | Frontend Server / app composition | Feature pages and route loaders | `AppRouter` renders `MainLayout`; `MainLayout` calls app hooks/store, auth logout, and route preload functions. [VERIFIED: GitNexus context and source inspection] |
| Weekly-menu ↔ coordination contract | Shared API/contract boundary | `features/projects`, `features/coordination` | Current projects code imports coordination API/types directly in 21+ baseline edges; a lower-level coordination API/types boundary removes feature-to-feature coupling without duplicate endpoints. [VERIFIED: dependency baseline and source inspection; recommendation MEDIUM] |
| Admin page model | App composition page | Admin, reports, coordination endpoint owners | `AdminDataPage` composes BOM/catalog, contracts, cleanup, inventory, statistics, audit, and employees; it is intentionally under `src/app/pages`. [VERIFIED: `docs/ARCHITECTURE.md`, `useAdminDataPageModel.ts`] |
| Reports page model | Reports feature page shell | Report panel models and report endpoint owner | `ReportsPage` calls one model that owns nine report views and URL/pagination state; panels already exist and provide extraction seams. [VERIFIED: `useReportsPageModel.ts`, reports page files] |

## Current Code Seam and Inventory

### Endpoint/public surface

- `workflowApi.ts` defines 75 hooks at lines 2022–2097 and one `apiSlice.injectEndpoints` object covering workflow documents, purchasing, inventory, production, approvals, reports, data-quality, and approval rules. [VERIFIED: source inspection]
- Existing hook consumers span app pages, dashboard, chef, projects weekly-menu, purchasing, reports, approvals, admin, warehouse, route prefetchers, and API characterization tests. [VERIFIED: `rg -l workflowApi frontend/src frontend/tests`]
- `routeDataPreloaders.ts` calls `workflowApi.util.prefetch` for dashboard, reports, approvals, purchasing, warehouse, and approval-rules routes; these calls must continue to resolve by unchanged endpoint name. [VERIFIED: `frontend/src/routes/routeDataPreloaders.ts`]
- `workflowApi.cacheInvalidation.test.ts` subscribes to 10 queries and asserts the remediation mutation refetches exactly audit/data-quality; `workflowApi.approvalDecisionWire.test.ts` asserts approval decision wire serialization. [VERIFIED: test source]

### Endpoint ownership recommendation

Use endpoint modules with the following ownership. Names are a planning recommendation; endpoint names, args, URLs, transforms, and tags remain byte-for-byte equivalent. [VERIFIED: endpoint inventory; module names MEDIUM-confidence recommendation]

| Owner module | Endpoints to move | Notes |
|-------------|------------------|-------|
| `features/dashboard/dashboardApi.ts` | `getWorkflowDocuments`, `getOperationalKpis`, `useWorkflowOverview` support types/helpers | Dashboard owns overview composition; keep overview helper pure and preserve its four query calls and `workflowOverviewCacheTags`. |
| `features/reports/reportsApi.ts` | `getWorkflowDocuments` only if dashboard/report document rail is centralized; all report read endpoints (`getIngredientDemand*`, `getPurchasePlan*`, price variance variants, stock/current-stock/ledger, kitchen/usage, audit, data-quality) | Prefer a single report owner for report transforms/types. If documents are shared by dashboard/approvals, put the endpoint in a lower-level `api/workflowDocumentsApi.ts` and re-export it. |
| `features/purchasing/purchasingApi.ts` | suppliers/warehouses, purchase workbench/evidence, quotations, purchase orders, purchase requests, demand→purchase and submit transitions | Preserve cross-domain invalidation tags such as documents, approval inbox, current stock, price variance, and operational KPIs. |
| `features/warehouse/warehouseApi.ts` | inventory receipt/issue/return mutations and queries, warehouse selector | Keep warehouse-side receipt invalidation fan-out unchanged; do not move report read endpoints here merely because WarehousePage renders them. |
| `features/chef/chefApi.ts` | daily production plan send/read and kitchen-issue read/receipt endpoints | Keep `KitchenIssueRow`, `DailyProductionPlan`, and mapper ownership together. |
| `features/approvals/approvalsApi.ts` | approval inbox/decision/history | `getApprovalRules` mutations are consumed by Admin and should move to `features/admin/adminApi.ts`, not approvals. |
| `features/admin/adminApi.ts` | approval-rule query/mutations | Existing `adminApi.ts` already owns employee endpoints; extending it avoids a second admin injector. |
| `api/coordinationApi.ts` (lower-level boundary) | existing coordination endpoint module and types currently under `features/coordination` | Move shared coordination types with it or to `src/types/coordination.ts`; feature coordination may re-export for compatibility. Projects imports only this boundary, never `features/coordination/*`. |

Avoid two implementations of an endpoint. A compatibility barrel may re-export symbols, but each endpoint definition must have exactly one injector and each module must be imported once before consumers call `apiSlice.endpoints`. [VERIFIED: D-01/D-02; recommendation]

### Dependency baseline

The baseline file has 54 entries, grouped as follows. [VERIFIED: PowerShell `ConvertFrom-Json` over `.dependency-cruiser-known-violations.json`]

| Rule | Count | Representative causes | Atomic remedy |
|------|------:|------------------------|---------------|
| R1 shared→feature/app | 9 | `apiSlice.ts` imports auth slice/types/role/session; `MainLayout` in shared components imports app/store/routes/auth | Move cross-cutting auth state/contracts/session bridge into a dependency-safe shared layer; move `MainLayout` to `src/app/layout`. |
| R2 feature→feature | 30 | 21+ `projects/weekly-menu` imports `coordinationApi.ts`, `coordinationSlice.ts`, or coordination types; chef and reports tests also cross into coordination/auth | Put coordination API/types behind `src/api`/`src/types` boundary; move auth test fixtures/selectors to auth-owned public contracts; do not whitelist. |
| R3 feature→app/router | 15 | Features import `app/hooks.ts`; Coordination/weekly-menu import `routes/ActionGuard.tsx` | Provide dependency-safe store/permission hooks and a shared `ActionGuard`/permission contract; app/router may compose features, never the reverse. |

Run dependency-cruiser with the current rules unchanged. The script intentionally ignores the baseline (`npm run depcruise`); the Phase 17 closeout must regenerate the baseline only after it is empty and verify no rule weakening. [VERIFIED: `frontend/package.json`, `.dependency-cruiser.cjs`]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@reduxjs/toolkit` | `^2.12.0` (registry 2.12.0) | RTK Query `createApi`/`injectEndpoints`, reducer and middleware | Already owns the single API slice and cache/session pipeline. [VERIFIED: `package.json`; `npm view @reduxjs/toolkit version`] |
| React | `^19.2.6` (registry latest 19.2.8) | Component/page composition | Existing app and tests; no React behavior change is in scope. [VERIFIED: `frontend/package.json`; `npm view react version`] |
| React Router DOM | `^7.17.0` (registry latest 7.18.2) | Router/layout/outlet and URL state | `AppRouter`, `MainLayout`, route loaders, and page models depend on it. [VERIFIED: `frontend/package.json`; `npm view react-router-dom version`] |
| Vite | `^8.0.12` (registry latest 8.1.5) | Dev/build/test config | `vite.config.ts` hosts Vitest and the `@` alias. [VERIFIED: `frontend/package.json`, `vite.config.ts`; `npm view vite version`] |
| TypeScript | `~6.0.2` (registry latest 7.0.2) | Strict typecheck and generated contract imports | Keep declared version; do not upgrade as part of ownership refactor. [VERIFIED: `frontend/package.json`, `tsconfig.app.json`; `npm view typescript version`] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | `^4.1.10` | Colocated characterization/model tests | Run targeted tests after each endpoint/layout/model slice. [VERIFIED: `frontend/package.json`, `vite.config.ts`; `npm view vitest version`] |
| `@testing-library/react` | `^16.3.2` | Component behavior tests | Use for public hook/page shell and layout behavior, not implementation snapshots alone. [VERIFIED: `frontend/package.json`] |
| Playwright | `^1.60.0` | Headed Chrome navigation/cache/performance evidence | Use real lane at 1365×900, 1280×900, 768×1024 per Gate 17. [VERIFIED: `frontend/playwright.config.ts`, `docs/TESTING.md`] |
| `dependency-cruiser` | `^18.1.0` (registry 18.1.0) | Enforce R1–R6 and retire the baseline | Run with existing `.dependency-cruiser.cjs`; never weaken rules. [VERIFIED: `frontend/package.json`, `.dependency-cruiser.cjs`; `npm view dependency-cruiser version`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RTK Query endpoint injectors | New API slices or custom fetch hooks | Rejected: changes reducer/cache namespace, hook behavior, and violates D-01. [VERIFIED: D-01/D-02] |
| Compatibility barrel over `apiSlice` | Keep the 85900-byte monolith | Rejected: ownership debt remains; barrel is only a transition/public-surface adapter. [VERIFIED: file size and D-02] |
| Shared coordination API/types boundary | Projects importing `features/coordination` | Rejected: leaves R2 feature-to-feature violations and risks cycles. [VERIFIED: dependency baseline and D-05] |

**Installation:** No new external packages are required for this phase; use the versions already in the workspace. [VERIFIED: phase scope and package inspection]

## Package Legitimacy Audit

No packages are installed by Phase 17, so the package-legitimacy gate is not applicable. Existing dependencies were checked against `frontend/package.json`; no new package recommendation is made. [VERIFIED: package inspection]

## Architecture Patterns

### System Architecture Diagram

```text
Browser navigation
      ↓
AppRouter → app/layout/MainLayout → route loaders / lazy pages
      ↓                                      ↓
Feature page + panel model ───────→ feature-owned endpoint module
      ↓                                      ↓
Compatibility barrel (legacy imports) → apiSlice.injectEndpoints
                                             ↓
                         one reducerPath=api, baseQuery/session refresh
                                             ↓
                                   RTK Query cache + workflowCacheTags
                                             ↓
                                    backend API / generated OpenAPI types
```

The diagram is a conceptual data flow; file locations are mapped in the tables above. One `apiSlice` remains registered in `app/store.ts`. [VERIFIED: `apiSlice.ts`, `store.ts`]

### Recommended Project Structure

```text
frontend/src/
├── api/
│   ├── apiSlice.ts                 # one transport/reducer/cache owner
│   ├── workflowApi.ts              # compatibility barrel + apiSlice alias
│   ├── workflowCacheTags.ts        # sole WorkflowReports tag registry
│   └── coordinationApi.ts          # lower-level boundary used by projects + coordination
├── app/
│   ├── layout/MainLayout.tsx       # app/store/router/auth orchestration
│   └── pages/
│       ├── admin-data/             # shell + extracted panel models
│       └── ...
├── features/
│   ├── admin/adminApi.ts
│   ├── approvals/approvalsApi.ts
│   ├── chef/chefApi.ts
│   ├── dashboard/dashboardApi.ts
│   ├── purchasing/purchasingApi.ts
│   ├── reports/reportsApi.ts
│   └── warehouse/warehouseApi.ts
├── shared/                         # only if needed for store/auth/permission contracts
├── types/coordination.ts           # shared coordination DTO/query contracts
└── routes/
    ├── AppRouter.tsx
    └── routeDataPreloaders.ts
```

### Pattern 1: Feature injector with compatibility registration

**What:** Each owner module calls `apiSlice.injectEndpoints({ endpoints: ... , overrideExisting: false })`; the compatibility barrel imports all owner modules for side-effect registration, re-exports their hooks/types, and exports `workflowApi = apiSlice`. [VERIFIED: existing `adminApi.ts`, `authApi.ts`, `coordinationApi.ts`; recommendation]

**When to use:** Every endpoint move. Keep endpoint key, query callback, transform, and tag arrays unchanged until the characterization gate passes.

```ts
// feature-owned module
import { apiSlice } from '@/api/apiSlice';

export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPriceVariancePage: builder.query<PriceVariancePage, PriceVarianceQuery>({
      query: (query) => ({ url: '/workflow-reports/receipt-price-variance/page', params: query }),
      providesTags: [workflowCacheTags.priceVariance],
    }),
  }),
  overrideExisting: false,
});

export const { useGetPriceVariancePageQuery } = reportsApi;
```

Source pattern: existing `frontend/src/features/admin/adminApi.ts` and `frontend/src/features/coordination/coordinationApi.ts`. [VERIFIED: codebase grep]

### Pattern 2: Compatibility barrel

Keep legacy imports working while consumers migrate:

```ts
import { apiSlice } from '@/api/apiSlice';
import { reportsApi } from '@/features/reports/reportsApi';
import { purchasingApi } from '@/features/purchasing/purchasingApi';

// Imports above register endpoints once through the shared slice.
export const workflowApi = apiSlice;
export * from '@/features/reports/reportsApi';
export * from '@/features/purchasing/purchasingApi';
```

The planner must add a test that enumerates the pre-split endpoint names and verifies `workflowApi.endpoints[name]` exists after barrel import. [RECOMMENDED: MEDIUM confidence]

### Pattern 3: Page-model extraction by existing panel boundary

Extract one hook/model per existing panel/use case and compose the same return object in the page model. Pass only stable inputs (`activeView`, permissions, dates, pagination setters, query state) and preserve `skip`, args, `QueryView` phases, mutations, and handlers. `ReportsPage` has nine report views; `AdminDataPage` has BOM, contracts, cleanup, inventory, statistics, audit, and employees panels. [VERIFIED: source inspection]

### Anti-Patterns to Avoid

- **Creating one `createApi` per feature:** creates multiple reducer paths/middleware/cache namespaces and breaks D-01. [VERIFIED: `apiSlice.ts`, D-01]
- **Changing endpoint names while moving files:** RTK Query cache keys include endpoint name and args; changing names invalidates prefetch, subscriptions, and tests. [VERIFIED: existing `routeDataPreloaders.ts` and D-02]
- **Copying DTOs or tag literals into each module:** creates drift in generated contract types and invalidation fan-out. Keep generated types and `workflowCacheTags` centralized. [VERIFIED: `workflowApi.ts`, `workflowCacheTags.ts`]
- **Whitelisting all current dependency debt:** `--ignore-known` hides the 54 baseline by design; weakening rules or expanding the baseline defeats ARCH-17. [VERIFIED: `.dependency-cruiser.cjs`, package scripts]
- **Extracting page models before endpoint ownership:** causes simultaneous import churn and makes cache/skip regressions hard to localize. [VERIFIED: D-08 and current imports]
- **Moving MainLayout without route-preload characterization:** `preloadRoute`, `preloadRouteData`, idle scheduling, mobile nav, and permission filtering are behavior contracts. [VERIFIED: `MainLayout.tsx`, `routeLoaders.ts`, browser tests]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transport/session refresh | A second fetch wrapper or API slice | Existing `apiSlice.baseQueryWithAuthHandling` | Preserves token preparation, refresh single-flight, dev fallback, and logout/session-expiry behavior. [VERIFIED: `apiSlice.ts`] |
| Cache identity/invalidation | Per-module tag constants or manual cache maps | `workflowCacheTags.ts` plus RTK Query tags | Existing 22 IDs and cross-domain fan-out are part of the public cache contract. [VERIFIED: `workflowCacheTags.ts`, cache test] |
| Generated API types | Hand-written DTO replacements | `shared/api/contracts/schema.ts` generated from OpenAPI | Contract gate compares deterministic generated files; hand-written substitutes can drift. [VERIFIED: `docs/DEVELOPMENT.md`, `REQUIREMENTS.md`] |
| Route preload/cache | New navigation cache or eager fetches | `routeLoaders.ts`, `routeDataPreloaders.ts`, and `apiSlice.util.prefetch` | Existing tests assert intent prefetch, warm navigation, and zero duplicate requests. [VERIFIED: `cache-navigation.spec.ts`, route preloaders] |
| Dependency enforcement | Deleting/weakening dependency-cruiser rules | Existing R1–R6 rules and shrinking baseline | The phase goal is zero unapproved debt, not a manufactured pass. [VERIFIED: `.dependency-cruiser.cjs`, D-06/D-07] |

**Key insight:** The hard part is preserving registration timing and RTK Query identity while changing module ownership; custom adapters tend to duplicate exactly the cache/session behavior this phase must keep stable. [RECOMMENDED: MEDIUM confidence]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — endpoint/layout/page-model moves do not change backend entities, keys, or database schema. [VERIFIED: phase scope, REQUIREMENTS.md] | No data migration; do not seed/reset/import. |
| Live service config | None found for frontend module paths; route/API configuration is in git (`vite.config.ts`, `routeDataPreloaders.ts`). [VERIFIED: source inspection] | Code edits only; preserve lane configuration. |
| OS-registered state | None — no task/service registration references these frontend symbols. [VERIFIED: project search] | None. |
| Secrets/env vars | `VITE_API_BASE_URL`, `VITE_ENABLE_MOCK_LOGIN`, and `K6_PASSWORD` remain names/config inputs; no rename is required. [VERIFIED: `apiSlice.ts`, Playwright config, AGENTS.md] | Keep names unchanged; never write credentials to docs/evidence. |
| Build artifacts / installed packages | `frontend/dist`/Vite cache are derived artifacts; generated `openapi.json` and `schema.ts` are checked-in contract artifacts. [VERIFIED: repository layout and docs] | Rebuild/check deterministically; do not hand-edit generated files. |

## Common Pitfalls

### Pitfall 1: Endpoint registration order or duplicate injector

**What goes wrong:** A consumer imports the compatibility barrel before an owner module, or both old and new definitions register the same endpoint with `overrideExisting: false`, producing missing/duplicate endpoint behavior. [ASSUMED based on RTK Query module behavior; validate with characterization test]

**Why it happens:** The old monolith registered every endpoint synchronously at one import site; splitting introduces module evaluation order. [VERIFIED: `workflowApi.ts`; inference]

**How to avoid:** Barrel-import all owner modules once, assert all endpoint keys exist, and retain `overrideExisting: false`.

**Warning signs:** `workflowApi.endpoints[name]` is undefined, route prefetch dispatches no request, or a hook has a different query cache key.

### Pitfall 2: Cache/tag drift hidden by successful HTTP responses

**What goes wrong:** Queries render correctly but mutations no longer refetch dependent panels (documents, KPIs, audit, stock, approvals). [VERIFIED: cache invalidation test demonstrates fan-out importance]

**Why it happens:** Invalidation arrays are copied incompletely or a tag literal is changed while moving an endpoint.

**How to avoid:** Snapshot every endpoint's `providesTags`/`invalidatesTags`, keep `workflowCacheTags` central, run cache fan-out tests after each owner slice.

**Warning signs:** Warm navigation shows stale data, remediation refetch count differs from 2, or `workflowApi.cacheInvalidation.test.ts` fails.

### Pitfall 3: Projects→coordination fix creates a new cycle

**What goes wrong:** A new projects facade imports coordination internals, or coordination imports projects models, leaving R2/R4 violations. [VERIFIED: current 30 R2 entries and dependency rules]

**Why it happens:** Weekly-menu UI needs coordination DTOs and hooks but the current API module is feature-owned.

**How to avoid:** Put coordination API/types at a lower-level shared boundary and import only that boundary from both features; keep feature slices/presentation private.

**Warning signs:** New dependency-cruiser edges between feature folders or direct imports into `features/coordination/*/`.

### Pitfall 4: MainLayout move changes preload or DOM behavior

**What goes wrong:** Navigation still works but idle preloads, permission-filtered menu, mobile menu, route cache, or HeaderShiftContext behavior changes. [VERIFIED: `MainLayout.tsx`, `cache-navigation.spec.ts`]

**Why it happens:** Relative imports change and layout effects are accidentally rewritten during the move.

**How to avoid:** Perform a path-only move first, import from `@/app/layout/MainLayout`, run route smoke/cache-navigation tests, then remove the old file only after no imports remain.

**Warning signs:** Extra requests on warm return, missing menu items, changed `MainLayout` remount count, or CLS/overflow regression.

### Pitfall 5: Page-model extraction changes query gating

**What goes wrong:** Hidden tabs fetch, skipped queries become ready-empty, forbidden states retry, or refreshing loses stale data. [VERIFIED: QueryView contracts and D-09]

**Why it happens:** Hook calls are moved across conditional components or `skip`/args are reconstructed from derived state.

**How to avoid:** Keep hooks unconditional within each extracted model, pass the same `skip` expressions and args, and keep `QueryView` conversion at the query owner boundary.

**Warning signs:** Request count changes when switching tabs, stale tables disappear during refetch, or page-state tests fail.

## Atomic Implementation Order and Characterization Gates

1. **Wave 0 — inventory/characterization (no behavior change):** record the 75 hook names, exported type/helper names, endpoint names, query URL/serialization, tag arrays, route prefetch endpoint names, `apiSlice.reducerPath`, generated contract hashes, and exact 54 baseline entries. Add deterministic tests that import the old barrel and assert these surfaces. Gate: existing FE unit suite plus new snapshots pass.
2. **Wave 1 — dependency-safe shared contracts:** move/invert auth state/session primitives used by `apiSlice`; establish dependency-safe typed store/permission hooks and shared `ActionGuard` contract; move coordination API/types to a lower-level boundary. Characterize auth refresh/logout and coordination query ownership. Gate: dependency count does not increase; targeted auth/coordination/projects tests pass.
3. **Wave 2 — endpoint modules by owner:** extract one owner at a time (reports, purchasing, warehouse, chef, approvals/admin, dashboard/shared documents). Each commit imports only its new injector, updates consumers/preloaders, and leaves the compatibility barrel exporting old names. Gate per slice: public hook/export snapshot, endpoint key presence, wire/serialization tests, cache invalidation tests, and focused feature tests.
4. **Wave 3 — MainLayout relocation:** copy/move `MainLayout` to `src/app/layout`, update `AppRouter`, preserve all effect/menu/preload code byte-for-byte, then delete old path. Gate: route smoke, cache/navigation performance, permission tests, build/lint, and GitNexus impact/detect-changes.
5. **Wave 4 — retire dependency baseline:** fix remaining R1/R2/R3 edges in small owner commits, rerun `npm run depcruise -w frontend` without the known file, and require zero violations before shrinking/removing the baseline. Any exception must include reason, owner, expiry in a narrowly scoped rule—not a broad whitelist. Gate: 0 violations and no R4 cycle.
6. **Wave 5 — page-model decomposition:** after endpoint imports are stable, extract Admin models by BOM, contracts, cleanup/data-quality, inventory, statistics, audit, employees; extract Reports by price (including subviews), demand/purchase, stock/movement, kitchen/usage, audit/data-quality. Compose the existing return object and keep page shell props stable. Gate: focused model/page tests, all QueryView state matrices, URL/pagination/permission tests, and no growth-warning files newly introduced.
7. **Wave 6 — closeout:** run full FE unit, lint, dependency-cruiser zero baseline, production build/typecheck, deterministic `npm run check:api-contract`, relevant backend regression, `git diff --check`, secret scan, staged GitNexus `detect_changes`, and headed Chrome at 1365×900, 1280×900, 768×1024. Browser evidence must include selected controls/render, API requests/responses, cache-hit warm revisit, console/page errors, long tasks, CLS, and no page overflow; do not mutate the protected lane. [VERIFIED: D-11/D-12, docs/TESTING.md]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + React Testing Library; Playwright 1.60.0 for headed browser. [VERIFIED: `docs/TESTING.md`, `frontend/package.json`] |
| Config file | `frontend/vite.config.ts` (Vitest jsdom/setup); `frontend/playwright.config.ts` (Chromium). [VERIFIED: files] |
| Quick run command | `npm run test:unit -w frontend -- <focused test path>` [VERIFIED: package scripts] |
| Full suite command | `npm run test:fe:unit` or root `npm run verify` [VERIFIED: root/package scripts] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-17/API | All 75 public hooks and endpoint keys remain exported/registered through one slice | unit/characterization | `npm run test:unit -w frontend -- src/api/workflowApi.publicSurface.test.ts` | ❌ Wave 0 |
| ARCH-17/cache | Query args, serialization, tag provides/invalidates and remediation fan-out unchanged | unit/integration | `npm run test:unit -w frontend -- src/api/workflowApi.cacheInvalidation.test.ts src/api/workflowApi.approvalDecisionWire.test.ts` | ✅ existing + extend |
| ARCH-17/coordination | Projects no longer imports coordination feature internals; coordination API/type boundary stable | architecture/unit | `npm run depcruise -w frontend` plus `npm run test:unit -w frontend -- src/features/projects/weekly-menu/coordinationQueryOwnership.test.ts src/features/coordination/coordinationQueryOwnership.test.ts` | ✅ existing; add import assertion |
| ARCH-17/layout | MainLayout relocation preserves routes, permissions, preload scheduling, mobile navigation and warm cache | Playwright smoke/performance | `npm run test:smoke -w frontend && npm run test:performance -w frontend` | ✅ existing; add path/import assertion |
| ARCH-17/admin | Admin panel extraction preserves skip/args/mutations/QueryView states and returned model shape | unit/component | `npm run test:unit -w frontend -- src/app/pages/admin-data/**/*.test.*` | Partial — add per-panel model contracts in Wave 5 |
| ARCH-17/reports | Reports panel extraction preserves URL state, pagination/cursors, permission tabs, CSV export and QueryView semantics | unit/component | `npm run test:unit -w frontend -- src/features/reports/**/*.test.*` | Partial — add panel model contracts in Wave 5 |
| Preservation | Generated OpenAPI and TypeScript remain deterministic | contract | `npm run check:api-contract` | ✅ root gate |
| Preservation | Three viewport headed real-lane behavior, cache warm revisit, CLS/errors/overflow | browser/manual evidence | `node .artifacts/shipyard-live/current-runtime-desktop-audit.mjs` after ports/health check | ✅ helper; rerun at closeout |

### Sampling Rate

- **Per endpoint/layout/model commit:** focused Vitest test(s), `npm run lint -w frontend`, and `npm run build -w frontend`.
- **Per dependency wave:** `npm run depcruise -w frontend` (without baseline for the affected slice) plus focused import/architecture tests.
- **Per wave merge:** `npm run test:fe:unit`, `npm run lint:fe`, `npm run depcruise:fe`, `npm run build:fe`.
- **Phase gate:** root `npm run verify`, `npm run check:api-contract`, staged `gitnexus detect_changes`, and headed browser evidence before `$gsd-verify-work`.

### Wave 0 Gaps

- [ ] `frontend/src/api/workflowApi.publicSurface.test.ts` — snapshot endpoint names, 75 hook exports, compatibility barrel registration, and one `apiSlice` identity.
- [ ] `frontend/src/api/workflowApi.cacheContract.test.ts` — deterministic provides/invalidates descriptor (or equivalent source-level contract) per endpoint.
- [ ] `frontend/src/app/layout/MainLayout.ownership.test.tsx` — assert app-owned import path and preserve layout/preload contract.
- [ ] `frontend/src/features/projects/weekly-menu/coordinationBoundary.test.ts` — assert no import of `features/coordination` internals.
- [ ] Per-panel Admin/Reports model tests — add only during Wave 5 after endpoint ownership is stable.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Preserve `baseQueryWithAuthHandling`, token header, refresh single-flight, and auth endpoint exclusions in `apiSlice.ts`. [VERIFIED: source inspection] |
| V3 Session Management | yes | Preserve HttpOnly-cookie credentials, logout/revoke behavior, session-expired event, and no duplicate refresh pipeline. [VERIFIED: `apiSlice.ts`, `logoutSession.ts`, AGENTS.md] |
| V4 Access Control | yes | Preserve `RoleGuard`, `ActionGuard`, menu permission filtering, and server-derived eligibility; tests must cover forbidden/no-retry states. [VERIFIED: route/layout/action guard sources] |
| V5 Input Validation | yes | Do not alter generated request types, query serialization, or mutation bodies; retain OpenAPI-derived types. [VERIFIED: `workflowApi.ts`, contract gate] |
| V6 Cryptography | no new crypto | No cryptographic implementation is introduced; do not move or log token values. [VERIFIED: phase scope] |

### Known Threat Patterns for React/RTK Query stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token/session handling split across modules | Spoofing / Elevation | One base query/session-refresh pipeline; characterization of 401 refresh/logout behavior. [VERIFIED: `apiSlice.ts`, D-01] |
| Permission guard import drift | Elevation of privilege | Keep `RoleGuard`/`ActionGuard` semantics and server permission mapping; test admin/non-admin/forbidden routes. [VERIFIED: guard sources, D-09] |
| Stale cache after mutation | Tampering / Information disclosure | Central tags and invalidation fan-out tests; no manual cache replacement. [VERIFIED: cache tests and tag registry] |
| Generated contract drift | Tampering | Run `npm run check:api-contract`; fail on any OpenAPI/schema diff. [VERIFIED: root scripts/docs] |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One `workflowApi.ts` monolith in `src/api` | Feature-owned `apiSlice.injectEndpoints` modules plus a compatibility barrel | Phase 17 target; existing feature injectors already present | Smaller ownership units while retaining one reducer/cache namespace. [VERIFIED: existing injectors; target from D-01/D-02] |
| Shared component owns `MainLayout` despite app/router/store imports | `src/app/layout/MainLayout.tsx` owns app composition | Phase 17 target | Removes R1 reversal without changing route/UI behavior. [VERIFIED: current violation and D-04] |
| Known dependency baseline ignored by CI | Zero unapproved baseline with explicit expiring exceptions only | Phase 17 target | Dependency-cruiser becomes an ownership gate rather than debt ledger. [VERIFIED: D-06/D-07 and package scripts] |

**Deprecated/outdated:** Keeping all new endpoint work in `workflowApi.ts` or weakening dependency-cruiser rules is out of contract for this phase. [VERIFIED: Phase 17 context]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A compatibility barrel can import all feature injectors and expose `workflowApi = apiSlice` without changing endpoint registration timing. [ASSUMED] | Architecture Patterns | Hooks/prefetch may be undefined or duplicate registration; must be proven by Wave 0 test. |
| A2 | Auth state/actions and typed store/permission hooks can be relocated to a shared dependency-safe layer without changing persisted auth behavior. [ASSUMED] | Dependency baseline / Atomic order | R1/R3 may remain or session behavior could drift; prototype with impact and auth tests before broad moves. |
| A3 | `src/api/coordinationApi.ts` plus shared coordination types is the least-risk lower-level boundary for projects↔coordination. [ASSUMED] | Endpoint ownership | Moving too much coordination presentation/state could create cycles; validate with dependency-cruiser and query ownership tests. |

## Open Questions

1. **Should workflow documents belong to dashboard, reports, approvals, or a lower-level shared module?**
   - What we know: Dashboard, approvals, warehouse, and overview helpers all consume `getWorkflowDocuments`; it currently has one cache tag. [VERIFIED: source imports and endpoint definition]
   - What's unclear: The final owner may be dashboard/report/shared document owner.
   - Recommendation: Keep one endpoint in a neutral `api/workflowDocumentsApi.ts` (or reports owner) and re-export; decide before Wave 2 to avoid a second move.
2. **Where should typed Redux hooks live after R3 cleanup?**
   - What we know: 15 R3 edges import `app/hooks.ts`; that file also mixes auth and coordination selectors. [VERIFIED: baseline and `app/hooks.ts`]
   - What's unclear: Whether to move generic typed hooks to shared state infrastructure or expose feature-local hooks with structural state types.
   - Recommendation: Prefer generic shared dispatch/selector primitives plus feature-owned selectors; validate with TypeScript and no R1/R3 violations.
3. **Can existing test mocks continue importing the compatibility barrel?**
   - What we know: Many Vitest tests `vi.mock('@/api/workflowApi')` and two tests call `workflowApi.endpoints.*` directly. [VERIFIED: `rg` test inventory]
   - What's unclear: Whether module-level mocks need a new test-only compatibility adapter.
   - Recommendation: Keep the barrel stable through the whole phase; migrate mocks only after public-surface characterization passes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vite/Vitest/build | ✓ | v24.13.0 | — |
| npm | workspace scripts and package lock | ✓ | 11.6.2 | — |
| Vitest | unit/characterization | ✓ | 4.1.10 | — |
| dependency-cruiser | DAG gate | ✓ | 18.1.0 | — |
| .NET SDK | `check:api-contract` and relevant backend regression | ✓ | 10.0.300 | — |
| GitNexus CLI/index | impact/context/detect_changes | ✓ | 1.6.7; index fresh at `f77404d` | — |
| FE/API/Shipyard ports 3001/8001/8090 | headed real-lane browser gate | ✗ (not listening during research) | — | Start the preserved lane/runtime only after checking health and credentials; do not reset/seed/mutate. [VERIFIED: port probe, AGENTS.md] |
| Headed Chrome/Playwright helper | final visual evidence | Available via project helper/config; not run during read-only research | Playwright 1.60.0 | Use `.artifacts/shipyard-live/current-runtime-desktop-audit.mjs`; no API-only conclusion. [VERIFIED: docs/TESTING.md] |

**Missing dependencies with no fallback:** None for static/unit planning. Real-lane browser evidence requires the preserved FE/API/Shipyard processes to be started before closeout.

## Sources

### Primary (HIGH confidence)

- `17-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — locked scope, preservation requirements, and Gate 17. [VERIFIED: repository files]
- `docs/ARCHITECTURE-AUDIT-2026-07-26.md` Part F / Step 17 — authoritative phase scope and ordering. [VERIFIED: repository file]
- `frontend/src/api/apiSlice.ts`, `workflowApi.ts`, `workflowCacheTags.ts`, existing feature API modules — endpoint/cache/session implementation. [VERIFIED: codebase grep/source inspection]
- `frontend/.dependency-cruiser.cjs`, `.dependency-cruiser-known-violations.json` — R1–R6 rules and exact 54 baseline. [VERIFIED: codebase grep]
- GitNexus `query`, `context`, `impact` after fresh `node .gitnexus/run.cjs analyze` — current callers/processes and LOW/ambiguous blast-radius summaries for MainLayout/page models. [VERIFIED: GitNexus CLI]

### Secondary (MEDIUM confidence)

- `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/DEVELOPMENT.md`, `frontend/README.md` — documented architecture and test/contract/browser commands. [VERIFIED: repository files]
- npm registry version probes for `@reduxjs/toolkit`, React, React Router DOM, Vite, TypeScript, Vitest, and dependency-cruiser. [VERIFIED: npm registry]

### Tertiary (LOW confidence)

- None. Remaining uncertainty is explicitly listed in Assumptions Log rather than presented as verified fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and scripts verified in package manifests and npm registry probes.
- Architecture: HIGH for current graph; MEDIUM for final coordination/auth boundary placement because those are delegated design choices.
- Pitfalls: HIGH for cache/layout/dependency risks supported by existing tests and rules; MEDIUM for module-evaluation assumptions.

**Research date:** 2026-07-29  
**Valid until:** 2026-08-28 for stable repository facts; re-check npm/Playwright versions and lane availability before execution.

## Project Constraints (from AGENTS.md)

- Read current-state/docs before work; code/runtime is source of truth when docs conflict. [VERIFIED: `AGENTS.md`]
- Preserve unrelated working-tree changes; no reset/overwrite. [VERIFIED: `AGENTS.md`]
- Before editing any symbol, run GitNexus upstream `impact` and warn on HIGH/CRITICAL; before each commit run staged `detect_changes`. [VERIFIED: `AGENTS.md`]
- Do not push, reset, seed, import, or mutate the preserved database lane. [VERIFIED: `AGENTS.md`, D-12]
- Headed browser must use the real application URL/runtime and capture screenshot, API request/response, console/page errors, long task, and CLS evidence; API-only checks are insufficient. [VERIFIED: `AGENTS.md`, `docs/TESTING.md`]
- Update relevant docs/current-state after significant changes and never include real secrets/tokens/connection strings. [VERIFIED: `AGENTS.md`]
