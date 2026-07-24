---
sketch: 003
name: preview-and-diagnostics
question: "How should normalized menu results and cell-level errors be reviewed before save?"
winner: "A"
tags: [validation, preview, feedback, fiori]
---

# Sketch 003: Preview and Diagnostics

## Design Question

How should an admin compare source Excel data with the normalized menu, understand warnings/errors and recover before saving a customer template?

## How to View

Open `.planning/sketches/003-preview-and-diagnostics/index.html` in a browser.

## Variants

- **A: Source First** — Keep the workbook grid dominant and attach a diagnostic inspector with direct links to cells.
- **B: Compare Split** — Show source and normalized output side by side with a collapsible issue drawer.
- **C: Review Queue** — Make the canonical menu the primary review surface and keep source evidence available on demand.

## Selected Direction

**Variant A: Source First** was selected. Diagnostics stay attached to highlighted source cells, while the inspector provides issue counts, recovery guidance and a compact normalized-menu preview. This best supports fixing mapping errors before save.

## What to Look For

Use the state buttons to compare valid, warning and error conditions. Check which layout makes the cause, affected cell and recovery action easiest to understand without hiding the resulting menu.
