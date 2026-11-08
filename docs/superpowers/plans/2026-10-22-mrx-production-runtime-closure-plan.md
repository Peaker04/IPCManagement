# MRX Production Runtime Closure & Industrial UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix live navigation 403 blocks, close orphaned operational capabilities (5 queues, completed register, prep date selection, delta discrepancy dialog), connect `useScopedQuery` into feature pages, and deliver accessible, tablet-ready enterprise workbenches verified on live Chromium without AI Slop.

**Architecture:** Implement view-aware query parameter matching in `navigationEligibility.ts` with clean base path redirection. Connect real backend operational endpoints into UI workbenches. Wire zero-dependency `useScopedQuery` into production pages for smooth transitions without layout shifts. Harden `Modal.tsx` with a WCAG 2.2 AA focus trap and make `SplitView.tsx` responsive on tablets.

**Tech Stack:** React 19, TypeScript, React Router 7, Vite, Tailwind CSS 4, Vitest, Playwright, ASP.NET Core 9 Web API, MySQL 9.5.

**Spec:** `docs/superpowers/specs/2026-10-22-mrx-production-runtime-closure-design.md`

## Global Anti-AI Slop Mandates & Constraints

- **Rule SLOP-1 (No Orphaned Code)**: Every utility, hook, or component MUST be imported and rendered in production user flows. Zero standalone unused stubs.
- **Rule SLOP-2 (No Tautological Tests)**: No mocking components or custom hooks under test. Assert exact DTO shapes and DOM nodes. Zero allowlist/baseline padding.
- **Rule SLOP-3 (No Synthetic Fallbacks)**: Zero mock/dummy data in `src/api/*.ts`. Failed requests MUST throw authentic `ApiError`.
- **Rule SLOP-4 (Live Browser Reality Gate)**: No task is complete based only on `npm run verify` or CLI test outputs. Every task must be verified on live Chromium with Kestrel and MySQL running.
- **Rule SLOP-5 (Domain Authenticity)**: Real industrial catering workflows: warehouse staff can enter physical counts and variance reasons; management queues derive strictly from MySQL queries.
- **`DOM-MODE-1` Isolation**: Operational modes `DEFAULT` and `MATERIAL_RECONCILIATION` never mix commands, queries, lineages, or audit logs.
- **Single Styling Authority**: Zero ad-hoc colors or inline styles outside `frontend/src/styles/index.css` semantic tokens.

---

### Task 1: Repair Route Eligibility and Base Path Resolution

**Files:**
- Modify: `frontend/src/routes/navigationEligibility.ts`
- Modify: `frontend/src/components/workbench/AppShell.tsx`
- Test: `frontend/src/__tests__/AppShell.test.tsx`

**Anti-Slop Prohibition:** Do NOT bypass `isRouteEligible` with an `isAdmin` or hardcoded path escape hatch. Do NOT hardcode URL strings in component-level guards.

**Evidence Requirement:** Playwright browser test navigates to base paths (`/admin-data`, `/settings/advanced`) and query paths (`/warehouse?view=mrx-daily&batchId=b2d7e7be&date=2026-09-21`) without a single 403 redirect.

- [x] **Step 1: Write failing unit test for view-aware and query-parameter route matching**
  In `frontend/src/__tests__/AppShell.test.tsx`, add test cases proving:
  - Base route `/admin-data` without search is eligible when the user has access to its leaves.
  - Operational route `/warehouse?view=mrx-daily&batchId=123&date=2026-09-21` is eligible.
  - Operational route `/chef?view=mrx-cooking&batchId=abc` is eligible.
  - Unknown view `/warehouse?view=unknown-view` is rejected (`false`).

- [x] **Step 2: Run test to observe failure (RED)**
  Run: `npm run test:unit -w frontend -- AppShell.test.tsx`
  Verify the test fails on `isRouteEligible`.

- [x] **Step 3: Implement view-aware route eligibility**
  In `frontend/src/routes/navigationEligibility.ts`:
  - When `!search || !currentView`, check if the route has at least one eligible leaf in the current mode/actor context.
  - When `currentView` is present, match against the leaf's declared `view` query parameter, ignoring additional operational parameters (`batchId`, `date`, `page`).

- [x] **Step 4: Run test to verify success (GREEN)**
  Run: `npm run test:unit -w frontend -- AppShell.test.tsx`
  Verify all tests pass.

- [x] **Step 5: Verify live in browser (Live Reality Gate)**
  Navigate via Playwright to `/admin-data`, `/settings/advanced`, `/warehouse?view=mrx-daily&batchId=b2d7e7be-6be0-40bd-8409-d4cc1bd5471d&date=2026-09-21`, and `/chef?view=mrx-cooking&batchId=b2d7e7be-6be0-40bd-8409-d4cc1bd5471d`.
  Verify zero 403 redirects and headers render properly.

---

### Task 2: Build 5 Operational Queue Metric Strip on `/reconciliation`

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Anti-Slop Prohibition:** Do NOT hardcode dummy badge counts or mock values. The numbers MUST come from `mrxApi.getOperationalSummary()` which queries real MySQL rows.

**Evidence Requirement:** Headless Chromium renders the 5 metric cards on `/reconciliation` with real numbers from MySQL. Clicking each card changes filters or navigates to the target work object.

- [x] **Step 1: Write failing test for Operational Queue Strip**
  In `frontend/src/__tests__/Reconciliation.test.tsx`, assert that `/reconciliation` renders the 5 operational metric cards:
  - "Đổi nguồn chờ duyệt" (`pendingSourceChangesCount`)
  - "Lô chờ xuất kho" (`awaitingWarehouseBatchesCount`)
  - "Hàng đợi bù/trả" (`pendingDeltasCount`)
  - "Sai lệch chưa giải trình" (`unresolvedVariancesCount`)
  - "Lô sẵn sàng chốt" (`completionReadyBatchesCount`)
  and clicking a card updates filters or triggers navigation.

- [x] **Step 2: Run test to observe failure (RED)**
  Run: `npm run test:unit -w frontend -- Reconciliation.test.tsx`

- [x] **Step 3: Implement Queue Strip in `ReconciliationPage.tsx`**
  - Call `mrxApi.getOperationalSummary()` on page load.
  - Render the 5 metric cards inside `TelemetrySubbar` or dedicated metric row.
  - Clicking on a metric applies the matching filter or navigates to the target work object.

- [x] **Step 4: Run test to verify success (GREEN)**
  Run: `npm run test:unit -w frontend -- Reconciliation.test.tsx`

- [x] **Step 5: Verify live on browser (Live Reality Gate)**
  Check `/reconciliation` in headless Chromium. Verify the 5 cards render with live numbers from MySQL.

---

### Task 3: Implement Completed Batch Register Tab (`completed-register`)

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Anti-Slop Prohibition:** Do NOT fabricate placeholder completed batches. Data must load from `GET /api/reconciliation/reports/completed-register` and CSV export button must trigger the real backend CSV endpoint.

**Evidence Requirement:** Browser renders the 4th tab on `/reconciliation`, loads the real batch `b2d7e7be-...` completed in MySQL with exact actor `4c90da94-...` (Manager), and CSV download succeeds.

- [x] **Step 1: Write failing test for Completed Register Tab**
  In `frontend/src/__tests__/Reconciliation.test.tsx`, assert that `ReconciliationPage` renders a 4th tab `'completed'` ("Danh bạ lô hoàn tất"), displays paged completed batches, and provides a "Tải CSV Danh bạ hoàn tất" button.

- [x] **Step 2: Run test to observe failure (RED)**
  Run: `npm run test:unit -w frontend -- Reconciliation.test.tsx`

- [x] **Step 3: Implement Completed Register Tab**
  - In `ReconciliationPage.tsx`, add tab `'completed'` to the subbar switcher.
  - When active, load `mrxApi.getCompletedRegister(pageNumber, 50)`.
  - In `ReconciliationReportTables.tsx`, render the table with columns: Mã lô, Khách hàng, Tuần, Nhu cầu (kg), Thực xuất (kg), Chênh lệch (kg), Người chốt, Thời điểm chốt, and CSV download button.

- [x] **Step 4: Run test to verify success (GREEN)**
  Run: `npm run test:unit -w frontend -- Reconciliation.test.tsx`

- [x] **Step 5: Verify live on browser (Live Reality Gate)**
  Switch to `'completed'` tab on `/reconciliation` in Chromium and verify real completed batch rows are displayed.

---

### Task 4: Multi-Customer Preparation Route Leaf and In-Screen Date Selector

**Files:**
- Modify: `frontend/src/routes/routeRegistry.ts`
- Modify: `frontend/src/features/warehouse/WarehousePage.tsx`
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Anti-Slop Prohibition:** Do NOT leave the user on an unnavigable empty screen. If no date is in URL, provide an in-screen date picker so warehouse staff can choose any date without manual URL editing.

**Evidence Requirement:** Browser can navigate to `/warehouse?view=mrx-preparation` directly from sidebar, pick a date with `<VietnameseDateInput>`, and see aggregated customer lines.

- [x] **Step 1: Write failing test for Preparation Date Selector**
  In `frontend/src/__tests__/Warehouse.test.tsx`, assert that navigating to `/warehouse?view=mrx-preparation` renders `MrxMultiCustomerPreparationWorkbench` with an accessible `<VietnameseDateInput>`, and changing date updates requirements.

- [x] **Step 2: Run test to observe failure (RED)**
  Run: `npm run test:unit -w frontend -- Warehouse.test.tsx`

- [x] **Step 3: Register route leaf and add Date Selector**
  - In `routeRegistry.ts`, add leaf `{ id: 'mrx.preparation', to: '/warehouse?view=mrx-preparation', label: 'Chuẩn bị xuất phối hợp', ... }`.
  - In `WarehousePage.tsx`, render `MrxMultiCustomerPreparationWorkbench` for `view === 'mrx-preparation'`.
  - In `MrxMultiCustomerPreparationWorkbench.tsx`, add top-level date picker in WorkspaceHeader when `serviceDate` is empty, defaulting to current business date.

- [x] **Step 4: Run test to verify success (GREEN)**
  Run: `npm run test:unit -w frontend -- Warehouse.test.tsx`

---

### Task 5: Implement Discrepancy Recording on Warehouse Delta Workbench

**Files:**
- Modify: `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Anti-Slop Prohibition:** Do NOT blindly auto-submit mathematical deltas. Warehouse staff must have an actual modal dialog to input actual quantities received/issued and mandate a reason when a discrepancy occurs.

**Evidence Requirement:** Clicking "Xử lý" opens a real modal. Entering a differing quantity without a reason disables the submit button. Submitting with reason creates a real issue/return with those exact values.

- [x] **Step 1: Write failing test for Delta Execution Modal**
  In `frontend/src/__tests__/Warehouse.test.tsx`, assert clicking "Xử lý" opens a confirmation modal allowing entry of actual quantity and optional/required discrepancy reason.

- [x] **Step 2: Run test to observe failure (RED)**
  Run: `npm run test:unit -w frontend -- Warehouse.test.tsx`

- [x] **Step 3: Implement Delta Execution Modal**
  - Add `<Modal>` in `MrxSourceDeltaWorkbench.tsx` with inputs for `actualQuantity` and `discrepancyReason`.
  - Validate required reason if `actualQuantity !== deltaQuantity`.
  - Submit issue or return with user-entered values.

- [x] **Step 4: Run test to verify success (GREEN)**
  Run: `npm run test:unit -w frontend -- Warehouse.test.tsx`

---

### Task 6: Wire `useScopedQuery` and Surface Skeletons into Feature Pages

**Files:**
- Modify: `frontend/src/features/reports/ReportsPage.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Test: `frontend/src/__tests__/Reports.test.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Anti-Slop Prohibition:** Do NOT leave `useScopedQuery` or `loadingGeometry` orphaned. Remove manual `useEffect` + `useRef` sequence counters in `ReportsPage.tsx` and `ReconciliationPage.tsx` and genuinely invoke `useScopedQuery`.

**Evidence Requirement:** Verify in Vitest and browser that switching tabs on Reports preserves previous data (`keepPreviousData: true`) without jarring blank flashes, and cold loading uses `matrix` and `table` skeletons.

- [x] **Step 1: Write test asserting cache retention during filter change**
  In `Reports.test.tsx`, assert changing month/tab preserves prior data (`keepPreviousData`) until new query resolves.

- [x] **Step 2: Run test to observe failure (RED)**
  Run: `npm run test:unit -w frontend -- Reports.test.tsx`

- [x] **Step 3: Integrate `useScopedQuery` in `ReportsPage.tsx` and `ReconciliationPage.tsx`**
  - Replace manual `useEffect` / `requestSequence` with `useScopedQuery`.
  - Pass `loadingGeometry` (`matrix` for reports, `table` for reconciliation) to `<StateBoundary>`.

- [x] **Step 4: Run test to verify success (GREEN)**
  Run: `npm run test:unit -w frontend -- Reports.test.tsx Reconciliation.test.tsx`

---

### Task 7: Implement WCAG 2.2 AA Focus Trap and Restoration in `Modal.tsx`

**Files:**
- Modify: `frontend/src/components/ui/modal.tsx`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

**Anti-Slop Prohibition:** Do NOT install external heavyweight dialog libraries (Headless UI, Radix) just for a focus trap. Implement zero-dependency native DOM focus trapping and active element restoration.

**Evidence Requirement:** Tab key navigation remains strictly trapped inside open modals; closing modal restores focus to the triggering button.

- [x] **Step 1: Write failing accessibility test for focus trap**
  In `Primitives.test.tsx`, assert:
  - When modal opens, focus moves to the first focusable element.
  - Tab on the last element wraps to the first element.
  - Shift+Tab on the first element wraps to the last element.
  - When modal closes, focus returns to the initiating trigger button.

- [x] **Step 2: Run test to observe failure (RED)**
  Run: `npm run test:unit -w frontend -- Primitives.test.tsx`

- [x] **Step 3: Implement Focus Trap in `Modal.tsx`**
  - Track `triggerRef = document.activeElement`.
  - Trap Tab navigation between focusable modal elements (`button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`).
  - Restore focus to `triggerRef` in cleanup effect.

- [x] **Step 4: Run test to verify success (GREEN)**
  Run: `npm run test:unit -w frontend -- Primitives.test.tsx`

---

### Task 8: Add Tablet Responsive Adaptability to `SplitView.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/SplitView.tsx`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

**Anti-Slop Prohibition:** Do NOT leave `SplitView` as static desktop-only `w-7/12`. Adapt it for real industrial workstations and tablets (iPad/POS screens).

**Evidence Requirement:** At 768px viewport width with detail active, master column is hidden and detail takes full width with a Back button to return to master.

- [x] **Step 1: Write failing test for tablet responsive split view**
  In `Primitives.test.tsx`, assert that on tablet viewport when detail is active (`hasActiveDetail: true`), the master panel is hidden and detail panel displays a "Quay lại danh sách" button.

- [x] **Step 2: Run test to observe failure (RED)**
  Run: `npm run test:unit -w frontend -- Primitives.test.tsx`

- [x] **Step 3: Implement responsive layout in `SplitView.tsx`**
  - Add optional prop `hasActiveDetail?: boolean; onBackToMaster?: () => void`.
  - On desktop (`lg:`), keep side-by-side layout.
  - On mobile/tablet (`< lg`), toggle between master and detail, providing Back button when detail is active.

- [x] **Step 4: Run test to verify success (GREEN)**
  Run: `npm run test:unit -w frontend -- Primitives.test.tsx`

---

### Task 9: Live Browser E2E Acceptance & Production Closure

**Files:**
- Modify: `frontend/tests/browser/conformance-runtime.spec.ts`
- Modify: `.planning/WORK.md`

**Anti-Slop Prohibition:** Do NOT declare production victory from `npm run verify` CLI output. Run the Playwright browser spec against live running Vite + Kestrel + MySQL, capturing screenshots and DOM proof.

**Evidence Requirement:** All 14 routes load with correct headers, zero 403s on base paths, operational queues visible, completed register rendered, and zero console errors.

- [x] **Step 1: Update Playwright conformance spec**
  In `frontend/tests/browser/conformance-runtime.spec.ts`:
  - Test base paths and query-parameter paths across all 14 canonical routes.
  - Test operational queue counter cards on `/reconciliation`.
  - Test completed register table tab.
  - Test modal focus trap in browser.

- [x] **Step 2: Run full automated verification suite**
  Run: `npm run verify`
  Confirm all 12 gates pass cleanly.

- [x] **Step 3: Run live Playwright browser acceptance**
  Run: `cd frontend && npx playwright test tests/browser/conformance-runtime.spec.ts`
  Confirm 100% pass on live Chromium.

- [x] **Step 4: Update task ledger and documentation**
  Update `.planning/WORK.md` recording all real DOM, HTTP, DB, and accessibility verification evidence.
