# Phase 3 UI Contract — Human UI and Refresh Stability

## Locked direction

- Compact SAP Fiori-inspired desktop workbench; preserve business behavior and source-line identity.
- Canonical normative rules: `docs/DASHBOARD-UI-RULES.md`; execution harness:
  `docs/UI-UX-EXECUTION-HARNESS.md`; refresh source:
  `.docs/dashboard-state-refresh-rules.md` as merged into F12–F24.
- User language is mandatory. Badges describe current state; buttons use a verb for the next action.
- Backend enum, UUID, concurrency version, query/cache name and implementation jargon never stand alone in
  headings, table cells, badges, buttons, tabs, empty states or modal copy.

## Inventory contract

The current baseline is `53` production owners containing `51` tables, `33` dialogs and `9` tab switchers.
The source-aware inventory is test-owned and must not be imported by production. Any count/fingerprint drift is
a review gate, not an invitation to update a snapshot mechanically.

## Status and refresh contract

- A status region keeps the same DOM/geometry owner across pending, success, error and background refresh.
- Table status columns reserve the registry-derived longest label width and use fixed table layout where the
  table contract applies.
- Initial load may use a matching skeleton after the canonical delay. Background refresh keeps old data and
  exposes a non-displacing busy/freshness signal.
- Mutation pauses same-query refresh, cancels in-flight stale reads, then invalidates only exact affected keys.
- Hidden tabs and active edit/modal contexts pause automatic refresh and state this honestly to the user.

## Performance evidence

Each inventoried family records navigation type, cache-return request count, skeleton count during refetch,
container delta, request count with modal open, requests after mutation, hidden-tab requests, row render count,
CLS and long tasks. Missing measurement is `NEEDS_EVIDENCE`, never PASS.

## Rollout order

1. Shared inventory/status/copy/query-state contracts.
2. Weekly Menu/Coordination; Purchasing/Approvals; Warehouse/Chef; Reports/Admin/Auth.
3. Production-build headed full matrix and owner-specific performance fixes.
