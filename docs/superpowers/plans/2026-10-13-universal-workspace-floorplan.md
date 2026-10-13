# Universal Operational Workspace Floorplan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the UI component architecture to implement a Universal Operational Workspace Floorplan across `/weekly-menu` and core shared primitives, enforcing the 8-state UI matrix (especially replacing `InlineAlert` / empty-div loading with structured `TableSkeleton`/`TabContentSkeleton`), eliminating layout jerking/CLS, and unifying Header (48px), Sub-Toolbar, TableViewport, and Flush Pagination Footer per the 24-dimension specification matrix and `DESIGN.md`.

**Architecture:**
1. Upgrade `QueryViewBoundary.tsx` to conditionally render `TableSkeleton` or `TabContentSkeleton` based on `geometry` (`table` | `workspace` | `section` | `compact`) or a custom `skeleton` prop when `phase === 'loading'`, removing the anti-pattern of rendering an `InlineAlert` while hiding children.
2. Standardize all 6 weekly menu sections (`MaterialDemandSection`, `PurchaseSummarySection`, `ProductionPlanSection`, `MenuCostSection`, `DishMaterialsSection`, `WeeklyScheduleWorkspace`) to share the exact 6-tier Universal Floorplan.
3. Clean up fragmented CSS overrides in `ui-redesign.css` and `demand.css`, anchoring them to standard Design Tokens.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vitest, Playwright.

**Spec:** `docs/DESIGN.md`, `docs/UI-KIT.md`, and UI Specification Matrix (24 pillars).

---

## Global Constraints
- Do not alter backend API contracts, routes, permissions, or financial arithmetic (BOM, costing, servings formulas).
- Adhere to Rule D9: Distinct business metaphors must not overload one glyph for unrelated meanings.
- Maintain Rule E4: Structured skeleton when loading; never blank canvas or alert box substituting for a table.
- Maintain Rule C1/C2: Table placeholders match real role/rows/columns to achieve CLS <= 0.1.
- All button and control focus changes must use `{ preventScroll: true }`.

---

## Tasks

### Task 1: Upgrade `QueryViewBoundary.tsx` to Support Structured Skeletons

**Files:**
- Modify: `frontend/src/components/common/QueryViewBoundary.tsx`
- Test: `frontend/src/components/common/QueryViewBoundary.test.tsx`

**Interfaces:**
- Props: Add optional `skeleton?: ReactNode`, `skeletonColumns?: number | Array<{ width?: string; align?: 'left' | 'center' | 'right' }>`, `skeletonRows?: number` to `QueryViewBoundary`.
- Behavior: When `blocking.view.phase === 'loading'`:
  - If `skeleton` prop is provided: render `skeleton`.
  - Else if `geometry === 'table'`: render `<TableSkeleton columns={skeletonColumns ?? 6} rows={skeletonRows ?? 6} ariaLabel={`Đang tải ${blocking.label}...`} />`.
  - Else if `geometry === 'workspace'`: render `<TabContentSkeleton geometry="workspace" message={`Đang tải ${blocking.label}...`} />`.
  - Else if `geometry === 'section'`: render `<TabContentSkeleton geometry="section" message={`Đang tải ${blocking.label}...`} />`.
  - Otherwise (for `compact`): render `<div className="flex items-center justify-center p-6 text-sm text-slate-500 animate-pulse">Đang tải {blocking.label}...</div>`.
  - DO NOT render `<InlineAlert>` for loading states.

- [ ] **Step 1: Write tests in `QueryViewBoundary.test.tsx` proving `loading` phase renders `TableSkeleton` for `geometry="table"` and `skeleton` prop when provided.**
- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Implement skeleton rendering in `QueryViewBoundary.tsx`.**
- [ ] **Step 4: Run test to verify it passes.**

---

### Task 2: Standardize `MaterialDemandSection.tsx` Loading & Inventory Structure

**Files:**
- Modify: `frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx`
- Test: `frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.presentation.test.tsx`

**Interfaces:**
- Behavior:
  - Eliminate all `<div className="ipc-demand-summary is-empty">` fallback strings.
  - When `demandView.phase === 'loading'`: render `<TableSkeleton columns={5} rows={5} ariaLabel="Đang tải nhu cầu nguyên liệu..." />`.
  - When `status.isFetchingAggregate && !presentation.aggregatePage`: render `<TableSkeleton columns={6} rows={5} ariaLabel="Đang tải nguyên liệu ngày đang xem..." />` inside the inventory section.
  - Header height fixed at 48px (`min-height: 48px; padding: 6px 16px;`) with `<PackageSearch size={18}>`.
  - Pagination flush footer attached directly to table boundary.

- [ ] **Step 1: Replace ad-hoc text loading divs with `TableSkeleton` in `MaterialDemandSection.tsx`.**
- [ ] **Step 2: Run `MaterialDemandSection` unit tests to verify no regressions.**

---

### Task 3: Standardize `PurchaseSummarySection.tsx` (Table Skeleton & Filter-Empty State)

**Files:**
- Modify: `frontend/src/features/projects/weekly-menu/purchasing/PurchaseSummarySection.tsx`
- Test: `frontend/src/features/projects/weekly-menu/purchasing/PurchaseSummarySection.feedback.test.tsx`

**Interfaces:**
- Behavior:
  - Pass `geometry="table"` and `skeleton={<TableSkeleton columns={presentation.usesDemand ? 6 : 7} rows={6} ariaLabel="Đang tải tổng hợp mua của tuần..." />}` to `QueryViewBoundary`.
  - When `presentation.totalItems === 0`:
    - If `state.search.trim().length > 0`: render clear filter-empty UI:
      `<div className="p-8 text-center text-sm text-slate-500">Không tìm thấy nguyên liệu nào khớp với từ khóa "{state.search}". <button type="button" onClick={() => actions.setSearch('')} className="ml-2 font-medium text-blue-600 underline">Xóa tìm kiếm</button></div>`
    - Else: render domain empty message ("Chưa có dòng nhu cầu đã phát sinh trong tuần này...").

- [ ] **Step 1: Implement `skeleton` in `QueryViewBoundary` and add filter-empty handler in `PurchaseSummarySection.tsx`.**
- [ ] **Step 2: Run `PurchaseSummarySection` tests to verify behavior.**

---

### Task 4: Standardize Clean Floorplan CSS in `ui-redesign.css` & `demand.css`

**Files:**
- Modify: `frontend/src/styles/ui-redesign.css`
- Modify: `frontend/src/styles/redesign/demand.css`

**Interfaces:**
- CSS rules:
  - Ensure `.ipc-section-header`, `.ipc-demand-context-heading`, `.ipc-fiori-command` all share exact 48px min-height, 6px 16px padding, and 18px primary-colored icons.
  - Standardize `.ipc-pagination-bar` as flush bottom bar for all `.ipc-section-panel` and `.ipc-demand-inventory-section`.
  - Remove all redundant ad-hoc overrides and ensure zero CLS on table containers.

- [ ] **Step 1: Refactor CSS rules in `ui-redesign.css` and `demand.css`.**
- [ ] **Step 2: Run `npm run lint:fe` and `npm run build:fe`.**

---

### Task 5: End-to-End Verification Across the Entire Project

- [ ] **Step 1: Run `npm run lint:fe`**
- [ ] **Step 2: Run `npm run build:fe`**
- [ ] **Step 3: Run `npm run depcruise:fe`**
- [ ] **Step 4: Run full vitest unit test suites for all modified components**
- [ ] **Step 5: Run Playwright pagination visual tests (`cd frontend && npx playwright test tests/browser/pagination-visual.spec.ts`)**
