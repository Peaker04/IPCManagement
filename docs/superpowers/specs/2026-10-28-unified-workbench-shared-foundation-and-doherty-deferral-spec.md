# Spec: Unified Workbench Shared Foundation & NN/g Doherty Deferral Architecture

**Date:** 2026-10-28  
**Subsystem:** Frontend Workbench Framework (`components/workbench/*`, `hooks/*`, `features/*`)  
**Scope:** All Material Reconciliation (MRX) Stations and Shared Surfaces (`DOM-MODE-1`)

---

## 1. Context & Identified Defects

### 1.1 The Rapid Skeleton Flicker (Chớp nháy nhanh dưới 150ms)
When a user accesses a station for the first time or triggers a cold query, modern local/high-speed APIs frequently resolve in **60ms – 120ms**. If a skeleton is mounted immediately at 0ms, it flashes onto the screen for a fraction of a second and disappears abruptly. This creates noticeable visual noise and perceived sluggishness.
- **NN/g Doherty Threshold & SAP Fiori Invariant**: Operations resolving within $\le 150\text{ms}$ must suppress skeleton display. When an operation exceeds 150ms, the skeleton must mount and remain visible for a minimum duration of $\ge 250\text{ms}$ (`minDurationMs`), eliminating rapid perceptual flicker.

### 1.2 Component Fragmentation & Ad-Hoc Inline Coding
Key UI patterns are currently duplicated via raw inline tailwind strings rather than centralized compound components:
- Reserved Badge Slots are manually duplicated with raw classes (`min-w-[110px]`, `min-w-[140px]`, `min-w-[220px]`).
- Header action containers are manually wrapped with `<div className="flex items-center gap-2 shrink-0">`.
- Document Code cells with detail-modal and copy triggers are locally coded inside feature branches.

---

## 2. Architecture Specifications & Shared Components

### 2.1 Centralized `WorkspaceHeader` Compound Slots (`WorkspaceHeader.tsx`)
Extend `WorkspaceHeader` into a compound component with two dedicated slots:

1. **`WorkspaceHeader.BadgeSlot`**:
   ```tsx
   export interface HeaderBadgeSlotProps {
     children?: ReactNode;
     variant?: 'status' | 'metric' | 'mode';
     className?: string;
   }
   ```
   - `variant="status"` (default): `min-w-[110px] h-9 shrink-0 flex items-center` (for operational status badges like `COMPLETED`, `IN_PROGRESS`).
   - `variant="metric"`: `min-w-[140px] h-9 shrink-0 flex items-center` (for counts like `756 nguyên liệu`, `195 món ăn`).
   - `variant="mode"`: `min-w-[220px] h-9 shrink-0 flex items-center` (for mode badges like `Chế độ hiện tại: ...`).
   - Automatically maintains the exact reserved layout slot whether children are present or pending.

2. **`WorkspaceHeader.Actions`**:
   ```tsx
   export interface HeaderActionsProps {
     children: ReactNode;
     className?: string;
   }
   ```
   - Standardizes the action bar container with `h-9 shrink-0 flex items-center gap-2`.

### 2.2 Centralized `DocumentCodeCell` (`DocumentCodeCell.tsx`)
Create `frontend/src/components/workbench/DocumentCodeCell.tsx`:
```tsx
export interface DocumentCodeCellProps {
  code: string;
  onOpenDetail?: (code: string) => void;
  title?: string;
  className?: string;
}
```
- Primary clickable badge: `<FileText size={12} />` + monospace code with underline, clicking triggers `onOpenDetail(code)` to open the detail modal.
- Dedicated copy button: `<Copy size={12} />` (swaps to `<Check size={12} className="text-emerald-600" />` on copy), clicks copy to clipboard with `e.stopPropagation()`.

### 2.3 Strict NN/g Doherty Threshold Deferral in `StateBoundary.tsx`
- Re-wire `useDeferredSkeleton(Boolean(isLoading && !hasExistingData), skeletonDelay, 250)`.
- If `hasExistingData` is true (hydrated from L1/L2 cache in 0ms):
  - Render children immediately; if `isFetching`, apply `opacity-70 transition-opacity duration-150`.
- If `hasExistingData` is false (cold start):
  - During the first 150ms: Do NOT mount `WorkbenchSkeleton`. Maintain a calm empty canvas.
  - If loading takes $> 150\text{ms}$: Mount `WorkbenchSkeleton` and hold for at least 250ms to prevent rapid flicker.

---

## 3. Station Migration Matrix

| Station | Header Badge Slot | Actions Slot | Data Surface |
|---|---|---|---|
| **`/weekly-menu?view=mrx-batch`** | `<WorkspaceHeader.BadgeSlot variant="status">` | `<WorkspaceHeader.Actions>` | `WorkspaceFrame.Body` |
| **`/warehouse?view=mrx-daily`** | `<WorkspaceHeader.BadgeSlot variant="status">` | `<WorkspaceHeader.Actions>` | `WorkspaceFrame.Body` |
| **`/warehouse?view=mrx-preparation`** | — | `<WorkspaceHeader.Actions>` | `WorkspaceFrame.Body` |
| **`/warehouse?view=mrx-issues`** | — | `<WorkspaceHeader.Actions>` | `WorkspaceFrame.Body` |
| **`/chef?view=mrx-cooking`** | `<WorkspaceHeader.BadgeSlot variant="status">` | `<WorkspaceHeader.Actions>` | `WorkspaceFrame.Body` |
| **`/reconciliation`** | `<WorkspaceHeader.BadgeSlot variant="status">` | `<WorkspaceHeader.Actions>` | `WorkspaceFrame.Body` |
| **`/admin-data`** | `<WorkspaceHeader.BadgeSlot variant="metric">` | `<WorkspaceHeader.Actions>` | `WorkspaceFrame.Body` |
| **`/settings/advanced`** | `<WorkspaceHeader.BadgeSlot variant="mode">` | `<WorkspaceHeader.Actions>` | `WorkspaceFrame.Body` |

---

## 4. Verification Invariants

1. **NN/g Threshold Test**: Cold queries resolving in $< 150\text{ms}$ produce 0 skeleton active frames.
2. **Zero-Jitter Test**: Headers maintain fixed 56px height, and badge mounting causes 0px element shift.
3. **Pre-commit Gate**: 100% PASS on `npm run precommit:verify` (220+ Vitest tests).
4. **Playwright E2E**: 63/63 tests PASS.
5. **Architecture Growth**: 0 FE files > 600 lines.
