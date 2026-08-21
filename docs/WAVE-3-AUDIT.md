# Wave 3 — Long-lived ledger/document audit

Status: **OPEN — cross-stack follow-up required**

## Findings

| Surface | Current evidence | Risk | Disposition |
| --- | --- | --- | --- |
| Admin audit | Cursor pagination is wired from query model through `CursorPaginationBar`; filters reset cursor history. | Low | Verified; retain. |
| Stock movement | Shared table supports server cursor pagination; local pagination is only used when the parent supplies a bounded snapshot. | Medium | Verified contract; add response-size evidence in Wave 6. |
| Weekly-menu import history | `useGetWeeklyMenuImportHistoryQuery` returns an unpaged array; UI filters `history` locally. Backend endpoint and service also return `IReadOnlyList` without page/cursor. | High for multi-year retention | Defer closure to Wave 6; add server page/date/customer filters across controller, service, API type and FE model. |
| Weekly-menu import jobs | In-memory jobs are a current import-session queue, not a retained ledger. | Low | Keep local; do not add server pagination. |

## Required Wave 3/6 checklist

- [x] Audit and movement tables use canonical viewport and stable row keys.
- [x] Admin audit filters reset cursor state.
- [ ] Import history has server-side date/customer/page boundaries.
- [ ] Query projection and response size are measured on a multi-year fixture.
- [ ] DTO null/date/timezone semantics are covered by a regression test.
- [ ] Detail/rollback action preserves list context after refetch.

Wave 4 must not claim the full program complete while the import-history finding remains open.
