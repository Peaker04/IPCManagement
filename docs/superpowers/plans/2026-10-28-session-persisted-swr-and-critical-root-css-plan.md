# Session-Persisted SWR & Critical Root CSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eradicate cold-start dark frame flashes and multi-hop skeleton flickering during F5/Ctrl+Shift+R reloads by enforcing critical inlined root CSS and dual-tier (L1 Memory + L2 SessionStorage) SWR cache hydration across all canonical routes.

**Architecture:** 
1. Inlined critical CSS and `<meta name="color-scheme" content="light">` in `index.html` to eliminate FOUC, User Agent margin jumps (8px to 0px), and dark-theme browser canvas borders.
2. Dual-tier `serverStateCache`: Memory `Map` (L1) backed by `sessionStorage` (L2) to provide synchronous 0ms Render #1 cache hydration across browser reloads.
3. Streamlined `StateBoundary`: Remove the empty white `div` fallback, enforce direct cached-data rendering with silent opacity revalidation, and prevent cascading layout shifts.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-session-persisted-swr-and-critical-root-css-spec.md`

## Global Constraints
- `node scripts/check-architecture-growth.mjs` must pass: 0 FE files > 600 lines, test files <= 1500 lines.
- `DOM-MODE-1`: Strict isolation between DEFAULT and MATERIAL_RECONCILIATION modes in session cache keys.
- Single styling authority: Semantic tokens in `index.css`, zero external tokens or ad-hoc inline color overrides.
- No synthetic test mocks or relaxed assertions.

## Review Focus
1. **F5 / Hard Refresh on `/login`**: Must never show black outline or margin jumps (`minX: 0..15`, `minY: 53..57` black pixels = 0).
2. **F5 / Hard Refresh on `/reconciliation`**: Must synchronously render existing table data on Render #1 from L2 session cache in 0ms without flashing white div or skeleton.
3. **SessionStorage Quota Safety**: L2 cache writing must be wrapped in safe quota guards to prevent uncaught quota exceeded exceptions on large datasets.
4. **Logout & Mode Switching**: Calling `clearAllServerCache()` or switching operational modes must cleanly purge both L1 and L2 caches.
5. **Brand-New Cold Start**: When opening a brand-new tab with no prior session cache, `StateBoundary` must render `WorkbenchSkeleton` directly without a jarring white flash hop.

---

### Task 1: Inlined Critical Root CSS & Color Scheme in `index.html`

**Files:**
- Modify: `frontend/index.html`
- Test: `scripts/test-all-cold-starts.mjs`

- [ ] **Step 1: Write verification test for document root styles**
  Ensure automated test verifies that document root has `color-scheme: light` and zero margin on initial parse.
- [ ] **Step 2: Add critical inlined style and meta color-scheme in `frontend/index.html`**
  Add `<meta name="color-scheme" content="light" />` and inline `<style>` setting `html, body { margin: 0; padding: 0; height: 100%; width: 100%; background-color: #f8fafc; color: #1e293b; color-scheme: light; } #root { height: 100%; width: 100%; background-color: #f8fafc; }`.
- [ ] **Step 3: Verify with Playwright frame capture**
  Run frame capture at 0ms and verify that black margin lines (`minX: 0..15`, `minY: 53..57`) are completely gone.

---

### Task 2: Dual-Tier L1/L2 Cache in `serverStateCache.ts`

**Files:**
- Modify: `frontend/src/store/serverStateCache.ts`
- Test: `frontend/src/__tests__/Render1CacheHitVerification.test.tsx`

- [ ] **Step 1: Write unit tests for L2 session storage persistence & hydration**
  Add test in `Render1CacheHitVerification.test.tsx` proving that instantiating or reading `serverStateCache` after a simulated page reload (where memory is wiped but `sessionStorage` has items) synchronously returns the cached entry in 0ms.
- [ ] **Step 2: Implement L2 sessionStorage backing in `serverStateCache.ts`**
  - Add `loadFromSessionStorage()` on startup to rehydrate critical snapshots (`snapshot:*`, `mrx_*`, `catalog_*`).
  - Add safe `saveToSessionStorage(key, entry)` with quota guard (`try/catch`).
  - Update `clear()` and `clearAllServerCache()` to purge both memory map and `sessionStorage` items prefixed with `ipc_mrx_l2_cache`.
- [ ] **Step 3: Run Vitest unit tests**
  Execute `npm run test:fe:unit -- src/__tests__/Render1CacheHitVerification.test.tsx` and confirm 100% PASS.

---

### Task 3: Streamline `StateBoundary.tsx` to Eradicate 2-Hop Strobe

**Files:**
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

- [ ] **Step 1: Update unit tests for StateBoundary loading behavior**
  Verify that when `hasExistingData` is true, `StateBoundary` never renders the white canvas or skeleton.
- [ ] **Step 2: Remove the empty white `div` fallback in `StateBoundary.tsx`**
  - When `hasExistingData` is true: render children immediately with `opacity-70` when `isFetching` or `isPreviousData` is active.
  - When `hasExistingData` is false: render `WorkbenchSkeleton` directly, suppressing the intermediate blank white div.
- [ ] **Step 3: Verify Primitives test suite**
  Run `npm run test:fe:unit -- src/__tests__/Primitives.test.tsx` and verify all tests pass.

---

### Task 4: Full Stack Verification & Regression Audit

**Files:**
- Test: `frontend/tests/browser/conformance-runtime.spec.ts`
- Test: `frontend/tests/browser/loading-ux-async-consistency.spec.ts`
- Test: `scripts/verify-precommit-gate.mjs`

- [ ] **Step 1: Run pre-commit quality gate**
  Run `npm run precommit:verify` (Gate A through Gate E: 28 test files / 218 tests).
- [ ] **Step 2: Run Playwright browser test suite**
  Run `npx playwright test` to verify all 63 browser tests pass without regression.
- [ ] **Step 3: Verify architecture growth limits**
  Run `node scripts/check-architecture-growth.mjs` to ensure 0 FE files > 600 lines.
