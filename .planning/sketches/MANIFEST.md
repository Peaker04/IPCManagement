# Sketch Manifest

## Design Direction

SAP Fiori-inspired compact desktop workbench for an unfamiliar but high-value admin task. The interface prioritizes a faithful spreadsheet grid, explicit semantic mapping, predictable feedback, keyboard parity and a safe read-only preview before any customer template is saved.

## Reference Points

- SAP Fiori wizard floorplan for progressive guidance and final review.
- SAP Fiori grid table for preserving spreadsheet row/column relationships.
- Existing IPC weekly-menu import dialog, customer selector, status messaging and compact operational tables.
- Default workbook: `weekly-menu-template-ANV-2026-07-20 (4).xlsx`; customer overrides must remain independent.

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|-----------------|--------|------|
| 001 | Fiori mapping layout | Which page structure best balances workbook context, mapping controls and preview? | C — Template Studio | layout, fiori, excel, desktop |
| 002 | Range selection interaction | Which interaction makes mouse selection, A1 input and semantic role assignment easiest? | - | interaction, grid, accessibility |
| 003 | Preview and diagnostics | How should normalized menu results and cell-level errors be reviewed before save? | - | validation, preview, feedback |
