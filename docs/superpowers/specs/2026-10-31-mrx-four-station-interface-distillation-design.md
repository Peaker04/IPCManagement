# MRX Four-Station Interface Distillation — Design

## Intent

Reduce cognitive load and wasted workspace across the four MRX stations exercised by the G6 operational flow while preserving every business rule, permission, state transition, data contract and audit guarantee.

The first and strongest target is `/weekly-menu?view=mrx-batch`, where the current source editor presents a long editable matrix beside an empty impact panel, while unrelated actions, lifecycle status, success feedback and cross-station navigation all compete for attention. The same evidence-driven simplification rule then applies to `/warehouse`, `/chef` and `/reconciliation` during browser verification.

## Users and operating context

- MRX Coordinator edits weekly source servings and dishes, previews impact and submits changes.
- MRX Admin/Manager reviews or directly applies authorized source changes.
- MRX Storekeeper issues daily materials from frozen lineage.
- Head Chef reads frozen cooking instructions and exports production documents.
- MRX Manager investigates variances and completes reconciliation.
- Desktop and tablet workstations only; keyboard operation and 200% browser zoom remain required.

## Goals

1. Make the current task and next valid action obvious within one glance.
2. Give the primary work object the majority of Zone 3 rather than reserving space for inactive panels.
3. Reduce repeated labels, duplicate actions and persistent feedback chrome without hiding required information.
4. Preserve Operational Compact Density, sticky table context and tabular numeric alignment.
5. Use progressive disclosure for impact review, exports and secondary navigation.
6. Apply the same hierarchy rules to the four G6 MRX stations when rendered evidence shows the same defect.
7. Keep desktop and tablet interaction grammars consistent and keyboard-complete.

## Non-goals

- No redesign of all 14 routes.
- No Backend, API, database, RBAC, mode, audit or lifecycle change.
- No new styling token, dependency, primitive family, route or navigation system.
- No replacement of `WorkspaceFrame`, `TelemetrySubbar`, `SplitView`, `DataGrid`, `StateBoundary`, `ActionGuard` or existing UI primitives.
- No speculative cleanup of a page that browser/source evidence does not connect to the approved MRX flow.
- No conversion of operational tables into decorative cards.
- No removal of information needed for stock, lineage, conflict or approval decisions.

## Anti-goals

- Do not solve density by shrinking text below 12px or reducing touch/focus usability.
- Do not hide primary actions in an overflow menu.
- Do not stack multiple banners, sticky bars or overlays.
- Do not use a permanent empty detail pane as a layout placeholder.
- Do not make compact and desktop flows behave as two unrelated products.
- Do not call viewport emulation evidence of actual browser zoom.

## Approved approach

Use an evidence-driven four-station distillation pass:

1. Redesign the MRX source editor around one active step at a time.
2. Run the real G6 flow in a dedicated sandbox browser.
3. At the three downstream stations, correct only duplicated hierarchy, inactive reserved space, repeated context or competing actions demonstrated by the connected source/rendered flow.
4. Reuse existing components and contracts; prefer deletion, relocation and conditional composition over new abstractions.

## Alternatives considered

### 1. Weekly-menu-only surgical refinement

Smallest diff and lowest immediate risk, but leaves the same hierarchy and duplication problems at downstream MRX handoffs. Rejected because the Owner explicitly approved a connected four-station experience.

### 2. Evidence-driven four-station distillation — selected

Repairs the source editor first, then applies the same rules only where G6 demonstrates equivalent friction. Best balance of consistency, testability and bounded risk.

### 3. Shared-workbench rewrite before migration

Could enforce stronger global uniformity but would expand architecture scope in a dirty feature workspace and risk unrelated routes. Rejected as unnecessary.

## Route and work-object contracts

### 1. `/weekly-menu?view=mrx-batch` — source preparation

**Primary work object:** source edit grid while editing; batch preview when not editing.

#### Header and telemetry

- Preserve customer, week, batch status, refresh and the current lifecycle owner.
- While source editing is open, hide actions unrelated to editing (`Món trong lô`, import and legacy schedule editing) from the immediate action cluster.
- Keep one explicit exit: `Đóng điều chỉnh nguồn`.
- Keep lifecycle and source-version context visible but quiet; do not repeat explanatory sentences already encoded by status and primary action.
- Render success as a compact one-line operational acknowledgement. A cross-station CTA may remain only when it is the valid next handoff; it must not compete with the current editor action.

#### Source grid

- The grid owns all available Zone 3 width until the user asks to review impact.
- Keep the sticky header and frozen `Ngày / Ca` column.
- Keep rows grouped by date and shift, but reduce repeated visual weight: date/shift is the group anchor, serving inputs are compact numeric columns, and slot label + dish selector remain one aligned pair.
- Locked dates stay visible in context, disabled and labeled with their lock reason; they are not moved into a separate screen.
- Preserve native horizontal scrolling where necessary; never clip the first identifying column or header.

#### Review and apply

- Before any draft change, show no persistent empty impact pane.
- Once changes exist, expose one secondary action with the exact count, for example `Xem ảnh hưởng (3)`.
- Activating review opens the existing impact panel:
  - desktop: right-side detail within `SplitView`;
  - below `lg`: sequential full-width detail with `Quay lại danh sách`.
- Reason entry belongs to the review step, after impact context is available.
- `Xem ảnh hưởng` remains secondary; the role-specific `Áp dụng ngay` or `Gửi duyệt` is the single primary action after a valid preview.
- Returning to the grid preserves draft, reason and preview state until the draft changes.
- Existing confirmation remains mandatory for direct apply.

### 2. `/warehouse?view=mrx-daily` — daily issue

**Primary work object:** selected day’s issue lines or issue-history grid.

- Keep batch/date scope and day tabs visible.
- Preserve `Điền đủ toàn bộ`, supplemental issue and submit behavior, but only the valid terminal write action is primary.
- Secondary navigation to preparation/history/reconciliation must not compete in the header with issue confirmation.
- Replace any ad-hoc mutation error strip with the existing feedback authority so conflict/error recovery has one visual owner.
- Keep revision actor/time/role adjacent to the affected lines; do not elevate it into a competing page-level banner.
- Do not redesign demand/history into route-level navigation; they are views of the same warehouse work object.

### 3. `/chef?view=mrx-cooking` — cooking instructions

**Primary work object:** frozen dish groups by day, shift and menu variant.

- Keep batch and shift filters as the dominant controls.
- Keep item count, serving count and material-line count as one compact telemetry sentence rather than three equal visual destinations.
- Export/print remain secondary utilities and may be visually grouped; none becomes the page primary action because this station is read/export oriented.
- Preserve menu-variant badges and accessible region labels.
- Remove only redundant explanatory copy or repeated scope already visible in the header/list.

### 4. `/reconciliation` — variance decision and completion

**Primary work object:** active reconciliation view selected by canonical sidebar/URL state.

- Keep batch/date/customer scope and lifecycle status.
- Eliminate duplicate ownership of `Phiếu nấu Bếp` and `Món ăn trong lô`; each action appears in one canonical location only.
- On the lines view, surface blockers and unresolved counts before completion; completion is the single terminal primary action only when allowed.
- Report exports remain one quiet secondary utility for the active report, not a competing action row.
- Keep conflict recovery, permission denial and partial-lineage states distinct.

## Shared hierarchy rules

1. **One task, one primary action:** each visible work context has at most one filled/default button.
2. **No inactive reserved pane:** a panel without decision-relevant data does not occupy persistent width.
3. **One owner per message/action:** duplicated navigation, banners or explanatory copy are deleted from the weaker owner.
4. **Progressive disclosure:** secondary detail appears only when requested or when it blocks the next action.
5. **Context stays visible:** customer, week/date, batch and immutable status remain available while editing or reviewing.
6. **Feedback is proportional:** success is compact; conflict/error remains prominent with recovery; locked states stay line-local when possible.
7. **No new visual vocabulary:** use existing tokens, `Button`, `Badge`, `InlineBanner`, `Input`, `SearchableCombobox`, `SplitView`, `DataGrid`, `TelemetrySubbar` and `WorkspaceFrame`.

## Responsive and accessibility behavior

- Desktop `lg+`: grid may transition to master/detail only after review is requested.
- Tablet portrait and actual 200% zoom: sequential grid → detail → grid; no side-by-side compression.
- Focus moves to the review heading when detail is opened and returns to the review trigger when returning to the grid.
- Existing combobox Arrow/Home/End/Enter/Escape contract remains intact.
- Sticky controls must not obscure the last editable row.
- No document-level horizontal overflow; table-level scrolling remains allowed.
- Controls retain accessible names when visible labels shorten responsively.
- Reduced motion and the existing <=150ms interaction policy remain unchanged.

## State matrix

The redesign must preserve all six mandatory states at each affected route:

- `loading`: geometry-matched workbench/table skeleton; no blank page.
- `empty`: one instructional owner with the next valid action.
- `error`: one message with retry/recovery; draft retained where applicable.
- `permission-denied`: no write action leakage.
- `partial`: legacy/missing-lineage explanation and safe read-only path.
- `write-reconciliation`: pending, conflict, locked and successful mutation states remain explicit.

Additional source-editor states:

- no draft changes: full-width grid, review action disabled/absent;
- dirty draft: full-width grid, counted review trigger;
- preview pending: current content retained, action shows pending state;
- preview ready: impact detail visible, one role-specific primary action;
- stale/locked conflict: detail remains open, draft retained, affected dates identified;
- success: compact acknowledgement, fresh source/batch state reloaded.

## RBAC and mode constraints

- Server mode remains `MATERIAL_RECONCILIATION`; `DOM-MODE-1` is unchanged.
- Existing route/navigation guards remain authoritative.
- Source editing remains guarded by `RECON.SOURCE_CHANGE.PREVIEW` and `reconciliation.source.read`.
- Admin/Manager direct apply, Coordinator submit and Warehouse read restrictions remain unchanged.
- Simplification must not expose hidden actions by merely moving them.

## Implementation boundaries

Expected existing owners:

- `MrxBatchWorkbench.tsx`
- `MrxSourceEditGrid.tsx`
- `MrxSourceChangePanel.tsx`
- existing MRX header branches where duplicate action ownership is proven
- `MrxDailyIssueWorkbench.tsx` and existing warehouse branches
- `MrxCookingWorkbench.tsx` and existing kitchen branches
- `ReconciliationPage.tsx` and existing reconciliation branches
- existing component tests and permanent G6 flow

Do not create `*V2`, `*New`, route-specific primitive copies or new CSS files. Styling remains in existing utility classes and canonical `frontend/src/styles/index.css` tokens.

## Test and evidence strategy

### Test value gate

- Extend an existing strongest-boundary test when a visible contract changes.
- Add no screenshot-only, source-string or duplicate implementation tests.
- Do not mock the workbench component or feature hook under test.
- Keep C# / generated-contract-shaped fixtures.

### RED→GREEN contracts

1. Source editor begins with a full-width grid and no inactive impact pane.
2. Dirty changes reveal the counted review action.
3. Review opens desktop detail and compact sequential detail.
4. Back preserves draft/reason; changing draft invalidates stale preview if the current hook contract requires it.
5. Only one role-valid primary mutation action appears.
6. Duplicate downstream actions removed from their weaker owner remain reachable at their canonical owner.
7. Warehouse errors use one recoverable message owner.

### Browser verification

Run the guarded sandbox G6 flow in dedicated Chrome and inspect:

- desktop `1440×900`;
- tablet portrait `768×1024`;
- equivalent compact viewport `720×450`;
- actual browser zoom 200% when OS focus control is available;
- Coordinator, Admin/Manager, Storekeeper and Head Chef stations;
- keyboard-only grid → review → back/apply traversal;
- no document-level overflow, hidden primary action or duplicate CTA;
- mutation → DB transition → reload evidence remains unchanged.

Capture bounded before/after screenshots for the four route checkpoints. Screenshots support composition review; DOM/network/DB assertions remain acceptance authority.

## Rollout and stopping rule

- Implement weekly-menu source-editor distillation first.
- Run focused component tests and inspect desktop/tablet before touching downstream routes.
- Continue to Warehouse, Chef or Reconciliation only for an issue matching this design and demonstrated by connected source or rendered G6 evidence.
- Stop after one batched visual correction pass and one confirmation pass. Do not expand into a general visual cleanup campaign.

## Risks and mitigations

- **Draft loss while changing composition:** preserve current hook ownership; test grid → detail → grid and close/reopen behavior.
- **Action leakage during relocation:** retain `ActionGuard` at the action owner and verify actor matrix.
- **Dense table regression:** preserve T7/T8, frozen context and minimum 12px text.
- **Hidden downstream utilities:** prove every removed duplicate remains reachable at its canonical owner.
- **Browser evidence instability:** separate actual OS zoom evidence from viewport emulation and report blocked evidence honestly.
- **Scope creep:** four routes only, with evidence-based stopping rule.

## Success criteria

- The source grid uses full Zone 3 width until impact review is requested.
- A first-time operator can identify the current scope, editable area and next valid action without interpreting an empty panel.
- No visible context presents more than one primary action.
- No duplicate cross-station action remains on the reviewed MRX routes.
- Desktop, tablet and keyboard flows remain complete.
- Existing MRX business, persistence, concurrency and RBAC tests remain green.
- No dependency, styling token, API, database or mode-boundary change.
