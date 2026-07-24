# Range Mapping & Accessibility

## Design Decisions

- Use Sketch 002 Variant D, **Hybrid + Context Bar**.
- Let users drag across cells for speed. While dragging, compute the normalized rectangle from the start/end cells and update the visible selection continuously.
- Keep a visible A1 address such as `C7:I31` synchronized with the grid. Editing the address must repaint the same selection; invalid addresses receive inline feedback.
- After selection, show a contextual toolbar close to the range with common roles: `Bảng menu`, `Header ngày`, `Nhãn món`, and `Bỏ qua`.
- Keep the right inspector for detailed properties and rules. The contextual toolbar handles the frequent action; the inspector handles precision and exceptions.
- List all saved semantic regions in the left rail with their A1 address and useful counts.
- Support keyboard parity: arrow-key cell movement, `Shift + Arrow` range expansion, `Ctrl + Enter` role assignment, and `Esc` cancellation.
- Use focus outlines and text labels. Color may reinforce a semantic region but cannot be the only indicator.

## CSS Patterns

```css
.sheet td.selected {
  background: #d9ecff;
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.sheet td.anchor {
  background: #b9ddff;
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.selection-bar {
  position: sticky;
  bottom: 8px;
  z-index: 8;
  display: flex;
  width: fit-content;
  margin: -48px auto 8px;
  border: 1px solid #7eb6ea;
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  padding: 7px;
}

.a1-input {
  min-height: 42px;
  font: 600 16px var(--font-mono);
}
```

Selection state should be stored as start/end coordinates and normalized before display or persistence:

```ts
type CellPoint = { row: number; column: number }
type CellRange = { start: CellPoint; end: CellPoint }

const normalized = {
  firstRow: Math.min(range.start.row, range.end.row),
  lastRow: Math.max(range.start.row, range.end.row),
  firstColumn: Math.min(range.start.column, range.end.column),
  lastColumn: Math.max(range.start.column, range.end.column),
}
```

## HTML Structures

```html
<aside class="mapped-regions">…named regions with A1 addresses…</aside>
<section class="workbook-canvas">
  <div role="grid" aria-label="Workbook ANV 25k">…cells…</div>
  <div class="selection-bar" role="toolbar" aria-label="Gán vai trò cho vùng">…</div>
</section>
<aside class="mapping-inspector">
  <label for="range-a1">Vùng đang chỉnh</label>
  <input id="range-a1" value="C7:I31">
  …detailed properties and validation…
</aside>
```

Announce selection changes and validation results through a polite live region. Do not move focus automatically after every drag; preserve the user's active cell.

## What to Avoid

- Do not make two-corner selection the primary interaction. It is precise but slower and less familiar than spreadsheet drag selection.
- Do not offer mouse-only selection or hover-only role assignment.
- Do not hide the A1 range after a drag; it is the clearest auditable representation of the saved mapping.
- Do not overload the floating toolbar with advanced rules. Keep it limited to frequent semantic roles.

## Origin

Synthesized from sketch: 002-range-selection-interaction, winner D.
Source file: `sources/002-range-selection-interaction/index.html`.
