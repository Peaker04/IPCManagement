# MRX Weekly Source Completion Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blank post-import MRX prerequisite gate and competing editors with one persistent four-section weekly-source matrix that displays Excel-style merged dishes, captures servings on web, preserves explicit per-slot editing, and advances through quantity validation and batch lifecycle.

**Architecture:** Keep `/weekly-menu?view=mrx-batch`, `MrxEditScopeDto`, and the existing source-change mutation authority. Build presentation groups in a pure Frontend matrix model from adjacent persisted slots with the same `DishId`; read/completion mode groups cells while dish-edit mode exposes each real slot/day. Repair MRX reimport analysis so merged continuations are compared consistently with the records committed by `WeeklyMenuImportPersistence`.

**Tech Stack:** ASP.NET Core 9, EF Core, xUnit/NSubstitute, React 19, TypeScript, Vitest/Testing Library, Playwright, existing IPCManagement UI primitives/workbench composites.

**Spec:** `docs/superpowers/specs/2026-11-01-mrx-weekly-source-completion-design.md`

## Global Constraints

- Preserve `DEFAULT != MATERIAL_RECONCILIATION`; all work remains on the MRX route and existing MRX policies.
- Excel owns four menu groups; web owns Mặn/Chay servings per service date and shift.
- Do not add dependencies, routes, database migrations, styling tokens, duplicate primitives, fake data, allowlists, lint suppressions, or test-only production seams.
- Preserve source-change preview/apply/submit, approval, audit revision, per-day locks, expected versions, 409 recovery, and apply-vs-issue race behavior.
- Use existing `WorkspaceFrame`, `WorkspaceHeader`, `TelemetrySubbar`, `StateBoundary`, `SplitView`, `Button`, `Input`, `SearchableCombobox`, `Badge`, `InlineBanner`, and `Tabs`.
- Maintain D6, D7, T7, T8, M1.2, N6 and all six UI states.
- Read grouping requires matching `DishId`, section/variant, adjacency and lock state; `DishName` equality alone is insufficient.
- Read grouping never changes persisted records. Dish-edit mode exposes every persisted slot/day independently.
- Current scope has no commit/push authorization; each task ends with an unstaged checkpoint instead of a commit.

## Review Focus

1. **Merged continuation parity:** reimporting an unchanged merged workbook must not report unsupported added/removed slots; Task 1 owns the regression.
2. **False grouping:** adjacent equal names with different `DishId`, non-adjacent slots, different variants, or mixed lock states must remain separate; Task 2 owns these cases.
3. **Post-import partial state:** a published menu with null servings must render all menu groups and editable serving cells, never the blank prerequisite screen; Task 3 owns it.
4. **Role and concurrency path:** Admin/Manager direct apply, Coordinator submit-for-review, locked dates, and 409 draft preservation must remain distinct; Task 4 owns it.
5. **Compact keyboard use:** desktop, `768×1024`, effective `720×450`, sticky/frozen table behavior, read blocks and per-slot edit focus must preserve grid → review → grid; Task 6 owns it.

---

### Task 1: Make MRX Reimport Preserve Merged Continuation Slots

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportService.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportBatchTests.cs`

**Interfaces:**
- Consumes: `WeeklyMenuImportPlan.Items`, including `IsMergedContinuation`, and the persisted per-slot `MenuItem` records created by `WeeklyMenuImportPersistence`.
- Produces: `AnalyzeMrxReimportAsync` comparison keys that include every persisted/imported slot; unchanged merged workbooks yield no structural mismatch, while real span/slot changes remain unsupported and fail closed.

- [ ] **Step 1: Add a failing merged-reimport regression**

Add `Reimporting_identical_merged_cells_preserves_continuation_slots` to `WeeklyMenuImportBatchTests.cs`. Use the canonical workbook/parser fixture with one vertically merged dish, commit it, prepare the same workbook again, and assert:

- every persisted continuation `DishSlot` has a matching imported comparison key;
- each `MrxDayOutcome` is `UNCHANGED` or `LOCKED_IDENTICAL`, never `CHANGED`/`LOCKED_CONFLICT` solely because of a continuation;
- commit is not rejected as unsupported structural change.

- [ ] **Step 2: Run the focused Backend test and verify RED**

Run:

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~WeeklyMenuImportBatchTests.Reimporting_identical_merged_cells_preserves_continuation_slots"
```

Expected: FAIL because `AnalyzeMrxReimportAsync` filters `IsMergedContinuation` from `imported` while persistence retains those slots.

- [ ] **Step 3: Align imported comparison with persistence**

In `WeeklyMenuImportService.AnalyzeMrxReimportAsync`, build `imported` from every `plan.Items` entry rather than filtering continuations. Keep the existing `SlotKey(serviceDate, shift, variant, slot)` and fail-closed `unsupported` rule for real added/removed slots.

- [ ] **Step 4: Run focused and connected reimport tests**

Run:

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~WeeklyMenuImportBatchTests|FullyQualifiedName~MrxSourceChangeApplierTests"
```

Expected: all selected tests PASS; locked-day and direct-source reimport behavior remains unchanged.

- [ ] **Step 5: Checkpoint without committing**

Record RED/GREEN evidence in `.planning/WORK.md`; do not stage or commit.

---

### Task 2: Add the Pure Weekly-Source Matrix Grouping Model

**Files:**
- Create: `frontend/src/features/weekly-menu/mrxSourceMatrixModel.ts`
- Test: `frontend/src/__tests__/MrxSourceEdit.test.tsx`

**Interfaces:**
- Consumes: `MrxEditScope` days/shifts/slots and `MrxSourceDraft`.
- Produces:
  - `type MrxMatrixMode = 'completion' | 'dish-edit'`
  - `interface MrxMatrixSlotCell { serviceDate; shiftName; menuVariant; dishSlot; slotLabel; dishId; dishCode; dishName; isLocked; lockReason }`
  - `interface MrxVerticalDishBlock { serviceDate; shiftName; menuVariant; slots: MrxMatrixSlotCell[]; rowSpan; dishId; dishCode; dishName; isLocked; lockReason }`
  - `interface MrxHorizontalDishBlock { days: MrxVerticalDishBlock[]; colSpan }`
  - `buildVerticalDishBlocks(cells: MrxMatrixSlotCell[]): MrxVerticalDishBlock[]`
  - `buildHorizontalDishBlocks(days: MrxVerticalDishBlock[][]): MrxHorizontalDishBlock[][]`
  - `buildMrxSourceMatrix(scope: MrxEditScope, draft: MrxSourceDraft, mode: MrxMatrixMode)` for the component in Task 3.

- [ ] **Step 1: Add failing grouping tests**

In `MrxSourceEdit.test.tsx`, add pure-model cases asserting:

1. adjacent slots in one date/shift/variant with the same non-empty `DishId` produce one `rowSpan: 4` vertical block;
2. same `DishName` with different `DishId` stays separate;
3. equal `DishId` separated by another dish stays separate;
4. equal vertical blocks on adjacent dates group horizontally only when slot sequence and lock state match;
5. `mode: 'dish-edit'` returns one cell/control per persisted slot/day and performs no vertical or horizontal grouping.

- [ ] **Step 2: Run the pure-model tests and verify RED**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/MrxSourceEdit.test.tsx
```

Expected: FAIL because `mrxSourceMatrixModel.ts` and its exports do not exist.

- [ ] **Step 3: Implement the model**

Create `mrxSourceMatrixModel.ts` with the exact exports above. Preserve the slot order supplied by `MrxEditScopeShiftDto.slots`; never sort by display name. A vertical run ends on `DishId`, variant, date, shift, adjacency or lock-state change. Horizontal grouping compares `DishId`, ordered `dishSlot` list, `rowSpan`, section and lock state.

- [ ] **Step 4: Run focused tests and TypeScript build**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/MrxSourceEdit.test.tsx
npm run build:fe
```

Expected: focused tests PASS; TypeScript/build PASS.

- [ ] **Step 5: Checkpoint without committing**

Record model contracts and test counts in `.planning/WORK.md`; do not stage or commit.

---

### Task 3: Redesign `MrxSourceEditGrid` as the Persistent Weekly Matrix

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts`
- Test: `frontend/src/__tests__/MrxSourceEdit.test.tsx`
- Test: `frontend/src/__tests__/SearchableCombobox.test.tsx` only if existing keyboard assertions need extension rather than duplication.

**Interfaces:**
- Consumes: Task 2 `buildMrxSourceMatrix`, existing `MrxEditScope`, `MrxSourceDraft`, dish options and mutation callbacks.
- Produces: updated `MrxSourceEditGridProps` with `mode: MrxMatrixMode`; completion mode renders grouped read dishes plus editable servings, dish-edit mode renders each persisted slot as `SearchableCombobox`.
- Preserves: `aria-label="Bảng sửa nguồn MRX"`, existing serving/dish accessible names, locked-day disabling and draft callbacks consumed by Task 4 and permanent G6.

- [ ] **Step 1: Add failing component tests for the approved matrix**

Extend `MrxSourceEdit.test.tsx` with a realistic two-day/four-section scope and assert:

- four canonical section labels render in order;
- each section has its own Mặn or Chay serving row for each date;
- completion mode renders a four-slot equal-DishId run once with a semantic cell spanning four rows;
- completion mode still exposes editable serving inputs;
- dish-edit mode renders four separate comboboxes for that run;
- locked days remain readable but all corresponding inputs/comboboxes are disabled with lock reason text;
- table has sticky header/frozen first-column ownership classes and a table-owned overflow container.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/MrxSourceEdit.test.tsx
```

Expected: FAIL because the current component renders one row per date/shift and has no four-section weekly matrix or mode.

- [ ] **Step 3: Implement completion and dish-edit modes**

Update `MrxSourceEditGrid.tsx` to use Task 2’s model. Reuse `Input`, `SearchableCombobox`, `Badge`, and existing tokens/classes only. Keep serving inputs 44px rows, normal dish rows 36–40px, sticky `thead`, frozen first column, and `min-width` horizontal table viewport.

Update `useMrxSourceEdit` only where needed to expose a stable `hasMissingServings`/draft completeness derivation and retain `changedLines`; do not change mutation request shapes.

- [ ] **Step 4: Run focused accessibility/component tests and lint**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/MrxSourceEdit.test.tsx src/__tests__/SearchableCombobox.test.tsx
cd frontend && npx eslint src/features/weekly-menu/MrxSourceEditGrid.tsx src/features/weekly-menu/mrxSourceMatrixModel.ts src/features/weekly-menu/hooks/useMrxSourceEdit.ts
```

Expected: tests PASS; ESLint zero diagnostics.

- [ ] **Step 5: Checkpoint without committing**

Record the rendered contract and test counts in `.planning/WORK.md`; do not stage or commit.

---

### Task 4: Replace the Blank Gate and Competing Editors with One Workbench Owner

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts`
- Modify: `frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx` only for state-derived title/action copy.
- Remove MRX caller/import only: `frontend/src/features/weekly-menu/WeeklyScheduleEditorModal.tsx` remains if another real route calls it; delete only if caller inventory proves none.
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: `frontend/src/__tests__/MrxSourceEdit.test.tsx`

**Interfaces:**
- Consumes: Task 3 `MrxSourceEditGrid` completion/dish-edit modes and existing `useMrxSourceEdit` mutation methods.
- Produces: one explicit workbench mode owner (`'completion' | 'dish-edit' | 'impact-review'`) in `MrxBatchWorkbench`; the weekly matrix mounts whenever a source and edit scope exist, independent of quantity preview.
- Removes: visible MRX `Chỉnh sửa lịch tuần` action, `editorMenuData`, `isEditorModalOpen`, `handleOpenEditor`, and MRX rendering of `WeeklyScheduleEditorModal`.

- [ ] **Step 1: Replace the old blocked-state owner test with failing matrix-first behavior**

Update the existing `WeeklyMenu.test.tsx` case that currently expects the disabled `Cần nhập đủ suất Mặn và Chay` gate. Assert instead:

- published source + null servings renders `Bảng sửa nguồn MRX` immediately;
- imported dish names remain visible;
- missing Mặn/Chay inputs are visible at the correct date/section;
- no blank prerequisite message occupies Zone 3;
- `Chỉnh sửa lịch tuần` and `Điều chỉnh nguồn` are both absent;
- `Nhập lại Excel` remains secondary;
- exactly one primary action exists for the current lifecycle.

Add a caller-inventory assertion/test or `rg` checkpoint proving whether `WeeklyScheduleEditorModal` has any non-MRX caller before deleting the file.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx
```

Expected: FAIL because the current workbench renders the prerequisite gate and both legacy/new edit actions.

- [ ] **Step 3: Implement the single workbench mode owner**

In `MrxBatchWorkbench.tsx`:

- render Task 3 matrix whenever `sourceEdit.editScope` exists;
- use `completion` mode by default and `dish-edit` only through the same source workbench;
- keep impact review as the existing sequential `SplitView` detail state;
- remove MRX legacy schedule editor state/action;
- keep `Nhập lại Excel`, pending review and history/recovery utilities secondary;
- classify missing servings as partial/readiness telemetry, not `StateBoundary` empty.

In `useMrxBatchWorkspace.ts`, make `primaryAction` consume source-draft completeness supplied by the workbench rather than hiding menu behind `preview`. Do not call quantity preview until all required servings are persisted.

- [ ] **Step 4: Preserve role-specific save/review semantics**

Wire dirty completion/dish edits to the existing impact preview. Admin/Manager can confirm direct apply; Coordinator submits for review. After direct apply succeeds, force source reload and then run quantity preview. After Coordinator submission, retain the pending-review state and do not claim quantity validation succeeded.

- [ ] **Step 5: Run focused tests, lint and build**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx src/__tests__/FullMrxModernizationSmoke.test.tsx
cd frontend && npx eslint src/features/weekly-menu/MrxBatchWorkbench.tsx src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx
cd .. && npm run build:fe
```

Expected: all focused tests PASS; ESLint zero; build PASS.

- [ ] **Step 6: Checkpoint without committing**

Record removal/retention decision for `WeeklyScheduleEditorModal` and focused evidence in `.planning/WORK.md`; do not stage or commit.

---

### Task 5: Keep the Source Matrix as Schedule Authority After Quantity Preview

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchPreviewSection.tsx`
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Test: `frontend/src/__tests__/MrxSourceEdit.test.tsx`

**Interfaces:**
- Consumes: Task 4 persistent matrix and existing `MrxQuantityPreview` materials/plans.
- Produces: `MrxBatchPreviewSectionProps` accepts `scheduleContent: ReactNode`; its `Thực đơn tuần` tab renders the source matrix rather than reconstructing menu data from quantity preview.
- Removes: `buildWeeklyMenuDataFromPreview` as a second menu-display authority when no real caller remains.

- [ ] **Step 1: Add failing post-preview authority tests**

In `WeeklyMenu.test.tsx`, assert after successful quantity preview:

- `Thực đơn tuần` still renders `Bảng sửa nguồn MRX` and the same source dish blocks;
- `Định lượng nguyên liệu` and `Kế hoạch theo ca` remain available;
- switching tabs and returning preserves unsaved matrix draft/focus state;
- BOM diagnostics appear without replacing or hiding the source matrix;
- no preview-derived duplicate schedule matrix is mounted.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx
```

Expected: FAIL because `MrxBatchPreviewSection` currently reconstructs schedule data from `preview.plans`.

- [ ] **Step 3: Make the source matrix the only schedule owner**

Add `scheduleContent: ReactNode` to `MrxBatchPreviewSectionProps`; render it for the schedule tab. Retain existing material and plan projections. Remove preview-to-weekly-menu reconstruction helpers/imports once caller search proves they are unused.

Keep diagnostics in the existing inline banner/recovery owner and preserve BOM import actions.

- [ ] **Step 4: Run focused tests, lint and build**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx
cd frontend && npx eslint src/features/weekly-menu/MrxBatchPreviewSection.tsx src/features/weekly-menu/MrxBatchWorkbench.tsx
cd .. && npm run build:fe
```

Expected: tests PASS; ESLint zero; build PASS.

- [ ] **Step 5: Checkpoint without committing**

Record single-owner proof in `.planning/WORK.md`; do not stage or commit.

---

### Task 6: Responsive, Keyboard, Runtime and Repository Convergence

**Files:**
- Modify permanent assertions as required: `frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts`
- Modify existing owner tests only where the approved observable contract changed.
- Modify: `.planning/WORK.md`

**Interfaces:**
- Consumes: Tasks 1–5 complete Backend/Frontend behavior.
- Produces: permanent browser proof for import → visible merged menu → servings → per-slot dish edit → impact review → quantity preview → batch lifecycle, plus repository-wide verification.

- [ ] **Step 1: Update permanent G6 assertions before product fixes are considered complete**

Change `g6-direct-source-edit.spec.ts` to assert:

- after Excel import, the source matrix and imported dish names are visible before servings exist;
- completion mode visually groups the canonical merged dish block;
- keyboard reaches missing serving inputs in table order;
- dish-edit mode exposes separate controls for persisted continuation slots;
- compact `720×450` and tablet `768×1024` retain grid → review → grid and no document-level horizontal overflow;
- locked date remains readonly after issue;
- reload persistence, Coordinator approval and apply-vs-issue exactly-one-winner assertions remain unchanged.

Run once before final implementation adjustments and expect the new assertions to fail on the old sequence if not already covered by Tasks 3–5.

- [ ] **Step 2: Run focused Frontend contracts**

Run:

```bash
npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx src/__tests__/SearchableCombobox.test.tsx src/__tests__/FullMrxModernizationSmoke.test.tsx src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts
```

Expected: all selected tests PASS with backend-shaped fixtures and no mocked feature owner.

- [ ] **Step 3: Run complete static/unit/build gates**

Run:

```bash
npm run lint:fe
npm run depcruise:fe
npm run check:architecture-growth
npm run test:architecture-growth
dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj -c Release --no-restore
npm run test:be
npm run test:fe:unit
npm run build:fe
npm run verify
git diff --check
```

Expected: all commands exit 0; only the environment-owned integration skip and documented Vite chunk warning may remain; staged list stays empty.

- [ ] **Step 4: Run permanent headed G6 in the sandbox**

Run:

```bash
npm run test:e2e:mrx:g6 -- --headed
```

Expected: 1/1 PASS; teardown reports residual customers 0, stops listeners on `5174/5263`, and drops `ipc_mrx_e2e_sandbox`.

- [ ] **Step 5: Perform mandatory reviews**

Apply `ipc-test-audit`, `ipc-code-review`, and `ipc-ui-review`. Record each in `.planning/WORK.md` using:

```text
Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact
```

Fix every Critical/Important finding through the owning task’s RED→GREEN cycle; rerun affected focused tests and the aggregate gate.

- [ ] **Step 6: Close truthfully**

Verify no listeners on `5174/5263`, sandbox schema count 0, no temporary visual probes, no staged files, and no product-code change outside planned owners. Mark each criterion PASS/FAIL/NEEDS_EVIDENCE/BLOCKED and return `.planning/WORK.md` to `IDLE` only when code/static/runtime gates pass.

---

## Self-Review Result

- **Spec coverage:** all goals, non-goals, merged-cell behavior, one-owner workflow, six states, responsive/keyboard requirements, lifecycle and review gates map to Tasks 1–6.
- **Type consistency:** Task 2 matrix types are consumed unchanged by Task 3; Tasks 4–5 consume `MrxSourceEditGrid` mode and `scheduleContent` exactly as produced.
- **Source truth:** persistence retains continuation slots; Task 1 removes the inconsistent reimport filter. No DB/DTO span field is invented.
- **Review Focus coverage:** each of the five listed failure classes has a named test in Tasks 1, 2, 3, 4 or 6.
- **Proportion:** the plan specifies interfaces, assertions and commands without prescribing component bodies or speculative abstractions.
