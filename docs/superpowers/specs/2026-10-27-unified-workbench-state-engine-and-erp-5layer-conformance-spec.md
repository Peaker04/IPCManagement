# Unified Workbench State Engine & ERP 5-Layer Conformance Specification

- **Feature Code**: `FR-SYS-STATE-01` / `ARCH-FE-5LAYER`
- **Canonical Design Contract**: `docs/DESIGN.md` (Sections 1–6, Rules `C1–C6`, `T7`, `T8`, `D6`, `D7`, `UXR-01–05`, `NFR-UI-01–05`)
- **Engineering & Verification Contract**: `docs/ENGINEERING.md`, `docs/table-contracts.json`, `.pi/skills/ipc-test-audit/SKILL.md`
- **Creation Date**: 2026-10-27
- **Status**: APPROVED & LOCKED

---

## 1. Problem Statement & Root Cause Analysis

### 1.1. Current Architectural Defect: "Patchwork" Fragmentation (Vá lẻ)
While recent changes achieved zero layout shifts ($\text{CLS} = 0.0000$) and synchronous Render #1 cache hydration ($0\text{ms}$), the underlying code across the 14 canonical routes and 12 MRX subviews suffers from **State Management Fragmentation**:
1. **Duplicated Boilerplate**: Every page independently manages 35–50 lines of bespoke state hooks (`useState` for snapshot, `hasHydratedData`, `isBootstrapping`, `hasLoadedOnce`, `error`, `loading`, `saving`).
2. **Brittle Boolean Algebra**: Boolean expressions passed into `<StateBoundary>` are repeatedly hand-crafted on each screen. A minor omission (such as appending `&& Boolean(batchId)` to `isBootstrapping`) repeatedly reintroduced visual strobe bugs.
3. **Multi-Store Desynchronization**: Three independent stores (`serverStateCache`, `workspaceSessionStore`, and local component state) are synchronized via ad-hoc, imperative function calls inside event handlers (`onChange`, `load()`).
4. **Per-View Snapshot Collision**: Views sharing a parent route (such as `/admin-data?view=ingredients` vs `?view=dishes`, or report tabs in `/reconciliation`) previously shared singular snapshot keys, causing temporary empty-table flashes when toggling tabs.

### 1.2. The Enterprise ERP State Machine Imperative
In a mission-critical ERP platform, state transitions must be mathematically disjoint, deterministic, and managed by a **single canonical engine** rather than component-level improvisation.

---

## 2. The 5-Layer Disjoint State Truth Table

Every view in the system must belong to exactly one of the 5 mutually exclusive operational layers:

```
[User Trigger / Route Mount]
             │
             ▼
      Is there data in RAM SWR cache or Snapshot?
     ┌───────┴───────┐
    YES              NO
     │               │
     ▼               ▼
[L1: HYDRATED_READY]  Is there a terminal blocker/409 error?
(Render data @ 0ms;   ┌───────┴───────┐
 isFetching if stale) YES             NO
                      │               │
                      ▼               ▼
         [L2: ERROR/BLOCKED]    Is catalog bootstrapping OR entity loading?
         (Render banner/error)  ┌───────┴───────┐
                               YES             NO
                                │               │
                                ▼               ▼
                      [L3: BOOTSTRAP/LOADING]   Has catalog finished and scopeId is empty?
                      (Render matched          ┌───────┴───────┐
                       WorkbenchSkeleton)     YES             NO
                                               │               │
                                               ▼               ▼
                                       [L4: NO_SCOPE]   [L5: EMPTY_DATASET]
                                       (Show "Chưa có    (Scope valid,
                                        lô đối soát")     lines count == 0)
```

### Truth Table Matrix

| Layer ID | Name | Mathematical Condition | UI Work Surface Contract | Forbidden Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **`L1`** | `HYDRATED_READY` | `hasHydratedData === true` (Cache Hit or previous data preserved) | Immediately render Zone 3 `DataGrid` / `SplitView` at $0\text{ms}$. If revalidating, keep table visible with `isFetching === true` (`opacity-90`). | **NEVER** render `<WorkbenchSkeleton />`. **NEVER** unmount children. **NEVER** set `data = null`. |
| **`L2`** | `ERROR_OR_BLOCKED` | `!hasHydratedData && (error !== null \|\| isCompatibilityBlocked === true)` | Render `StateBoundary` error view or `409 LEGACY` blocked banner with clear operational guidance and `[Thử lại]` action. | **NEVER** render empty state. **NEVER** hide the blocker reason (`UXR-02`). |
| **`L3`** | `BOOTSTRAPPING_OR_LOADING` | `!hasHydratedData && !error && (isBootstrappingCatalog \|\| (Boolean(scopeId) && isLoadingData))` | Render `WorkbenchSkeleton` with `columnWidths` matching actual `DataGrid` columns, `thead` 40px, rows 36px. | **NEVER** flash an empty canvas or drop into empty state during bootstrapping. |
| **`L4`** | `NO_SCOPE_AVAILABLE` | `!hasHydratedData && !isBootstrappingCatalog && hasLoadedCatalogOnce && !scopeId` | Render `StateBoundary` Empty Scenario (`empty-first-use` or `prerequisite-blocked`) explaining no active batch/customer exists. | **NEVER** get stuck in an infinite skeleton. |
| **`L5`** | `EMPTY_DATASET` | `hasHydratedData && !isBootstrappingCatalog && !isLoadingData && !isFetching && !error && isDatasetEmpty(data)` | Render honest empty state inside Zone 3 (e.g. "Ngày này không có nguyên liệu cần xuất kho"). | **NEVER** trigger `L5` when `data === null` or during data fetching. |

---

## 3. Core Architecture: Canonical Hook `useWorkbenchQuery`

To eradicate patchwork state handling, all pages must consume a single standardized hook: `frontend/src/hooks/useWorkbenchQuery.ts`.

### 3.1. Interface Contract

```typescript
export interface UseWorkbenchQueryOptions<TData, TParams = Record<string, unknown>> {
  /** Logical module identifier (e.g. 'mrx_daily', 'mrx_cooking', 'admin_ingredients') */
  scopeKey: string;
  /** Exact unique cache key including all active query parameters */
  cacheKey: string;
  /** Dedicated screen-level snapshot key for synchronous 0ms Render #1 hydration */
  snapshotKey?: string;
  /** Primary data loader invoking the authoritative API client */
  queryFn: (params?: TParams) => Promise<TData>;
  /** Optional active entity scope (batchId, customerId, period). If omitted or truthy, query is enabled */
  scopeId?: string | null;
  /** Whether the parent catalog is still loading (e.g. batches or customers list) */
  isCatalogLoading?: boolean;
  /** Predicate determining whether the authoritative returned dataset has 0 operational rows */
  isDatasetEmpty?: (data: TData) => boolean;
  /** Custom error mapper for legacy compatibility blockers (e.g. 409 LEGACY_DAILY_LINEAGE_MISSING) */
  isCompatibilityBlocked?: (error: unknown, cached?: unknown) => boolean;
  /** Static Empty Scenario metadata */
  emptyTitle?: string;
  emptyDescription?: string;
}

export interface UseWorkbenchQueryResult<TData> {
  /** Authoritative data, guaranteed non-null in L1, preserved during parameter transitions */
  data: TData | null;
  /** Explicit layer status */
  layer: 'L1_HYDRATED_READY' | 'L2_ERROR_OR_BLOCKED' | 'L3_LOADING' | 'L4_NO_SCOPE' | 'L5_EMPTY';
  /** Normalized props passed directly into <StateBoundary {...stateProps}> */
  stateProps: {
    isLoading: boolean;
    isFetching: boolean;
    hasExistingData: boolean;
    error: Error | null;
    isEmpty: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    isPartial?: boolean;
    partialMessage?: string;
  };
  /** Imperative refetch function */
  refetch: (force?: boolean) => Promise<void>;
  /** Atomic mutation setter for optimistic updates and write-through */
  setData: (updater: TData | ((prev: TData | null) => TData | null)) => void;
}
```

### 3.2. Mandatory Invariant Guarantees
1. **Zero-Strobe Render #1**: The hook evaluates `serverStateCache.get(snapshotKey)` or `serverStateCache.get(cacheKey)` during initial `useState` initialization. If cache is hit, `layer` is `L1_HYDRATED_READY` on the very first execution tick ($0\text{ms}$).
2. **Atomic `keepPreviousData`**: When parameters change (e.g. switching date or batch), the hook **NEVER** clears `data` to `null`. It marks `isFetching = true`, retains the old table in the DOM with `opacity-90`, and performs an atomic swap when the new payload arrives.
3. **Unified Write-Through**: Any successful query or mutation automatically updates both `serverStateCache.set(cacheKey, result)` and `serverStateCache.set(snapshotKey, result)`.

---

## 4. Test Audit Invariants (Rule TA-1 through TA-5 Compliance)

1. **Rule TA-1 (Backend-Grounded Fixtures)**: All mock data for the 12 MRX subviews must adhere strictly to C# DTO contracts (`MrxBatchSummary`, `MrxWarehouseDaily`, `MrxKitchenCooking`, `ReconciliationBatchSummary`, `MrxPreparation`, `MrxSourceDelta`). No synthetic or fabricated fields permitted.
2. **Rule TA-2 (No Tautological Mocks)**: Unit tests must render the actual feature workbenches (`<MrxDailyIssueWorkbench>`, `<ReconciliationPage>`, etc.) and mock only the network transport layer (`apiClient` / `mrxApi`).
3. **Rule TA-3 (Zero Exemption Padding)**: No `test.skip` or `allowlist` additions permitted.
4. **Rule TA-4 (4-Scenario Behavioral Coverage)**: Every workbench test suite must cover:
   - Success with data (L1)
   - Prerequisite blocked / Empty dataset (L4 / L5)
   - HTTP Error 400/500 with retry (L2)
   - Mutation submission with RBAC `ActionGuard` validation.
5. **Rule TA-5 (Zero Fake API Data)**: Production API files in `frontend/src/api/*.ts` must contain zero hardcoded dummy records, zero baseline fallbacks, and zero error-swallowing `try/catch` blocks.
