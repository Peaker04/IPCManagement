# Spec: Session-Persisted SWR & Critical Root CSS Architecture (Cold-Start & Zero-Flash)

**Date:** 2026-10-28  
**Subsystem:** Frontend Foundation (`HTML Shell`, `serverStateCache`, `StateBoundary`, `AppShell`)  
**Target Routes:** All 14 canonical routes and 25 surfaces (with immediate impact on `/login`, `/reconciliation`, and MRX stations)

---

## 1. Context & Root Cause Analysis

### 1.1 The FOUC & Black Frame Flash (0ms - 150ms)
In Vite development mode, stylesheets (`import './styles/index.css'`) are bundled and delivered as dynamic JavaScript modules. Before `main.tsx` is parsed and executed:
1. `index.html` has no CSS in `<head>`.
2. The browser renders the bare HTML with User Agent defaults (`body { margin: 8px; }`).
3. In browsers with Dark Mode / Dark Theme enabled (Brave, Chromium Dark, Windows High Contrast), the un-styled document canvas initializes with a dark or high-contrast window border (`0, 0, 0` at viewport margins).
4. When `main.tsx` loads, it injects Tailwind CSS and sets `body { margin: 0; background-color: #f8fafc; }`, causing an abrupt margin snap (from 8px to 0px) and a color inversion from black border to light canvas.

### 1.2 The 3-Step Cold Refresh Strobe (0ms - 300ms)
In modern Single Page Applications, navigating between client routes is instant because memory state persists. However, when the operator presses **F5** or **Ctrl+Shift+R**:
1. JavaScript memory is destroyed. `serverStateCache` (implemented as an in-memory `Map`) is completely purged.
2. Render #1 of the refreshed route starts with `hasHydratedData = false` and `isLoading = true`.
3. `StateBoundary.tsx` currently applies a 2-hop transition:
   - Phase 1 (0ms - 150ms): Renders an empty white `div` (`<div className="bg-white" />`) to prevent skeleton flicker.
   - Phase 2 (150ms - 250ms): Replaces the white `div` with `<WorkbenchSkeleton />` table rows with animated pulse bars.
   - Phase 3 (250ms+): API data returns; the skeleton is replaced by `<DataGrid />`.
4. The human eye perceives this rapid triple-hop (`White Screen` $\rightarrow$ `Skeleton Flash` $\rightarrow$ `Real Table`) as a jarring layout shift and flash.

---

## 2. Requirements & Invariants

- **INV-SHELL-COLOR-SCHEME**: `index.html` must declare `<meta name="color-scheme" content="light">` and inlined critical styles so that frame 0 (0ms) renders with `margin: 0` and `background-color: #f8fafc` before any JavaScript is parsed.
- **INV-L2-SESSION-CACHE**: `serverStateCache` must implement dual-tier caching: Tier 1 (In-Memory Map) backed by Tier 2 (`sessionStorage`). Hard refreshes (F5) must synchronously hydrate Render #1 with the last seen route state in 0ms.
- **INV-ZERO-STROBE**: `StateBoundary.tsx` must never transition through an intermediary blank white screen before a skeleton. If existing data is present from L2 cache, it must immediately render the cached data and perform a silent SWR revalidation. If it is a true brand-new cold start with zero session cache, it must render the geometry-matched skeleton directly.
- **INV-MODE-ISOLATION**: Session cache entries must respect `DOM-MODE-1`. DEFAULT cache items must never leak into MRX operational mode.

---

## 3. Architecture Specification

### 3.1 Layer 1: Critical Root CSS in `frontend/index.html`
Inlined in `<head>`:
```html
<meta name="color-scheme" content="light" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    background-color: #f8fafc;
    color: #1e293b;
    color-scheme: light;
    -webkit-font-smoothing: antialiased;
  }
  #root {
    height: 100%;
    width: 100%;
    background-color: #f8fafc;
  }
</style>
```

### 3.2 Layer 2: Dual-Tier L1/L2 `serverStateCache.ts`
- **Prefix**: `ipc_mrx_l2_cache` in `sessionStorage`.
- **Hydration**: On class instantiation, `serverStateCache` scans `sessionStorage` and populates the in-memory `Map`.
- **Set**: When `serverStateCache.set(key, data)` is called:
  - Updates the in-memory `Map`.
  - If `key` is a snapshot (`snapshot:*`) or a route state (`mrx_*`, `catalog_*`), serializes and writes to `sessionStorage` (with a safe `try/catch` quota guard).
- **Clear**: `clearAllServerCache()` clears both memory and `sessionStorage`.

### 3.3 Layer 3: Unified State Transition in `StateBoundary.tsx`
- Eliminate the arbitrary white `div` shim when `isDeferredLoading` is false.
- When `hasExistingData` is true (hydrated from L1/L2 cache in 0ms):
  - Immediately render children.
  - If `isFetching` is true, apply `opacity-70 transition-opacity duration-150` for silent revalidation.
- When `hasExistingData` is false (cold start without cache):
  - Render `<WorkbenchSkeleton />` directly, preserving header geometry and column layout.

---

## 4. Verification Criteria

1. **Pixel Measurement on Hard Refresh**: Hard refresh on `/login` and `/reconciliation` produces 0 black lines (`r < 30` pixels at margins = 0).
2. **0ms Cold Render #1**: Reloading an active MRX workbench renders the table synchronously on Render #1 without dropping to white screen or flashing skeleton.
3. **Automated Conformance**:
   - `npm run precommit:verify` (100% PASS).
   - `npx playwright test` (63/63 browser tests PASS).
