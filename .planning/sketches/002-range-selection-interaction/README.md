---
sketch: 002
name: range-selection-interaction
question: "Which interaction makes mouse selection, A1 input and semantic role assignment easiest?"
winner: "D"
tags: [interaction, grid, accessibility, fiori]
---

# Sketch 002: Range Selection Interaction

## Design Question

How should an admin select an Excel region and tell the system what that region means without requiring spreadsheet expertise?

## How to View

Open `.planning/sketches/002-range-selection-interaction/index.html` in a browser.

## Variants

- **A: Drag + Context Bar** — Drag over cells, then assign the selected range from a contextual toolbar.
- **B: Two Corners** — Choose the first and last cell explicitly; the system fills the rectangle between them.
- **C: Accessible Hybrid** — A1 range input is primary, while click/drag selection keeps the address synchronized.
- **D: Hybrid + Context Bar** — Keeps C's synchronized A1/keyboard workflow and adds A's immediate role-assignment toolbar after selection.

## Selected Direction

**Variant D: Hybrid + Context Bar** was selected. Mouse drag, A1 input and keyboard expansion stay synchronized; a contextual toolbar assigns the range immediately, while the persistent inspector handles detailed properties and validation.

## What to Look For

Try selecting a range in each variant. Compare discoverability, precision, accidental selection risk and whether the same task remains usable without a mouse.
