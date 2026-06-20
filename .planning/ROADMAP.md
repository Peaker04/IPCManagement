# Roadmap: IPC Management UI/UX Refactor

## Overview

This roadmap prepares a focused brownfield UI/UX refactor for the existing IPC Management frontend. The work should modernize and clarify the operational interface while preserving routes, business flows, API contracts, and the current React/Vite/Tailwind component structure.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (1.1, 1.2): Urgent insertions, marked with INSERTED

- [x] **Phase 1: Frontend UI/UX Operational Refactor** - Refine the current app UI using taste-skill guidance suitable for an internal operations system. (completed 2026-06-13)
- [x] **Phase 1.1: Operational IA & Page Recomposition** - Recompose the app around daily kitchen operations, shift context, and workflow workspaces instead of the original page-template structure. (INSERTED after Phase 1) (completed 2026-06-13)
- [x] **Phase 1.2: End-to-End Kitchen Workflow IA** - Bóc tách lại frontend theo quy trình quản lý suất ăn, kho nguyên liệu, mua hàng, duyệt, bếp trưởng, và admin từ sơ đồ swimlane IPC. (INSERTED after Phase 1.1) (completed 2026-06-13)
- [x] **Phase 1.3: UI/UX Hardening & Visual Regression** - Làm cứng UI toàn bộ route sau tái cấu trúc IA: chuẩn hóa token, giảm nhiễu chuyển động, bổ sung inline feedback có chọn lọc, và thêm kiểm chứng responsive/visual regression. (INSERTED after Phase 1.2) (completed 2026-06-14)
- [x] **Phase 1.4: UI/UX Deep Hardening All Routes** - Chỉnh sâu toàn bộ route theo hướng data-dense internal operations: cố định layout/card/button, chuẩn hóa bảng và phân trang cho dữ liệu 5-10 năm, hoàn thiện accessibility, và kiểm chứng visual toàn route. (INSERTED after Phase 1.3) (completed 2026-06-15)
- [x] **Phase 2: Data-driven Workflow Integration from IPC Sample Files** - Thay mock data bằng dữ liệu nghiệp vụ từ `.docs`, bổ sung API/UI còn thiếu cho nhu cầu nguyên liệu, mua hàng, xuất/nhập/trả kho, và thống kê admin. (completed 2026-06-19)

## Phase Details

### Phase 1: Frontend UI/UX Operational Refactor

**Goal**: Refactor the current frontend UI/UX so IPC Management feels consistent, readable, responsive, and appropriate for daily industrial kitchen operations.
**Depends on**: Existing frontend implementation and codebase maps
**Requirements**: [UI-01, UI-02, UI-03, OPS-01, OPS-02, OPS-03, PRES-01, PRES-02]
**UI hint**: yes
**Canonical refs**:

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/codebase/STACK.md`
- `.planning/codebase/STRUCTURE.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/CONVENTIONS.md`
- `.planning/codebase/CONCERNS.md`
- `frontend/package.json`
- `frontend/src/styles/index.css`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/components/common/`
- `frontend/src/features/`

**Success Criteria** (what must be TRUE):

  1. User can navigate existing protected app routes with a clearer shell, sidebar, header, and page hierarchy.
  2. User can scan operational screens without text overlap, clipped controls, inconsistent spacing, or confusing visual emphasis.
  3. User can use core table, form, dialog, card, status, empty, loading, and error states with consistent styling and accessible focus/contrast.
  4. Existing route structure, feature behavior, API contracts, and Vietnamese workflow copy continue to work.
  5. Frontend lint/build verification passes or any remaining failures are documented with exact blockers.

**Plans**: 3
Plans:
**Wave 1**

- [x] 01-01: UI foundation, tokens, shared components, and shell.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02: Coordination, Chef, Weekly Menu, Dashboard, and Reports UX polish.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03: Responsive verification, accessibility states, and preservation audit.

### Phase 1.1: Operational IA & Page Recomposition (INSERTED)

**Goal**: Recompose the frontend shell and pages around the real operational flow of an industrial kitchen: today's control room, menu planning, meal-order coordination, chef production, and price-movement analysis.
**Depends on**: Phase 1 frontend UI/UX refactor and existing route/API preservation constraints
**Requirements**: [OIA-01, OIA-02, OIA-03, OIA-04, OIA-05]
**UI hint**: yes
**Canonical refs**:

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/v1.0-MILESTONE-AUDIT.md`
- `.planning/phases/01-frontend-ui-ux-operational-refactor/01-UI-SPEC.md`
- `.planning/phases/01-frontend-ui-ux-operational-refactor/01-VERIFICATION.md`
- `frontend/src/routes/routeConfig.ts`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/components/common/`
- `frontend/src/features/dashboard/`
- `frontend/src/features/projects/`
- `frontend/src/features/coordination/`
- `frontend/src/features/chef/`
- `frontend/src/features/reports/`

**Success Criteria** (what must be TRUE):

  1. Existing routes remain available, but each page is recomposed around a clear operational role in the daily kitchen workflow.
  2. The shell exposes useful operating context such as date, shift, status, and active workflow instead of feeling like a generic admin template.
  3. Dashboard, weekly menu, coordination, chef, and reports screens use workflow-specific structures such as command bars, split panes, production boards, analysis tables, and drawers where appropriate.
  4. Vietnamese workflow copy and current API/Redux boundaries remain intact unless explicitly planned otherwise.
  5. Frontend lint/build and responsive browser verification pass, or exact blockers are documented.

**Plans**: 5
Plans:

**Wave 1**

- [x] 01.1-01: Operational shell, workbench primitives, and shared interaction scaffolding.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01.1-02: Today control room and price-movement analysis workspaces.
- [x] 01.1-03: Weekly menu planning and coordination console recomposition.
- [x] 01.1-04: Chef production board and exception rail recomposition.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01.1-05: Responsive verification, accessibility states, and preservation audit.

### Phase 1.2: End-to-End Kitchen Workflow IA (INSERTED)

**Goal:** Bóc tách lại frontend theo đúng quy trình swimlane IPC: điều phối chốt đơn, hệ thống tính định lượng/KHSX, quản lí duyệt, thu mua, thủ kho nhập/xuất, bếp trưởng nhận/trả/bổ sung nguyên liệu, và admin điều chỉnh BOM/tồn.
**Depends on:** Phase 1.1 operational IA/page recomposition and `.docs/unnamed (1).png` swimlane workflow analysis
**Requirements**: TBD
**UI hint**: yes
**Canonical refs**:

- `.docs/unnamed (1).png`
- `.planning/phases/01.1-operational-ia-page-recomposition/01.1-UI-REVIEW.md`
- `frontend/src/routes/routeConfig.ts`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/features/coordination/`
- `frontend/src/features/projects/`
- `frontend/src/features/chef/`
- `frontend/src/features/reports/`

**Plans:** 6 plans

Plans:

**Wave 1**

- [x] 01.2-01: Workflow foundation, swimlane primitives, and protected route aliases.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01.2-02: Dashboard and shell as end-to-end control room.
- [x] 01.2-03: Coordination, KHSX, and demand flow recomposition.
- [x] 01.2-04: Approval, purchasing, warehouse, and admin lane pages.
- [x] 01.2-05: Kitchen production and price reporting lifecycle closure.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01.2-06: Responsive, accessibility, route preservation, and workflow verification.

### Phase 1.3: UI/UX Hardening & Visual Regression (INSERTED)

**Goal:** Làm cứng trải nghiệm UI/UX toàn bộ frontend sau Phase 1.2 để app vận hành bếp công nghiệp ổn định hơn trong sử dụng hằng ngày: token nhất quán, trạng thái thao tác rõ hơn bằng inline feedback có chọn lọc, motion tiết chế, và có kiểm chứng route/responsive/visual regression.
**Depends on:** Phase 1.2 end-to-end kitchen workflow IA, current dirty frontend worktree, and Phase 01.2 UI review findings.
**Requirements**: [UIV-01, UIV-02, UXH-01, UXH-02, UXH-03, UXH-04, UXH-05, UXH-06]
**UI hint**: yes
**Canonical refs**:

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/phases/01.2-end-to-end-kitchen-workflow-ia/01.2-UI-REVIEW.md`
- `.planning/phases/01.2-end-to-end-kitchen-workflow-ia/01.2-VERIFICATION.md`
- `frontend/package.json`
- `frontend/src/styles/index.css`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/components/common/`
- `frontend/src/routes/routeConfig.ts`
- `frontend/src/features/auth/pages/LoginPage.tsx`
- `frontend/src/features/dashboard/pages/DashboardPage.tsx`
- `frontend/src/features/projects/pages/WeeklyMenuPage.tsx`
- `frontend/src/features/coordination/pages/CoordinationPage.tsx`
- `frontend/src/features/chef/pages/ChefDashboardPage.tsx`
- `frontend/src/features/reports/pages/ReportsPage.tsx`
- `frontend/src/features/workflow/pages/ApprovalPage.tsx`
- `frontend/src/features/workflow/pages/PurchasingPage.tsx`
- `frontend/src/features/workflow/pages/WarehousePage.tsx`
- `frontend/src/features/workflow/pages/AdminDataPage.tsx`

**Success Criteria** (what must be TRUE):

  1. All protected routes and `/login` retain their existing paths, auth boundaries, primary navigation labels, Vietnamese copy direction, and API/Redux integration boundaries.
  2. Shared IPC tokens/classes replace page-level inline color decisions where practical, with a written token reference covering status, buttons, panels, tables, focus, and motion.
  3. Existing `alert()`/`prompt()` behavior remains unless already supported by a local UI pattern; unclear workflow confirmations, validation feedback, export feedback, signoff feedback, or exception feedback receive inline state or journal feedback where practical.
  4. Motion is purposeful and reduced-motion safe: warning pulses/bounces are limited, do not distract table scanning, and respect `prefers-reduced-motion`.
  5. Dashboard, weekly menu, meal orders, chef, reports, approvals, purchasing, warehouse, admin data, login, shell, and shared primitives pass responsive smoke at desktop, tablet, and 320px mobile widths without page-level overflow.
  6. Frontend lint/build pass, and critical route smoke or visual regression coverage exists for the full route set; any dependency addition such as Playwright is explicit and documented.

**Plans:** 6 plans

Plans:

**Wave 1**

- [x] 01.3-01: Token reference and shared primitive hardening.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01.3-02: Priority page token cleanup and responsive polish.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01.3-03: Motion and keyboard focus hardening.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01.3-04: Selective local feedback hardening.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01.3-05: Playwright route smoke and visual regression.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01.3-06: Final preservation, responsive, and regression audit.

### Phase 1.4: UI/UX Deep Hardening All Routes (INSERTED)

**Goal:** Chỉnh sâu UI/UX toàn bộ frontend hiện có để IPC Management chịu được dữ liệu vận hành tích lũy nhiều năm mà không vỡ giao diện: mọi card, queue, table, command bar, form, dialog, shell, và route chính có layout ổn định, phân trang/containment rõ, chữ không tràn, action/status cố định, và accessibility/focus đủ tốt cho vận hành nội bộ hằng ngày.
**Depends on:** Phase 1.3 UI/UX hardening, quick fixes `260614-q89`, `260614-qk1`, `260614-qu7`, `260614-rib`, `260614-rbd`, current dirty frontend worktree, and borrowed AISTHEA `.agent` `ui-ux-pro-max` / frontend-design / brainstorm guidance.
**Requirements**: [UIDH-01, UIDH-02, UIDH-03, UIDH-04, UIDH-05, UIDH-06, UIDH-07, UIDH-08, UIDH-09]
**UI hint**: yes
**Canonical refs**:

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/01.3-ui-ux-hardening-visual-regression/01.3-CONTEXT.md`
- `.planning/phases/01.3-ui-ux-hardening-visual-regression/01.3-RESEARCH.md`
- `.planning/phases/01.3-ui-ux-hardening-visual-regression/deferred-items.md`
- `.planning/quick/260614-q89-data-scale-ui-hardening-fixed-cards-and-/260614-q89-SUMMARY.md`
- `.planning/quick/260614-qk1-fix-role-inbox-fixed-column-alignment-af/260614-qk1-SUMMARY.md`
- `.planning/quick/260614-qu7-fix-dashboard-role-inbox-visual-alignmen/260614-qu7-SUMMARY.md`
- `.planning/quick/260614-rib-tighten-role-inbox-actions/260614-rib-SUMMARY.md`
- `.planning/quick/260614-rbd-remove-urgent-clock-overflow/260614-rbd-SUMMARY.md`
- `C:\Users\Administrator\Downloads\OJT\Week3_GIT\AISTHEA-Project\.agent\workflows\ui-ux-pro-max.md`
- `C:\Users\Administrator\Downloads\OJT\Week3_GIT\AISTHEA-Project\.agent\skills\frontend-design\SKILL.md`
- `C:\Users\Administrator\Downloads\OJT\Week3_GIT\AISTHEA-Project\.agent\skills\frontend-design\ux-psychology.md`
- `C:\Users\Administrator\Downloads\OJT\Week3_GIT\AISTHEA-Project\.agent\skills\brainstorming\SKILL.md`
- `C:\Users\Administrator\Downloads\OJT\Week3_GIT\AISTHEA-Project\.agent\skills\plan-writing\SKILL.md`
- `frontend/package.json`
- `frontend/src/styles/index.css`
- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/components/common/`
- `frontend/src/components/ui/`
- `frontend/src/routes/routeConfig.ts`
- `frontend/src/features/auth/pages/LoginPage.tsx`
- `frontend/src/features/dashboard/pages/DashboardPage.tsx`
- `frontend/src/features/projects/pages/WeeklyMenuPage.tsx`
- `frontend/src/features/coordination/pages/CoordinationPage.tsx`
- `frontend/src/features/coordination/components/`
- `frontend/src/features/chef/pages/ChefDashboardPage.tsx`
- `frontend/src/features/chef/components/`
- `frontend/src/features/reports/pages/ReportsPage.tsx`
- `frontend/src/features/workflow/pages/ApprovalPage.tsx`
- `frontend/src/features/workflow/pages/PurchasingPage.tsx`
- `frontend/src/features/workflow/pages/WarehousePage.tsx`
- `frontend/src/features/workflow/pages/AdminDataPage.tsx`

**Success Criteria** (what must be TRUE):

  1. Every current route (`/login`, `/`, `/weekly-menu`, `/meal-orders`, `/chef-dashboard`, `/reports`, `/approvals`, `/purchasing`, `/warehouse`, `/admin-data`) renders without page-level horizontal overflow or clipped critical controls at 375px, 768px, 1365/1440px, and 1920px widths.
  2. Queue/task cards, especially dashboard RoleInbox-style cards, use a fixed information architecture: status top-right, primary action bottom-right, title/description left, and two stable metadata columns for `Phụ trách` and `Hành động kế tiếp`.
  3. Primary action buttons size to content with min/max bounds, stay one-line on desktop, wrap safely on mobile if needed, and do not stretch wider than the task requires.
  4. Long-lived tables, audit logs, reports, menu matrices, order tables, stock movement tables, and lane queues have explicit containment and paging/scroll strategy so 5-10 years of data cannot break the page.
  5. Shared primitives and page implementations use IPC semantic tokens and stable dimensions instead of one-off inline colors, arbitrary widths, or hover transforms that cause layout shift.
  6. Accessibility issues from the borrowed frontend audit are addressed or documented with exact reason: skip-to-main, labels/aria names, keyboard paths for custom click targets, non-color-only severity, contrast, and focus visibility.
  7. The UI remains dense, Vietnamese, internal-operations focused, and free of marketing/AI-looking patterns, decorative gradients, oversized heroes, or workflow animations.
  8. Existing routes, nav labels, API base, Redux/auth behavior, business workflows, browser `alert()`/`prompt()` policy, and current dirty user work remain preserved.
  9. Lint/build plus Playwright route smoke/visual snapshots or equivalent browser evidence verifies the full route set after implementation.

**Plans:** 6/6 plans executed

Plans:

**Wave 1**

- [x] 01.4-01: Deep UI contract, primitives, and layout invariants.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01.4-02: Shell, login, dashboard, and RoleInbox deep hardening.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01.4-03: Weekly menu and coordination data-scale hardening.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01.4-04: Chef, approval, purchasing, and warehouse workbench hardening.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01.4-05: Reports and admin data table/audit hardening.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01.4-06: Full-route visual, accessibility, preservation, and data-scale verification.

## Progress

**Execution Order:**
Phases execute in numeric order: 1, 1.1, 1.2, 1.3, 1.4, 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Frontend UI/UX Operational Refactor | 3/3 | Complete    | 2026-06-13 |
| 1.1 Operational IA & Page Recomposition | 5/5 | Complete    | 2026-06-13 |
| 1.2 End-to-End Kitchen Workflow IA | 6/6 | Complete    | 2026-06-13 |
| 1.3 UI/UX Hardening & Visual Regression | 6/6 | Complete    | 2026-06-14 |
| 1.4 UI/UX Deep Hardening All Routes | 6/6 | Complete    | 2026-06-15 |
| 2. Data-driven Workflow Integration from IPC Sample Files | 6/6 | Complete | 2026-06-19 |

**Post-Phase Residual Note (2026-06-20):** FE-3.2 and FE-3.3 are verified against backend catalog/BOM data via `/api/dishes/catalog`. FE-3.1 is only complete for the dishes catalog hook; its `menu-schedules` and `meal-quantity-plans` hooks remain blocked until BE-3.2/BE-3.3 expose endpoints or an SDS contract.

### Phase 2: Data-driven workflow integration from IPC sample files

**Goal:** Use the sample IPC data files in `.docs` to replace current frontend mock data with backend-backed, seedable operational data, while correcting the swimlane flow decisions from `.docs/unnamed (1).png` and adding missing workflow/reporting surfaces.
**Depends on:** Phase 1.4 UI/UX Deep Hardening All Routes, current backend schema/API, `.docs` sample files, and confirmed swimlane decisions.
**Requirements**: [DATA-01, DATA-02, DATA-03, FLOW-01, FLOW-02, FLOW-03, ADM-01, UI-INT-01, VERIFY-01]
**UI hint**: yes
**Canonical refs**:

- `.docs/unnamed (1).png`
- `.docs/Document Database Lastest.docx`
- `.docs/IPCmanagement.sql`
- `.docs/THỰC ĐƠN DRAXLMAIER TỪ NGÀY 15.06 - 20.06.xlsx`
- `.docs/IPC. Định lượng 22.xlsx`
- `.docs/Đơn đặt hàng T5.2025.xlsx`
- `.docs/IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx`
- `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`
- `backend/src/IPCManagement.Api/Controllers/CoordinationController.cs`
- `backend/src/IPCManagement.Api/Controllers/DishesController.cs`
- `backend/src/IPCManagement.Api/Controllers/IngredientsController.cs`
- `backend/src/IPCManagement.Api/Controllers/InventoryIssuesController.cs`
- `backend/src/IPCManagement.Api/Controllers/InventoryReceiptsController.cs`
- `backend/src/IPCManagement.Api/Controllers/ProductionPlansController.cs`
- `backend/src/IPCManagement.Api/Controllers/WarehousesController.cs`
- `backend/src/IPCManagement.Api/Services/CoordinationService.cs`
- `backend/src/IPCManagement.Api/Services/ProductionPlanService.cs`
- `backend/src/IPCManagement.Api/Services/InventoryIssueService.cs`
- `backend/src/IPCManagement.Api/Services/InventoryReceiptService.cs`
- `backend/src/IPCManagement.Api/Services/StockLedgerService.cs`
- `frontend/src/features/coordination/coordinationSlice.ts`
- `frontend/src/features/coordination/coordinationApi.ts`
- `frontend/src/features/projects/dishCatalogApi.ts`
- `frontend/src/features/projects/pages/WeeklyMenuPage.tsx`
- `frontend/src/features/chef/pages/ChefDashboardPage.tsx`
- `frontend/src/features/workflow/workflowData.ts`
- `frontend/src/features/workflow/pages/WarehousePage.tsx`
- `frontend/src/features/workflow/pages/PurchasingPage.tsx`
- `frontend/src/features/workflow/pages/ApprovalPage.tsx`
- `frontend/src/features/workflow/pages/AdminDataPage.tsx`
- `frontend/src/features/reports/pages/ReportsPage.tsx`

**Success Criteria** (what must be TRUE):

  1. Sample workbooks are mapped into a documented seed/import contract for customers, weekly menu schedules, dishes, BOM/ingredient quantities, supplier/order history, inventory prices, and order/serving quantities.
  2. Current frontend mock sources are removed or demoted to explicit fallback fixtures after real API-backed data exists for coordination, weekly menu, chef production, workflow lanes, warehouse/purchasing/admin, and reports.
  3. The corrected workflow is represented in data, API, and UI: demand is calculated before stock check; warehouse exports by approved list before recording issue documents; kitchen has one post-cooking excess/shortage check; admin includes statistics.
  4. Backend exposes or extends APIs for missing domains: material requests, purchase requests, inventory returns, stock/current inventory summaries, BOM adjustments, and admin/reporting statistics.
  5. Reports include ingredient demand, purchase demand, current stock, receipt price variance, kitchen issues, issue-vs-return usage, and audit/BOM/stock changes using Vietnamese labels.
  6. All protected routes keep existing paths/nav labels and remain dense, data-scale-safe, and Vietnamese.
  7. Verification proves the path `.docs` sample data -> backend seed/import -> API response -> frontend route rendering for the core daily workflow.
  8. GitNexus is refreshed or its stale-branch limitation is documented before code execution begins, because the current index was built for another branch.

**Plans:** 6/6 plans executed

Plans:

**Wave 1**

- [x] 02-01: Sample data contract, parser strategy, and canonical workflow lock.
- [x] 02-02: Backend seed/import foundation for menu, quantities, BOM, ingredients, suppliers, and inventory prices.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-03: Backend workflow APIs for material requests, purchase requests, stock checks, issue/receipt/return, and admin reporting.
- [x] 02-04: Frontend data integration replacing coordination, menu, chef, workflow, and report mocks.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-05: Admin statistics, reporting pages, and missing workflow UI completion.
- [x] 02-06: End-to-end data verification, GitNexus refresh, lint/build/browser smoke, and mock-removal audit.
