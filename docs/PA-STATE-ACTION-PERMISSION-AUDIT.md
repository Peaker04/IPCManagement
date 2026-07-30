---
title: PA state/action and BE-FE permission audit
audited_at: 2026-07-30
scope: WeeklyMenuLifecycle plus complete backend/frontend permission vocabulary
behavior_change: remove unintended lifecycle panel and align two verified frontend permission gates
---

# PA state/action and permission audit

This document is an audit snapshot, not a permission or lifecycle source of truth. The executable
registry is `frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts`;
backend vocabulary remains `AuthorizationPolicies.AllPermissions` plus the admin wildcard emitted by
`AuthService.BuildPermissionsForRole`. Production code must not import this document or the registry.

## PA-2 — `WeeklyMenuLifecycle` registry

The registry projects ten scenarios from `buildWeeklyMenuLifecycleModel` and records object, projected
state, role, action, operation, source, backend permission, frontend permission and correspondence. Its
tests prove that state/action cells still come from the lifecycle model, that literal source assertions
fail on drift, and that production source does not import the registry.

The route-level `coordination.read` source guard lives in
`frontend/src/routes/AppRouter.pa2Source.test.ts`; lifecycle/action guards stay in the feature-local
registry test. This keeps the source assertions architecture-clean without changing production code.

### Refactor-debt map — `KHÔNG-XÁC-ĐỊNH-ĐƯỢC`

The ten role cells are all unknown because the lifecycle model does not accept an actor or role. The
remaining unknown cells are below; no inferred value has been substituted.

| Registry scenario | Unknown columns | Evidence |
|---|---|---|
| `activeLoadingModel` | operation, backend permission, frontend permission | `weeklyMenuLifecyclePa2Registry.test.ts:175-182` |
| `activeErrorModel` | operation, backend permission, frontend permission | `weeklyMenuLifecyclePa2Registry.test.ts:184-191` |
| `activeShortageModel` | backend permission | `weeklyMenuLifecyclePa2Registry.test.ts:193-201` |
| `activeNoShortageModel` | operation, backend permission, frontend permission | `weeklyMenuLifecyclePa2Registry.test.ts:203-210` |
| `inconsistentModel` | operation, backend permission, frontend permission | `weeklyMenuLifecyclePa2Registry.test.ts:212-219` |
| `supersededModel` | operation, backend permission, frontend permission | `weeklyMenuLifecyclePa2Registry.test.ts:221-229` |

Total projected unknown cells: 26 — ten role cells and sixteen operation/permission cells.

### Verified BE↔FE differences in this registry

#### FE tighter than BE

| Scenario | Observable difference | Evidence |
|---|---|---|
| Draft lifecycle publish | 2026-07-31 disposition — Option A approved: backend `CoordinationAccess` accepts Manager/Coordinator, while the real `Publish` surface remains Admin-only inside Admin Data behind wildcard admin routing. DRAFT × Manager/Coordinator is intentional FE-tighter-than-BE; no reconciliation is required. | `weeklyMenuLifecyclePa2Registry.test.ts`; `AdminContractsPanel.tsx:240-304`; `AppRouter.tsx:62`; `MenuSchedulesController.cs:13,51-68` |

Serving completion is no longer a difference: FE uses canonical `coordination.order.lock` and Manager dev
fixture receives that same string. Purchasing handoff is gated by canonical `purchase.read`.

#### FE looser than BE

No row in this one-object registry is verified as `FE-LỎNG-HƠN`.

### API operations with no discovered state or permission condition

No traced API operation in the four executable registry rows lacks both a state condition and a backend
authorization policy. The remaining operation cells are `KHÔNG-XÁC-ĐỊNH-ĐƯỢC`; they are FE presentation
states or navigation, not evidence of an unguarded API action.

## PA-3 — complete permission-chain diff

### Blocking answer

Frontend permission strings are handwritten, not generated from backend definitions. Evidence:

- Backend emits `AuthorizationPolicies.ResolvePermissions(...)` through
  `AuthService.BuildPermissionsForRole` (`AuthService.cs:304-313`).
- Route and menu strings are literals (`AppRouter.tsx:55-63`, `MainLayout.tsx:57-65`).
- Dev-login fixture strings are literals (`LoginPage.tsx:20-27`).
- Action guards and guard tests also use literals (`MaterialDemandSection.tsx:111-116,249-256`,
  `guards.test.tsx:69-155`).

Therefore every FE literal is a potentially drifting copy. The PA-4 checker reads both frontend roots
and resolves its valid vocabulary from backend code; it does not maintain a second FE allow-list.

### Named backend authorization policies actually enforced

All names below are defined in `AuthorizationPolicies.cs:5-19`, registered in `Program.cs:159-189`, and
used by `[Authorize(Policy = ...)]` at the listed enforcement sites.

| Policy | Enforcement sites |
|---|---|
| `AdminAccess` | `AdminEmployeesController.cs:14`; `ApprovalRulesController.cs:18`; `AuditReportsController.cs:28,35,41`; `StockSnapshotReportsController.cs:34`; `WorkflowReportsController.cs:98,125` |
| `CatalogAccess` | `DishBomController.cs:34,47,62`; `DishBomImportsController.cs:37,58`; `DishesController.cs:50,60,72`; `IngredientsController.cs:14`; `CoordinationOrdersController.cs:101,166`; `SampleDataController.cs:16` |
| `CatalogReadAccess` | `DishBomController.cs:22`; `DishBomImportsController.cs:24`; `DishCatalogDiagnosticsController.cs:20,26,32,38`; `DishesController.cs:20,29,38` |
| `CoordinationAccess` | `CoordinationOrdersController.cs:15`; `CustomerContractsController.cs:13`; `MealQuantityPlansController.cs:15`; `MenuSchedulesController.cs:13`; `PortionRulesController.cs:13`; `WeeklyMenuImportsController.cs:19` |
| `DemandGenerateAccess` | `MaterialDemandController.cs:15` |
| `InventoryAccess` | `InventoryReceiptsController.cs:16`; `InventoryReturnsController.cs:82`; `StocktakesController.cs:14`; `SupplementalMaterialRequestsController.cs:96,104,112` |
| `InventoryApproveAccess` | `StocktakesController.cs:64,73` |
| `InventoryIssueAccess` | `InventoryIssuesController.cs:16`; `InventoryReturnsController.cs:32,47`; `SupplementalMaterialRequestsController.cs:16` |
| `ProductionAccess` | `InventoryReturnsController.cs:64`; `ProductionPlansController.cs:14` |
| `PurchaseAccess` | `PurchaseOrdersController.cs:63,87`; `PurchaseWorkflowController.cs:17`; `SupplierQuotationsController.cs:14`; `PriceVarianceReportsController.cs:42,49,56,63,70,77`; `PurchasingReportsController.cs:35,42` |
| `PurchaseGenerateAccess` | `PurchaseWorkflowController.cs:62,81,114,158` |
| `PurchaseOrderReadAccess` | `PurchaseOrdersController.cs:28,37,47`; `PriceVarianceReportsController.cs:28,35` |
| `WarehouseCatalogAccess` | `WarehousesController.cs:14` |
| `WarehousePurchaseReceive` | `WarehousePurchaseReceiptsController.cs:15` |

`WarehouseAccess` is declared and registered but no `[Authorize(Policy = AuthorizationPolicies.WarehouseAccess)]`
enforcement site exists. It is not included in the enforced table.

Approval decisions are an additional permission-string enforcement path under generic `[Authorize]`:
`ApprovalWorkflowService.cs:61-69` maps each target to its required permission and
`ApprovalsController.cs:46-53` returns HTTP 403 with `Không có quyền phê duyệt chứng từ này.` when it fails.

### Vocabulary diff

The authoritative backend vocabulary contains 22 named permissions plus the admin wildcard `*`.

| Group | Permission strings |
|---|---|
| `KHỚP` | `*`, `auth.profile.read`, `catalog.read`, `coordination.order.adjust`, `coordination.order.lock`, `coordination.order.signoff`, `coordination.read`, `dashboard.read`, `demand.generate`, `inventory.read`, `production.read`, `purchase.generate`, `purchase.read`, `purchase.request.approve`, `report.read`, `warehouse.read` |
| `CHỈ-CÓ-Ở-BE` | `catalog.write`, `inventory.adjustment.approve`, `inventory.issue.approve`, `inventory.receipt.approve`, `material-demand.approve`, `purchase.price-exception.approve`, `purchase.quotation.manage` |
| `CHỈ-CÓ-Ở-FE` | `admin.only`, `warehouse.issue` |
| `GẦN-GIỐNG` | `inventory:read` ↔ `inventory.read`; `production:read` ↔ `production.read`; `warehouse:read` ↔ `warehouse.read` |

### Observable consequences of FE-only/near-match strings

| FE string | Location | Verified consequence | Canonical backend value |
|---|---|---|---|
| `production:read` | `LoginPage.tsx:24` | In the dev-login fixture, Bếp trưởng receives a colon variant while menu/route require `production.read`; the Bếp screen is hidden/forbidden in that fixture. | `production.read` |
| `warehouse:read` | `LoginPage.tsx:25` | In the dev-login fixture, Thủ kho does not satisfy the `warehouse.read` menu/route gate. | `warehouse.read` |
| `inventory:read` | `LoginPage.tsx:25` | No current runtime gate consumes canonical `inventory.read`; the immediate visible consequence is not independently observable. | `inventory.read` |
| `admin.only` | `guards.test.tsx:87,155` | Test-only synthetic string; no production screen is affected. | `*` for the tested admin-wildcard case |
| `warehouse.issue` | `guards.test.tsx:128,141,147` | Test-only synthetic string; semantic canonical replacement cannot be determined from this generic guard test. | `KHÔNG-XÁC-ĐỊNH-ĐƯỢC` |

## PA-4 — intentional-red vocabulary checker

`FrontendPermissionVocabularyTests` imports `AuthorizationPolicies.AllPermissions`, reads the admin wildcard
from `AuthService.BuildPermissionsForRole`, and scans both `frontend/src` and `frontend/tests`. It covers
route guards, menu/action guards, hooks, dev fixtures and tests. No fixture or test exemption exists.

Verified command:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~FrontendPermissionVocabularyTests"
```

Expected current result: one failed test with the five remaining non-canonical literal groups listed above.
`orders.lock` is no longer reported. This red result
is the requested stopping point. No permission string is changed by PA.

## PA-5 — seven backend permissions without an exact FE runtime gate

| Backend permission | UI/action finding | Conclusion | Evidence |
|---|---|---|---|
| `catalog.write` | Catalog/BOM mutation controls exist in Admin Data, but the parent route requires admin wildcard while backend `CatalogAccess` also permits Manager. This is FE tighter, so the original “no gate ⇒ FE looser” premise does not apply. | `KHÔNG-XÁC-ĐỊNH-ĐƯỢC` within PA-5's four allowed outcomes; needs product decision on Manager access | `AdminBomPanel.tsx:191,250,419`; `AppRouter.tsx:62`; `AuthorizationPolicies.cs:36-40,150-174` |
| `inventory.adjustment.approve` | Generic Approve/Reject controls operate on permission-filtered approval inbox records. | `KHÔNG-CẦN-GATE-RIÊNG` — centralized approval flow | `ApprovalPage.tsx:217-239,342,381`; `ApprovalInboxService.cs:213-216`; `ApprovalWorkflowService.cs:68` |
| `inventory.issue.approve` | Generic Approve/Reject controls operate on permission-filtered inventory-issue records. | `KHÔNG-CẦN-GATE-RIÊNG` — centralized approval flow | `ApprovalPage.tsx:217-239,342,381`; `ApprovalInboxService.cs:207-210`; `ApprovalWorkflowService.cs:67` |
| `inventory.receipt.approve` | Backend can execute this approval target, but the inbox builder has no inventory-receipt branch and no receipt-approval action is found on UI. “Ghi nhận nhập kho” is a different warehouse mutation. | `ỨNG-VIÊN-LỚP-A` | `ApprovalWorkflowService.cs:66`; `ApprovalInboxService.cs:187-217`; `WarehousePurchaseReceiptDialog.tsx:305` |
| `material-demand.approve` | Generic Approve/Reject controls operate on permission-filtered material-demand records. | `KHÔNG-CẦN-GATE-RIÊNG` — centralized approval flow | `ApprovalPage.tsx:217-239,342,381`; `ApprovalInboxService.cs:189-192`; `ApprovalWorkflowService.cs:63` |
| `purchase.price-exception.approve` | Generic Approve/Reject controls operate on permission-filtered price-exception records. | `KHÔNG-CẦN-GATE-RIÊNG` — centralized approval flow | `ApprovalPage.tsx:217-239,342,381`; `ApprovalInboxService.cs:201-204`; `ApprovalWorkflowService.cs:64` |
| `purchase.quotation.manage` | Quotation/supplier decisions exist under the Purchasing route. The exact string is not checked, but `purchase.read` and `purchase.quotation.manage` are emitted to the same non-admin role cohort. No button-then-403 consequence is demonstrated. | `KHÔNG-CẦN-GATE-RIÊNG` under the current role mapping; not a centralized approval | `AppRouter.tsx:60`; `PurchaseDecisionPanel.tsx:335-379`; `AuthorizationPolicies.cs:150-174,189-199` |

## Decisions still required

1. Approve which five remaining PA-4 mismatches may be corrected; PA does not assume backend names are necessarily the desired product policy.
2. Decide whether Manager should reach catalog-write UI. Current FE admin-only routing is stricter than `CatalogAccess`.
3. Decide whether inventory-receipt approval should enter the centralized inbox or remain API-only.
4. Approve this one-object registry format before creating a registry for a second business object.

## Scalability assessment

The row format scales when an object has one importable lifecycle model and importable permission policy.
It will break down when expanding to objects whose state is split across query status, server entity status,
local dialog state and generic approval target state. Role aliases and role-policy authorization are also
not isomorphic to emitted permission strings. Before expanding broadly, the registry needs stable scenario
identifiers and a generator/report step; otherwise source line references and handwritten audit prose will
be expensive to keep current.
