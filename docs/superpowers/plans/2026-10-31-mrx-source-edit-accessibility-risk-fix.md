# MRX Source Edit Accessibility Risk Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MRX source editing completable by keyboard and usable at actual browser zoom 200% and tablet portrait without changing desktop behavior or MRX contracts.

**Architecture:** Repair keyboard ownership in the shared `SearchableCombobox`, then use the existing `SplitView.hasActiveDetail` contract as a compact sequential master/detail state owned by `MrxBatchWorkbench`. Desktop remains side-by-side; below `lg`, users edit the grid first and explicitly advance to or return from the impact panel.

**Tech Stack:** React 19, TypeScript, Testing Library/Vitest, Tailwind utilities, Playwright with Chrome channel.

**Spec:** `docs/superpowers/specs/2026-10-31-mrx-source-edit-accessibility-risk-fix-design.md`

## Global Constraints

- Preserve `DEFAULT != MATERIAL_RECONCILIATION` and existing MRX RBAC/day-lock/API behavior.
- Reuse existing `Button`, `SplitView`, grid and panel; add no dependency, primitive, CSS token, modal, Backend change or test-only seam.
- Fixtures remain C#/generated-contract grounded; no mocks of the component under test, fake fallback or allowlist padding.
- Use TDD RED→GREEN and retain one owner test at the strongest boundary.
- Do not commit or push without separate Owner authorization.

## Review Focus

- Filtered combobox options: active option resets to the first filtered result and Enter selects that exact value.
- Empty filtered result: Arrow/Enter must not call `onChange` or reference a missing active option.
- Escape: close listbox while retaining combobox focus and the current value.
- Compact editor reopen: always return to the source grid rather than stale impact-detail state.
- Desktop `lg+`: both grid and impact panel remain rendered; compact-only navigation controls stay hidden by responsive classes.

---

### Task 1: Repair SearchableCombobox Keyboard Contract

**Files:**
- Modify: `frontend/src/components/ui/searchable-combobox.tsx`
- Test: `frontend/src/__tests__/SearchableCombobox.test.tsx`

**Interfaces:**
- Consumes: existing `ComboboxOption`, `value`, `options`, `onChange`, filtering and click selection.
- Produces: WAI-ARIA-style active option state, stable option IDs, `aria-activedescendant`, Arrow/Home/End navigation, Enter selection and Escape focus retention.

- [ ] **Step 1: Extend the existing Escape owner test to assert focus retention**

Add `expect(input).toHaveFocus()` after Escape closes the listbox.

- [ ] **Step 2: Add keyboard selection regression**

Render three options, focus the combobox, press `ArrowDown`, assert `aria-activedescendant` identifies the first visible option, press `ArrowDown` again, press `Enter`, and assert `onChange` receives the second visible option and the listbox closes.

- [ ] **Step 3: Add filtered/empty active-option regressions**

Assert typing a query resets the active descendant to the first matching option; assert a no-match query removes `aria-activedescendant` and Enter does not call `onChange`.

- [ ] **Step 4: Run the focused test and confirm RED**

Run: `npm run test:unit -w frontend -- src/__tests__/SearchableCombobox.test.tsx`

Expected: FAIL because Escape blurs focus and keyboard navigation/active descendant do not exist.

- [ ] **Step 5: Implement minimal keyboard state in SearchableCombobox**

In `searchable-combobox.tsx`:
- add `activeIndex: number` state;
- derive stable option IDs from the existing generated combobox ID and option index;
- reset `activeIndex` to `0` when the list opens or filtered options change, and to `-1` for an empty result;
- handle `ArrowDown`, `ArrowUp`, `Home`, `End`, `Enter`, and `Escape` with `preventDefault()` where the key is owned;
- call existing `handleSelect` on Enter;
- remove the Escape blur;
- expose `aria-activedescendant` only for a valid active option and mark the active option without introducing new colors/tokens.

- [ ] **Step 6: Run focused GREEN**

Run the command from Step 4.

Expected: all `SearchableCombobox` tests PASS.

---

### Task 2: Make MRX Source Edit Sequential on Compact Viewports

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `SplitView.hasActiveDetail`, `SplitView.onBackToMaster`, existing source grid, change panel and editor toolbar toggle.
- Produces: local `isCompactSourceDetail` state; compact-only `Tiếp tục xem ảnh hưởng` action; grid-first open/reopen; back-to-grid draft preservation.

- [ ] **Step 1: Extend the existing direct-source editor test with compact workflow assertions**

In the existing test that opens and closes direct source editing:
- assert a button named `Tiếp tục xem ảnh hưởng` exists with responsive compact-only class;
- click it and assert `Quay lại danh sách` plus `Ảnh hưởng thay đổi nguồn MRX` are present;
- enter a serving value before advancing, click `Quay lại danh sách`, and assert the same serving input/value remains;
- close and reopen through the toolbar, then assert the compact workflow is reset to the grid-first state.

Do not mock `MrxBatchWorkbench`, `SplitView`, `MrxSourceEditGrid` or the source-edit hook; retain the existing API-boundary mocks.

- [ ] **Step 2: Run the Weekly Menu owner test and confirm RED**

Run: `npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx`

Expected: FAIL because no compact advance action exists and `hasActiveDetail` is always true.

- [ ] **Step 3: Implement compact detail state in MrxBatchWorkbench**

- add `const [isCompactSourceDetail, setIsCompactSourceDetail] = useState(false)`;
- centralize toolbar toggle so opening and closing reset compact detail to false;
- pass `hasActiveDetail={isCompactSourceDetail}`;
- wrap the existing grid in a flex/min-height-safe master container and add one `lg:hidden` outline button named `Tiếp tục xem ảnh hưởng` that sets compact detail true;
- change `onBackToMaster` to set compact detail false rather than closing source editing;
- preserve desktop detail rendering through `SplitView`'s existing `lg:flex` behavior.

- [ ] **Step 4: Run focused GREEN**

Run the command from Step 2.

Expected: `WeeklyMenu.test.tsx` PASS.

---

### Task 3: Browser Regression and Required Gates

**Files:**
- Modify: `frontend/tests/e2e-mrx/specs/g6-direct-source-edit.spec.ts`
- Modify: `.planning/WORK.md`

**Interfaces:**
- Consumes: repaired compact source editor and shared combobox keyboard behavior.
- Produces: durable G6 assertions for keyboard completion, actual zoom 200% and tablet portrait; final task evidence.

- [ ] **Step 1: Add bounded G6 accessibility/layout steps**

Extend the existing G6 source-edit flow—without a second import or synthetic fixture—to assert:
- keyboard Tab/Enter opens source editing;
- Arrow navigation plus Enter changes a real unlocked dish combobox and Escape retains focus;
- at actual Chrome zoom 200% (`DPR 2`, effective `720×450`), the source grid is visible first, compact advance reveals the impact panel, and back reveals the same draft;
- at `768×1024`, the same grid → detail → grid sequence works;
- document-level horizontal overflow remains absent and toolbar exit remains visible.

Use the existing dedicated headed Chrome/sandbox setup. Do not add a permanent OS-key helper outside the E2E spec or any production seam.

- [ ] **Step 2: Run focused component suites**

Run: `npm run test:unit -w frontend -- src/__tests__/SearchableCombobox.test.tsx src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx`

Expected: all focused tests PASS.

- [ ] **Step 3: Run changed-scope ESLint**

Run ESLint on the two production files, three affected test files and G6 spec.

Expected: 0 errors; inherited warnings reported separately.

- [ ] **Step 4: Run production build**

Run: `npm run build -w frontend`

Expected: PASS; existing chunk-size warning may remain.

- [ ] **Step 5: Run guarded headed-Chrome G6**

Run: `npm run test:e2e:mrx:g6 -- --headed`

Expected: PASS; teardown reports residual customers `0`, ports terminated and `ipc_mrx_e2e_sandbox` dropped.

- [ ] **Step 6: Run broader Frontend regression**

Run: `npm run test:unit -w frontend`

Expected: all Frontend tests PASS.

- [ ] **Step 7: Run final hygiene checks and record evidence**

Run: `git diff --check`, verify no listeners on `5174/5263`, and query `information_schema.schemata` for sandbox count `0`. Update `.planning/WORK.md` with RED→GREEN, browser measurements, review-gate format and final `IDLE` status.

- [ ] **Step 8: Do not commit or push**

Report the working-tree changes and await explicit Owner authorization.
