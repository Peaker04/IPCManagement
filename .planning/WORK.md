# Active work

Status: IDLE (Wave 2 Deep UI Refactor Complete — Ready for Wave 3: /purchasing, /warehouse, /approvals)

### Completed: Wave 2 Deep UI Refactor (`/weekly-menu`, `/meal-orders`, `/chef`)
- **Routes Refactored**:
  1. `/weekly-menu` (`FR-MENU`):
     - `WeeklyScheduleCommandBar.tsx` & `WeeklyMenuCommandBar.tsx`: Chuẩn hóa 100% sang `<Button variant="secondary"|"default" size="sm">` primitive (loại bỏ toàn bộ native `<button>` tự chế).
     - `MenuCostSection.tsx`: Chuẩn hóa 100% số lượng, đơn giá, thành tiền và tỷ lệ Food Cost sang `<Num tabular-nums>` và `<Num type="currency">` (cột số học căn phải chuẩn `T1, T2, T8`).
     - `MaterialDemandSection.tsx`: Chuẩn hóa checkpoint số suất và dòng KHSX, bọc mã chứng từ vào `<IdentifierText>`, số suất vào `<Num>`, đảm bảo duy nhất 1 primary button trên command bar (`Rule D7`).
     - `ProductionPlanSection.tsx`: Bọc mã KHSX vào `<IdentifierText>`, số suất món vào `<Num tabular-nums>`.
     - `PurchaseSummarySection.tsx`: Chuẩn hóa tổng tiền BOM và số lượng nguyên liệu sang `<Num>`.
     - `DishMaterialsSection.tsx`: Chuẩn hóa định lượng BOM và thành tiền suất ăn sang `<Num>`.
  2. `/meal-orders` (`FR-COORD`):
     - `header-info.tsx`: Thay thế `<Input type="date">` thô bằng `<VietnameseDateInput type="date">` chuẩn giao diện `dd/MM/yyyy`.
     - `order-table.tsx`: Bọc mã khách hàng vào `<IdentifierText>`, bọc số lượng chênh lệch/tăng giảm vào `<Num tabular-nums>`.
  3. `/chef` (`FR-CHEF`):
     - `ChefShiftControls.tsx`: Thay thế `<Input type="date">` thô bằng `<VietnameseDateInput>`.
     - `ChefProductionSection.tsx`: Bọc mã kế hoạch vào `<IdentifierText>`, số suất và lượng mua dự kiến vào `<Num tabular-nums>`.
     - `material-checklist.tsx`: Bọc mã phiếu xuất vào `<IdentifierText>`, số lượng nhận/tổng hợp vào `<Num tabular-nums>`, giữ chuẩn `typography.code`.
     - `ServiceRunSection.tsx`: Bọc mã kế hoạch vào `<IdentifierText>`, số suất kế hoạch/thực tế/chờ nhận vào `<Num tabular-nums>`.
     - `DemandPlanningScreen.tsx` & `CostScreen.tsx`: Chuẩn hóa toàn bộ ô số lượng và giá vốn sang `<Num tabular-nums>` với độ chính xác số thập phân cao (`maximumFractionDigits={6}`).
- **Eliminated 2 Skipped Tests (Rule TA-3)**:
  - Tái cấu trúc `frontend/tests/warehouseDataWorkspaceContract.test.ts` loại bỏ `it.skipIf`, cung cấp schema fixture kiểm thử hợp đồng `validateWarehouseAiReviewInput` và `validateWarehouseAiFinding`. Số lượng skipped tests giảm từ 2 xuống **0**!
- **100% Verification Pipeline Passed (`npm run verify`)**:
  - `test:ignore-policy`: 2/2 PASS
  - `test:frontend-test-taxonomy`: 1/1 PASS
  - `test:frontend-unit-launcher`: 2/2 PASS
  - `test:phase05-fixture-determinism`: 1/1 PASS
  - `test:architecture-growth`: 6/6 PASS
  - `check:architecture-growth`: PASS (strict production baseline exact, 0 test debt)
  - `build:be`: PASS (0 warnings, 0 errors)
  - `test:be:ci`: 1311/1311 Api.Tests PASS, 49/49 Application.Tests PASS
  - `lint:fe`: PASS (0 errors)
  - `depcruise:fe`: PASS (356 modules cruised, 0 violations)
  - `build:fe`: PASS (built in 0.93s)
  - `test:fe:unit`: 300/300 test files PASS (**1730 tests passed, 0 failed, 0 skipped**)

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


