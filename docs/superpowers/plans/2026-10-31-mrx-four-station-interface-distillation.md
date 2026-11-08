# MRX Four-Station Interface Distillation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distill the four connected MRX workstations so each screen emphasizes one current task and one valid primary action, beginning with a full-width source grid that reveals impact review only on demand.

**Architecture:** Preserve all existing feature hooks, API contracts, RBAC guards and workbench primitives. Change composition at current route owners: weekly-menu conditionally mounts `SplitView` only during impact review; Warehouse and Chef move secondary utilities out of the primary header action cluster; Reconciliation removes dead duplicate action ownership without changing visible behavior. Browser evidence determines whether any additional downstream visual edit is justified.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind utility classes backed by `frontend/src/styles/index.css`, Vitest + Testing Library, Playwright/Chrome, existing IPC workbench/UI primitives.

**Spec:** `docs/superpowers/specs/2026-10-31-mrx-four-station-interface-distillation-design.md`

## Global Constraints

- `DEFAULT != MATERIAL_RECONCILIATION`; all changed routes remain MRX-only under existing route/navigation/action guards.
- No Backend, API, database, DTO, audit-lineage or lifecycle behavior change.
- No package installation, dependency, CSS file, styling token, primitive copy, `*V2` or `*New` component.
- Reuse `WorkspaceFrame`, `WorkspaceHeader`, `TelemetrySubbar`, `SplitView`, `DataGrid`, `StateBoundary`, `ActionGuard` and existing UI primitives.
- Preserve D6 (`>=12px`), D7 (one primary), T7 (sticky header/frozen first column), T8 (36–40px data rows / 44px inline-edit rows), M1.2 and N6.
- Preserve six states: loading, empty, error, permission-denied, partial and write-reconciliation.
- Frontend fixtures stay generated/C#-contract shaped; no feature hook/component mock, fake API fallback, allowlist or test-only seam.
- Browser/database mutations target only `ipc_mrx_e2e_sandbox` on ports `5174/5263`; teardown is mandatory.
- Continue in the existing dirty feature workspace; no worktree, commit or push without separate Owner authorization.
- Scope is limited to `/weekly-menu`, `/warehouse`, `/chef` and `/reconciliation`; stop after one correction pass plus one confirmation pass.

## Review Focus

1. **Zero-change draft:** opening source edit must show the full-width grid, no impact region and no unrelated import/dish actions; covered by Task 1.
2. **Dirty draft and stale preview:** changing a serving/dish must reveal a counted review trigger and clear a previous preview while preserving the draft; covered by Task 1.
3. **Actor-specific mutation:** Admin/Manager see only direct apply, Coordinator sees only submit, Warehouse sees neither; existing `MrxSourceEdit.test.tsx` RBAC cases own this and Task 1 reruns them.
4. **Conflict recovery:** a 409 in Warehouse or source review must retain work and expose one recovery owner, not stacked messages; covered by Task 2 and permanent G6.
5. **Responsive focus/reflow:** desktop, tablet portrait, equivalent `720×450`, keyboard return focus and actual 200% zoom when OS control is available; covered by Task 1 component assertions and Task 5 browser evidence.

---

### Task 1: Progressive MRX Source Editing

**Files:**
- Modify: `.planning/WORK.md`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxSourceChangePanel.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx`
- Modify: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: `frontend/src/__tests__/MrxSourceEdit.test.tsx`

**Interfaces:**
- Consumes: `useMrxSourceEdit().changedLines`, `previewResult`, `setServings`, `setDish`, `preview`, `apply`, `submit`; existing `SplitView` compact `hasActiveDetail/onBackToMaster` contract.
- Produces: local `isSourceReviewOpen: boolean`; counted trigger accessible name `Tiếp tục xem ảnh hưởng (<count>)`; `MrxSourceChangePanel` mount-time focus on its `h2[tabIndex=-1]`; return focus to the counted trigger.

- [ ] **Step 1: Record the mandatory Scoped Pre-Code UI Gate in `.planning/WORK.md`**

Record route `/weekly-menu?view=mrx-batch`, primary object `SplitWorkbench`, mode `MATERIAL_RECONCILIATION`, existing route/navigation/`ActionGuard` protections, all six UI states, reused primitives/composites, and D6/D7/T7/T8/M1.2/N6 pledges. Mark Task 1 `EXECUTE`; do not create another state file.

- [ ] **Step 2: Rewrite the existing direct-editor test to fail on the current permanent detail pane**

In `WeeklyMenu.test.tsx`, first make the existing edit-scope fixture capable of producing a real changed line: add one Backend-shaped slot `{ dishSlot: 'savory-main', menuVariant: 'savory', slotLabel: 'Món mặn', dishId: 'dish-1', dishCode: 'M01', dishName: 'Cơm thịt' }` and return active `dish-1` from `adminApi.getDishes`. Then extend the current “blocks quantity checking…” owner case with these assertions:

```tsx
await userEvent.click(screen.getByRole('button', { name: 'Điều chỉnh nguồn' }));
expect(await screen.findByLabelText('Bảng sửa nguồn MRX')).toBeVisible();
expect(screen.queryByRole('region', { name: 'Ảnh hưởng thay đổi nguồn MRX' })).not.toBeInTheDocument();
expect(screen.queryByRole('button', { name: /Tiếp tục xem ảnh hưởng/ })).not.toBeInTheDocument();
expect(screen.queryByRole('button', { name: 'Nhập thực đơn Excel' })).not.toBeInTheDocument();

await userEvent.type(screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 MORNING' }), '125');
const review = screen.getByRole('button', { name: 'Tiếp tục xem ảnh hưởng (1)' });
await userEvent.click(review);
expect(screen.getByRole('region', { name: 'Ảnh hưởng thay đổi nguồn MRX' })).toBeVisible();
expect(screen.getByRole('heading', { name: 'Xem trước ảnh hưởng' })).toHaveFocus();

await userEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' }));
expect(screen.getByRole('spinbutton', { name: 'Số suất Mặn 19/10 MORNING' })).toHaveValue(125);
expect(screen.getByRole('button', { name: 'Tiếp tục xem ảnh hưởng (1)' })).toHaveFocus();
```

Keep the existing close/reopen assertion, but expect reopening to return to full-width grid with no impact region.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx
```

Expected: FAIL because the impact region is mounted immediately, unrelated actions remain visible and no counted trigger/focus contract exists.

- [ ] **Step 4: Implement the smallest progressive composition in `MrxBatchWorkbench.tsx`**

- Replace `isCompactSourceDetail` with `isSourceReviewOpen` and `reviewTriggerRef: RefObject<HTMLButtonElement>`.
- Opening or closing source edit sets `isSourceReviewOpen(false)`.
- While `isChangeOpen`, suppress schedule/import/dish/inbox actions; keep only the guarded close action.
- When `isSourceReviewOpen === false`, render `MrxSourceEditGrid` full width. Render the outline button `Tiếp tục xem ảnh hưởng (${sourceEdit.changedLines.length})` only when `changedLines.length > 0`.
- When `isSourceReviewOpen === true`, mount the existing `SplitView` with `hasActiveDetail`, the same grid as master and `MrxSourceChangePanel` as detail.
- `onBackToMaster` sets review false and restores focus to `reviewTriggerRef` on the next animation frame.
- Render success feedback as one compact `InlineBanner`: put `changeMessage` in `title`, omit a second child text line, and use `actionLabel/onAction` only for the valid Warehouse handoff.
- Do not move mutation ownership out of `useMrxSourceEdit`; keep `loadSource(true)` after successful direct apply.

- [ ] **Step 5: Make the review panel own focus and keep one role-valid primary action**

In `MrxSourceChangePanel.tsx`:

- Add an internal heading ref and focus `h2[tabIndex={-1}]` on mount.
- Keep reason entry and material-impact table inside the review step.
- Keep `Xem ảnh hưởng` outline; keep exactly one default action based on actor (`Áp dụng ngay` or `Gửi duyệt`).
- Preserve confirmation modal, pending state, locked-date warning and inline error.
- Do not add a close action; `SplitView`/toolbar own back and exit.

- [ ] **Step 6: Distill the existing grid without changing its data contract**

In `MrxSourceEditGrid.tsx`:

- Keep `min-w-[760px]`, sticky header and frozen `Ngày / Ca` column.
- Preserve each day/shift row and all serving/dish inputs.
- Reduce repeated visual weight using existing slate utilities only: group anchor remains bold, slot labels remain one fixed compact column, input rows use the T8 inline density, and locked reason remains line-local.
- Do not introduce cards, nested panels, hidden columns or new CSS tokens.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx src/__tests__/SearchableCombobox.test.tsx
```

Expected: all tests PASS; no draft/RBAC/keyboard regression.

- [ ] **Step 8: Run changed-scope lint and detector**

Run:

```bash
npx eslint frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx frontend/src/features/weekly-menu/MrxSourceChangePanel.tsx frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx frontend/src/__tests__/WeeklyMenu.test.tsx
"C:/Users/Administrator/.pi/agent/skills/impeccable/scripts/impeccable.cmd" detect --json frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx frontend/src/features/weekly-menu/MrxSourceChangePanel.tsx frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx
```

Expected: ESLint exits 0; detector has no unresolved finding in the changed target.

- [ ] **Step 9: Checkpoint without committing**

Record RED/GREEN commands and results in `.planning/WORK.md`. Do not stage, commit or push.

---

### Task 2: Warehouse Action Hierarchy and Conflict Recovery

**Files:**
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx`
- Modify: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Consumes: `mutationError`, `setMutationError`, `load(true)`, `navigate`, `TelemetrySubbar.rightActions`, current header callbacks.
- Produces: header with issue-write actions only; `Chuẩn bị phối hợp` as a secondary subbar utility; one `InlineBanner` conflict/error owner with 409 reload action.

- [ ] **Step 1: Add RED assertions to the existing 409 owner test**

Update “MRX daily workbench invalidates stale source…” and add `within` to the existing Testing Library import:

```tsx
expect(await screen.findByText('Danh sách xuất kho đã thay đổi; hãy tải lại trước khi xác nhận.')).toBeInTheDocument();
const alert = screen.getByRole('alert');
expect(within(alert).getByRole('button', { name: 'Tải lại dữ liệu mới nhất' })).toBeInTheDocument();
expect(screen.getAllByRole('alert')).toHaveLength(1);
await userEvent.click(within(alert).getByRole('button', { name: 'Tải lại dữ liệu mới nhất' }));
await waitFor(() => expect(getDaily).toHaveBeenCalledTimes(2));
```

Add a hierarchy assertion in the canonical initial-issue test:

```tsx
const header = screen.getByRole('banner');
expect(within(header).queryByRole('button', { name: 'Chuẩn bị phối hợp' })).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Chuẩn bị phối hợp' })).toBeInTheDocument();
expect(within(header).getAllByRole('button', { name: /Xác nhận xuất kho/ })).toHaveLength(1);
```

- [ ] **Step 2: Run Warehouse test and verify RED**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx
```

Expected: FAIL because the current ad-hoc error strip has only `Đóng`, and `Chuẩn bị phối hợp` still occupies the header action cluster.

- [ ] **Step 3: Move only secondary navigation out of the header**

- Remove `onNavigatePreparation` from `MrxDailyHeaderBranchProps` and from the branch action cluster.
- Keep `Điền đủ toàn bộ` outline and `Xác nhận xuất kho` default together; keep `Xuất bổ sung ca` as the one primary when applicable.
- Render `Chuẩn bị phối hợp` as an outline `xs` button in `TelemetrySubbar.rightActions` from `MrxDailyIssueWorkbench`.
- Do not change demand/history view state or date tabs.

- [ ] **Step 4: Replace the ad-hoc mutation error strip with `InlineBanner`**

Use `variant="conflict"` for `ApiError` 409, otherwise `error`. For 409 expose `actionLabel="Tải lại dữ liệu mới nhất"`; action clears the error then invokes `load(true)`. Keep a single close action through `onClose`.

- [ ] **Step 5: Run Warehouse test and verify GREEN**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx
```

Expected: all Warehouse tests PASS, including issue body, stale-cache invalidation and revision attribution.

- [ ] **Step 6: Lint and checkpoint without committing**

Run:

```bash
npx eslint frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx frontend/src/__tests__/Warehouse.test.tsx
```

Expected: 0 errors. Record evidence in `.planning/WORK.md`; do not stage/commit/push.

---

### Task 3: Chef Read/Export Hierarchy

**Files:**
- Modify: `frontend/src/features/chef/MrxCookingWorkbench.tsx`
- Modify: `frontend/src/features/chef/branches/MrxCookingHeaderBranch.tsx`
- Modify: `frontend/src/__tests__/Chef.test.tsx`

**Interfaces:**
- Consumes: existing CSV/XLSX/print callbacks, `TelemetrySubbar.rightActions`, cooking metrics.
- Produces: header with batch/shift/version and one print primary; CSV/XLSX as grouped secondary subbar utilities; one compact metrics sentence.

- [ ] **Step 1: Add a RED hierarchy assertion to the existing sanitized projection test**

After data renders, add `within` to the existing Testing Library import and assert:

```tsx
const header = screen.getByRole('banner');
expect(within(header).getByRole('button', { name: 'In phiếu nấu' })).toBeInTheDocument();
expect(within(header).queryByRole('button', { name: 'Tải CSV' })).not.toBeInTheDocument();
expect(within(header).queryByRole('button', { name: 'Tải Excel' })).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Tải CSV' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Tải Excel' })).toBeInTheDocument();
```

Keep existing callback assertions so relocation cannot disconnect exports.

- [ ] **Step 2: Run Chef test and verify RED**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/Chef.test.tsx
```

Expected: FAIL because CSV and Excel currently render inside `WorkspaceHeader`.

- [ ] **Step 3: Relocate export utilities without changing callbacks**

- Remove CSV/XLSX callback props from `MrxCookingHeaderBranch`; leave `onPrint` and its default button as the only header action.
- Add CSV and Excel outline `xs` buttons to `TelemetrySubbar.rightActions` in `MrxCookingWorkbench`, disabled when no rows exist.
- Keep all three metrics in `telemetryPills`, but render them as one concise reading sequence with shared separators; remove the redundant left sentence `Phiếu nấu theo từng món ăn trong ca` if the header already communicates it.
- Preserve menu-variant grouping, sanitized fields and URLs.

- [ ] **Step 4: Run Chef test and verify GREEN**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/Chef.test.tsx
```

Expected: all Chef tests PASS; CSV/XLSX/print calls and prohibited-field assertions remain intact.

- [ ] **Step 5: Lint and checkpoint without committing**

Run:

```bash
npx eslint frontend/src/features/chef/MrxCookingWorkbench.tsx frontend/src/features/chef/branches/MrxCookingHeaderBranch.tsx frontend/src/__tests__/Chef.test.tsx
```

Expected: 0 errors. Record evidence; do not stage/commit/push.

---

### Task 4: Reconciliation Single Action Ownership

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx`
- Verify: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: existing subbar actions and header completion contract.
- Produces: header interface without unused `onNavigateCooking`/`onOpenDishes`; visible cooking/dish utilities remain owned once by `TelemetrySubbar`; completion remains the only header primary.

- [ ] **Step 1: Establish the existing behavioral baseline**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx
```

Expected: PASS before the pure owner cleanup. This task intentionally adds no tautological test because visible actions already have one owner and the change removes dead props only.

- [ ] **Step 2: Remove dead duplicate ownership**

- Delete `onNavigateCooking` and `onOpenDishes` from `ReconciliationHeaderBranchProps`, destructuring and call site.
- Keep the visible outline actions in `TelemetrySubbar.rightActions` exactly once.
- Keep completion and blocker copy in the header unchanged.
- Do not move report exports or alter report routing.

- [ ] **Step 3: Run Reconciliation test and compile checks**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx
npx eslint frontend/src/features/reconciliation/ReconciliationPage.tsx frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx
```

Expected: all tests PASS and ESLint exits 0.

- [ ] **Step 4: Stop if rendered evidence shows no further reconciliation defect**

During Task 5 browser review, do not make another Reconciliation visual edit unless it matches the approved spec and has concrete DOM/screenshot evidence. Record “no additional change required” when the existing composition already passes.

- [ ] **Step 5: Checkpoint without committing**

Record baseline/post-cleanup evidence; do not stage/commit/push.

---

### Task 5: Connected Browser Evidence, Full Gates and Closure

**Files:**
- Modify only if assertions must reflect the approved visible flow: `frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts`
- Modify: `.planning/WORK.md`
- Evidence output (ignored/local): `frontend/test-results/evidence/mrx-four-station-distillation/`

**Interfaces:**
- Consumes: Tasks 1–4 visible contracts and existing G6 sandbox lifecycle.
- Produces: bounded desktop/tablet/compact screenshots, permanent behavior assertions, final PASS/FAIL/NEEDS_EVIDENCE matrix and cleanup evidence.

- [ ] **Step 1: Update permanent G6 only for changed observable flow**

Replace the immediate compact `Tiếp tục xem ảnh hưởng` assumption with:

1. assert no impact region on editor open;
2. make one unlocked draft change;
3. assert counted `Tiếp tục xem ảnh hưởng (n)`;
4. open detail, assert impact heading focus;
5. return and assert trigger focus/draft preservation.

Do not add screenshot-only assertions, sleeps, fake API data or actual-zoom emulation.

- [ ] **Step 2: Run focused frontend suites**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx src/__tests__/SearchableCombobox.test.tsx src/__tests__/Warehouse.test.tsx src/__tests__/Chef.test.tsx src/__tests__/Reconciliation.test.tsx src/__tests__/AppShell.test.tsx
```

Expected: all selected files/tests PASS.

- [ ] **Step 3: Run headed G6 against the sandbox**

Run:

```bash
npm run test:e2e:mrx:g6 -- --headed
```

Expected: 1/1 PASS; real login enters feature routes; source edit/persistence/locked days/Coordinator approval/apply-vs-issue race remain valid; teardown reports residual customers `0`, ports terminated and sandbox dropped.

- [ ] **Step 4: Capture one bounded visual pass**

Using temporary capture instrumentation only, save these checkpoints under `frontend/test-results/evidence/mrx-four-station-distillation/`:

- weekly source grid before review, desktop `1440×900`;
- weekly impact review, desktop;
- grid and detail at `768×1024` and equivalent `720×450`;
- Warehouse daily issue action hierarchy;
- Chef read/export hierarchy;
- Reconciliation lines/completion hierarchy.

Remove temporary capture instrumentation afterward. Actual browser zoom 200% is attempted only through real Chrome zoom; if Windows focus isolation blocks it, report `BLOCKED` and do not relabel viewport evidence.

- [ ] **Step 5: Run Impeccable detector once over final changed UI targets**

Run:

```bash
"C:/Users/Administrator/.pi/agent/skills/impeccable/scripts/impeccable.cmd" detect --json frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx frontend/src/features/weekly-menu/MrxSourceChangePanel.tsx frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx frontend/src/features/chef/MrxCookingWorkbench.tsx frontend/src/features/chef/branches/MrxCookingHeaderBranch.tsx frontend/src/features/reconciliation/ReconciliationPage.tsx frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx
```

Expected: no unresolved detector finding. Do not run repeated polish loops.

- [ ] **Step 6: Run full Frontend verification**

Run:

```bash
npm run test:unit -w frontend
npm run build -w frontend
npx eslint frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx frontend/src/features/weekly-menu/MrxSourceChangePanel.tsx frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx frontend/src/features/warehouse/branches/MrxDailyHeaderBranch.tsx frontend/src/features/chef/MrxCookingWorkbench.tsx frontend/src/features/chef/branches/MrxCookingHeaderBranch.tsx frontend/src/features/reconciliation/ReconciliationPage.tsx frontend/src/features/reconciliation/branches/ReconciliationHeaderBranch.tsx frontend/src/__tests__/WeeklyMenu.test.tsx frontend/src/__tests__/Warehouse.test.tsx frontend/src/__tests__/Chef.test.tsx frontend/src/__tests__/Reconciliation.test.tsx frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts
git diff --check
```

Expected: Vitest PASS; production build PASS except inherited chunk warning; changed-scope ESLint 0 errors; diff check 0 errors aside from inherited line-ending notices.

- [ ] **Step 7: Verify environment hygiene**

Run listener and MySQL schema checks. Expected: no `LISTENING` process on `5174/5263`; `ipc_mrx_e2e_sandbox` schema count `0`. Do not mutate `ipcmanagement`.

- [ ] **Step 8: Perform mandatory reviews and close `.planning/WORK.md`**

Apply `ipc-test-audit`, `ipc-ui-review` and `ipc-code-review`. Record each as:

```text
Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact
```

Report each criterion as PASS/FAIL/NEEDS_EVIDENCE/BLOCKED, return the lifecycle to `IDLE`, and state commit/push `NOT_RUN`.

- [ ] **Step 9: Do not commit**

Leave all changes unstaged until the Owner separately authorizes a commit or push.
