# Active work

Status: IN_PROGRESS (Wave 3: Deep UI Refactor — Supply Chain & Approvals: /purchasing, /warehouse, /approvals)

### Completed: Wave 2A Structural UI/UX Rebuild (Dashboard & Weekly Menu)
- **Rebuilt `/` (DefaultDashboardPage.tsx)**:
  - Rebuilt "Việc cần xử lý trước" task item layout using explicit Tailwind grid (`grid-cols-[minmax(0,1fr)_auto_auto] gap-4`) with separated labels for `Phụ trách:` and `Thời hạn:` to eliminate text running together.
  - Rebuilt "Tiến độ 4 công đoạn" to fix badge and text overlap (badge number `shrink-0`, title/desc in flex column `flex-1 min-w-0`, and action/status badge `shrink-0`).
  - Added clean empty state handling for filtered queue items vs ca-wide clear states.
- **Rebuilt `/weekly-menu` Shell & Views**:
  - `WeeklyMenuPricingContext.tsx`: Replaced tight inline labels with `inline-flex items-center gap-1.5` containing explicit separators (`Định mức:`, dot separator) to eliminate text running together.
  - `WeeklyScheduleWorkspace.tsx`: Cleaned up empty states with standard `EmptyState` without duplicate button action owners.
  - `MaterialDemandSection.tsx`: Eliminated left vertical collapse; converted 3 KPI checkpoints into a responsive grid with distinct cards, proper icons, `<dt>` and `<dd>` semantics preserved; enforced Rule D7 with single primary action (Mở phê duyệt / Mở thu mua / Tính lại nhu cầu); upgraded native `<details>` disclosures into styled interactive panels; converted action buttons to UI Kit `Button` primitives and removed button exceptions.
  - `ProductionPlanSection.tsx`: Eliminated date and servings concatenation (`Ngày phục vụ`, `KHSX`); constrained 'Phạm vi' select dropdown width to `w-44`; enhanced plan cards with consistent headers and typography.
  - `MenuCostSection.tsx`: Eliminated day navigation label concatenation (`Ngày đang tính`); added `whitespace-nowrap` and column widths to BOM aside breakdown table to prevent unit/number overlap; upgraded ingredient summary disclosure into styled panel.
  - `DishMaterialsSection.tsx`: Modernized command bar and object layout.
  - `PurchaseSummarySection.tsx`: Converted native `<button>` to UI Kit primitive `<Button>`.
- **Tests & Quality Verification**:
  - Updated contract fixtures (`pcActionCompletenessFixture.ts`, `operationalStateActionRegistry.test.ts`, `weekly-menu-lifecycle-pa2b-fixture.ts`, `buttonPrimitiveConvergence.test.ts`).
  - 100% verification pipeline passed (`npm run verify`: 1311 BE tests, 300 FE test files / 1730 tests passed, 0 skipped, 0 failed).
  - Committed to `cleanup/revert-sidebar-v2` (`4e98515b`).

---

### In Progress: Wave 3 — Deep UI Refactor: Supply Chain & Approvals
- **Target Surfaces**:
  1. `/purchasing` (`FR-PUR`): `PurchasingPage.tsx`, `PurchaseDecisionPanel.tsx`, `PurchaseServiceDateWorkbench.tsx`, `PurchaseLineGroups.tsx`, `SupplementalPurchasingWorkbench.tsx`, `SupplierQuotationSection.tsx`.
  2. `/warehouse` (`FR-WH`): `WarehousePage.tsx`, `WarehouseMovementPanel.tsx`, `WarehousePurchaseOrdersPanel.tsx`, `WarehouseReceiptLifecyclePanel.tsx`, `WarehouseExceptionsWorkbench.tsx`, `WarehouseDemandPanel.tsx`, `ReconciliationWarehousePage.tsx`.
  3. `/approvals` (`FR-APPR`): `ApprovalPage.tsx`, `ApprovalQueue.tsx`, `ApprovalHistoryTab.tsx`, `ApprovalDecisionDialog.tsx`, `MenuAmendmentInbox.tsx`, `MenuAmendmentReconciliation.tsx`.

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

### Step 3: Wave 2 — Deep UI Refactor: Planning, Coordination & Chef
- Hoàn thành kiểm toán UI Gap và tái cấu trúc sâu giao diện `.tsx`/`.css` cho 3 routes `/weekly-menu`, `/meal-orders`, `/chef`.
- Đạt 100% chuẩn UI-Kit primitives (`Button`, `Num`, `IdentifierText`, `VietnameseDateInput`).
- 0 tests skipped, 0 tests failed.

## Next Phase: Wave 3 — Deep UI Refactor: Supply Chain & Approvals
- Chờ lệnh kích hoạt Wave 3: `/purchasing` (`FR-PUR`), `/warehouse` (`FR-WH`), `/approvals` (`FR-APPR`), `/reconciliation` (`FR-RECON`), `/reports` (`FR-REP`).


