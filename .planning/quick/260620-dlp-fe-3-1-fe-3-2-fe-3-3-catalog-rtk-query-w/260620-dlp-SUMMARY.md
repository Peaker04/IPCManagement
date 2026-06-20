# Summary: FE-3.1/FE-3.2/FE-3.3 Catalog Integration

## Outcome

- FE-3.2 verified complete: Weekly Menu uses backend catalog data from `/api/dishes/catalog` through RTK Query and no longer uses `DEV_FALLBACK_DISHES`.
- FE-3.3 verified complete: Chef Dashboard builds its material checklist from catalog BOM data and no longer uses `DEV_FALLBACK_RAW_MATERIALS`.
- FE-3.1 is partially complete: dishes catalog hook exists and was normalized to the tracker-facing `useGetDishesCatalogQuery` name.
- Critical blocker captured: `GET /api/menu-schedules` and `GET /api/meal-quantity-plans` are still BE-3.2/BE-3.3 work and have no implemented controller/SDS contract in the current repo, so frontend hooks for those endpoints were not faked.

## Changes

- Code commit: `1a8e295`.
- `frontend/src/features/projects/dishCatalogApi.ts`
  - Exported `useGetDishesCatalogQuery` as an alias for the existing catalog endpoint hook.
- `frontend/src/features/projects/pages/WeeklyMenuPage.tsx`
  - Switched to `useGetDishesCatalogQuery`.
- `frontend/src/features/chef/pages/ChefDashboardPage.tsx`
  - Switched to `useGetDishesCatalogQuery`.
- `.planning/STATE.md` and `.planning/ROADMAP.md`
  - Recorded the partial FE-3.1 blocker and verified FE-3.2/FE-3.3 status.

## Verification

- `npm run build --workspace frontend` passed.
- `npm run lint --workspace frontend` passed.
- Search found no `DEV_FALLBACK_DISHES` or `DEV_FALLBACK_RAW_MATERIALS` in the touched frontend feature paths.

## Blocker

- FE-3.1 cannot truthfully add working `useGetMenuSchedulesQuery` or `useGetMealQuantityPlansQuery` until BE-3.2/BE-3.3 deliver `GET /api/menu-schedules` and `GET /api/meal-quantity-plans` or provide an approved SDS/API contract.
