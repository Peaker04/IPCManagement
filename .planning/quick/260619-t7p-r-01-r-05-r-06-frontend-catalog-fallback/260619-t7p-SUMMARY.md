---
quick_id: 260619-t7p
status: complete
completed: 2026-06-19
code_commit: 1511ceb
---

# Quick Task Summary: R-01/R-05/R-06 Frontend Catalog, Code Splitting, Visual Regression

Completed the requested R-01/R-05/R-06 slice.

## Changes

- Added frontend `GET /api/dishes/catalog` RTK Query integration in `frontend/src/features/projects/dishCatalogApi.ts`.
- Replaced Weekly Menu cost/BOM calculations and Chef preview material calculations with catalog API data.
- Deleted `frontend/src/features/projects/menuData.ts`; no frontend source references `DEV_FALLBACK_DISHES` or `DEV_FALLBACK_RAW_MATERIALS`.
- Code-split protected feature routes in `AppRouter.tsx` with `React.lazy`/`Suspense`.
- Refreshed visual route baselines and hardened route smoke tests for current protected route headings/profile reload behavior.

## Notes

- `R-01` now uses backend catalog BOM/unit/reference-price data for cost and chef preview flows.
- Dedicated weekly schedule SDS/API remains separate from this slice; the UI still preserves existing route/state behavior and does not invent a new schedule endpoint.
- `R-05` build output no longer emits the Vite chunk-size warning; main JS chunk is below 500 kB.

## Verification

- `npm run build --workspace frontend` passed.
- `npm run lint --workspace frontend` passed.
- `npm run test:visual:update --workspace frontend` passed and refreshed 9 protected-route snapshots.
- `npm run test:visual --workspace frontend` passed 10/10.
- `npm run test:smoke --workspace frontend` passed 7/7.

## Commits

- `1511ceb` `feat(r-01-r-05-r-06): wire catalog data and route visual baselines`
