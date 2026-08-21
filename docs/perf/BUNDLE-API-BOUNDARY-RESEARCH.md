# Shared bundle/API boundary research — Wave 8

## Findings from primary sources

### RTK Query: one API slice, split endpoint definitions

Redux Toolkit documents `injectEndpoints` as the supported code-splitting pattern:
start with one empty `createApi` slice, inject endpoint definitions from domain
files, and export the generated hooks from the domain module. Injection mutates
and returns the same API service object, so cache invalidation remains inside one
slice. Source: [RTK Query code splitting](https://redux-toolkit.js.org/rtk-query/usage/code-splitting).

RTK Query also warns that multiple `createApi` slices do not share automatic tag
invalidation, and each slice adds middleware work. Therefore this project must
keep one `apiSlice`/middleware while removing the broad `workflowApi` consumer
barrel. Source: [RTK Query API overview](https://redux-toolkit.js.org/rtk-query/api/created-api/overview).

### Vite/Rollup: chunk boundaries are build graph decisions

Vite exposes Rollup output configuration for chunk splitting, including
`manualChunks`; current Vite guidance points to Rollup output options rather than
using arbitrary source renames as an optimization. Source: [Vite production build](https://v3.vite.dev/guide/build).

The project manifest is therefore the authoritative artifact for this wave: a
change is useful only when a clean build changes the route closure measured by
`frontend/scripts/check-route-budgets.mjs` without duplicating shared runtime.

## Current source evidence

- `src/api/apiSlice.ts` is the single configured RTK Query base slice and the only
  reducer/middleware registered by `src/app/store.ts`.
- `src/api/workflowApi.ts` imports and intersects eight domain API modules, then
  re-exports hooks and types. Runtime consumers across dashboard, approvals,
  warehouse, purchasing, reports, chef, admin, and preloaders import this barrel.
- The clean emitted `workflowCacheTags-*.js` asset contains the RTK Query,
  React-Redux, auth/base-query runtime plus the tag object. The filename is not a
  proof that the tag object is the source of the 30 KiB gzip payload.

## Recommended implementation waves

### Boundary-1 — preserve service identity

Keep `apiSlice` as the only `createApi` call and preserve `reducerPath`, tag types,
endpoint names, `overrideExisting`, and cache-contract tests. Do not create one
API slice per route/domain.

### Boundary-2 — domain endpoint exports

Move runtime consumers from `@/api/workflowApi` to their owning domain API module
(`reportsApi`, `warehouseApi`, `purchasingApi`, etc.). Move shared DTO/type imports
to `workflowApiTypes.ts` or feature-owned type modules. Update test mocks in the
same commit; a production-only import change is invalid because it bypasses the
public-surface test seam.

### Boundary-3 — route preload registration

Preloaders may dynamically import the owning API module only after Boundary-2
exports are proven. Verify endpoint injection order before dispatching `prefetch`;
do not assume a type-only barrel registers endpoints at runtime.

### Boundary-4 — clean-manifest budget gate

Run a clean production build, then `check:route-budgets`. Compare manifest closure
and shared asset gzip sizes. Keep thresholds unchanged. If a split increases every
route, revert that slice and record the disposition rather than hiding the change
with a budget edit.

## Carryover checklist

- [ ] Public-surface endpoint list unchanged.
- [ ] Cache invalidation tests pass for every moved domain.
- [ ] All runtime imports have an owning API module; remaining barrel imports are
  type-only or explicitly justified.
- [ ] No second `createApi`/middleware introduced.
- [ ] Unit, dependency-cruiser, lint, build, clean-manifest route-budget and probe
  checks pass.
- [ ] Dead barrel/helper removal has zero source-aware consumers and a replacement
  proof.

## Machine-readable inventory

`npm run check:workflow-api-boundary` now inventories non-test TypeScript imports
of the barrel. The current source snapshot is **41 import statements**: **34
runtime** and **7 type-only**. Duplicate entries in one file are intentional in
the output because each import statement is a migration unit. This gate prevents
the team from mistaking type-only consumers for bundle consumers and gives each
domain wave a measurable zero-runtime-consumer target.
