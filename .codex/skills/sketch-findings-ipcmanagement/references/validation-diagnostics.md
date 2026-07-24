# Validation & Diagnostics

## Design Decisions

- Use Sketch 003 Variant A, **Source First**, during template mapping and correction.
- Keep the workbook grid dominant. Mark affected cells and connect every diagnostic to an exact sheet/cell/range.
- Show semantic message states above the workspace: success, warning, and error. Include a concise summary and counts; never communicate severity through color alone.
- Keep a diagnostic inspector with day/item/error/warning counts, an ordered issue list, specific recovery guidance, and a compact normalized-menu preview.
- Clicking a diagnostic must focus and reveal the associated source cell. The selected issue should also expose raw source evidence.
- Errors are blockers and disable `Lưu template`. Warnings remain visible and may allow save after acknowledgement. A valid state clearly announces readiness.
- Preview is always read-only. Parsing, state switching, filtering, or opening a diagnostic must never persist menu data.
- Keep the path back to range mapping visible and preserve the current preview/diagnostic state when navigating back.

## CSS Patterns

```css
.source-layout {
  display: grid;
  grid-template-columns: minmax(720px, 1fr) 360px;
  gap: 12px;
}

.cell-error {
  background: var(--color-danger-soft);
  box-shadow: inset 0 0 0 2px var(--color-danger);
}

.cell-warning {
  background: var(--color-warning-soft);
  box-shadow: inset 0 0 0 2px var(--color-warning);
}

.issue {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  border-left: 4px solid var(--issue-color);
  padding: 9px;
}

.save-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
```

Represent validation state explicitly instead of deriving it from display color:

```ts
type DiagnosticSeverity = 'warning' | 'error'

type MenuDiagnostic = {
  severity: DiagnosticSeverity
  code: string
  message: string
  recovery: string
  sheetName: string
  cellRange: string
}

const canSave = diagnostics.every(item => item.severity !== 'error')
```

## HTML Structures

```html
<div class="validation-banner" role="status">…summary and counts…</div>
<main class="source-layout">
  <section class="source-workbook">…grid with marked cells…</section>
  <aside class="diagnostic-inspector">
    <section>…metrics…</section>
    <ol>…diagnostics linked to cells…</ol>
    <section>…compact canonical preview…</section>
  </aside>
</main>
```

Use `aria-live="polite"` for validation summaries and preserve focus when results refresh. On submit with blockers, move focus to the error summary or first invalid diagnostic, not an arbitrary cell.

## What to Avoid

- Do not make the normalized-menu review surface primary while the user is correcting a mapping; this hides the source of parser failures.
- Do not require a side-by-side full workbook/full preview at all times; it compresses both tables and increases horizontal density.
- Do not show only a generic message such as `menuRows: no valid rows`. Always identify sheet, cell/range, cause, and recovery action.
- Do not auto-save after validation or auto-fix without an explicit confirmation.

## Origin

Synthesized from sketch: 003-preview-and-diagnostics, winner A.
Source file: `sources/003-preview-and-diagnostics/index.html`.
