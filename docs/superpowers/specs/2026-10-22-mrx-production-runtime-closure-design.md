# MRX Production Runtime Closure & Industrial UX Architecture Design

**Date:** 2026-10-22  
**Status:** Approved by Owner (Option 2 — Industrial Standard & Full UI Closure with Anti-AI Slop Mandate)  
**Authors:** Senior Systems Architect & Frontend Conformance Auditor  
**Related Specs & Plans:**
- `docs/superpowers/specs/2026-10-18-frontend-runtime-conformance-remediation-design.md`
- `docs/superpowers/specs/2026-10-18-mrx-production-vertical-slice-design.md`
- `docs/domain/material-reconciliation.md`
- `docs/DESIGN.md`, `docs/UI-KIT.md`, `AGENTS.md`

---

## 1. Context & Executive Summary

The backend foundations, relational migrations (MySQL 9.5), and automated test suites (`1,406` backend tests, `146` frontend unit tests) pass 100%. However, direct, unvarnished Playwright browser inspection and codebase analysis revealed four critical gaps between the declared architecture and real-world runtime behavior:

1. **URL Eligibility Defect (`navigationEligibility.ts`)**:
   - `isRouteEligible` performed naive string equality (`leaf.to === target`), immediately causing false 403 Forbidden redirects when users navigated to canonical base paths (`/admin-data`, `/settings/advanced`, `/warehouse`, `/chef`, `/reports`, `/weekly-menu`) or whenever a component legitimately attached operational query parameters (`&batchId=...&date=...`).
2. **Orphaned Capabilities (Missing UI Surfaces)**:
   - **5 Operational Queues**: `GET /api/reconciliation/reports/operational-summary` calculates real-time counts from MySQL (pending source changes, batches awaiting warehouse, pending deltas, unresolved variances, completion-ready batches), but zero frontend components currently display or link to them.
   - **Completed Batch Register**: `GET /api/reconciliation/reports/completed-register` exists with CSV export, but `ReconciliationReportTables.tsx` only offers 3 tabs, omitting the completed register from manager access.
   - **Warehouse Preparation & Discrepancies**: `MrxMultiCustomerPreparationWorkbench` lacks an in-screen date selector when accessed without a pre-set URL query, and `MrxSourceDeltaWorkbench` auto-submits exact delta quantities without an input interface for warehouse staff to report actual physical received/issued discrepancies.
3. **Orphaned Runtime Engine (`useScopedQuery` & `loadingGeometry`)**:
   - `useScopedQuery` in `scopedQuery.ts` was implemented and tested in isolation, but zero production feature pages adopted it. Pages still rely on fragmented `useEffect` + `useRef` + `useState` logic.
   - `loadingGeometry` in `StateBoundary.tsx` is ignored by production pages, falling back to generic loading states.
4. **Accessibility (WCAG 2.2 AA) & Responsiveness**:
   - `Modal.tsx` lacks a complete focus trap (Tab key escapes the modal) and does not return focus to the trigger element on close.
   - `SplitView.tsx` lacks responsive tablet breakpoints (768px–1024px) and collapsible panel mechanisms.

---

## 2. Strict Anti-AI Slop Mandate (Bộ Quy Chuẩn Chống AI Slop & Lừa Dối Kiểm Thử)

To ensure this project reflects true industrial engineering rather than superficial AI-generated artifacts, every line of code, design choice, and verification step MUST strictly adhere to the following 5 Anti-Slop Invariants:

### Rule SLOP-1: Zero Orphaned Code & Zero Placebo Stubs (Cấm mã mồ côi & stub bù nhìn)
- Every utility, hook, class, component, or service added MUST be actively imported, wired up, and executed in production user flows.
- Any code that only exists to be imported by its own unit test (e.g., building a query hook or skeleton prop that no real page calls) is classified as **AI SLOP** and is strictly prohibited.
- Functions must perform real work: no dummy `return { success: true }`, no swallow-and-ignore catch blocks, and no unused parameters left dangling.

### Rule SLOP-2: Anti-Tautology & Anti-Fake Green (Cấm test tự biên tự diễn)
- Tests must verify observable user behavior and durable contracts at the strongest public boundary.
- **Never mock the component, custom hook, or state boundary under test**. Mocks are permitted ONLY at the network transport boundary (HTTP fetch / `apiClient`).
- Tests must assert exact business fields, real DTO shapes, and rendered DOM nodes. Never use broad, fuzzy assertions (e.g. `expect(res).toBeDefined()`, regex matching any single character) to manufacture artificial passes.
- **Zero Allowlist Padding**: Absolutely no modifying allowlists, padding test baselines, or adding `test.skip`/`test.todo` to bypass failures. A failure requires a root-cause fix in product code.

### Rule SLOP-3: No Synthetic API Fallbacks (Cấm fallback dữ liệu ảo trong API clients)
- All files in `frontend/src/api/*.ts` must connect strictly to real backend endpoints.
- Absolutely no hardcoded dummy items (`NL-THIT-01`, `Trần Văn B`, dummy prices, mock seeds in production paths).
- When the backend fails or is offline, API clients MUST throw authentic `ApiError` instances so `<StateBoundary>` renders the authentic error state with retry capabilities.

### Rule SLOP-4: Live Browser Reality Gate (Kiểm chứng thực tế trên trình duyệt - Không tin output test runner)
- Test runner output (`npm run verify`, `vitest run`, `dotnet test`) is an advisory signal, **NOT compliance proof**.
- A task is ONLY complete when independently verified in a live Chromium browser against running Kestrel (`http://localhost:5262`) and live MySQL (`localhost:3306/ipcmanagement`):
  1. The page renders the exact 56px WorkspaceHeader, 44px TelemetrySubbar, and DataGrid with sticky headers.
  2. Actual network requests are dispatched and return live data from MySQL.
  3. Real user interactions (clicks, tab switches, modal submissions) execute without console errors or 403 redirects.
  4. Real mutations are verified directly in MySQL tables via SQL queries.

### Rule SLOP-5: Industrial Domain Authenticity (Tính chân thực của nghiệp vụ suất ăn công nghiệp)
- In real-world catering management (Compass Group, Sodexo, Aramark):
  - Warehouse delta handling cannot blindly assume physical quantities match mathematical deltas. Warehouse staff must have the explicit ability to record actual quantities received/issued and mandate variance reasons.
  - The Manager Control Tower must display live counts derived directly from database queries, linking to real work objects.
  - Cooking projections must remain completely sanitized for Chef stations (zero prices, zero stock quantities, zero variance computations).

---

## 3. Invariant Constraints

- **`DOM-MODE-1` Isolation**: `DEFAULT != MATERIAL_RECONCILIATION`. Shared master data and physical stock never merge workflows, commands, queries, lineages, or audit logs.
- **Single Styling Authority**: Zero inline styles or ad-hoc colors outside `frontend/src/styles/index.css` semantic tokens.
- **Transactional & Concurrency Integrity**: Every mutation carries command ID, expected version, and actor audit.
- **Real Runtime Verification**: Work is only considered complete when independently verified on a live Chromium browser against running Kestrel on MySQL.

---

## 4. Architecture & Technical Design

### Layer 1: Resilient Navigation & Route State Engine (`navigationEligibility.ts`)

#### Problem
In React Router 7, a canonical route has a base path (e.g., `/admin-data`, `/warehouse`) and defined operational leaves with view identifiers (e.g., `to: '/admin-data?view=ingredients'`). When a user visits `/admin-data`, `search` is empty. Under current logic, `(!search && leaf.to === pathname)` evaluates to `false` because `'/admin-data?view=ingredients' !== '/admin-data'`. Furthermore, when a view appends operational parameters (`?view=mrx-daily&batchId=abc&date=2026-09-21`), strict comparison against `'/warehouse?view=mrx-daily'` also fails.

#### Solution
Refactor `isRouteEligible` in `frontend/src/routes/navigationEligibility.ts` to implement **view-aware operational parameter matching**:

```ts
export function isRouteEligible(
  routes: RouteDef[],
  pathname: string,
  search: string,
  actor: NavigationActor,
  mode: OperationalMode | null
): boolean {
  const eligibleRoutes = resolveEligibleNavigation(routes, actor, mode);
  const route = eligibleRoutes.find((entry) => entry.path === pathname);
  if (!route) return false;
  if (!route.leaves?.length) return true;

  const currentParams = new URLSearchParams(search);
  const currentView = currentParams.get('view');

  // Case A: No search params provided -> user navigated to base route.
  // Eligible if the route has at least one eligible leaf in the current mode/actor context.
  if (!search || !currentView) {
    return route.leaves.length > 0;
  }

  // Case B: Search params present with a 'view' parameter.
  // Check if any eligible leaf matches this view identifier.
  return route.leaves.some((leaf) => {
    const leafParams = new URLSearchParams(leaf.to.split('?')[1] || '');
    const leafView = leafParams.get('view');
    // If leaf defines a view, it must match currentView.
    // Additional operational params (batchId, date, page, filter) are view-level state.
    if (leafView) return leafView === currentView;
    return leaf.to === pathname;
  });
}
```

#### Automatic Redirection to Default Leaf
In `AppShell.tsx` or route level wrappers: when navigating to a base path with leaves (e.g. `/admin-data`), automatically redirect to the first eligible leaf (e.g. `/admin-data?view=ingredients`) to preserve clean URL states.

---

### Layer 2: Manager Control Tower & Complete Reports Surface

#### 1. 5 Operational Queue Metric Strip on `/reconciliation`
In `ReconciliationPage.tsx`, incorporate a dedicated **Operational Queue Strip** (using the TelemetrySubbar pattern) displaying 5 real-time counts from `mrxApi.getOperationalSummary()`:
1. **Đổi nguồn chờ duyệt** (`pendingSourceChangesCount`): Links to `/weekly-menu?view=mrx-batch`.
2. **Lô chờ xuất kho** (`awaitingWarehouseBatchesCount`): Filters batches with status `READY` / `TRANSFERRED`.
3. **Hàng đợi bù/trả** (`pendingDeltasCount`): Links to `/warehouse?view=mrx-issues`.
4. **Sai lệch chưa giải trình** (`unresolvedVariancesCount`): Filters batches having discrepancies.
5. **Lô sẵn sàng chốt** (`completionReadyBatchesCount`): Filters batches with `weeklyStatus === 'WEEK_COMPLETE'`.

Each card displays the count with an alert-colored badge if $> 0$, and clicking it applies the corresponding filter or navigates directly to the target work object.

#### 2. Completed Batch Register (`completed-register`) Tab
In `ReconciliationReportTables.tsx` and `ReconciliationPage.tsx`:
- Add a 4th tab: `'completed'` (`Danh bạ lô hoàn tất`).
- When active, loads `mrxApi.getCompletedRegister(pageNumber, pageSize)`.
- Renders a DataGrid with columns:
  - `Mã lô`: `<IdentifierText>` (Hex slice)
  - `Khách hàng`: `customerName`
  - `Tuần phục vụ`: `weekStartDate` – `weekEndDate` (formatted `dd/MM/yyyy`)
  - `Nhu cầu (kg)`: `<Num value={totalRequired} />`
  - `Thực xuất (kg)`: `<Num value={totalIssued} />`
  - `Chênh lệch (kg)`: `<Num value={totalVariance} />`
  - `Người chốt`: `<Badge variant="neutral">{completedBy}</Badge>`
  - `Thời điểm chốt`: `completedAt` (formatted in Vietnamese business timezone)
  - `Thao tác`: Button "Tải CSV" calling `/api/reconciliation/reports/completed-register/csv`.

---

### Layer 3: Warehouse Preparation & Delta Execution Completeness

#### 1. Multi-Customer Preparation Date Selector & Route Leaf
- Register `/warehouse?view=mrx-preparation` as a canonical leaf in `routeRegistry.ts` (with label `Chuẩn bị nguyên liệu phối hợp`).
- In `MrxMultiCustomerPreparationWorkbench.tsx`:
  - When `serviceDate` is not passed or empty, provide a top-level `<VietnameseDateInput>` in the WorkspaceHeader, defaulting to tomorrow's business date.
  - Changing the date updates the URL query `date=...` and reloads the multi-customer preparation requirements.

#### 2. Warehouse Delta Discrepancy Recording
In `MrxSourceDeltaWorkbench.tsx`:
- Replace the blind auto-submit with an accessible confirmation dialog `<Modal>`:
  - Displays the expected delta quantity and ingredient name.
  - Allows warehouse staff to enter `actualQuantity` (defaulting to delta quantity).
  - If `actualQuantity !== deltaQuantity`, requires a mandatory `varianceReason`.
  - For `SUPPLEMENTAL_ISSUE`, submits `issuedQty = actualQuantity`.
  - For `RETURN_REQUIRED`, submits `quantity = Math.abs(actualQuantity)`.

---

### Layer 4: Runtime Query Engine & Accessibility Hardening

#### 1. Production Integration of `useScopedQuery`
Refactor `ReportsPage.tsx` and `ReconciliationPage.tsx` to use `useScopedQuery` from `frontend/src/lib/scopedQuery.ts`:
- Replaces custom `useEffect` and `useRef` sequence counters.
- Provides `keepPreviousData: true` during pagination and tab switching to eliminate jarring blank flashes.
- Passes `loadingGeometry` to `<StateBoundary>` based on the route surface:
  - `table` geometry with 6 columns for `ReconciliationPage`.
  - `matrix` geometry for reports.

#### 2. Modal Focus Trap & Restoration (WCAG 2.2 AA)
Update `frontend/src/components/ui/modal.tsx`:
- Capture `document.activeElement` before opening the modal.
- On mount, focus the first focusable element inside the modal.
- Implement Tab key listener:
  - If focus is on the last focusable element and Tab is pressed, wrap focus to the first focusable element.
  - If focus is on the first focusable element and Shift+Tab is pressed, wrap focus to the last focusable element.
- On close, restore focus to the previously active element.

#### 3. SplitView Tablet Responsive Adaptation
Update `frontend/src/components/workbench/SplitView.tsx`:
- Add responsive Tailwind classes:
  - On desktop (`lg:`): Keep side-by-side master/detail (`w-7/12` and `flex-1`).
  - On tablet/mobile (`< lg`): When detail is active (`hasActiveDetail: boolean`), hide the master column and render the detail panel full width, with a prominent "Quay lại danh sách" (Back) button at the top.

---

## 5. Verification & Testing Strategy

No task is complete without dual-level verification:

1. **Unit & Contract Level**:
   - `vitest run` on all affected test suites.
   - Zero mocked components under test.
   - Zero allowlist padding.
2. **Live Runtime Browser Level (Playwright)**:
   - Dedicated Playwright E2E spec running against live Vite (`http://127.0.0.1:5173`) and Kestrel (`http://127.0.0.1:5262`).
   - Verifies:
     - Navigating to `/admin-data`, `/settings/advanced`, `/warehouse`, `/chef`, `/reports` loads the default leaf with HTTP 200 / DOM visible, zero 403s.
     - Appending `&batchId=...&date=...` renders the workbench cleanly.
     - 5 queue cards render on `/reconciliation` with real counts.
     - Tab switching between all 4 report tables works smoothly.
     - Modal focus trap holds Tab key.
     - SplitView renders correctly on tablet viewport (768px).

---

## 6. Rollback & Migration Safety

- **Zero DB Schema Changes**: All required database columns and tables exist and are tested.
- **Additive Frontend Changes**: All changes enhance existing components without breaking backend API contracts.
- **Single Source of Truth**: All progress tracked in `.planning/WORK.md`.
