# Reconciliation month scope — approved design

Operator approved replacement A and quiet semantic filter colors. Supersedes the week-input header design.

## UX and rules
- Header: customer → batch (at most five recent batches in selected month) → month → year → readonly batch status. No “Tuần bắt đầu”, “Cả tuần từ”, duplicate date calendars or selector pager.
- Month membership is the batch's business WeekStartDate, not CreatedAt or individual service dates. Nov30–Dec5 belongs only to November. Server filters inclusive month first/last dates before counting/paging; order WeekStartDate descending, CreatedAt descending, existing stable BatchId tie-break.
- Ordinary entry/month/customer changes choose the first matching batch; empty month never substitutes another month. Changing customer retains month/year.
- More than five matches exposes “Xem tất cả N lô…” opening existing Modal/DataGrid with 25 rows/page; pagination/cancel never selects. Dropdown has no more than five selectable batch options; an explicitly selected older batch is represented by the control's selected display, not a sixth selectable batch. Each option includes business week, creation time/reference to distinguish repeated imports (Version is mutable concurrency version, not import ordinal).
- Explicit batch links resolve authoritative customer/week/month even outside the five; URL month and day/batch scope survive navigation. In-flight obsolete customer/month reads cannot overwrite current scope; cached other-customer snapshots cannot override explicit customer URLs.
- Daily lines: six accessible pressed buttons T2–T7 above table, dates derived from selected batch week, no extra header calendar. Reports remain whole-batch; completed register unchanged.
- Filter chips retain neutral/amber/blue/green soft backgrounds even at count0; selected background stronger in the same hue, no underline or decorative thick outline. Keyboard focus remains visible; aria-pressed and counts remain.
- Existing mode isolation, RBAC, write/export stale-scope gating, recovery, quantity and lineage unchanged.

## Approaches
A chosen: five recent batches within month plus paginated full-month chooser. Clear single scope with reachable history.
B rejected: five latest globally plus independent month search; competing scope authorities.
Previous dual week/day calendars rejected by operator screenshots.

## Verification boundary
Real fetch-boundary owner tests for query ranges/order/limit, old history>100, chooser>100/cancel/retry, calendar boundaries, empty/error/denial, late response, day/batch/month/history and explicit links. Existing independent regression tests retained and migrated. CSS at index.css only. No install/delegation/schema/production data/commit/deploy. Live layout and contrast require browser evidence; do not claim them from DOM tests.
