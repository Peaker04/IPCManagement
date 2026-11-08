# Spec: Clean Core Architecture & Viewport Ergonomics Across All Routes

- **Objective:** Eliminate stacked duplicate toolbars on `/reconciliation`, prevent sticky context loss in warehouse staging, implement smart active-only sidebar expansion in `AppShell`, and centralize triplicated scope mutations into a single authoritative mutator.
- **Standards:** SAP Fiori 3.0 / IBM Carbon / NN/g / Zero-CLS Enterprise Design.
- **Architecture Limits:** Strictly $\le 600$ lines per FE source file; strictly $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`).

---

## 1. Problem Statement & Functional Requirements

The full-tree architectural audit revealed four distinct structural friction points:
1. **Stacked Duplicate Toolbars (`/reconciliation`):** In `ReconciliationPage.tsx`, `TelemetrySubbar` (44px) and `ReconciliationLinesFilterToolbar` (40px) were both rendered as separate `bg-slate-50 border-b` bars stacked on top of each other. This created visual redundancy and ate 40px of vertical space that belongs to table rows.
2. **Loss of Sticky Context in Warehouse Staging (`/warehouse?view=mrx-preparation`):** The customer selection chips and supplier filter were rendered inside the scrollable canvas body. When scrolling through 50+ materials, the filter controls scrolled out of sight, forcing operators to scroll all the way back to the top to change customer selections.
3. **Sidebar Vertical Overflow (`AppShell.tsx`):** All 6 parent navigation groups were hardcoded to `expanded: true` simultaneously. On laptop viewports ($1280\times 800$ or $1366\times 768$), the sidebar overflowed vertically, pushing the user profile and Logout button off the bottom of the screen.
4. **Triplicated State Sinks:** Component event handlers manually called `setSearchParams`, `workspaceSessionStore.setScope`, and `serverStateCache.set` in scattered locations, risking state synchronization drift.

---

## 2. Design Invariants & Contracts

### 2.1. Consolidated Single Subbar on `/reconciliation`
- Consolidate `ReconciliationLinesFilterToolbar` into `TelemetrySubbar` on the `lines` tab:
  - Left controls: Search Input (w-60 h-8) + 4 Segmented Filter Buttons (`Tất cả`, `Cần xử lý`, `Đã giải trình`, `Khớp định mức`).
  - Right telemetry pills: Lifecycle status badge + batch version and line count.
  - Total height: strictly **44px (`h-11`)**.
  - Eradicate the second 40px gray toolbar completely, granting 40px more vertical real estate directly to the DataGrid.

### 2.2. Sticky Customer Staging Filter on `/warehouse?view=mrx-preparation`
- Anchor the customer selection chips and supplier search input in a sticky container (`sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200`) above the DataGrid table.
- When the table scrolls through 100+ ingredient allocations, the customer checkboxes and supplier filter remain permanently accessible at the top of the canvas.

### 2.3. Active-Route Smart Accordion on `AppShell.tsx`
- On mount and route navigation, automatically expand only the parent group matching the current `location.pathname` (e.g. `/reconciliation` expands only `reconciliation`, collapsing others).
- Operators can still freely toggle any parent group.
- The entire sidebar navigation tree fits comfortably within 100% of standard laptop screen heights ($768\text{px} - 900\text{px}$) without any vertical scrollbar.

### 2.4. Centralized Unified Scope Mutator
- In `useUrlWorkbenchState.ts`, expose `syncScope(patch)` to update URL search parameters, `workspaceSessionStore`, and screen snapshots atomically in one call.

---

## 3. Verification Criteria

1. Exactly ONE 44px Subbar rendered on `/reconciliation` (0 duplicate stacked gray bars).
2. Customer selection controls on `/warehouse?view=mrx-preparation` remain sticky and visible during vertical table scrolling.
3. Sidebar on `AppShell` defaults to active-group expansion, keeping the profile and Logout button visible on standard viewports without a sidebar scrollbar.
4. 0 files $> 600$ lines.
5. All 24 Vitest test files pass 100%.
6. All 63 Playwright browser tests pass 100%.
7. All 1,419 Backend C# tests pass 100%.
