# Code Context

## Files Retrieved
1. `frontend/src/routes/AppRouter.tsx` (lines 1-92) - authoritative protected-route tree and permission guards.
2. `frontend/src/lib/routeConfig.ts` (lines 1-15) - route URL constants.
3. `frontend/src/routes/routeLoaders.ts` (lines 1-75) - lazy page-module ownership and preload map.
4. `frontend/src/app/layout/MainLayout.tsx` (lines 38-66, 88-167, 281-304) - navigation, route header context, and UI owner/floorplan/region IDs.
5. `frontend/src/components/common/index.ts` (lines 1-31) - exported shared operational primitives.
6. `frontend/src/components/common/OperationalFrame.tsx` (lines 1-64) - page/workbench shell and ownership-marker contract.
7. `frontend/src/components/common/SectionPanel.tsx` (lines 1-67) - canonical section/card-like panel.
8. `frontend/src/components/common/TableViewport.tsx` (lines 1-88) - canonical scroll, density, sticky/frozen, caption and preferences boundary.
9. `frontend/src/components/common/PaginatedTableFrame.tsx` (lines 1-25) - thin canonical paginated table wrapper.
10. `frontend/src/components/ui/card.tsx` (lines 1-91) and `frontend/src/components/ui/table.tsx` (lines 1-112) - low-level shadcn card/table primitives.
11. `frontend/src/lib/typography.ts` (lines 1-11) and `frontend/src/styles/index.css` (lines 1-100) - semantic typography roles and token definitions.
12. `frontend/src/main.tsx` (lines 6-17) - parallel legacy/component/redesign CSS layer imports.
13. `frontend/package.json` (lines 6-28), `frontend/playwright.config.ts` (lines 1-38), `frontend/route-budgets.json` (lines 1-15) - measurement, visual, performance, smoke and route-budget entry points.
14. `frontend/tests/ui-audit.spec.ts` (lines 1-113) - protected-route measurement matrix, geometry/focus/error/non-read-request evidence.
15. `frontend/tests/visual-routes.spec.ts` (lines 1-41, 80-108) - screenshot route/viewport matrix and warehouse selector fixture.
16. `frontend/src/features/warehouse/pages/WarehousePage.tsx` (lines 174-208, 262-285, 342-346) - only direct singular-warehouse presentation inference found; operational selection remains ID-based.
17. `frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx` (lines 69-106, 150-152, 208-250) - multi-warehouse selector and preferred-warehouse locking.
18. `frontend/src/features/purchasing/PurchaseDecisionPanel.tsx` (lines 405-409, 516-519) - receiving-warehouse selection/display.
19. `frontend/src/shared/api/contracts/schema.ts` (lines 8226-8308, 11072-11442, 12162-12730, 13917-13979, 14950-15133) - generated OpenAPI surface proving warehouse identity is a backend contract.

## Key Code

### Protected routes and lowest page owners
All routes below are inside `ProtectedRoute` + `MainLayout`; `/403` is protected but has no role guard.

| Path | Guard | Lowest page owner | UI owner marker |
|---|---|---|---|
| `/` | authenticated | `src/features/dashboard/pages/DashboardPage.tsx` | `uio-g` |
| `/weekly-menu` | `coordination.read` | `src/features/projects/pages/WeeklyMenuPage.tsx` | `uio-16` |
| `/reports` | `report.read` | `src/features/reports/pages/ReportsPage.tsx` | `uio-s` |
| `/meal-orders` | `coordination.read` | `src/features/coordination/pages/CoordinationPage.tsx` | `uio-j` |
| `/chef-dashboard` | `production.read` | `src/features/chef/pages/ChefDashboardPage.tsx` | `uio-d` |
| `/approvals` | `purchase.request.approve` | `src/features/approvals/pages/ApprovalPage.tsx` | `uio-a` |
| `/purchasing` | `purchase.read` | `src/features/purchasing/pages/PurchasingPage.tsx` | `uio-k` |
| `/warehouse` | `warehouse.read` | `src/features/warehouse/pages/WarehousePage.tsx` | `uio-12` |
| `/admin-data` | `*` | `src/app/pages/AdminDataPage.tsx` | `uio-0` |
| `/admin/rules` | `*` | `src/features/admin/pages/ApprovalRulesPage.tsx` | `uio-9` |
| `/admin/advanced-settings` | `*` | `src/features/admin/pages/AdvancedDisplaySettingsPage.tsx` | `uio-8` |
| `/403` | authenticated | `src/features/auth/pages/ForbiddenPage.tsx` | `uio-h` |

Public `/login` belongs to `src/features/auth/pages/LoginPage.tsx`. The wildcard redirects to `/`.

### Shared rollout seams
- **Global shell/layout:** `MainLayout` owns sidebar, responsive navigation, header, route title/context, and route ownership markers. Lowest owner for project-wide shell changes: `frontend/src/app/layout/MainLayout.tsx` plus `frontend/src/styles/components/shell.css`/`responsive.css`.
- **Page/data-container:** `OperationalFrame` is the canonical page/workbench floorplan; `SectionPanel` is the canonical semantic section/card container. Prefer these before local wrappers.
- **Tables:** `TableViewport` is explicitly documented not to own data/filter/pagination contracts. `PaginatedTableFrame` composes it. `QueryViewBoundary`, `SkeletonTableRow`, pagination bars and empty/error primitives are exported from `components/common/index.ts`.
- **Cards:** `components/ui/card.tsx` is low-level; only `chef-header.tsx` directly imports it. Most route panels should converge at `SectionPanel`, while specialized chef cards can remain lowest-owned in `features/chef/components`.
- **Typography:** use `lib/typography.ts` roles backed by `styles/index.css` theme tokens; avoid new local `text-[Npx]`/font recipes.

### Likely duplicated/local patterns
- **MEDIUM:** `src/main.tsx:6-17` loads component CSS plus `ui-redesign.css` and four `styles/redesign/*` files. This is a high-risk cascade/duplication seam for a rollout. Lowest consolidation owners are each CSS module first; do not flatten globally until selector overlap is measured.
- **MEDIUM:** chef local components (`features/chef/components/chef-header.tsx`, `active-dishes-grid.tsx`, `material-checklist.tsx`) directly use low-level Card/Table while the rest of the app has `SectionPanel`/`TableViewport`. Review these as a bounded chef-family migration, not by changing shadcn primitives globally.
- **LOW:** route page headers/context exist globally in `MainLayout` while pages also compose `OperationalFrame` titles/commands. Preserve the distinction (global route context versus local work-object heading) and audit duplicate visible titles per page.
- **LOW:** many admin/report sections have local query boundaries and empty rows (`app/pages/admin-data/*`, `features/reports/pages/*`) despite shared `QueryViewBoundary`/`EmptyState`; migrate at the panel owner because their model/state semantics differ.

### Multiple-warehouse findings and contract boundary
- **MEDIUM presentation defect/simplification:** `WarehousePage.tsx:176` derives the shell warehouse label from `currentStockRows[0]`, then renders one name at `342-344`. With mixed-warehouse rows this falsely presents the page as one warehouse. Safe UI-only options: label it “Tất cả kho”, summarize selected filters, or omit the singular chip. Lowest owner: `WarehousePage.tsx`. Do not alter query grouping or IDs.
- The page already constructs all `receiptWarehouses` as options (`184-187`) and fetches issue allocation by `selectedWarehouseId` (`208`, `285`). Receipt dialogs map all warehouses and require `warehouseId`; supplemental receipts may lock `preferredWarehouseId`. Purchasing decisions similarly select `receivingWarehouseId`. These are intentional multi-warehouse behaviors, not duplication.
- Visual fixtures often return one “Kho chính” (`tests/visual-routes.spec.ts:99-104`) and many unit fixtures use one warehouse. That is fixture simplification only; it must not be interpreted as a product invariant. Add a multi-warehouse visual scenario when changing the singular chip.
- **CRITICAL contract boundary:** generated schema exposes `/api/Warehouses`, `/api/Warehouses/{id}`, `/api/Warehouses/selector`; query filters and mutation DTOs carry `WarehouseId`/`warehouseId`; stock, receipt, issue, return, movement, snapshot and stocktake DTOs carry warehouse identity/name; purchase decisions carry `receivingWarehouseId`. UI rollout must not remove, default, merge, or infer these fields, nor aggregate rows across warehouses by ingredient name. Presentation-only simplification is limited to labels/layout when IDs and API arguments remain unchanged.

## Architecture
`AppRouter` authenticates first, applies permission guards, lazy-loads the route owner, and mounts it inside `MainLayout`. `MainLayout` supplies navigation, route context and ownership metadata. Each page should compose `OperationalFrame` → `SectionPanel`/specialized workbench → `TableViewport`/query-state primitives. API hooks and generated schema remain below presentation; common table containers deliberately do not own filtering, totals or pagination.

Measurement coverage is layered: Vitest source/contract tests; Playwright smoke/control routes; `ui-audit.spec.ts` for five desktop viewports and DOM geometry/focus/console/page/non-read-request records; `visual-routes.spec.ts` and pagination snapshots for pixel regression; navigation/cache tests and `scripts/perf-probe.mjs` for performance/INP/overflow; `route-budgets.json` + checker for bundle budgets. Current broad visual snapshots omit the two admin settings routes and `/403`, and use only desktop 1365×900/mobile 390×844 rather than the canonical five-desktop measurement matrix.

## Recommended rollout ownership
1. Tokens/type/cross-route shell: `styles/index.css`, `lib/typography.ts`, `app/layout/MainLayout.tsx`.
2. Container/table behavior: `components/common/OperationalFrame.tsx`, `SectionPanel.tsx`, `TableViewport.tsx`; keep API semantics outside.
3. Route-specific appearance: change the listed page owner, then its nearest feature component; avoid global CSS fixes for one route.
4. Warehouse singular-label fix: only `features/warehouse/pages/WarehousePage.tsx`, plus multi-warehouse fixture/snapshot coverage; preserve all warehouse IDs.
5. Harness coverage: extend route arrays in `tests/ui-audit.spec.ts` and `tests/visual-routes.spec.ts` for admin settings/403 as rollout scope requires.

## Start Here
Open `frontend/src/routes/AppRouter.tsx` first to lock route/permission scope, then `frontend/src/app/layout/MainLayout.tsx` for shared shell and ownership markers. For primitive rollout, proceed to `frontend/src/components/common/OperationalFrame.tsx`.

## Residual Risks
- Static inventory did not enumerate every raw `<section>`, `<table>`, or local typography class across hundreds of feature files; source-owner fixtures and selector-overlap measurement should precede mass replacement.
- Generated schema proves multi-warehouse API semantics, but backend implementation/schema migrations were intentionally not inspected; treat the generated contract as immutable for this UI-only rollout.
- Existing screenshot suites do not cover every protected route or canonical desktop viewport.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "review-findings include concrete route, primitive, harness, duplication, and multi-warehouse findings with exact paths and LOW/MEDIUM/CRITICAL severity where applicable"
    }
  ],
  "changedFiles": [
    "context.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "read-only find/grep/read inventory under frontend/src, frontend/tests, frontend/package.json, frontend/playwright.config.ts, and frontend/route-budgets.json",
      "result": "passed",
      "summary": "Mapped protected routes, page owners, shared primitives, harnesses, likely duplication seams, and warehouse identity usage without executing mutations."
    }
  ],
  "validationOutput": [
    "AppRouter contains 12 protected route entries including /403; 10 role-guarded business/admin routes plus dashboard and forbidden.",
    "Only direct first-row warehouse presentation inference found was WarehousePage.tsx:176; operational selectors and API payloads remain warehouse-ID based.",
    "Generated OpenAPI schema contains warehouse resources, filters, entity DTO warehouse identity, and required mutation warehouse IDs."
  ],
  "residualRisks": [
    "Static inventory is not an exhaustive AST census of every local JSX container/class.",
    "Visual snapshot coverage omits /admin/rules, /admin/advanced-settings and /403 and does not use all five canonical desktop viewports."
  ],
  "noStagedFiles": true,
  "diffSummary": "Added only the mandated context.md read-only inventory artifact; no application or test source edited.",
  "reviewFindings": [
    "MEDIUM: frontend/src/features/warehouse/pages/WarehousePage.tsx:176 - first stock row supplies a singular warehouse header even when API rows may span warehouses; fix presentation only.",
    "MEDIUM: frontend/src/main.tsx:6-17 - overlapping component and redesign stylesheet layers are a cascade-risk seam for project-wide rollout.",
    "CRITICAL boundary: frontend/src/shared/api/contracts/schema.ts - warehouse IDs/names and receivingWarehouseId are API/entity/mutation contracts and must not be simplified away.",
    "LOW: frontend/tests/visual-routes.spec.ts - broad snapshots omit three protected routes and use a narrower viewport matrix than the measurement audit."
  ],
  "manualNotes": "No source edits or tests were performed; only the required context.md artifact was written."
}
```
