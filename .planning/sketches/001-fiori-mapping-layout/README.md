---
sketch: 001
name: fiori-mapping-layout
question: "Which page structure best balances workbook context, mapping controls and preview?"
winner: "C"
tags: [layout, fiori, excel, desktop]
---

# Sketch 001: Fiori Mapping Layout

## Design Question

Which page structure lets an admin understand the source workbook, define a customer-specific mapping and verify the normalized menu without losing context?

## How to View

Open `.planning/sketches/001-fiori-mapping-layout/index.html` in a browser.

## Variants

- **A: Split Workbench** — Spreadsheet stays large on the left; mapping inspector and live preview remain visible on the right.
- **B: Guided Wizard** — One focused task per step with a full-width grid and a summary before save.
- **C: Template Studio** — Customer/template navigation, workbook canvas and mapping inspector remain visible in three columns.

## Selected Direction

**Variant C: Template Studio** was selected because customer/template navigation, workbook context, mapping properties and version status remain visible together. This best supports repeated administration across many customer-specific templates.

## What to Look For

Compare source-data visibility, perceived complexity, ease of switching customers/templates and confidence before saving. Desktop is the primary editing target; the viewport tool demonstrates why narrow screens need a summary fallback.
