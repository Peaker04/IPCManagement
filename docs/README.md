# IPCManagement Documentation

This directory contains supplemental project documentation. The root
`README.md` remains the quick-start entry point; these docs capture domain
context and operational rules that are too detailed for the main README.

## Domain Docs

| Document | Purpose |
| --- | --- |
| [Business Flow](domain/business-flow.md) | Explains the IPC catering workflow from weekly menus to production, purchasing, and inventory. |
| [Data Model](domain/data-model.md) | Maps the proposed MySQL schema and current EF Core model into domain areas. |
| [Source Workbooks](domain/source-workbooks.md) | Summarizes the Excel/DOCX/SQL files in `.docs` and how they should inform development. |

## Primary Source Files

The domain docs are based on the project files under `.docs/`:

- `Document Database Lastest.docx`
- `IPCmanagement.sql`
- `THỰC ĐƠN DRAXLMAIER TỪ NGÀY 15.06 - 20.06.xlsx`
- `IPC. Định lượng 22.xlsx`
- `Đơn đặt hàng T5.2025.xlsx`
- `IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx`

Treat `.docs/` as source reference material, not runtime application input.
