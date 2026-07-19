---
phase: 08-operational-page-feature-decomposition
type: master-plan
waves: 7
requirements: [REFA-01]
autonomous: true
route_contract:
  - /weekly-menu
  - /purchasing
  - /chef-dashboard
quality_gates:
  page_shell_max_lines: 400
  workflow_component_max_lines: 500
  custom_hook_max_lines: 300
---

# Phase 8 Plan: Operational page feature decomposition

## Objective

Refactor `WeeklyMenuPage`, `PurchasingPage` và `ChefDashboardPage` theo vertical workflow. Giữ nguyên route, permission, API payload, UI labels và hành vi người dùng; không biến refactor thành redesign hoặc chỉ chuyển JSX sang file khác.

## Locked decisions

- Giữ một route cho mỗi page; tab/section được tách nội bộ.
- Page shell chỉ giữ shared scope và active view.
- RTK Query là authority cho server state.
- Mỗi workflow sở hữu custom hook và UI state cục bộ.
- Không thêm Redux slice, Context tổng hoặc state manager mới.
- Dùng Shadcn/Base UI, Tailwind và IPC token hiện có.
- Ngưỡng cân bằng: page 400, component 500, hook 300 dòng.

## Target ownership

```text
weekly-menu/
  pages/WeeklyMenuPage.tsx
  model/{types,scope,formatters}.ts
  import/{WeeklyMenuImportDialog,useWeeklyMenuImport,importValidation}.ts(x)
  schedule/{WeeklyScheduleSection,WeeklyScheduleEditor,useWeeklyScheduleEditor}.ts(x)
  production-plan/{ProductionPlanSection,useWeeklyProductionPlan}.ts(x)
  demand/{MaterialDemandSection,useMaterialDemand}.ts(x)
  purchasing/PurchaseSummarySection.tsx
  cost/MenuCostSection.tsx
  dish-materials/DishMaterialsSection.tsx

purchasing/
  pages/PurchasingPage.tsx
  quotations/{SupplierQuotationManager,useSupplierQuotations}.ts(x)
  orders/{PurchaseOrderManager,usePurchaseOrders}.ts(x)
  demand/{PurchaseDemandSection,usePurchaseCandidates}.ts(x)

chef/
  pages/ChefDashboardPage.tsx
  production/{ChefProductionSection,useChefProductionPlan}.ts(x)
  receipts/{KitchenReceiptSection,useKitchenReceipts}.ts(x)
  journal/ShiftJournal.tsx
  exceptions/{OperationalActions,useChefExceptions}.ts(x)
```

## Wave 0 — Baseline and ownership gate

- Record exact dirty-worktree ownership and file hashes for the three pages.
- Run GitNexus context/impact for page symbols, imported hooks and shared components.
- Add characterization tests for route/tab labels, import preview/commit, demand generation, purchase candidate paging, inventory receipt and supplemental request.
- Record line counts and current API calls; any behavior change blocks extraction.

**Exit gate:** tests capture current behavior; no production source changed.

## Wave 1 — Pure model extraction

- Move types, formatter, import validation, layout mapper and aggregate selectors out of page files.
- Keep functions pure and add focused unit tests.
- No hook, JSX, route or styling changes.

**Exit gate:** only model imports change; render output and API calls are unchanged.

## Wave 2 — Weekly Menu import workflow

- Extract the complete import state machine as `useWeeklyMenuImport` rather than moving individual setters.
- Extract upload/job list, validation/diff panel, preview, commit, rollback and quick-customer controls.
- Dialog success closes only after mutation unwrap succeeds; error and blocking warnings remain visible.

**Expected reduction:** 900–1,200 lines from `WeeklyMenuPage`.

## Wave 3 — Weekly schedule editor

- Extract schedule rendering, edit draft, quick servings and save/cancel behavior.
- Pass one `WeeklyMenuScope` object instead of separate customer/week/tier props.
- Keep imported layout and current table geometry unchanged.

## Wave 4 — Production plan and material demand

- Extract production plan and demand as sibling modules.
- Modules communicate through RTK Query invalidation/refetch, not by calling each other's local setters.
- Preserve stale-demand, missing-BOM, serving and generation feedback semantics.

## Wave 5 — Read-only tabs and lazy boundaries

- Extract purchase summary, cost and dish-material sections.
- Lazy-load heavyweight inactive sections while preserving the single `/weekly-menu` route.
- Ensure loading placeholders have stable geometry and accessible text.

**Weekly exit gate:** shell <=400 lines, no behavior regression, no dead caller.

## Wave 6 — Purchasing and Chef application

- Apply the proven shell/scope/hook pattern to Purchasing and Chef.
- Purchasing: extract quotation, purchase-order and candidate-demand workflows.
- Chef: extract production-plan mapping, kitchen receipt, shift journal and exception mutation workflows.
- Keep all real API mutations and current Shadcn dialogs intact.

**Phase exit gate:** all three page shells <=400 lines or documented reviewed exception.

## Wave 7 — Cleanup and full verification

- Use `rg` and GitNexus context/impact before removing any old component, helper, export or file.
- Run `detect_changes` before every commit and compare affected flows with the wave manifest.
- Run frontend unit, build, lint, smoke, backend integration where API contracts are exercised, then live browser UAT against real backend/database.
- Re-run `gsd-ui-review` and `gsd-code-review`; Critical/High or functional Warning blocks full pass.

## Commit boundaries

1. `test: characterize operational page contracts`
2. `refactor: extract weekly menu pure model`
3. `refactor: isolate weekly menu import workflow`
4. `refactor: isolate weekly schedule editor`
5. `refactor: isolate production and demand workflows`
6. `refactor: isolate weekly menu read-only sections`
7. `refactor: decompose purchasing workflows`
8. `refactor: decompose chef workflows`
9. `chore: remove verified dead operational UI`
10. `docs: close phase 8 verification`

## Risk controls

- Never stage unrelated dirty hunks; use exact path/hunk staging and inspect cached diff.
- No refactor commit may change API payload, cache tag, permission or visible copy.
- Do not split one state machine across multiple hooks merely to satisfy line count.
- Any HIGH/CRITICAL impact is reported before edit and requires a narrower boundary or explicit decision.
- Browser unavailability leaves UAT pending; it cannot be replaced by a code-only full pass.

## Verification commands

```powershell
npm run test:unit --workspace frontend -- --run
npm run build --workspace frontend
npm run lint --workspace frontend
npm run test:smoke --workspace frontend
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore
node .gitnexus/run.cjs detect-changes --scope staged --repo IPCManagement
```

## Definition of done

- Requirement `REFA-01` passes.
- Routes and workflow semantics are unchanged.
- Page shells and feature files meet the approved thresholds.
- No dead UI/file remains where caller count is zero.
- Live browser/backend/database UAT and both GSD reviews pass.
