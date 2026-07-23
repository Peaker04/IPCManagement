---
status: complete
completed_at: "2026-07-01T23:15:00+07:00"
---

# PRD-061 Import Validation Summary

Implemented structured weekly menu import validation and connected it to the import wizard.

## Completed

- Added `WeeklyMenuImportValidationDto` and `WeeklyMenuImportValidationIssueDto`.
- Preview now returns validation DTOs for unknown customer and parser-level critical failures instead of only failing opaquely.
- Backend validation emits critical errors for week-start mismatch and duplicate date/shift/variant/slot rows, including cell coordinates.
- Unknown dish mappings are returned as warning issues with row/column/cell.
- Commit re-runs validation and throws before opening the transaction if critical errors remain.
- Frontend wizard displays validation issue rows and uses backend critical errors as commit blockers.

## Verification

- `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj` -> 88 passed, 1 skipped.
- `dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj` -> passed.
- `npm run lint --workspace frontend` -> passed.
- `npm run build --workspace frontend` -> passed.
- `npm run test:smoke --workspace frontend` -> 7 passed.
- `node .gitnexus/run.cjs analyze` -> 4,749 nodes, 12,149 edges, 154 clusters, 300 flows.

