# IPC Design Tokens

This reference is the source of truth for Phase 01.4 UI deep hardening. It documents the existing IPC CSS variables, `ipc-*` classes, and shared primitives already present in `frontend/src/styles/index.css` and `frontend/src/components/common`.

The goal is consistency in dense operational screens, not a second design system.

Phase 01.4 maps this contract to UIDH-02 through UIDH-08: stable task-card layout, bounded controls, contained tables/lists, accessible names and focus, reduced-motion safety, and severity that is not communicated by color alone.

## Token Sources

Use `frontend/src/styles/index.css` as the implementation source:

| Token family | Current source | Use |
| --- | --- | --- |
| Brand | `--ipc-primary`, `--ipc-primary-hover`, `--ipc-primary-soft`, `--ipc-primary-600` | Primary actions, active navigation, selected tabs, key operational accents |
| Success | `--ipc-success`, `--ipc-success-soft` | Completed, stable, accepted, safe stock state |
| Warning | `--ipc-warning`, `--ipc-warning-soft` | Needs review, near threshold, pending operational attention |
| Danger | `--ipc-danger`, `--ipc-danger-soft` | Blocking issue, shortage, rejected item, threshold breach |
| Neutral | `--ipc-slate-50` through `--ipc-slate-900` | Text, borders, table structure, secondary actions, metadata |
| Layout | `--ipc-space-*`, `--ipc-radius-*`, `--ipc-shell-width` | Spacing, radius, shell sizing, dense panel rhythm |
| Depth | `--ipc-shadow-xs`, `--ipc-shadow-sm`, `--ipc-shadow-md`, `--ipc-shadow-lg` | Panels, command bars, cards, hover affordance |
| Focus | `--ipc-focus-ring`, `--ring` | Keyboard-visible focus across controls |
| Motion | `--ipc-transition-fast`, `--ipc-transition-normal`, `--ipc-transition-smooth` | Short feedback transitions only |

## Semantic States

| State | Preferred primitive or class | Guidance |
| --- | --- | --- |
| Primary | `.ipc-button-primary`, active `.ipc-nav-link`, active `.ipc-view-switcher button` | Use for the main page command or current route/view. Do not use primary for every clickable item. |
| Secondary | `.ipc-button-ghost`, neutral slate classes, default panel/table structure | Use for supporting actions and metadata. Keep contrast clear but quiet. |
| Success | `.ipc-button-success`, `StatusBadge variant="success"`, `.is-success` lane classes | Use only when work is accepted, stable, completed, or safe. |
| Warning | `.ipc-button-warning`, `InlineAlert variant="warning"`, `StatusBadge variant="warning"`, `.is-warning` lane classes | Use for review-needed state that is not blocked. Warning state should be static by default. |
| Danger | `.ipc-button-danger`, `InlineAlert variant="danger"`, `StatusBadge variant="danger"`, `.is-danger` lane classes | Use for blockers, shortage, rejection, failed validation, or breached threshold. |
| Info | `InlineAlert variant="info"`, `.ipc-context-item.is-info`, blue info accents in existing common classes | Use for workflow notes and demo/local-data disclosures. Prefer `InlineAlert` or `ContextStrip` before page-local blue badges. |
| Neutral | `StatusBadge variant="neutral"`, `.is-neutral`, slate text/borders | Use for idle, draft, unknown, or non-urgent metadata. |
| Disabled | Native disabled controls plus `.ipc-input:disabled`, `.ipc-select:disabled`, `.ipc-textarea:disabled` | Use real `disabled` attributes when controls cannot be used. Do not simulate disabled state with opacity only. |
| Focus | `:focus-visible`, `.ipc-button:focus-visible`, `.ipc-input:focus-visible`, `.ipc-select:focus-visible`, `.ipc-textarea:focus-visible` | Keep visible focus rings. Do not remove outlines unless replaced with an equally visible ring. |
| Empty | `.ipc-empty-state`, `.ipc-role-inbox.is-empty`, `.ipc-approval-queue.is-empty`, `.ipc-demand-summary.is-empty`, `.ipc-document-rail.is-empty`, `.ipc-stock-movement-table.is-empty` | Empty states should explain operational absence briefly and keep layout stable. |
| Selected | active `.ipc-view-switcher button`, active `.ipc-nav-link`, `.ipc-swimlane-step.is-active` | Selected state uses primary-soft surfaces plus a visible border or inset indicator. |

## Shared Primitive Coverage

Prefer these shared primitives before adding page-local color maps:

| Primitive | Existing coverage | Use |
| --- | --- | --- |
| `InlineAlert` | `warning`, `danger`, `info`; default icons; action slot | Local status, validation, demo-data notes, and selective workflow feedback. Keep existing `alert()` and `prompt()` flows as-is. |
| `StatusBadge` | `neutral`, `success`, `warning`, `danger`; semantic dot | Compact state labels in tables, queues, rails, and command metadata. Use neutral for non-urgent informational chips unless an `InlineAlert` or `ContextStrip` is more appropriate. |
| `DataTableShell` | `.ipc-table-shell w-full overflow-x-auto` | Wrap wide operational tables. Table overflow belongs inside this shell, not on the document body. |
| `CommandBar` | Leading context plus action grouping | Page-level controls, filters, and route actions. Keep command sets wrapping cleanly on mobile. |
| `SectionPanel` | `default`, `danger`, `dark`; title, badge, description, footer | Operational sections and table panels. Use `tone="dark"` only where the current operation-surface styling intentionally requires it. |
| `ContextStrip` and lane primitives | `info`, `success`, `warning`, `danger`, neutral structure | Dense route context, workflow queues, exceptions, documents, stock movements, and swimlanes. |

No global toast provider, notification dependency, dialog replacement, route edit, API edit, Redux edit, or auth edit belongs to this token layer.

## Buttons And Controls

- Use `.ipc-button-primary` for the one primary command on a surface.
- Use `.ipc-button-success`, `.ipc-button-warning`, and `.ipc-button-danger` only when the action itself carries that semantic outcome.
- Use `.ipc-button-ghost` for secondary commands, filters, exports, and navigation-like actions.
- Use `.ipc-button-bounded` for task-card and rail actions that need content-aware min/max bounds.
- Keep icons from `lucide-react` where the surrounding UI already uses icons.
- Keep text short enough for 320px layouts; command groups and bounded buttons must wrap inside their surface instead of clipping.
- Icon-only controls require an `aria-label` or visible adjacent label.
- Inputs use `.ipc-input`, selects use `.ipc-select`, compact table selects use `.ipc-compact-select`, and text areas use `.ipc-textarea`.
- Inputs need visible labels through `.ipc-field-label` or an explicit accessible name when a visible label is already provided by the surrounding table/header.

## Task Cards

Use the task-card contract for RoleInbox, approval queue cards, exception cards, demand cards, and lane summaries that carry an owner and next action.

```tsx
<article className="ipc-task-card is-warning">
  <div className="ipc-task-card-main">...</div>
  <div className="ipc-task-card-aside">...</div>
</article>
```

Rules:

- Desktop cards reserve a right rail for the status at the top and primary action at the bottom.
- Mobile cards collapse to one column without changing the title, status, metadata, or action order.
- Owner and next action stay in two metadata columns through `.ipc-task-card-meta`; long Vietnamese labels wrap inside the card.
- Use the main `StatusBadge` and card tone instead of duplicate urgency chips.
- Hover/focus states must not change card dimensions or move neighboring cards.

## Tables

Use this structure for operational tables:

```tsx
<DataTableShell>
  <table className="ipc-data-table min-w-[720px]">
    ...
  </table>
</DataTableShell>
```

Rules:

- Keep document-level horizontal overflow absent. Wide tables scroll inside `DataTableShell`.
- Add explicit `min-w-*` only to the table that needs it.
- Pair growing tables/lists with `PaginationBar`, local paging, or an equivalent containment rule before they can exceed a small operational batch.
- Use `.ipc-numeric-cell` for quantities, money, percentages, and deltas that need right alignment and tabular figures.
- Use sticky headers from `.ipc-table-shell .ipc-data-table thead` for dense scan tables.
- Use `StatusBadge` inside table cells for status, not ad hoc red/amber/green pill classes.
- Do not remove first-column left alignment unless the table is a fixed schedule matrix.

## Panels And Page Structure

Operational pages should be composed from:

- `.ipc-page-stack` for route body spacing.
- `OperationalFrame` for route eyebrow, title, command area, context strip, rail, and body.
- `CommandBar` for filters and page actions.
- `SectionPanel` for repeated operational sections.
- `.ipc-section-header`, `.ipc-section-title`, and `.ipc-section-description` for panel heading rhythm.
- `.ipc-context-strip` and `.ipc-context-item.is-*` for compact route facts.

Avoid landing-page sections, oversized hero layouts, decorative gradients, and low-density marketing composition.

## Motion

Motion is operational feedback only:

- Use short hover, active, focus, and panel transition feedback through `--ipc-transition-*`.
- Normal, neutral, success, and warning states should be static.
- Do not use pulse, bounce, ping, or staggered workflow entrance animation for normal route content.
- Nonessential motion must respect `prefers-reduced-motion`.
- Do not add bounce, ping, or continuous decorative animation to tables, queues, command bars, or route headers.

Existing motion classes and keyframes are centralized in `index.css`: `ipc-fade-in`, `ipc-slide-in-left`, and `ipc-inline-alert-enter`.

## Responsive Rules

- The minimum supported viewport width is 320px.
- Command bars collapse to full-width rows at small widths through `.ipc-command-bar`, `.ipc-command-bar-main`, and `.ipc-command-bar-actions`.
- Compact view switchers use `.ipc-view-switcher.is-compact` and allow buttons to wrap.
- Lane items, role inbox cards, approval records, document cards, and table shells must use `min-width: 0` where nested in grids or flex containers.
- Button text, badge text, and tabs should wrap or shrink within the existing responsive rules; do not hide required operational labels.

## Page Cleanup Checklist

Before adding page-local classes, check:

1. Can `InlineAlert`, `StatusBadge`, `DataTableShell`, `CommandBar`, or `SectionPanel` handle this state?
2. Is the color already represented by `--ipc-primary`, success, warning, danger, or slate tokens?
3. Is this a local info note better represented by `InlineAlert variant="info"` or `.ipc-context-item.is-info`?
4. Does the table overflow stay inside `DataTableShell` at 320px?
5. Is focus visible for every keyboard-reachable command?
6. Is motion static unless the state is truly urgent?
7. Are existing `alert()` and `prompt()` flows preserved?

If the answer requires route, API, Redux, auth, or workflow behavior changes, stop. That is outside Phase 01.4 hardening scope.
