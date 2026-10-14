# Active work

Status: IDLE

## Last closed task
Implementation of 4 Universal Operational Workspaces for `/weekly-menu` and sidebar navigation consolidation:
1. Workspace 1: Weekly Schedule Matrix (`ImportedLayoutMatrix.tsx` & `WeeklyScheduleWorkspace.tsx`) maintained as dedicated independent workspace, displaying only clean dish names per cell with 48px header and readiness strip.
2. Workspace 2: Kitchen Production Plan (`ProductionPlanSection.tsx`) standardized with 4-column operational grid (`Ca`, `Mã KHSX`, `Món ăn`, `Số suất` tabular-nums) and TableSkeleton.
3. Workspace 3: Material Handover (`PurchaseSummarySection.tsx`) streamlined to 5 columns (`Ngày`, `Nguyên liệu/nguồn`, `Cần`, `Bàn giao kho`, `Trạng thái`), completely removing the cross-role `nextAction` column to preserve RBAC and prevent out-of-scope actions.
4. Workspace 4: Cost & Recipe BOM (`MenuCostSection.tsx`) upgraded to Master-Detail Split View, displaying daily dish cost list on the left with interactive BOM breakdown and Food Cost % on the right.
5. Sidebar Navigation: `routeRegistry.ts`, `navigationPreferences.ts`, and `WeeklyMenuPage.tsx` consolidated from 6 leaves to EXACTLY 4 leaves (`schedule`, `demand`, `production-plan`, `cost`), with legacy deep-link aliasing (`purchase-summary` ➔ `demand`, `dish-materials` ➔ `cost`).
6. Verification:
   - `npm run lint:fe`: PASS (0 errors, 1 warning)
   - `npm run build:fe`: PASS
   - `npm run depcruise:fe`: PASS
   - Vitest unit & contract suites: 46 test files, 222 tests PASS 100%
   - Playwright visual pagination tests across 4 viewports (`s-390`, `m-768`, `l-1280`, `xl-1440`): 4/4 PASS
