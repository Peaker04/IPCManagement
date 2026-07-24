---
name: sketch-findings-ipcmanagement
description: Validated SAP Fiori design decisions, CSS patterns, and interaction direction for IPCManagement customer-specific weekly-menu template implementation.
---

<context>
## Project: IPCManagement

Use a compact SAP Fiori-inspired desktop workbench for customer-specific weekly-menu templates. Preserve spreadsheet row/column context, make semantic mapping explicit, support mouse and keyboard equally, and keep preview read-only until an explicit save.

Reference points: SAP Fiori grid table and wizard guidance, the existing IPC weekly-menu import surface, and `weekly-menu-template-ANV-2026-07-20 (4).xlsx` as the system default/fallback workbook.

Sketch session wrapped: 2026-07-24
</context>

<design_direction>
## Overall Direction

- Use a three-column Template Studio: customer/template navigation, workbook canvas, persistent mapping/validation inspector.
- Use a dense Fiori visual vocabulary: shell navy, SAP blue primary actions, white surfaces, low-radius borders, compact 32px controls, restrained shadows.
- Keep editing desktop-first. On narrow screens, expose template summaries, diagnostics, and A1 editing while the spreadsheet grid becomes read-only or opens on demand.
- Synchronize drag selection, A1 addresses, keyboard range expansion, and a contextual role-assignment toolbar.
- Validate against source cells. Errors block save; warnings require visibility and acknowledgement but may allow save; preview never writes menu data implicitly.
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Layout & Template Navigation | `references/layout-template-navigation.md` | Three-column Template Studio keeps customer, workbook, mapping, preview, and version context visible. |
| Range Mapping & Accessibility | `references/range-mapping-accessibility.md` | Hybrid drag/A1/keyboard selection with a contextual role toolbar and persistent inspector. |
| Validation & Diagnostics | `references/validation-diagnostics.md` | Source-first cell diagnostics with recovery guidance and a compact normalized preview. |

## Theme

The winning shared theme is at `sources/themes/default.css`.

## Source Files

Original interactive sketch files are preserved in `sources/` for complete reference. Each file retains all explored variants and marks the selected direction in its top navigation.
</findings_index>

<metadata>
## Processed Sketches

- 001-fiori-mapping-layout
- 002-range-selection-interaction
- 003-preview-and-diagnostics
</metadata>
