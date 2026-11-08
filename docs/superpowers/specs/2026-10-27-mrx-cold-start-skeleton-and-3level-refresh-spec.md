# Spec: MRX Cold-Start Skeleton Normalization, 3-Level Refreshing Patterns & 5-Layer Frontend Conformance

- **Target Systems:** IPCManagement Frontend (`frontend/src/`) & MRX Subsystem (`features/warehouse`, `features/chef`, `features/reconciliation`, `features/weekly-menu`, `features/admin`)
- **Standards:** SAP Fiori / IBM Carbon / Nielsen Norman Group (NN/g 150ms Doherty Threshold) / SWR & TanStack Refreshing Patterns / Zero-CLS Enterprise Design
- **Architecture Limits:** Strictly $\le 600$ lines per frontend source file; strictly $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`).

---

## 1. Problem Statement & Objectives

While previous iterations stabilized in-session navigation and purged dead code, four enterprise-grade usability and interaction defects remain across cold-start and asynchronous refresh lifecycles:

1. **Cold Start Skeleton Strobe (<150ms network responses):** When opening an uncached page on a high-speed local network or warm browser cache, `StateBoundary` immediately mounts `WorkbenchSkeleton` on Frame 0, only for data to arrive 30–80ms later. This causes a perceptible "flash of gray skeleton" (Doherty Threshold violation).
2. **Missing Top Micro-Progress Bar during Silent Revalidation (Level 1):** In-session re-visits keep cached table data, but provide no visual feedback that a background check is in flight, or indiscriminately dim the entire table (`opacity-90`), degrading text contrast and readability during high-intensity kitchen/warehouse operations.
3. **Imperfect Context Pivot Handling (Level 2):** When switching filters (e.g., date or batch) to an uncached target, data should stay frozen on the previous table at `opacity-70 pointer-events-none` with an active 2px top micro-bar, transitioning seamlessly without layout jump or temporary white flashes.
4. **Manual Refresh Non-Destructive Error Resilience (Level 3):** If a background revalidation fails while stale data is visible, the UI must never replace the populated table with a full-page red error block. Stale data must remain visible, accompanied by a non-intrusive inline error ribbon with an instant "Thử lại" action.

---

## 2. Architectural Design & Contracts

### 2.1. 150ms Cognitive Delay (Doherty Threshold) & Min-Duration Skeleton (`useDeferredSkeleton`)

Per NN/g guidelines:
- If API response time is $< 150\text{ms}$, show NO skeleton. The page renders the layout and transitions straight to the hydrated table.
- If response time exceeds $150\text{ms}$, mount `WorkbenchSkeleton` with low-contrast breathing pulse (`bg-slate-100/200`, `animate-pulse`, `aria-busy="true"`).
- Once the skeleton has been shown, enforce a minimum visibility duration ($250\text{ms} - 300\text{ms}$) to prevent the skeleton from disappearing prematurely after being noticed by human cognitive vision.

```ts
export function useDeferredSkeleton(
  isLoading: boolean,
  delayMs = 150,
  minDurationMs = 250
): boolean;
```

### 2.2. 3-Level Refreshing Patterns in `StateBoundary`

```
┌────────────────────────────────────────────────────────────────────────┐
│                        3-LEVEL REFRESHING PATTERNS                     │
├────────────────────┬─────────────────────────────┬─────────────────────┤
│ Level 1: SILENT    │ Level 2: CONTEXT PIVOT      │ Level 3: MANUAL     │
│ Re-visit cached    │ Filter switch to uncached   │ Explicit click      │
│ • 100% opacity     │ • 70% opacity               │ • Real isFetching   │
│ • 2px Micro-Bar    │ • pointer-events-none       │ • Real spin icon    │
│ • Retain scroll    │ • 2px Micro-Bar             │ • Inline error ban  │
└────────────────────┴─────────────────────────────┴─────────────────────┘
```

1. **Top Micro-Progress Bar (2px):**
   - Positioned at the very top edge of the data canvas (`absolute top-0 left-0 right-0 h-0.5 z-30`).
   - Active when `(isFetching && hasExistingData) || isPreviousData`.
   - Gradient animation: `bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400 animate-pulse`.
2. **Context Pivot (`isPreviousData`):**
   - Renders previous table snapshot with `opacity-70 pointer-events-none transition-opacity duration-150`.
3. **Non-Destructive Error Banner:**
   - When `error && hasExistingData`, render inline alert ribbon (`bg-rose-50 border-b border-rose-200 text-rose-800`) at the top of the canvas, keeping children mounted below.

### 2.3. 5-Layer Frontend Conformance Invariants

- **Layer 1 (Navigation Shell):** `AuthorizedAppShell` remains mounted across route changes.
- **Layer 2 (Session Store):** `workspaceSessionStore` synchronizes `customerId`, `customerCode`, `serviceDate`, `batchId`.
- **Layer 3 (SWR Cache):** 100% Write-Through Cache via `serverStateCache`.
- **Layer 4 (State Boundary):** Strict 5-state disjoint precedence:
  $$\text{L1\_HYDRATED} > \text{L2\_ERROR} > \text{L3\_LOADING} > \text{L4\_NO\_SCOPE} > \text{L5\_EMPTY}$$
- **Layer 5 (View & URL Sync):** Pure reactive URL updates via `useUrlWorkbenchState`, zero `setTimeout(0)`.

---

## 3. Verification Criteria

1. All 36 physical modules verified on disk (`npm run precommit:verify` Gate A).
2. Zero occurrences of `alert()` / `confirm()` (Gate B).
3. 0 frontend files $> 600$ lines, 0 test files $> 1500$ lines (Gate C).
4. Production typecheck and Vite build pass with 0 errors (Gate D).
5. All 23 Vitest unit & integration test files pass 100% (Gate E).
6. All 6 Playwright browser test suites pass 100% (63 / 63 tests).
7. Live MutationObserver audit across all 12 MRX links records 0 skeleton flashes, 0 empty flashes, 0 layout shifts.
