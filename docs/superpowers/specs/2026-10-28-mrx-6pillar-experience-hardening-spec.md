# Spec: MRX 6-Pillar Experience Hardening Architecture

**Date:** 2026-10-28  
**Subsystem:** Material Reconciliation Subsystem (`FR-DASH`, `FR-RECON`, `FR-MENU`, `FR-WH`, `FR-CHEF`, `FR-CAT`, `FR-SYS`)  
**Scope:** Landing Flow, Contextual Empty-State Icons, Scrollbar Gutter, Top-Bar Geometry, Clean Sidebar IA, Microcopy Trimming, and Shared Constants (`DOM-MODE-1`)

---

## 1. Domain & Problem Analysis

1. **Contextual Empty-State Icons**: Currently, `StateBoundary.tsx` and `DataGrid.tsx` hardcode `<Inbox />` across every screen. Seeing an email inbox tray on warehouse batches, preparation allocations, or chef cooking stations violates domain ergonomics. Each domain must display its authoritative Lucide icon (`Boxes`, `Warehouse`, `ChefHat`, `Scale`, `SearchX`, `FileClock`).
2. **Login Landing Destination**: `resolveLandingPath()` in `navigationEligibility.ts` explicitly excludes `/` in MRX mode via `(mode !== 'MATERIAL_RECONCILIATION' || route.path !== '/')`, forcing users upon login to jump directly to `/weekly-menu?view=mrx-batch` instead of the executive Dashboard `/`.
3. **Inter-Page Layout Shifts**:
   - **Horizontal Jitter (17px)**: Missing `scrollbar-gutter: stable` in `index.css` causes the browser's 17px vertical scrollbar to pop in and out between short and tall pages, shifting tables and buttons horizontally.
   - **Vertical Accordion (56px $\leftrightarrow$ 100px $\leftrightarrow$ 148px)**: Prep/Issues stations have only 56px (no Subbar), while Reconciliation has 148px (Header + Queue + Subbar), causing the canvas to bounce vertically during navigation.
4. **Sidebar Nested v2**:
   - Leaves must remain text-only under the vertical guide line (no icons on leaves).
   - Sidebar disclosure groups must default to collapsed, auto-expanding only the group containing the currently active route.
   - Titles must reflect the closed-loop MRX lifecycle.
5. **Verbose Microcopy**: Overly verbose explanations (e.g. *"· Nhật ký append-only ghi nhận từng lần kho xuất và bếp hoàn trả"*) clutter the interface and must be distilled into concise enterprise labels (4–7 words).
6. **Hardcoded Duplication**: `STATUS_LABELS`, shift labels, and badge color mappings are copy-pasted across multiple feature files.

---

## 2. Invariants & Architecture Specifications

- **`INV-CONTEXTUAL-EMPTY-ICONS`**: `StateBoundary.tsx` and `DataGrid.tsx` must render domain-specific icons based on `emptyScenario` or explicit `emptyIcon` prop:
  - Batch / Allocation / Preparation: `<Boxes />` or `<PackageOpen />`
  - Warehouse / Inventory issues: `<Warehouse />`
  - Chef / Cooking / Dishes: `<ChefHat />`
  - Reconciliation / Variances / Audit: `<Scale />`
  - Search / Filter empty: `<SearchX />`
  - Prerequisite / Pending: `<FileClock />`
- **`INV-MRX-ROOT-LANDING`**: `resolveLandingPath()` must return `/` for all authenticated roles in `MATERIAL_RECONCILIATION` mode so that login opens `ReconciliationDashboardPage`.
- **`INV-SCROLLBAR-GUTTER`**: `index.css` must declare `scrollbar-gutter: stable;` on `html` and root scrollable containers to permanently reserve 17px scrollbar space.
- **`INV-TOPBAR-100PX-HARMONY`**: All MRX operational stations must adhere to a uniform 100px top-bar height: Zone 1 (Header 56px) + Zone 2 (Subbar 44px).
- **`INV-TEXT-ONLY-LEAVES`**: Sidebar leaves must not contain icons, preserving clean hierarchy under the vertical guideline.
- **`INV-CENTRAL-CONSTANTS`**: `frontend/src/constants/mrxConstants.ts` must serve as the single authority for `MRX_STATUS_LABELS`, `MRX_STATUS_VARIANTS`, and `SHIFT_OPTIONS`.

---

## 3. Station Implementation Specifications

### 3.1 Contextual Empty States in `StateBoundary.tsx`
```tsx
function resolveEmptyIcon(scenario?: EmptyScenario, customIcon?: LucideIcon): LucideIcon {
  if (customIcon) return customIcon;
  switch (scenario) {
    case 'filter-empty': return SearchX;
    case 'prerequisite-blocked': return FileClock;
    case 'empty-permission': return ShieldAlert;
    default: return Boxes;
  }
}
```

### 3.2 Landing Resolution in `navigationEligibility.ts`
```ts
export function resolveLandingPath(
  routes: RouteDef[],
  actor: NavigationActor,
  mode: OperationalMode
): string {
  if (mode === 'MATERIAL_RECONCILIATION') {
    return '/';
  }
  const destination = resolveEligibleNavigation(routes, actor, mode)
    .find((route) => route.path !== '/login' && route.path !== '/forbidden');
  return destination?.leaves?.[0]?.to ?? destination?.path ?? '/forbidden';
}
```

### 3.3 Scrollbar Gutter in `frontend/src/styles/index.css`
```css
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  scrollbar-gutter: stable;
  ...
}
```

### 3.4 Centralized Constants in `frontend/src/constants/mrxConstants.ts`
Export `MRX_STATUS_LABELS`, `MRX_STATUS_VARIANTS`, and `MRX_SHIFT_LABELS`.

---

## 4. Verification Criteria

1. **Login Test**: Logging in as admin in `MATERIAL_RECONCILIATION` lands at `http://127.0.0.1:5173/` (`ReconciliationDashboardPage`).
2. **Contextual Icon Test**: Empty states on Warehouse Preparation show `<Boxes />`, not `<Inbox />`.
3. **Scrollbar Jitter Test**: Navigating between 1-row table and 50-row table produces 0px horizontal shift.
4. **Pre-commit Gate**: 100% PASS on `npm run precommit:verify` (221+ Vitest tests).
5. **Playwright E2E**: 63/63 tests PASS.
