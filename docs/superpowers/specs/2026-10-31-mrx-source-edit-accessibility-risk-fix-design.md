# MRX Source Edit Accessibility Risk Fix — Design

## Intent

Close the measured P1 failures on `/weekly-menu?view=mrx-batch`: keyboard users cannot choose a dish, and the editable source grid disappears at actual browser zoom 200% and tablet portrait `768×1024`.

## Goals

- Preserve the existing desktop two-column MRX source-edit workbench.
- Make the complete source-edit flow usable below the `lg` breakpoint and at actual 200% browser zoom.
- Support keyboard traversal and dish selection with visible, retained focus.
- Keep existing MRX RBAC, day locks, drafts, preview/apply behavior, API contracts and styling authority unchanged.

## Non-goals / Anti-goals

- No redesign of the weekly-menu route or generic app shell.
- No new dependency, primitive, styling token, modal, API or Backend change.
- Do not stack an unbounded seven-day grid above the impact panel on compact viewports.
- Do not solve the issue by lowering breakpoints or forcing two cramped columns.

## Approved Approach

Use the existing `SplitView` master/detail contract as a sequential compact workflow:

- Desktop `lg+`: continue rendering the source grid and impact panel side by side.
- Below `lg`: open on the editable source grid; expose one secondary `Tiếp tục xem ảnh hưởng` action after the grid; selecting it reveals the existing impact panel.
- In compact detail, `Quay lại danh sách` returns to the source grid and preserves the draft. The toolbar `Đóng điều chỉnh nguồn` remains the editor exit.
- Reset compact detail state whenever the source editor is opened or closed so reopening always starts at the editable grid.

Repair the shared `SearchableCombobox` using the existing input/listbox DOM:

- Track one active option while open.
- Implement Arrow Down/Up, Home/End and Enter selection.
- Publish `aria-activedescendant` and stable option IDs.
- Keep focus on the combobox when Escape closes the list.
- Keep pointer selection and filtering behavior unchanged.

## Alternatives Considered

1. **Approved: sequential compact master/detail** — preserves desktop behavior and makes both compact steps reachable without a long stacked page.
2. **Stack grid and panel vertically** — simpler state, but the large grid pushes the decision panel far below the viewport and is poor at `720×450`.
3. **Lower the side-by-side breakpoint** — smallest CSS diff, but remains unusable at 200% zoom and produces cramped tablet columns.

## Verification Contract

- RED→GREEN component regression for compact source-grid-first flow, transition to impact panel, back-to-grid draft preservation, and toolbar exit.
- RED→GREEN shared combobox regression for Arrow navigation, Enter selection, `aria-activedescendant`, Escape close and focus retention.
- Focused Frontend suites, changed-scope ESLint, production build and `git diff --check`.
- Guarded headed-Chrome rerun on `ipc_mrx_e2e_sandbox` proving keyboard-only completion, actual DPR `2` / effective `720×450`, and tablet portrait `768×1024`.

## Constraints

`DEFAULT != MATERIAL_RECONCILIATION`; shared tokens/primitives only; no synthetic fixtures, fake API fallback, allowlist padding, test-only seams, commit or push without separate Owner authorization.
