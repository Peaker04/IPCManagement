# Phase 17: Frontend ownership - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish explicit frontend ownership for endpoint modules, the application layout, cross-feature contracts, dependency directions, and the Admin/Reports page models. This phase is a structural refactor only: it must preserve the single RTK Query API slice, generated API contract, endpoint names and arguments, public hooks, cache keys/tags/invalidation, routes, DOM-visible behavior, permissions, query-state behavior, and browser interaction/performance characteristics.

</domain>

<decisions>
## Implementation Decisions

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

### Folded Todos
- **Browser UAT for decomposed operational pages:** Folded into Gate 17 verification because the phase explicitly requires three-viewport headed-browser stability after layout/page-model ownership changes.

### the agent's Discretion
- Exact endpoint-to-feature module file names, compatibility-barrel mechanics, and the dependency-safe location of shared Redux/auth contracts are delegated to research and planning, provided D-01 through D-12 remain true.
- Exact atomic commit count and plan wave grouping are delegated to the planner; each commit must remain independently testable and must not mix unrelated owners.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Active architecture contract
- `docs/ARCHITECTURE-AUDIT-2026-07-26.md` § Part F / Step 17 — authoritative scope, ordering rules, preservation constraints, and Gate 17.
- `.planning/ROADMAP.md` § Phase 17 — active v1.2 routing; archived v1.1 roadmap is non-executable.
- `.planning/REQUIREMENTS.md` — ARCH-17 and preservation requirements.
- `.planning/PROJECT.md` — active milestone objective and non-negotiable constraints.

### Runtime and verification context
- `docs/CURRENT-STATE.md` — current branch/lane/evidence, protected data lineage, latest gates, and resume checklist.
- `docs/ARCHITECTURE.md` — current frontend data flow and composition boundaries.
- `docs/TESTING.md` — unit, dependency, contract, production-build, and headed-browser gates.
- `docs/DEVELOPMENT.md` — scripts, Shipyard lane constraints, and browser helper usage.
- `AGENTS.md` — mandatory GitNexus impact/detect-changes protocol and no-reset/no-seed rules.

### Frontend boundary sources
- `frontend/.dependency-cruiser.cjs` — R1–R6 dependency rules and zero-baseline intent.
- `frontend/.dependency-cruiser-known-violations.json` — current 54-violation baseline to retire, not expand.
- `frontend/src/api/apiSlice.ts` — single transport/cache/session owner to preserve.
- `frontend/src/api/workflowApi.ts` — endpoint/public-hook monolith to decompose.
- `frontend/src/api/workflowCacheTags.ts` — cache-tag registry whose behavior must remain stable.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apiSlice.injectEndpoints`: existing RTK Query mechanism for feature-owned endpoint registration while retaining one reducer, middleware, base query, cache namespace, and tag registry.
- `workflowApi.cacheInvalidation.test.ts` and `workflowApi.approvalDecisionWire.test.ts`: characterization coverage for invalidation and wire-format preservation.
- `QueryView` plus feature state/ownership tests: established contract for uninitialized/loading/forbidden/error/ready/refreshing/partial behavior.
- `routeLoaders` and navigation performance tests: established route preload/cache contract that constrains the `MainLayout` move.
- Existing Admin panels and Reports navigation/price panels: natural extraction boundaries for the two large page models.

### Established Patterns
- Feature API modules such as `features/admin/adminApi.ts`, `features/auth/authApi.ts`, and `features/coordination/coordinationApi.ts` already inject endpoints into the shared `apiSlice`.
- App-level pages are allowed to compose multiple features; feature modules may depend only downward and may not import app/routes or another feature.
- Dependency-cruiser baseline may shrink only; rules cannot be weakened to manufacture a pass.
- Public behavior is protected by deterministic generated contracts, colocated Vitest tests, and real headed-browser evidence.

### Integration Points
- `frontend/src/app/store.ts` registers the one API reducer/middleware and auth reducer.
- `frontend/src/routes/AppRouter.tsx` and `frontend/src/routes/routeLoaders.ts` consume `MainLayout` and control lazy/preload behavior.
- Projects weekly-menu code currently consumes Coordination API/types across the feature boundary and accounts for most R2 violations.
- Admin/Reports pages consume large flat page models whose panel contracts must remain stable while internals split.

</code_context>

<specifics>
## Specific Ideas

- Preserve behavior byte-for-byte where practical through characterization tests before moves, then compare exported hook names, endpoint definitions, cache tag behavior, generated TypeScript, and browser requests after each ownership slice.
- Prefer compatibility re-exports only when they keep the public surface stable without recreating forbidden ownership; do not leave a second endpoint implementation in the old monolith.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- **Build customer weekly-menu template workbench:** Deferred because it is a new product capability unrelated to structural frontend ownership and would violate the no-UI-behavior-drift boundary of Phase 17.

</deferred>

---

*Phase: 17-frontend-ownership*
*Context gathered: 2026-07-29*
