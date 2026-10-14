# Active work

Status: IDLE (Phase 2 Completed — All Waves 1, 2, 3 Verified Green; Ready for PR Review)

---

## Phase 2 Closed Tasks

### Step 1: Governance, Design Contract & Requirements Standardization
- Standardized `AGENTS.md` (82 lines), `docs/DESIGN.md` (117 lines), `docs/UI-KIT.md` (157 lines), `docs/DOMAIN.md` (164 lines).
- Locked rule `T8` to Operational Compact Density (`36px–40px` data row height, `44px` inline input row, `<Num tabular-nums>` mandatory).
- Added Global Business Rules (`BR-GLOBAL-01..04`), 13 Functional Requirements matrix (`FR-AUTH` to `FR-SYS`), and Non-Functional Requirements.

### Step 2: Core Infrastructure Clean (5 Domain Components & Deprecated CSS Removed)
- Relocated 5 domain components from `components/common/` to feature modules (`StockMovementTable` -> warehouse, `DemandSummary` -> planning, `ApprovalQueue` -> approvals, `RoleInbox` -> dashboard, `ExceptionLane` -> reconciliation).
- Deleted deprecated CSS redesign files and preview tokens (`styles/redesign/`, `ui-redesign.css`, `planning-demand-preview-tokens.css`).
- Migrated required contrast rules and transitions to `styles/components/operations.css`.

### Step 3: Wave 1 — Test Audit + AppShell/Sidebar v2 + Foundation Cluster Reconstruction
- Activated `ipc-test-audit` skill enforcing Rules TA-1..TA-4.
- Audited 34 test files, rewrote `AdminCleanupPanel.presentation.test.tsx` into DOM behavioral test, hardened `LoginPage.feedback.test.tsx`, fixed DTO casing in `ApprovalRulesPage`.
- Cleaned `ipc-redesign-shell` from `MainLayout.tsx` and standardized group chevrons to accessible `button[type="button"]` with `aria-expanded`.
- 100% tests passed (41 test files, 258 tests).

### Step 3: Wave 2 — Test Audit + Planning, Coordination & Chef Reconstruction
- Scoped Pre-Code UI Gate Block verified for `/weekly-menu`, `/meal-orders`, `/chef`.
- Cleaned `DemandPlanningScreen.css` (100% semantic CSS tokens, 0 custom hex colors).
- Rewrote `MenuCostSection.presentation.test.tsx` & `action-toolbar.send-plan.test.tsx` into DOM behavioral tests (TA-2 eliminated).
- 100% tests passed (76 test files, 395 tests).

### Step 3: Wave 3 — Test Audit + Supply Chain & Operational Execution Reconstruction
- Scoped Pre-Code UI Gate Block verified for `/approvals`, `/purchasing`, `/warehouse`, `/reconciliation`, `/reports`.
- Rewrote all 7 TA-2 tests into real DOM behavioral `.tsx` tests:
  1. `approvals/components/menuAmendmentStatus.test.tsx` (1/1 PASS)
  2. `coordination/components/action-toolbar.send-plan.test.tsx` (5/5 PASS)
  3. `purchasing/pages/PurchasingPage.geometry.test.tsx` (2/2 PASS)
  4. `purchasing/PurchaseDecisionPanel.copy.test.tsx` (1/1 PASS)
  5. `warehouse/pages/warehouse-permission.test.tsx` (3/3 PASS)
  6. `warehouse/pages/WarehousePage.presentation.test.tsx` (4/4 PASS)
  7. `warehouse/WarehouseReceiptLifecyclePanel.test.tsx` (4/4 PASS)
  8. `reports/pages/ReportsPage.model-ownership.test.tsx` (4/4 PASS)
- Resolved architecture debt: condensed `WeeklyMenuPage.tsx` from 750 to 517 lines (<= 600 line threshold), eliminating debt finding.
- Fixed EF Core InMemory reference comparison bug in `ReconciliationBatchService.cs:196`.
- Synchronized `scripts/architecture-growth-baseline.json` with strict shrink (1313 lines for `ReconciliationWarehousePage.tsx`, 766 lines for `ReconciliationBatchService.cs`, 0 debt additions).
- Updated `presentationSurfaceInventory.test.ts` (6/6 PASS), `typographyContract.test.ts` (11/11 PASS), `sectionPanelHeadingContract.test.ts` (2/2 PASS), `uiFloorplanScopeContract.test.ts` (12/12 PASS), `buttonPrimitiveConvergence.test.ts` (2/2 PASS), `formPrimitiveConvergence.test.ts` (2/2 PASS).
- 100% passed on full verification pipeline (`npm run verify`):
  - `test:ignore-policy`: 2/2 PASS
  - `test:frontend-test-taxonomy`: 1/1 PASS
  - `test:frontend-unit-launcher`: 2/2 PASS
  - `test:phase05-fixture-determinism`: 1/1 PASS
  - `test:architecture-growth`: 6/6 PASS
  - `check:architecture-growth`: PASS (strict production baseline exact, 0 test debt)
  - `build:be`: PASS (0 warnings, 0 errors)
  - `test:be:ci`: 1311/1311 PASS in `IPCManagement.Api.Tests`, 49/49 PASS in `IPCManagement.Application.Tests`
  - `lint:fe`: PASS (0 errors)
  - `depcruise:fe`: PASS (356 modules cruised, 0 violations)
  - `build:fe`: PASS (built in <1s)
  - `test:fe:unit`: 300/300 test files PASS (1728 tests passed, 2 skipped)

## Next Phase: Phase 3 — Remaining View Migration & PR Readiness
- Complete PR review and merge of `cleanup/revert-sidebar-v2` into `main`.

