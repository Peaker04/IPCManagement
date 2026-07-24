---
title: Build customer weekly-menu template workbench
date: 2026-07-24
priority: high
phase: unassigned
status: pending
---

# Build customer weekly-menu template workbench

Implement the approved SAP Fiori workflow for a system-wide ANV default template plus customer-specific workbook layout and default-menu overrides.

## Required work

- Preserve `weekly-menu-template-ANV-2026-07-20 (4).xlsx` as the immutable system fallback and verify its real workbook structure.
- Extend the customer mapping contract beyond `SheetNameHint` and `LabelColumn` to cover A1 range, header row, dish-name column, day columns, row filters and template version metadata.
- Add a Fiori-style mapping workbench with sheet selection, mouse range selection, keyboard/A1 input and semantic role assignment.
- Show a canonical menu preview with day/dish counts, warnings and cell-level recovery guidance before save.
- Store customer-specific default menu content independently from the workbook layout mapping and support reset to the ANV default.
- Add parser, API, persistence, frontend state, accessibility and regression coverage; run GitNexus impact analysis before editing every affected symbol.

## Completion gate

- A customer without an override imports and displays the ANV default menu.
- An admin can save a different layout and default menu for one customer without affecting any other customer.
- Reopening the workbench restores the saved mapping and version metadata.
- Preview is read-only; save is explicit and errors identify the relevant sheet/cell/range.
- Desktop interaction supports mouse and keyboard; narrow screens provide a non-grid fallback summary.
