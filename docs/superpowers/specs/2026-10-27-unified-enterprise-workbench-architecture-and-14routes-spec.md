# Spec: Unified Enterprise Workbench Architecture Across All 14 Routes

- **Scope:** Complete 14 Canonical Routes & 25 Surfaces in IPCManagement
- **Objective:** Eliminate visual jitter, eradicate the "Layer Cake" anti-pattern (232px stacked strips), unblock multi-station operational workflows, enforce a 3-tier semantic badge hierarchy, and guarantee 0ms synchronous Render #1 hydration across the entire application.
- **Standards:** SAP Fiori 3.0 / IBM Carbon / NN/g (150ms Doherty Threshold) / SWR 3-Level Refreshing / Zero-CLS Enterprise Design.
- **Architecture Limits:** Strictly $\le 600$ lines per source file; strictly $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`).

---

## 1. Root Cause Analysis: The "Layer Cake" Anti-Pattern & Asynchronous Jitter

### 1.1. The Layer-Cake Anti-Pattern
In complex operational workbenches (notably `/reconciliation`, `/warehouse?view=mrx-daily`, `/weekly-menu?view=mrx-batch`), presentation logic has evolved into vertically stacked independent strips:
1. **WorkspaceHeader (56px):** Title, context selectors, actions.
2. **BlockerStrip (36px):** Amber warning banner, conditionally rendered.
3. **QueueCards (48px):** 5 metric buttons, conditionally rendered.
4. **TelemetrySubbar (44px):** Stepper + metadata pills.
5. **FilterToolbar (48px):** Search input + tab buttons.

**Impact:**
- **Vertical Choking ($232\text{px}$ overhead):** On standard enterprise laptop viewports ($1280\times 800$ or $1440\times 900$), $>34\%$ of vertical height is eaten by stacked bars, leaving only 6–8 table rows visible.
- **Asynchronous Stagger Jitter:** Because each strip binds to a different asynchronous query (`getBatchSummary`, `getOperationalSummary`, `getReports`), they mount at staggered timestamps (+0ms, +35ms, +80ms, +120ms), repeatedly pushing the DataGrid downwards.
- **Subview Jolt (132px Collapse/Expand):** Switching to tabs like "Danh bạ hoàn tất" unmounts 3 middle strips, causing the entire table to violently jump up by 132px, and jump down by 132px when returning to lines review.

### 1.2. Cognitive Badge Overload
A single screen simultaneously presents up to 6 competing badge/status indicators:
- Header status badge (`Đang đối chiếu`)
- Stepper pills (`[5] Đã chốt sổ`)
- Queue count dots (`0`, `0`, `0`, `1`, `0`)
- Blocker banner (`Còn 1 dòng chênh lệch`)
- Filter tab counts (`Cần xử lý (1)`, `Khớp định mức (66)`)
- Table cell row status (`Khớp định mức`, `Cần giải trình`)
All represent projections of the same underlying Batch aggregate but create visual noise and cognitive friction.

### 1.3. Workflow Fragmentation
When an issue discrepancy or stock shortage occurs, operators are kicked out of their current workbench to a different route (`Đi đến Trạm Kho nguyên liệu →`, `Mở trạm Kho xuất ngày →`), forcing a full page reload and context loss instead of resolving in-place.

---

## 2. Architectural Design & Invariants

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             UNIFIED WORKBENCH FRAMEWORK: 96PX FIXED HEIGHT (ZERO LAYOUT SHIFT)         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ROW 1 (56px / h-14) — CONTEXT & PRIMARY ACTIONS (Zone 1)                               │
│ [Breadcrumb] Title  │ [Select Khách] [Select Lô] [Date Input] ── [Master Status] [Act] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ROW 2 (40px / h-10) — INTEGRATED TABS & INLINE METRICS (Zone 2)                        │
│ [Tabs: Rà soát (67) | Chênh lệch (0) | Lịch sử (12) | Kiểm toán] ── [Inline KPI Chips] │
│                                                                  [!] 1 dòng cần xử lý  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ZONE 3 (flex-1 min-h-0 overflow-auto) — DATA CANVAS                                    │
│ DataGrid table starts precisely at pixel 97 downwards across ALL subviews.             │
│ Zero vertical collapse or expansion when switching tabs (CLS = 0.0000).               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Unified Fixed-Height 96px Header Container
1. **Row 1 (56px):**
   - Breadcrumb + H1 Title.
   - Context selectors (Customer, Batch, VietnameseDateInput).
   - Right: Exactly 1 primary button (Rule D7) + utility outline buttons (Refresh, Export).
2. **Row 2 (40px):**
   - Left: Segmented navigation tabs with integrated record counts.
   - Right: Integrated metric chips and inline blocker chip.
   - **Crucial Invariant:** Row 2 height is fixed at 40px regardless of whether blockers exist. An active blocker renders as an actionable chip inside Row 2 (`[!] Còn 1 dòng cần xử lý`), which triggers in-place filtering without altering layout height.
3. **Zone 3 (Remaining Viewport):**
   - DataGrid receives maximum vertical real estate, displaying 18–25 rows per screen on standard desktop viewports.

### 2.2. Three-Tier Semantic Status Hierarchy
- **Tier 1 (Master Entity State):** Displayed ONCE in Row 1 of the header (e.g. `Đang đối chiếu`, `Đã chốt sổ`).
- **Tier 2 (Filter Scope Counts):** Embedded directly inside Row 2 tabs (`Tất cả (67)`, `Cần xử lý (1)`).
- **Tier 3 (Row-Level Fact):** Localized Badge in the DataGrid table cell (`Khớp định mức`, `Xuất lệch`).

### 2.3. In-Place Drawer / Modal Workflow Unblocking
- Operators resolve blockers directly on the current screen via sliding drawers (`ReconciliationDispositionModal`, `ReconciliationLineDetailModal`, `MrxSupplementalIssueModal`) without URL displacement.
- Upon drawer confirmation, local cache mutates instantly (`serverStateCache.mutateLocal`), updating row status and Row 2 tab counts with 0ms delay.

### 2.4. Synchronous 5-Layer Hydration Engine
- **Layer 1 (Navigation Shell):** `AppShell` with eager static imports, synchronous auth/mode state, and responsive drawer on mobile ($<768\text{px}$).
- **Layer 2 (Session Scope):** `workspaceSessionStore` hydrates from `sessionStorage` at 0ms.
- **Layer 3 (SWR Cache):** `serverStateCache` persists `snapshot:*` entries to `sessionStorage`. Hard refresh (F5) resolves data at **0ms** on Render #1.
- **Layer 4 (State Boundary):** Disjoint mathematical precedence:
  $$\text{L1\_HYDRATED} > \text{L2\_ERROR} > \text{L3\_LOADING} > \text{L4\_NO\_SCOPE} > \text{L5\_EMPTY}$$
  True cold starts mount `WorkbenchSkeleton` immediately inside the fixed 96px frame without white shims.
- **Layer 5 (URL & View Sync):** Reactive synchronization without artificial `setTimeout` timers.

---

## 3. Scope of 14 Routes & 25 Surfaces

| # | Route | Features | Key Views & Surfaces |
|---|---|---|---|
| 1 | `/` | Dashboard | KPI Metrics, 4 Prioritized Tasks, 4-Stage Stepper |
| 2 | `/weekly-menu` | Planning & Coordination | Schedule, Demand, Production Plan, Cost, MRX Batch Workbench |
| 3 | `/meal-orders` | Coordination | Meal Quantity Plans, Shift Orders |
| 4 | `/approvals` | Approvals | Pending PR, PO, Inventory Approvals & Decision Drawer |
| 5 | `/purchasing` | Purchasing | PO List, Supplier Partner Selection, Order Detail SplitView |
| 6 | `/warehouse` | Warehouse & Inventory | Receipts, Issues, Stock, MRX Daily, MRX Preparation, MRX Deltas |
| 7 | `/chef` | Kitchen Production | Production Plans, Issue Acknowledgements, MRX Cooking Cards |
| 8 | `/reconciliation` | Reconciliation (MRX) | Lines Review, Variances, Transactions, Audit Trail, Completed Register |
| 9 | `/reports` | Reports | Material Demand, Price Variance, Current Stock |
| 10 | `/admin-data` | Catalog Management | Ingredients Catalog, Standard Dishes Catalog |
| 11 | `/settings/approval-rules` | Admin Governance | Document Approval Rules, Thresholds, SLAs |
| 12 | `/settings/advanced` | System Operation | Operational Mode Switching (DOM-MODE-1), Cache Operations |
| 13 | `/login` | Authentication | Login Form, Single Primary Button |
| 14 | `/forbidden` | Security | 403 Access Denied, Clean Mode-Aware Guidance |

---

## 4. Verification & Quality Gates

1. **Geometry Invariant:** Header height is strictly 96px across all subviews on `/reconciliation` and all workbenches.
2. **Zero Layout Shift (CLS = 0.0000):** Switching between tabs in `/reconciliation` results in 0px vertical jump.
3. **No White Shim:** Zero blank white div renders during initial load.
4. **No Artificial Timers:** Zero occurrences of `setTimeout` for refresh spinner lifecycle.
5. **Text Hygiene:** Zero English enums (`INITIAL_ISSUE`, `WEEK_COMPLETE`), zero developer jargon (`DOM-MODE-1`, `append-only`, `stock movement`).
6. **Architecture Limits:** 0 files $> 600$ lines.
7. **Full Suite Conformance:** 100% PASS on Vitest (206+ tests), Playwright (63 tests), and C# Backend (1,419 tests).
