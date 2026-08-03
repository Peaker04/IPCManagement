# Phase 2: Import Diagnostics and Provenance — Context

**Gathered:** 2026-08-03
**Status:** Ready for execution
**Mode:** Autonomous from accepted standardization contract

## Phase boundary

Close `OPEN-02` and `OPEN-07` across two existing import lanes: catalog BOM preview must turn unreadable workbooks into stable domain/API diagnostics; weekly-menu preview must bind commit to the exact workbook and scope and persist queryable provenance on dishes created by that import.

## Locked decisions

- Reuse `WeeklyMenuImportValidationIssueDto` sheet/row/column/field diagnostics; do not invent a second diagnostics shape.
- Preview issues a random, short-lived, server-side cached ticket bound to SHA-256, customer, week and price tier. Commit requires the ticket and recomputes/compares the same fields.
- Invalid/unreadable workbooks still return their friendly parsing diagnostic before ticket validation.
- A ticket is removed only after successful commit so a recoverable transaction failure does not force re-upload; expiry remains fail-closed.
- New dishes store nullable source import batch, source filename and source checksum. Existing/manual dishes are not retroactively relabeled.
- Provenance is exposed by dish/catalog DTOs and covered by migration/model/API tests.
- Migration is additive and must include inline `[Migration]` metadata plus an updated model snapshot; no migration is applied to `ipc_lane1` in this phase.

## Safety

- `LESSONS.md` migration traps were reviewed before design.
- No database reset, seed, restore, direct SQL or live migration execution.
- GitNexus is not active.
