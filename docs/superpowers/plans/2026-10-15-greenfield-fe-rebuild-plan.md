# Greenfield FE Rebuild (3-Zone Flat Workbench) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruct all 14 canonical routes on the 3-Zone Flat Workbench (Zero AI-Slop), eliminate all fake baseline fallbacks in `src/api/*.ts`, connect 100% live ASP.NET Core .NET 9 Backend endpoints, fix date/currency formatting, restore Nested Sidebar with Lucide icons, and verify with a strict anti-tautology test suite.

**Architecture:** 5-Layer Governance Model (`AGENTS.md`). Single CSS authority with flat tokens (`index.css`), 10 UI primitives + 5 flat workbench composites, pure one-way dependency flow (`routes` -> `features` -> `components/ui` + `api`), live ASP.NET Core Kestrel API client with JWT & operational mode headers (`DEFAULT` vs `MATERIAL_RECONCILIATION`), and `<StateBoundary>` managing 6 UI states.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Tailwind CSS v4, `@base-ui/react/popover`, `lucide-react`, `@testing-library/react`, Vitest, ASP.NET Core .NET 9 (Kestrel on port 5262), MySQL 8.0.

**Spec:** `docs/SPEC-GREENFIELD-FE-REBUILD.md`

## Global Constraints
- Zero Fake Data: No `getBaseline*()`, dummy seed constants, or `try/catch` fallback blocks in `frontend/src/api/*.ts`. Errors must rethrow.
- Single Primary Button (Rule D7): Exactly one `bg-slate-900` primary button per view/panel.
- ERP Typography Scale (Rule D6 & T8): Root font-size `16px`, data rows `h-10` (`40px`), font `text-sm` (`14px`), table headers `text-xs uppercase tracking-wider whitespace-nowrap`. No text `< 12px`.
- Vietnamese Localization (NFR-I18N-01 & UXR-04): Visible date display strictly `dd/MM/yyyy` (e.g. `21/09/2026`) with 100% Vietnamese popover calendar (`T2-CN`, `Tháng M năm YYYY`). No native English browser calendar and no emoji `📅`.
- Zero `<details>` Tags: All legacy disclosure details tags are strictly banned and replaced by Segmented Tabs or SplitView.
- Real Database Accounts: Only 6 canonical MySQL users: `admin`, `quanly`, `dieuphoi`, `beptruong`, `thukho`, `thumua` with password `Admin@123456`.
- Mandatory Justification (BR-GLOBAL-03 & UXR-05): Modifications to locked orders, approval rejections, and reconciliation signoffs require non-empty `reason`/`notes`.

## Review Focus
1. **Uncaught Network Errors**: If the backend API returns 404/500, `<StateBoundary>` must catch the thrown `ApiError` and render the error alert with the "Thử lại" button without crashing the app shell.
2. **Date Picker Interaction**: Selecting any day in the popover calendar must emit the ISO string `YYYY-MM-DD` while updating the visible text field strictly to `dd/MM/yyyy`.
3. **BOM Line Deduplication**: In `MenuCostView`, a dish with multiple contract tiers in the database must display each ingredient exactly once (filtered to 25k tier and grouped by `ingredientId`) with 5 columns including `Đơn giá`.
4. **Header Primary Action Dynamics**: Switching views in `/weekly-menu` must dynamically switch the single primary button in `WorkspaceHeader` to match the active view (`schedule` -> Duyệt kế hoạch, `demand` -> Mở hàng đợi duyệt, `production-plan` -> In lệnh KHSX, `cost` -> Xuất bảng chi phí).
5. **Table Header Collision Prevention**: In split view on lower screen widths, `<th>` headers must never wrap or collide with adjacent columns (`whitespace-nowrap` + safe `min-w`).

---

### Task 1: Audit Gate & Anti-Fake API Enforcement (Rule TA-5)

**Files:**
- Create: `frontend/src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts`
- Modify: `.pi/skills/ipc-test-audit/SKILL.md`

**Interfaces:**
- Consumes: `frontend/src/api/*.ts`
- Produces: Test guard asserting zero fake data patterns, zero error-swallowing catch blocks, and 100% `apiClient` usage across all API files.

- [ ] **Step 1: Write test in `frontend/src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts`**
  Scan all files in `src/api/*.ts`: assert no `getBaseline`, no dummy constants, no `catch` blocks returning fallbacks, and every export calls `apiClient`.
- [ ] **Step 2: Run test to verify check**
  Run: `npm run test:unit -w frontend -- src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts`
  Expected: PASS when clean, FAIL if any fake data exists.
- [ ] **Step 3: Document Rule TA-5 in `.pi/skills/ipc-test-audit/SKILL.md`**
  Lock Rule TA-5 into project governance.
- [ ] **Step 4: Commit**
  `git commit -m "chore(audit): enforce Rule TA-5 zero fake api guard"`

---

### Task 2: Pure Vietnamese Popover Date Picker & Number Formatter Fix

**Files:**
- Modify: `frontend/src/components/ui/vietnamese-date-input.tsx`
- Modify: `frontend/src/utils/formatters.ts`
- Modify: `frontend/src/utils/dates.ts`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

**Interfaces:**
- Consumes: `@base-ui/react/popover`, `lucide-react` (`CalendarDays`, `ChevronLeft`, `ChevronRight`)
- Produces: `<VietnameseDateInput value="..." onChange={...} />` with visible `dd/MM/yyyy` text input and pure Vietnamese popover; `formatNumber(val, 'currency')` with `Math.round(val)` and 0 decimals.

- [ ] **Step 1: Write test cases in `frontend/src/__tests__/Primitives.test.tsx`**
  Test visible input text `21/09/2026`, typing commit, popover calendar day selection, and currency rounding (e.g. `78524819.492` -> `78.524.819 ₫`).
- [ ] **Step 2: Run test to verify failure on unrounded currency or native datepicker**
  Run: `npm run test:unit -w frontend -- src/__tests__/Primitives.test.tsx`
- [ ] **Step 3: Implement popover calendar in `vietnamese-date-input.tsx` & round currency in `formatters.ts`**
  Eliminate emoji `📅` and browser `<input type="date">`. Build popover with `T2-CN` and `Tháng M năm YYYY`. In `formatters.ts`, apply `Math.round()` on currency.
- [ ] **Step 4: Run test to verify pass**
  Run: `npm run test:unit -w frontend -- src/__tests__/Primitives.test.tsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  `git commit -m "feat(ui): implement pure vietnamese popover datepicker and round currency"`

---

### Task 3: Nested Tree Sidebar (`Rule N6`) & Full Lucide Iconography

**Files:**
- Modify: `frontend/src/components/workbench/AppShell.tsx`
- Modify: `frontend/src/routes/routeRegistry.ts`
- Test: `frontend/src/__tests__/AppShell.test.tsx`

**Interfaces:**
- Consumes: `lucide-react` icons (`LayoutDashboard`, `CalendarDays`, `Utensils`, `ClipboardCheck`, `ShoppingCart`, `Warehouse`, `ChefHat`, `Scale`, `TrendingUp`, `Database`, `Settings`, `SlidersHorizontal`, `LogOut`, `Menu`, `X`, `ChevronDown`)
- Produces: `<AppShell>` with `w-60` sidebar, hamburger toggle, 12 Lucide icons, nested tree for `Thực đơn tuần` with vertical guide line (`border-l-2 ml-5 pl-2.5`).

- [ ] **Step 1: Write tests in `frontend/src/__tests__/AppShell.test.tsx`**
  Assert all 12 routes render with Lucide icons; assert `/weekly-menu` parent expands with 4 child leaf links; assert hamburger button toggles width.
- [ ] **Step 2: Run test to verify current state**
  Run: `npm run test:unit -w frontend -- src/__tests__/AppShell.test.tsx`
- [ ] **Step 3: Implement Lucide icons & nested tree in `AppShell.tsx`**
  Map 12 Lucide icons to menu items. Style nested tree under `Thực đơn tuần` with vertical line. Add user avatar, role label, and logout icon.
- [ ] **Step 4: Run test to verify pass**
  Run: `npm run test:unit -w frontend -- src/__tests__/AppShell.test.tsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  `git commit -m "feat(shell): restore nested sidebar with full lucide iconography (Rule N6)"`

---

### Task 4: Real Database Authentication & RBAC ActionGuard

**Files:**
- Modify: `frontend/src/features/auth/LoginPage.tsx`
- Modify: `frontend/src/store/authContext.tsx`
- Create: `frontend/src/components/ui/action-guard.tsx`
- Modify: `frontend/src/api/authApi.ts`
- Test: `frontend/src/__tests__/Auth.test.tsx`

**Interfaces:**
- Consumes: `/api/auth/login`, `/api/auth/profile`
- Produces: `<ActionGuard roles={...} permissions={...} />`; `<LoginPage>` with 6 real database accounts (`admin`, `quanly`, `dieuphoi`, `beptruong`, `thukho`, `thumua`).

- [ ] **Step 1: Write tests in `frontend/src/__tests__/Auth.test.tsx`**
  Test login submission, error feedback on 401, quick login auto-fill for real accounts (`admin`, `beptruong`, `thukho`), and 403 Forbidden page.
- [ ] **Step 2: Run test to verify**
  Run: `npm run test:unit -w frontend -- src/__tests__/Auth.test.tsx`
- [ ] **Step 3: Implement real database accounts in `LoginPage.tsx` & create `action-guard.tsx`**
  Remove fake accounts `chef`/`manager`. Implement `<ActionGuard>` checking `useAuth().hasRole()`.
- [ ] **Step 4: Run test to verify pass**
  Run: `npm run test:unit -w frontend -- src/__tests__/Auth.test.tsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  `git commit -m "feat(auth): align login with real database users and create ActionGuard"`

---

### Task 5: Weekly Menu 4-Views & Real Menu Data Matrix (`FR-MENU`)

**Files:**
- Modify: `frontend/src/api/weeklyMenuApi.ts`
- Modify: `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx`
- Modify: `frontend/src/features/weekly-menu/views/WeeklyScheduleView.tsx`
- Modify: `frontend/src/features/weekly-menu/views/MaterialDemandView.tsx`
- Modify: `frontend/src/features/weekly-menu/views/ProductionPlanView.tsx`
- Modify: `frontend/src/features/weekly-menu/views/MenuCostView.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `/api/coordination/customers`, `/api/coordination/weekly-menu`, `/api/production-plans/filter`, `/api/dishes/{id}/bom`, `/api/material-demand/generate`, `/api/material-demand/{id}/approve`
- Produces: Full 4-view workspace: (1) Schedule Mon-Sat matrix without cell noise, (2) Demand DataGrid 6 cols with segmented tabs and zero `<details>`, (3) Production plan with formatted `dd/MM/yyyy` dates, (4) Cost view with daily active dishes, BOM deduplication (5 cols with `Đơn giá`), and dynamic header primary button per view (`Rule D7`).

- [ ] **Step 1: Write test cases in `frontend/src/__tests__/WeeklyMenu.test.tsx`**
  Assert dynamic primary button in header per view; assert 5 BOM columns including `Đơn giá`; assert BOM lines deduplicated; assert date display `21/09/2026`; assert zero `<details>` in DOM.
- [ ] **Step 2: Run test to verify failures on old implementation**
  Run: `npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx`
- [ ] **Step 3: Implement real data mapping and dynamic header in `WeeklyMenuPage.tsx` & views**
  Eliminate fake baseline data from `weeklyMenuApi.ts`. In `MenuCostView.tsx`, query dishes from selected day's menu, deduplicate BOM lines by `ingredientId`, add `Đơn giá` column, and calculate daily materials.
- [ ] **Step 4: Run test to verify pass**
  Run: `npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  `git commit -m "feat(weekly-menu): wire real api data, dynamic header primary, and deduplicated BOM"`

---

### Task 6: Coordination Orders & Chef Production Dashboard (`FR-COORD`, `FR-CHEF`)

**Files:**
- Modify: `frontend/src/api/coordinationApi.ts`
- Modify: `frontend/src/api/chefApi.ts`
- Modify: `frontend/src/features/coordination/MealOrdersPage.tsx`
- Modify: `frontend/src/features/chef/ChefDashboardPage.tsx`
- Test: `frontend/src/__tests__/MealOrders.test.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`

**Interfaces:**
- Consumes: `/api/coordination/orders?serviceDate=&shiftName=`, `/api/coordination/orders/lock`, `/api/coordination/orders/{id}/servings`, `/api/production-plans/daily/send-to-kitchen`
- Produces: `<MealOrdersPage>` with shift tabs, variance pills, lock action (`ActionGuard`), mandatory reason modal; `<ChefDashboardPage>` with KHSX ca nấu, material checklist with interactive checkboxes, excess material table, complete shift modal.

- [ ] **Step 1: Write test cases in `MealOrders.test.tsx` & `Chef.test.tsx`**
  Test order loading by shift, variance calculations, reason validation on adjustment, checklist checkbox toggle, and complete shift modal.
- [ ] **Step 2: Run tests to verify**
  Run: `npm run test:unit -w frontend -- src/__tests__/MealOrders.test.tsx src/__tests__/Chef.test.tsx`
- [ ] **Step 3: Implement real API calls & UI logic in `MealOrdersPage.tsx` & `ChefDashboardPage.tsx`**
  Eliminate fake fallbacks. Pass required `shiftName` (`MORNING`/`AFTERNOON`) to `/api/coordination/orders`. Wrap mutation buttons in `<ActionGuard>`.
- [ ] **Step 4: Run tests to verify pass**
  Run: `npm run test:unit -w frontend -- src/__tests__/MealOrders.test.tsx src/__tests__/Chef.test.tsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  `git commit -m "feat(coordination-chef): connect real backend orders, shift kpis, and checklist"`

---

### Task 7: Supply Chain, Governance & System Operations (`FR-PUR`, `FR-WH`, `FR-APPR`, `FR-RECON`, `FR-REP`, `FR-CAT`, `FR-ADMIN`, `FR-SYS`)

**Files:**
- Modify: `frontend/src/api/purchasingApi.ts`, `warehouseApi.ts`, `approvalsApi.ts`, `reconciliationApi.ts`, `reportsApi.ts`, `adminApi.ts`
- Modify: `frontend/src/features/purchasing/PurchasingPage.tsx`
- Modify: `frontend/src/features/warehouse/WarehousePage.tsx`
- Modify: `frontend/src/features/approvals/ApprovalPage.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/reports/ReportsPage.tsx`
- Modify: `frontend/src/features/admin/AdminDataPage.tsx`
- Modify: `frontend/src/features/admin/ApprovalRulesPage.tsx`
- Modify: `frontend/src/features/admin/AdvancedSettingsPage.tsx`
- Test: `frontend/src/__tests__/Purchasing.test.tsx`, `Warehouse.test.tsx`, `Approvals.test.tsx`, `Reconciliation.test.tsx`, `Reports.test.tsx`, `AdminData.test.tsx`, `ApprovalRules.test.tsx`, `AdvancedSettings.test.tsx`

**Interfaces:**
- Consumes: `/api/purchase-orders`, `/api/suppliers`, `/api/warehouses`, `/api/inventory-receipts`, `/api/inventory-issues`, `/api/approvals/inbox`, `/api/reconciliation/batches`, `/api/workflow-reports/*`, `/api/ingredients`, `/api/dishes`, `/api/approval-rules`, `/api/system-operation-mode`
- Produces: 8 completed canonical pages with safe column widths (`whitespace-nowrap`), integer currency formatting, formatted timestamps, `<ActionGuard>` on write actions, and mandatory reason validation (`BR-GLOBAL-03`).

- [ ] **Step 1: Write test cases across all 8 feature test files**
  Test table rendering with real DTO fixtures, column layout, empty states, error retries, and modal submissions with reason inputs.
- [ ] **Step 2: Run tests to verify**
  Run: `npm run test:unit -w frontend -- src/__tests__/Purchasing.test.tsx src/__tests__/Warehouse.test.tsx src/__tests__/Approvals.test.tsx`
- [ ] **Step 3: Implement real API calls & fix column widths / formatting across all 8 pages**
  Eliminate fake fallbacks in API files. Set safe `min-w` on columns. Format dates as `dd/MM/yyyy` and timestamps as `dd/MM/yyyy HH:mm`. Eliminate `,492 ₫` decimals. Wrap mutation buttons in `<ActionGuard>`.
- [ ] **Step 4: Run all feature tests to verify pass**
  Run: `npm run test:fe:unit`
  Expected: PASS (all 16 test files pass)
- [ ] **Step 5: Commit**
  `git commit -m "feat(supply-chain-governance): complete 8 operational pages with live api and safe table geometry"`

---

### Task 8: Full Pipeline Verification & Live Browser Validation

**Files:**
- Modify: `.planning/WORK.md`

**Interfaces:**
- Consumes: Complete project repository & ASP.NET Core backend
- Produces: 100% PASS on `npm run verify`, working live frontend on `http://localhost:5173` connected to backend on `http://localhost:5262`.

- [ ] **Step 1: Run complete verification pipeline**
  Run: `npm run verify`
  Expected:
  - `test:ignore-policy`: PASS
  - `test:frontend-test-taxonomy`: PASS
  - `test:frontend-unit-launcher`: PASS
  - `test:architecture-growth`: PASS
  - `check:architecture-growth`: PASS (0 frontend debt)
  - `build:be`: PASS
  - `test:be:ci`: PASS (1311 BE tests)
  - `lint:fe`: PASS (0 errors, 0 warnings)
  - `depcruise:fe`: PASS (0 violations)
  - `build:fe`: PASS (Production build)
  - `test:fe:unit`: PASS (16 test files, 87+ tests)
- [ ] **Step 2: Check live dev server responsiveness**
  Verify `http://localhost:5173` and `http://localhost:5262` respond with HTTP 200 OK.
- [ ] **Step 3: Update `.planning/WORK.md` status to IDLE**
  Record full verification evidence in `.planning/WORK.md`.
- [ ] **Step 4: Push to origin**
  `git push origin feature/greenfield-fe-3zone-workbench`
