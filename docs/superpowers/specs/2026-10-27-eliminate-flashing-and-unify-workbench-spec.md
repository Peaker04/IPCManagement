# Spec: Eliminate Flashing & Unify Workbench Architecture

- **Scope:** All 14 Canonical Routes & 25 Surfaces in IPCManagement
- **Objective:** Eliminate the flashing "khung xanh" (2px top micro-progress bar & premature green badges), enforce visual token stability, unify 3-zone presentation without intrusive banners, and guarantee zero-strobe initial loading across the entire application.
- **Standards:** SAP Fiori 3.0 / IBM Carbon / NN/g (150ms Doherty Threshold) / SWR Quiet Revalidation / Zero-CLS Enterprise Design.
- **Architecture Limits:** Strictly $\le 600$ lines per FE source file; strictly $\le 1500$ lines per test file (`scripts/check-architecture-growth.mjs`).

---

## 1. Problem Statement & Functional Requirements

1. **Flashing "Khung Xanh" (Indigo 2px Micro-Bar):** In `StateBoundary.tsx`, a 2px top gradient bar (`bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400`) flashed across the screen whenever `isFetching && hasExistingData` was true, creating an annoying flashing blue/green frame during initial revalidation.
2. **Premature Green Badge Flashing:** In `ReconciliationLifecycleStrip.tsx` and `ReconciliationPage.tsx`, status badges rendered `variant="success"` (`bg-emerald-100 border border-emerald-300`) from previous completed batch snapshots for 50ms before flipping to `info` (`bg-blue-100`) or hiding, causing a visible green box to flash and disappear.
3. **Banner Insertion Jitter:** In `MrxDailyIssueWorkbench.tsx` and `MrxMultiCustomerPreparationWorkbench.tsx`, conditional banners inserted between the subbar and the table pushed the table down by 36px–40px after initial render.
4. **Initial-Load Waterfall Glitch:** In `ReconciliationPage.tsx`, sequential `useEffect` dependencies (`getCustomers` $\rightarrow$ `getBatchPage` $\rightarrow$ `getBatchSummary`) briefly evaluated `isEmpty = true` for 20ms during bootstrap before the batch ID was resolved.

---

## 2. Design Invariants & Contracts

### 2.1. Eradicate Canvas Micro-Bar Flashes
- Remove the 2px full-width top micro-progress bar from `StateBoundary.tsx`.
- Quiet operational philosophy: SWR background revalidations remain completely silent on the data canvas.
- Visual indication of network activity is strictly confined to the calm spinning `RotateCw` icon on the "Làm mới" button in the WorkspaceHeader, leaving the DataGrid table canvas completely still and calm.

### 2.2. Visual Token Stability & Badge Hysteresis
- Do not render premature green success badges (`variant="success"`) on Render #1 if the batch data is currently in flight or unverified.
- Master status badges in Row 1 of WorkspaceHeader and lifecycle steppers remain in calm neutral tones (`slate-100/200`) until the authoritative API response is received.

### 2.3. Zero-Banner Canvas Invariant
- DataGrid tables start immediately below the 44px TelemetrySubbar across all workbenches without intermediate conditional banners pushing them down.
- Informational notes belong inside `telemetryPills` in the Subbar or inside accessible modal drawers.

### 2.4. Atomic Bootstrapping Precedence
- During initial bootstrap (when customers or batch lists are resolving from network), `isLoading` is strictly `true` and `isEmpty` is strictly `false`.
- Empty state notices are only permitted after network calls have completed and authoritatively verified that the database record count is 0.

---

## 3. Verification Criteria

1. Zero occurrences of the 2px gradient micro-bar in `StateBoundary.tsx`.
2. Zero flashes of green success badges on cold load or batch transitions.
3. Zero intermediate banners inserted between TelemetrySubbar and DataGrid.
4. 0 files $> 600$ lines.
5. All 24 Vitest test files pass 100%.
6. All 63 Playwright browser tests pass 100%.
7. All 1,419 Backend C# tests pass 100%.
