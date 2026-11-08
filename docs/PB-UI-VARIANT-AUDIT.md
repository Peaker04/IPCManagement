---
title: PB hidden design-system inventory and canon ballot
audited_commit: df05520
production_baseline: 757f2c8
audited_at: 2026-07-30
status: approved
approved_at: 2026-07-30
approved_ballot: "1-13; button=8B; form-controls=9B"
production_changes: none
---

# PB hidden design-system inventory and canon ballot

This is a read-only inventory of production files under `frontend/src`. Tests, specs and declaration
files are excluded. JSX counts come from every opening tag in the TypeScript AST; formatting counts come
from named call expressions. Counts below are exact callsites, not estimates. A composed adapter call is
called out separately when it is included in a component total.

The state-refactored region is the Phase 12/13 ownership set proven by the current verification artifacts:
Admin, Approval, Chef, Coordination, Purchasing, Reports, Warehouse and Projects/Weekly Menu. Shared
components and app-shell adapters are labelled `shared`; Dashboard/Auth sources without a `QueryView`
owner are labelled `legacy/unmodeled`. This classification does not claim that every DOM primitive inside
a state-refactored page was modernized by the state refactor.

The approved precedence is applied without hiding ambiguity: the state-refactored contract wins when it
is clearer, but Button and form-control primitives remain mixed even inside that region. Pagination and
feedback are classified by context rather than forced into one component.

## Discovered concept list

The source scan found eighteen recurring concepts:

1. Status presentation.
2. Initial loading and background refreshing.
3. Search/filter ownership, placement and reset.
4. Quantity/count/percent formatting.
5. Query error and forbidden presentation.
6. Empty-result presentation.
7. Table viewport and table adapters.
8. Query-state boundary rendering.
9. Mutation feedback.
10. Button primitives.
11. Form-control primitives.
12. Action placement.
13. Confirmation contracts.
14. Pagination/navigation contracts.
15. Form validation feedback.
16. Date/time formatting.
17. Currency formatting.
18. Work-object switching and route-page shell.

## Ranked ballot

Rows are sorted by active variant count. `Places to change` is the exact source set implied by the
proposal in that row; it is not authorization to start PE.

| Concept | Variants | Proposed canon | Why | Places to change | Risk / ballot state |
|---|---:|---|---|---:|---|
| Status presentation | 5 | `StatusBadge` for compact object/row status; `ContextStrip` for page summary; retain shell/scope banners | `StatusBadge` has 47 uses and 41 are in state-refactored regions; the five residual compact badges are also state-refactored but expose no extra edge case | 5 | MEDIUM · APPROVED |
| Loading vs refreshing | 5 | `QueryView` initial-load branch; stale content plus refresh notice; table placeholder only inside a table; skeleton/spinner only when geometry or control focus must remain stable | The state algebra distinguishes loading from ready+refreshing; contextual placeholders are not interchangeable | 1 duplicate loading row | HIGH · APPROVED |
| Search/filter ownership | 5 | Deferred server search, immediate client filtering, URL state only for shareable scope; reset the owned page/cursor when the filtered collection is paginated | There are 23 rendered search controls but five ownership patterns; two timer debounces and three immediate server searches duplicate the dominant deferred contract | 5 owners | MEDIUM · APPROVED |
| Quantity/count/percent formatting | 5 | Existing shared context formatters (`formatNumber`, `formatQuantity*`, `formatPercent`) with explicit unit/precision; file size remains its own formatter | Shared formatters cover 67 callsites; display-layer `toFixed`, direct locale output and one local percent helper disagree on precision | 26 | HIGH · APPROVED |
| Date/time formatting | 5 | Promote the existing date-only algorithm from `formatImportDate` and the guarded timestamp algorithm from `formatPublishedAt` into separate shared contracts | Date-only and timestamp values cannot share timezone rules; 39 consumers currently bypass those existing guarded algorithms | 39 | HIGH · APPROVED |
| Query error/forbidden | 4 | Retryable errors use `QueryErrorAlert`/error `EmptyState` or an equally visible state-owned retry action; forbidden uses fixed danger feedback; never encode either as empty | Purchasing already has a state-owned command-bar retry; the only duplicated residual is the quotation table's forbidden/error rows | 2 duplicate rows | HIGH · APPROVED |
| Empty-result presentation | 4 | `EmptyState` outside tables; semantic empty row inside tables; `InlineAlert` for missing prerequisite; compact text only inside constrained detail/dialog regions | These variants occupy different legal DOM and recovery contexts | 0 | LOW · APPROVED |
| Table boundary | 4 | `TableViewport` base; `PaginatedTableFrame` pagination adapter; shadcn `Table` may live inside the viewport; retire `DataTableShell` | The newer adapters retain native table semantics, caption and keyboard scroll ownership | 1 | LOW · APPROVED |
| Query-state boundary | 4 | Canon is the `QueryView<T>` algebra plus domain boundary renderers, not one universal renderer | Generic, Admin, Chef and Reports boundaries aggregate different query sets while preserving one algebra | 0 | MEDIUM · APPROVED |
| Mutation feedback | 4 | Query feedback by query boundary; short success by Toast; actionable mutation error persistent in-screen; validation field-adjacent | This is the approved context matrix; duration and recovery differ by category | 0 | LOW · APPROVED |
| Pagination/navigation | 4 | Keep page/offset, cursor, finite grouped page and calendar-week navigation as separate contracts | Total counts, opaque cursors, finite groups and calendar movement are not isomorphic | 0 | LOW · APPROVED |
| Button primitives | 3 | shadcn `Button` for domain/form/dialog actions; retain router Link, CommandBar and compact-control adapters | Choice 8B favors the clearer disabled/variant/size contract in newer dialogs while preserving contracts that are not buttons-in-disguise | 80 under the approved 8B canon | HIGH · APPROVED 8B |
| Form-control primitives | 3 | shadcn `Input`/`Select`/`Textarea`; retain checkbox, file and pagination internals | Choice 9B favors the clearer accessible-state contract while preserving controls with a different semantic contract | 69 under the approved 9B canon | HIGH · APPROVED 9B |
| Action placement | 3 | Page actions in `CommandBar`; row actions in the row; selected-object/form/dialog actions next to that object | Scope is visible at the action site and matches `UI = f(state)` | 0 | HIGH · APPROVED |
| Validation feedback | 3 | Field error adjacent to its control with `aria-invalid`/`aria-describedby`; form alert only for cross-field/server errors; native `required` is supplementary | The field-adjacent contract identifies the failing recovery point; two older Chef dialogs still use one dialog-level string | 2 | MEDIUM · APPROVED |
| Currency formatting | 3 | Shared `formatCurrency`; ranges compose formatted endpoints; no local helper or bare locale-money output | The shared helper has 32 callsites and one VND contract; 12 residual displays duplicate it | 12 | MEDIUM · APPROVED |
| Confirmation contracts | 2 | `ConfirmDialog` for simple yes/no mutation; rich `Dialog` when reason, validation, evidence or recoverable error is part of the decision | The simple component cannot absorb business decision forms safely | 0 | LOW · APPROVED |
| Work-object switching / route shell | 1 | `OperationalFrame` plus `ViewSwitcher`; pages without tabs omit the switcher | All operational route pages have converged | 0 | LOW · CONVERGED |

## Exact variant evidence

### 1. Status presentation

- `StatusBadge`: 47 callsites in 29 files — 41 state-refactored, 6 shared.
- Import-specific status spans: 2 state-refactored callsites —
  `WeeklyMenuImportJobs.tsx:72`, `WeeklyMenuImportReview.tsx:21`.
- shadcn `Badge` used as status: 3 state-refactored callsites —
  `material-checklist.tsx:104,117,129`. The fourth `Badge` at `chef-header.tsx:44` is a shift label,
  not status.
- `ContextStrip`: 16 callsites, all under state-refactored owners.
- Scope/shell status: `order-status-banner.tsx:38` and `MainLayout.tsx:263`; these are not compact
  row badges.

Exact compact migration set: 5 callsites (the two import spans and three checklist badges).

### 2. Loading and refreshing

- Query/domain boundary consumers: 16 — `AdminQueryBoundary` 8, `ChefQueryBoundary` 2,
  `ReportQueryBoundary` 2 and generic `QueryViewBoundary` 4; all are state-refactored.
- Refresh `InlineAlert` render sites preserving current content: 13 in 10 state-refactored files.
- Semantic table loading placeholders: 6 in 5 files — `AdminBomPanel.tsx:262`,
  `PurchaseServiceDateWorkbench.tsx:121`, `SupplierQuotationSection.tsx:110`,
  `WarehouseExceptionsWorkbench.tsx:224,274`, `WarehousePage.tsx:662`; all are state-refactored.
- Pulse geometry: 7 callsites in `AppRouter.tsx:31,33,34,35,37`,
  `PurchaseServiceDateWorkbench.tsx:121`, `WarehousePage.tsx:534` — 5 shared route-shell and 2
  state-refactored callsites.
- Animated control/scope spinners: 4 — `PaginationBar.tsx:112`, `CursorPaginationBar.tsx:77`,
  `order-table.tsx:57`, `order-status-banner.tsx:39` — 2 shared adapters and 2 state-refactored.

Only `SupplierQuotationSection.tsx:110` duplicates the outer loading notice at line 87. The
forbidden/error rows at 111–112 belong to the query-error concept below.

### 3. Search/filter ownership

- Rendered search controls: 23; all are inside state-refactored owner regions.
- `useDeferredValue`: 19 total calls; 16 are search values and 3 are view-transition values.
  Of the 16 searches, 15 feed server queries and `useAdminBomPanelModel.ts:43` defers a client filter.
- Timer debounce: 2 server-query owners — `useReportsAuditQualityViewModel.ts:33` and
  `useReportsPriceViewModel.ts:38`.
- Immediate server search: 3 — `SupplierQuotationSection.tsx:36`,
  `WarehouseExceptionsWorkbench.tsx:215,265`.
- Immediate client search: 5 — `order-table.tsx:239`, `WeeklyMenuImportHistory.tsx:31`,
  `WeeklyMenuImportJobs.tsx:45`, `PurchaseLineGroups.tsx:73`,
  `PurchaseOrderLineGroups.tsx:48`.
- URL-owned route scope: 5 `useSearchParams` owners — Admin, Approval, Purchasing, Reports and Warehouse.

Under the proposed contract, the exact review/migration set is the two timers plus three immediate
server searches. Client filters and URL-owned shareable scope remain separate sanctioned variants.

### 4. Quantity/count/percent formatting

- Shared context formatters: 67 production callsites across state-refactored consumers and shared
  presentation adapters — `formatNumber` 3, `formatQuantity` 9 after excluding its internal composition
  call, `formatQuantityWithUnit` 46 and `formatPercent` 9.
- Display-layer `toFixed`: 11 — `AdminBomPanel.tsx:37,161,322`,
  `AdminStatisticsPanel.tsx:175`, `MenuCostSection.tsx:89` (2),
  `DishMaterialsSection.tsx:14,40,55`, `PurchaseSummarySection.tsx:89,90`.
- Direct locale quantity/count output: 14 — `AdminStatisticsPanel.tsx:86,93,104` (2 at 104),
  `MenuCostSection.tsx:60`, `MaterialDemandSection.tsx:229,232,268,269`,
  `demandModel.ts:289`, `WeeklyMenuImportJobs.tsx:71`,
  `ProductionPlanSection.tsx:24,75`, `PurchaseLineGroups.tsx:104`.
- Local signed-percent helper consumer: `ApprovalQueue.tsx:150`.
- File-size locale branches at `weekly-menu/model/formatters.ts:116,117` are a separate unit contract and
  are not in the 26-place migration set.

The 11 + 14 + 1 residual callsites are exact: 25 are state-refactored and the local percent helper is
shared. Model-layer rounding calls are excluded because they are domain normalization, not display
formatting.

### 5. Date/time formatting

- Existing safe date-only `formatImportDate`: 15 consumers. It parses `yyyy-MM-dd` without shifting
  timezone and is the proposed date-only algorithm.
- Three duplicated Purchasing `formatIsoDate` definitions: 7 consumers.
- Direct locale date/timestamp output outside those helper implementations: 29 calls.
- Component-local guarded helper: `chef-header.tsx:35` — 1 consumer.
- App-shell `Intl.DateTimeFormat` singleton: `MainLayout.tsx:152` — 1 consumer.
- `formatDateVN` has 0 production consumers and is not treated as an active winning variant.

Exact 38-place migration/review set after removing the unintended lifecycle panel:

```text
api/workflowDocumentsApi.ts:44
app/layout/MainLayout.tsx:152
app/pages/admin-data/AdminAuditPanel.tsx:110 (2 calls)
app/pages/admin-data/AdminCleanupPanel.tsx:72
app/pages/admin-data/AdminEmployeesPanel.tsx:151
app/pages/admin-data/AdminStatisticsPanel.tsx:142
components/common/DemandSummary.tsx:83
features/approvals/approvalsApi.ts:32
features/approvals/pages/ApprovalPage.tsx:146,148,446
features/chef/components/chef-header.tsx:35
features/projects/weekly-menu/dish-materials/DishMaterialsSection.tsx:24
features/projects/weekly-menu/production-plan/ProductionPlanSection.tsx:72
features/projects/weekly-menu/purchasing/PurchaseSummarySection.tsx:78
features/projects/weeklyMenuPlanning.ts:80
features/purchasing/PurchaseDecisionPanel.tsx:48,49,293,318,460
features/purchasing/PurchaseLineGroups.tsx:108
features/purchasing/PurchaseServiceDateWorkbench.tsx:92
features/reports/pages/ReportsPage.tsx:168,301,363,406,448
features/reports/pages/ReportsPricePanel.tsx:309
features/reports/pages/useReportsAuditQualityViewModel.ts:68
features/reports/pages/useReportsKitchenUsageViewModel.ts:38,52
features/reports/pages/useReportsStockMovementViewModel.ts:80
features/warehouse/WarehouseDemandPanel.tsx:41,43 (2 calls at 43)
features/warehouse/pages/WarehousePage.tsx:676
```

The set contains 36 state-refactored consumers and 3 shared consumers (`workflowDocumentsApi`,
`MainLayout`, `DemandSummary`).

### 6. Query error and forbidden

- `QueryErrorAlert`: 20 callsites in 14 files — 17 state-refactored, 2 shared compositions and 1
  legacy/unmodeled Dashboard callsite.
- Error `EmptyState`: 10 callsites; it composes `QueryErrorAlert` and keeps retry adjacent to the result.
- Fixed forbidden `InlineAlert`: 19 query-state render sites.
- State-owned retry outside the alert: Purchasing uses `nextAction.kind === 'recovery'` and the visible
  command-bar `Thử lại` action (`PurchasingPage.tsx:102,164-165,187-195`). It is not a missing retry.
- Plain table duplicates: `SupplierQuotationSection.tsx:111-112` repeat the already-rendered forbidden
  and error states from lines 75 and 79.

Exact migration set: the two quotation table rows. Backend/FE permission semantics are not changed.

### 7. Empty-result presentation

- `EmptyState`: 26 callsites in 23 files — 18 state-refactored, 7 shared and 1 legacy/unmodeled.
- Semantic table empty rows: 26 callsites — 19 direct rows plus 7 `AdminEmptyRow` consumers.
- Explicit empty/prerequisite `InlineAlert`: 11 callsites —
  `ApprovalQueryPanels.tsx:86,92`, `MaterialDemandSection.tsx:160,273,306,318`,
  `PurchaseSummarySection.tsx:44`, `WeeklyMenuAlerts.tsx:53`,
  `PurchaseDecisionPanel.tsx:67,356`, `SupplierQuotationSection.tsx:69`.
- Compact constrained detail/dialog text remains context-local; it is not legal as a table row or page
  result component.

The four forms are sanctioned contexts, not four candidates for one universal component.
All semantic table-row and prerequisite-alert callsites are inside state-refactored owner regions.

### 8. Table boundary

- `TableViewport`: 39 JSX uses — 33 state-refactored, 5 shared adapters and 1 weekly-menu legacy
  presentation component; 38 are direct consumers plus one internal use in `PaginatedTableFrame`.
- `PaginatedTableFrame`: 6 state-refactored consumers.
- shadcn `Table` inside `TableViewport`: 2 Chef consumers.
- `DataTableShell`: 1 residual at `AdminBomPanel.tsx:201`.

Exact migration set: the one `DataTableShell` callsite.

### 9. Query-state boundary

- Direct `toQueryView` call expressions: 21, all on state-refactored ownership chains and including the four reusable adapters
  (`toAdminView`, `toChefView`, `toReportView`, `toLabeledQueryView`).
- Renderer variants and consumers: generic 4, Admin 8, Chef 2, Reports 2 — 16 total.
- All four renderers consume the same exhaustive algebra; their aggregation and fallback rules differ.

No universal boundary component is proposed, so the migration count is zero.

### 10. Mutation feedback

- Toast: 9 calls in 5 files — 5 state-refactored and 4 shared copy-action calls.
- `QueryErrorAlert`: 20 calls in 14 files — 17 state-refactored, 2 shared and 1 legacy/unmodeled.
- `InlineAlert`: 126 calls in 29 files — 121 state-refactored and 5 shared compositions.
- Field-adjacent `aria-invalid`: 28 controls in 8 files — 26 state-refactored and 2 legacy Auth controls.

The volume difference is expected: persistent business/query feedback outnumbers short-lived successful
mutations. The approved PE feedback pass leaves no confirmed context violation.

### 11. Button primitives

- CSS `ipc-button` primitive: 106 callsites in 30 files — 74 native `<button>` and 32 router `Link`;
  state split 100 state-refactored, 1 shared, 5 legacy/unmodeled.
- shadcn `Button`: 56 callsites in 16 files — 53 state-refactored, 2 shared, 1 legacy/unmodeled.
- Bespoke native `<button>` without `ipc-button`: 26 callsites in 20 files — 12 state-refactored,
  13 shared adapters, 1 legacy/unmodeled.

Action-location recount across all 188 button/link controls: 24 in 9 CommandBars, 38 in rows,
41 in dialogs, 6 in forms and 79 in local section/shell regions.

Under the shadcn proposal, 79 native buttons require review/migration after retaining 10 native
CommandBar controls and 11 pagination/view-switcher/toast/shell adapter internals. All 32 router Links
remain links. The exact 79-callsite set is:

```text
app/pages/admin-data/AdminAuditPanel.tsx:68,81
app/pages/admin-data/AdminBomPanel.tsx:28,72,81,91,117,128,191,250,253,417,418
app/pages/admin-data/AdminCleanupPanel.tsx:99
app/pages/admin-data/AdminContractsPanel.tsx:71,75,186,296,300,303
app/pages/admin-data/AdminEmployeesPanel.tsx:86,89,155,163
components/common/DocumentRail.tsx:75
components/common/QueryErrorAlert.tsx:20
components/common/StockMovementTable.tsx:126
features/admin/pages/ApprovalRulesPage.tsx:316,324,418,504
features/approvals/pages/ApprovalPage.tsx:219,227,400
features/approvals/pages/ApprovalQueryPanels.tsx:217
features/auth/pages/LoginPage.tsx:185
features/chef/components/active-dishes-grid.tsx:50
features/chef/components/material-checklist.tsx:112
features/chef/components/operational-actions.tsx:31,45
features/chef/production/ChefProductionSection.tsx:56
features/coordination/components/header-info.tsx:54
features/dashboard/pages/DashboardPage.tsx:324
features/projects/weekly-menu/cost/MenuCostSection.tsx:30,31
features/projects/weekly-menu/demand/MaterialDemandSection.tsx:118,131,132,251
features/projects/weekly-menu/import/WeeklyMenuImportDialog.tsx:19,51,60,61
features/projects/weekly-menu/import/WeeklyMenuImportHistory.tsx:62
features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx:35,38,66,74,75,76
features/projects/weekly-menu/import/WeeklyMenuImportReview.tsx:46
features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:74,83,95,106,122
features/projects/weekly-menu/schedule/WeeklyScheduleEditorDialog.tsx:12,52,53
features/purchasing/PurchaseDecisionPanel.tsx:78
features/purchasing/PurchaseLineGroups.tsx:110,124
features/purchasing/PurchaseServiceDateWorkbench.tsx:79
features/purchasing/PurchaseWorkflowGuide.tsx:39
features/purchasing/quotation/SupplierQuotationSection.tsx:105,106,142,143
features/reports/pages/ReportsPage.tsx:201
```

### 12. Form-control primitives

- shadcn controls: 47 callsites in 18 files — `Input` 40, `Select` 4, `Textarea` 3; all are in
  state-refactored regions.
- Raw `ipc-input`/`ipc-select`/`ipc-textarea`: 58 callsites in 15 files — 56 state-refactored and
  2 legacy/unmodeled.
- Other raw controls: 21 callsites in 10 files — 19 state-refactored and 2 shared pagination internals.

The explicit exception set is 10 callsites: 6 checkboxes, 2 file inputs and 2 PaginationBar internals.
Under the shadcn proposal, the exact 69-place migration set is:

```text
app/pages/admin-data/AdminAuditPanel.tsx:19,30,47,58
app/pages/admin-data/AdminBomPanel.tsx:44,62,184,334,353,377,382,387,397,401,408
app/pages/admin-data/AdminContractsPanel.tsx:47,84,96,107,118,128,141,151,164,236,260,272,287
app/pages/admin-data/AdminEmployeesPanel.tsx:29,39,49,60,101
features/admin/pages/ApprovalRulesPage.tsx:379,465,479
features/auth/pages/LoginPage.tsx:150,168
features/chef/pages/ChefDashboardPage.tsx:169,172
features/coordination/components/header-info.tsx:38
features/coordination/components/order-table.tsx:326,354
features/projects/weekly-menu/dish-materials/DishMaterialsSection.tsx:29
features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx:19,39,51,116,119
features/projects/weekly-menu/production-plan/ProductionPlanSection.tsx:30
features/projects/weekly-menu/schedule/QuickServingCell.tsx:7
features/projects/weekly-menu/schedule/WeeklyScheduleEditorDialog.tsx:33
features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx:45,55
features/purchasing/PurchaseDecisionPanel.tsx:303
features/purchasing/quotation/SupplierQuotationSection.tsx:36,46,124,130,134,137,138
features/reports/pages/ReportsPage.tsx:75,87,99,107
features/warehouse/WarehouseExceptionsWorkbench.tsx:306,322
features/warehouse/WarehousePurchaseReceiptDialog.tsx:218
```

### 13. Action placement

- Page/CommandBar actions: 24 controls in 9 CommandBars — 21 state-refactored and 3 legacy Dashboard.
- Row actions: 38 controls — 37 state-refactored and 1 shared table adapter.
- Selected-object/form/dialog/local actions: 127 controls (41 dialog, 6 form, 80 section/shell) —
  108 state-refactored, 15 shared and 4 legacy/unmodeled.

These are scope variants, not three competing visual components. No misplaced action is proven by the
source inventory, so the proposed migration count is zero.

### 14. Validation feedback

- `aria-invalid`: 28 controls in 8 files.
- `aria-describedby`: 43 controls; the larger count includes help text and dialog descriptions.
- Native `required`: 5 controls, all in `AdminBomPanel` and supplementary to application validation.
- Legacy dialog-level validation string without field wiring: exactly 2 —
  `excess-material-dialog.tsx:88` and `supplemental-request-dialog.tsx:80`; both are older DOM inside
  the state-refactored Chef owner.

Exact migration set: those two Chef dialog messages.

### 15. Currency formatting

- Shared `formatCurrency`: exactly 32 production callsites after excluding the local helper with the same
  name in `ApprovalQueue`.
- Local helper consumers: `ApprovalQueue.tsx:148,149` — 2.
- Bare locale-money displays: 10 — `AdminContractsPanel.tsx:219`,
  `AdminStatisticsPanel.tsx:173,174`, `ApprovalRulesPage.tsx:298` (2 calls),
  `PurchaseLineGroups.tsx:99,100` (2 calls at 100),
  `SupplierQuotationSection.tsx:101`, `WarehousePurchaseReceiptDialog.tsx:207`.

Exact migration set: 12 presentation callsites; 10 are state-refactored and 2 are shared.

### 16. Confirmation contracts

- Simple `ConfirmDialog`: 4 — Admin BOM close, Approval Rule delete, Material Demand generation and
  Supplier Quotation deactivation; all four are state-refactored.
- Rich business decision `Dialog`: 3 — Coordination decision flow, Purchasing decision flow and
  Approval approve/reject flow. Their internal branches cover multiple actions but remain three dialog
  owners; all three are state-refactored.
- Native `window.confirm`: 0 production callsites.

Other `Dialog` uses are forms, detail views or session UX, not confirmation variants.

### 17. Pagination/navigation

- Page/offset `PaginationBar`: 33 — 29 state-refactored and 4 shared consumers.
- Cursor `CursorPaginationBar`: 4 — 3 state-refactored and 1 shared consumer.
- Finite grouped `PageStepper`: 1 state-refactored consumer.
- Calendar-week navigation: 2 arrow controls plus one reset in the state-refactored
  `PurchasingPage.tsx:177-186`.

The last item moves a calendar route context and is not a row-page or opaque-cursor contract. All four
variants are sanctioned by the already-approved pagination decision.

### 18. Work-object switching / route shell

- `OperationalFrame`: 10 route-page consumers — 9 state-refactored and 1 legacy Dashboard shell.
- `ViewSwitcher`: 9 state-refactored tabbed surfaces; the tenth route page has no work-object tabs.

No competing production variant remains.

## Post-PE live-source recount — 2026-08-02

The ballot above remains the decision record; this section is the current projection after Phase 21
convergence. “Residual” means a production presentation that still violates the approved canon, not the
number of valid canon consumers. Counts come from executable AST/owner tests rather than the historical line
list, whose line numbers moved during convergence.

| Approved concept | Live residual | Canon / exact exception disposition |
|---|---:|---|
| Status presentation | 0 | `StatusBadge`/`ContextStrip`; exactly one non-status Badge in `chef-header` |
| Initial loading vs background refresh | 0 | stale content stays rendered during background refresh |
| Search/filter ownership | 0 | all five audited server-search owners pass deferred query values; the two Reports owners retain their existing 300 ms request debounce before deferral as a behavior-preserving compatibility layer, while client/URL owners retain their contracts |
| Quantity/count/percent | 0 | shared quantity/percent formatters; exactly four model-rounding `toFixed` calls remain |
| Date-only vs timestamp | 0 | shared timezone-free `formatDateOnly` and guarded `formatDateTime` fixed to the audited business timezone `Asia/Bangkok`; MainLayout clock and transport/date arithmetic remain semantic exceptions |
| Query error/forbidden vs empty | 0 | `QueryErrorAlert`/`InlineAlert` branches remain distinct from empty state |
| Empty-result presentation | 0 | approved page/table/prerequisite/detail context variants remain |
| Table boundary | 0 | `TableViewport`/approved adapters; `DataTableShell` callers remain zero |
| Query-state algebra | 0 | domain renderers retain exhaustive query-state contracts without a universal component |
| Mutation feedback | 0 | toast, persistent actionable error and field validation remain context-owned |
| Pagination/navigation | 0 | offset, cursor, finite-step and calendar adapters remain separate contracts |
| Button primitive (8B) | 0 | 77 migrated; exactly 10 CommandBar and 11 adapter/shell native controls remain |
| Form-control primitive (9B) | 0 | 39 Input, 26 Select and 4 Textarea migrated; exactly 11 semantic exceptions remain |
| Action placement | 0 | page, row and selected-object placement remains scope-owned |
| Validation feedback | 0 | field-adjacent Chef residuals migrated; ARIA wiring retained |
| Currency formatting | 0 | shared `formatCurrency`; local/bare presentation residuals remain zero |
| Confirmation contracts | 0 | native `window.confirm` remains zero; simple and rich decision contracts stay distinct |
| Work-object switching / route shell | 0 | `OperationalFrame` and conditional `ViewSwitcher` contract retained |

Executable closure is in `frontend/tests/uiCanonSourceInventory.test.ts`,
`buttonPrimitiveConvergence.test.ts`, `formPrimitiveConvergence.test.ts`,
`dateFormattingConvergence.test.ts`, `quantityFormattingConvergence.test.ts` and
`currencyFormattingConvergence.test.ts`. The exact shared/file-size `toLocaleString` exception set is three;
any new occurrence changes a count-locked test.

## Approval record

Approved by the user on 2026-07-30: all thirteen pending concepts, with choice **8B** for Button
primitives and **9B** for form-control primitives. Empty result, Mutation feedback, Confirmation and
Pagination were already approved; the route shell was already converged.

PB has no remaining canon decision. This approval closes the inventory/ballot and authorizes the next
read-only sequence `P3 → P4 → PC`. It does **not** authorize the 79 Button migrations, 69 form-control
migrations or any other PE slice before PC has measured missing actions and the user has reviewed the
result.

Post-audit correction ngày `2026-07-30`: `WeeklyMenuLifecyclePanel` là UI phát sinh do hiểu nhầm yêu cầu
E2E và đã bị gỡ hoàn toàn. Các count/date/button set phía trên đã trừ đúng hai consumer của file đó; model
lifecycle và PA registry vẫn tồn tại như contract/test, không phải production component.
