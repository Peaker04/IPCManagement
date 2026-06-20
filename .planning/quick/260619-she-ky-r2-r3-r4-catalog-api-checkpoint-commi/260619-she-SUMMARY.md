# Quick Task Summary: Kỳ R-02/R-03/R-04 Catalog API and SampleData Production Guard

## Scope

Thực hiện residual slice đầu tiên của Kỳ: checkpoint worktree Phase 2 hiện có, thêm Dish Catalog API có BOM/menu-slot detail, và ẩn SampleData API ở Production bằng 404.

## Completed

- R-03 checkpointed the existing dirty backend/frontend source work after verification.
  - Commit: `4526600` (`chore(r-03): checkpoint current phase 2 worktree`)
  - Excluded ignored/non-source artifacts from the checkpoint.
- Added `GET /api/dishes/catalog` under the existing catalog authorization policy.
- Added dish catalog DTOs with:
  - dish id/code/name/type/group/active state
  - distinct menu slots from menu items
  - BOM line id, ingredient id/code/name, unit id/code/name, gross quantity, waste rate, effective dates, and reference price
- Extended `DishRepository` with an `AsNoTracking` catalog query including `Dishboms -> Ingredient -> Unit` and `Menuitems`.
- Added `SampleDataProductionGuardMiddleware` before auth/rate-limited controller execution so `/api/sample-data/*` returns `404` outside Development.
- Kept the `SampleDataController` `IsDevelopment()` guard as defense in depth.
- Added focused tests for dish catalog mapping, catalog `ApiResponse` shape, and Production 404 guard.
- Final code commit: `c5439ab` (`feat(r-02-r-04): add dish catalog api and sample data production guard`).
- Synced `.planning/ROADMAP.md` with the Phase 02 complete state and updated `Project_Tracking v.xlsx` rows for `R-02`, `R-03`, `R-04`, `BE-3.1`, and `BE-3.6`.

## Critical Notes

- GitNexus was up to date before R-03, became stale after each commit, and was refreshed after both code commits.
- Planning mismatch was confirmed and then reconciled after implementation: `ROADMAP.md` now marks Phase 2 as complete with 6/6 plans executed.
- Frontend `DEV_FALLBACK_DISHES` and `DEV_FALLBACK_RAW_MATERIALS` were intentionally left untouched for Hưng/R-01.

## Verification

- `dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj` passed.
- `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj` passed: 36/36 tests.
- `npm run build --workspace frontend` passed with the existing Vite chunk-size warning.
- `npm run lint --workspace frontend` passed.
- `node .gitnexus/run.cjs status` passed after final analyze: indexed commit `c5439ab`, current commit `c5439ab`, status up to date.
- Search audit confirmed frontend dev fallback constants were not removed or rewired in this slice.
