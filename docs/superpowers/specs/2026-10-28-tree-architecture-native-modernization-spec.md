# Spec: Native Frontend Tree Architecture & Full MRX Surface Modernization

- **Scope:** Complete Operational Mode `MATERIAL_RECONCILIATION` (6 Core Routes + 3 Shared Routes = 10 Surfaces)
- **Objective:** Eliminate background idle API spamming, eradicate rapid skeleton flickering (Doherty threshold compliance), eliminate asynchronous badge layout jumps, and decompose 100% of monolithic pages into a clean, decoupled **4-Tier Native Tree Architecture (Kiến trúc Cây)** without hardcoded layer frameworks.
- **Standards:** Component & State Tree Architecture / Scoped Context Boundaries / Event-Driven URL Authority / Nielsen Norman Group (NN/g 150ms Doherty Latency Deferral) / Single Responsibility Principle ($\le 350$ lines per module, $\le 600$ hard limit).
- **Core Principles:** Learn the clean architectural paradigm and implementation patterns; zero hardcoding of rigid layer numbers, pixel locks, or monolithic state machines.

---

## 1. Forensic Audit & Root Cause Analysis

### 1.1. Root Cause 1: Idle Backend API Storm (Spamming GET Requests)
- **Observed Phenomenon:** Even when an operator is completely idle, the backend Kestrel log receives a continuous barrage of GET requests to `/api/reconciliation/...` and `/api/reconciliation-batches/...` every 50–100ms.
- **Root Cause in Code:**
  1. In `useReconciliationWorkspace.ts`: The `useEffect` fetching batch summary includes `data` in its dependency array:
     ```typescript
     useEffect(() => {
       if (!batchId) return;
       mrxApi.getBatchSummary(batchId, serviceDate).then((result) => {
         setData(result); // <-- Modifies 'data' reference!
       });
     }, [batchId, serviceDate, customerCode, data]); // <-- Re-triggers effect on every setData!
     ```
     Because `setData` assigns a new object reference, the effect immediately executes again, creating an infinite, self-sustaining network storm.
  2. In `useMrxDailyWorkspace.ts` and `useReconciliationWorkspace.ts`: Cascading `useEffect` cycles between `searchParams`, `setSearchParams`, and `setScope` trigger recursive re-fetching without user input.

### 1.2. Root Cause 2: Rapid Skeleton Flickering (Micro-Jitter)
- **Observed Phenomenon:** When navigating or switching tabs, a gray skeleton table flashes for 15–30ms and vanishes abruptly, causing visual strobe/flicker and cognitive eye strain.
- **Scientific Foundation (NN/g Perceptual Response Times):**
  - **$0\text{ms} - 100\text{ms}$:** Instantaneous perception. Displaying a skeleton within this window is an anti-pattern.
  - **$150\text{ms}$ (Doherty Threshold):** Only show a skeleton if asynchronous resolution exceeds 150ms.
  - **$\ge 250\text{ms}$ (Minimum Dwell Duration):** Once mounted, the skeleton must remain visible for at least 250ms to allow human visual fixation without a jarring flash.
- **Root Cause in Code:**
  `useDeferredSkeleton.ts` was implemented but **never wired** into `StateBoundary.tsx` or `LocalizedBoundary.tsx`. Any query setting `isLoading=true` for 20ms immediately mounted the full `<WorkbenchSkeleton />` without latency deferral.

### 1.3. Root Cause 3: Asynchronous Badge Layout Jumps (Horizontal Shifts)
- **Observed Phenomenon:** When opening a route or changing dates, the Header selectors (Customer dropdown, Date input) suddenly jerk 100–280px to the right after 20–40ms.
- **Root Cause in Code:**
  Badges and secondary selectors are conditionally rendered only after asynchronous queries return:
  ```tsx
  {batchStatus && <Badge ...>{statusLabels[batchStatus]}</Badge>}
  {data && <Select ... options={shiftOptions} />}
  ```
  At Frame 0 (initial paint), no space is reserved. When the badge mounts, it violently expands the flex container, shifting all neighboring controls.

### 1.4. Root Cause 4: Incomplete MRX Route Coverage
- Prior iterations only partially extracted files in `/reconciliation`, `/weekly-menu?view=mrx-batch`, and `/warehouse?view=mrx-daily`.
- The remaining MRX surfaces remained monolithic and unmigrated:
  - `/warehouse?view=mrx-preparation` (`MrxMultiCustomerPreparationWorkbench.tsx` — 325 lines)
  - `/warehouse?view=mrx-issues` (`MrxSourceDeltaWorkbench.tsx` — 280 lines)
  - `/chef?view=mrx-cooking` (`MrxCookingWorkbench.tsx` — 370 lines, 280px header explosion)
  - `/reconciliation` reports (`ReconciliationReportTables.tsx` — 517 lines)

---

## 2. Target 4-Tier Native Tree Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: APPLICATION ROOT & SHELL TREE (Root Providers & Navigation Trunk)              │
│ App.tsx: AuthProvider ── BrowserRouter ── DirtyNavigationProvider                      │
│ └── AppShell.tsx: Sidebar v2 Navigation Tree ── Global Network Banner ── Outlet        │
└────────────────────────────────────┬───────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────────────────────┐
│ TIER 2: WORKSPACE BRANCH ORCHESTRATOR (Page-Level Domain & Scope Authority)            │
│ Route Controller (e.g. ReconciliationWorkspace, WeeklyMenuWorkspace, WarehouseWorkspace)│
│ ├── Scope Authority: URLSearchParams as Source of Truth + SessionStorage Hydration     │
│ ├── Event-Driven Scope Updates: Only user interaction mutates searchParams             │
│ └── Elastic Frame: <WorkspaceHeader /> + <WorkspaceBody />                             │
│     └── Reserved Badge Slot (min-w-[110px] h-8): Frame 0 geometry stability            │
└────────────────────────────────────┬───────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────────────────────┐
│ TIER 3: SUB-TREE FEATURE COMPOSITES (Independent, Self-Contained Views)                │
│ Each sub-view is an autonomous branch component (< 300 lines) with its own:           │
│ ├── Dedicated Domain Hook (e.g. useReconciliationLines, useChefCookingPlan)            │
│ ├── Localized Latency-Deferred Boundary: useDeferredSkeleton(isLoading, 150, 250)     │
│ └── Local Sub-Filters & Modals (Colocated with the sub-view that owns them)            │
└────────────────────────────────────┬───────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────────────────────┐
│ TIER 4: LEAF NODES & ATOMIC UI PRIMITIVES (Dumb / Presentational / Pure)              │
│ Button, Badge, Input, Select, VietnameseDateInput, Num, IdentifierText, DataGrid       │
│ Pure presentational components; zero business logic; elastic whitespace-nowrap styling │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Invariants

### 3.1. Invariant 1: Absolute Dependency Purity & Event-Driven URL Authority
1. **No Data Mirrors in `useEffect` Dependencies:**
   State variables populated by an effect (e.g. `data`, `batches`, `daily`) **MUST NEVER** appear in that effect's dependency array.
2. **Event-Driven URL Mutations:**
   `setSearchParams` is invoked **strictly** inside user action handlers (`onChange`, `onClick`). Background query resolution (`then()`) **MUST NEVER** unilaterally overwrite URL search parameters.
3. **Purity of Query Identifiers:**
   Effects trigger queries only when primitive route identifiers change: `[customerId, batchId, serviceDate]`.

### 3.2. Invariant 2: Latency-Deferred Skeleton Engine (Doherty Threshold)
1. Both `<StateBoundary>` and `<LocalizedBoundary>` must incorporate `useDeferredSkeleton(isLoading, 150, 250)`.
2. If network/cache returns data within $\le 150\text{ms}$, the UI maintains the existing screen or displays the hydrated data at 0ms. Zero skeleton is rendered.
3. If network latency exceeds $150\text{ms}$, the skeleton mounts and is locked for a minimum of $250\text{ms}$ before fading into live data, completely eliminating rapid flicker.

### 3.3. Invariant 3: Reserved Header Badge Anchors (Zero-Jitter Headers)
1. Header context containers reserve a fixed slot for status badges:
   ```tsx
   <div className="min-w-[110px] h-8 flex items-center shrink-0">
     {batchStatus ? (
       <Badge variant={...} className="animate-in fade-in duration-150">...</Badge>
     ) : null}
   </div>
   ```
2. Surrounding controls (Customer select, Date input) remain perfectly stationary at Frame 0, Frame 1, and throughout the entire session.

### 3.4. Invariant 4: 100% Comprehensive Coverage of MRX Surfaces
Every MRX route must be cleanly decomposed into Tier 2 Orchestrator + Tier 3 Branches ($\le 350$ lines per file):
1. `/weekly-menu?view=mrx-batch`: Orchestrator + `MrxBatchHeaderBranch` + `MrxBatchPreviewSection`
2. `/warehouse?view=mrx-daily`: Orchestrator + `MrxDailyHeaderBranch` + `MrxDailyDateTabsBranch` + `MrxDailyLinesBranch`
3. `/warehouse?view=mrx-preparation`: Orchestrator + `MrxPrepHeaderBranch` + `MrxPrepAllocationsBranch`
4. `/warehouse?view=mrx-issues`: Orchestrator + `MrxDeltaHeaderBranch` + `MrxDeltaTableBranch`
5. `/chef?view=mrx-cooking`: Orchestrator + `MrxCookingHeaderBranch` + `MrxCookingDishListBranch`
6. `/reconciliation`: Orchestrator + `ReconciliationHeaderBranch` + `ReconciliationLinesBranch` + `ReconciliationVariancesBranch` + `ReconciliationTransactionsBranch` + `ReconciliationAuditBranch` + `ReconciliationCompletedBranch`

---

## 4. Verification & Acceptance Criteria

1. **Backend Log Purity:** With the frontend running on `http://127.0.0.1:5173`, leaving the browser idle for 60 seconds generates **ZERO HTTP requests** in the backend log.
2. **Zero-Flicker Skeleton Conformance:** Fast tab switches and in-session navigation display zero skeleton flash ($\le 150\text{ms}$ suppression).
3. **Zero-Jitter Header Conformance:** Badge appearance during cold loads and date changes produces **0px horizontal shift** on neighboring select boxes.
4. **Architecture Gate:** 100% of frontend files strictly $\le 350$ lines (average $\le 200$ lines), 0 files $> 600$ lines.
5. **Pre-Commit & E2E Suites:** 100% PASS on all 26 Vitest suites (214+ tests), 63 Playwright browser tests, and 1,419 backend C# tests.
