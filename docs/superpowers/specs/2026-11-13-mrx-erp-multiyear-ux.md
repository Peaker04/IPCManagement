# MRX multiyear ERP workflow design

Status: approved by the user's request to implement the expanded audit natively. `.planning/WORK.md` owns task state. This document defines behavior, not qualification status.

## Goal and boundaries

People must find historical customer/week/batch records, understand Excel import outcomes, prepare food and materials, and read audit history without knowing internal identifiers. Keep existing MRX mode/RBAC, source and stock authority, locked-day rules, immutable audit history and six UI states. Do not create a second scope store, visual system, or backend data source. Do not mutate the source DB or run endurance.

## Scope and acceptance

1. **Historical scope:** Dashboard retains customer/period filters. Weekly source views select customer and Monday. Warehouse and Chef retain the active batch in the header and expose a paged, server-filtered historical batch picker by customer, date range and optional code. Reconciliation retains month/year for live batch views and its paged month picker. Dashboard and completed register expose all-time, historical-year and explicit cross-year intervals; completed customer/time scope applies on the server to rows, counts, paging and exports. Source delta history gains customer/date/batch filters and server paging.
2. **Import:** In the existing modal, current week fixes customer/week; selecting another week immediately enables Monday and customer. A matching saved draft is offered as an explicit resume path. Explain separately new source, draft recovery, reimport of an existing unfinished batch and completed-scope new-week flow. Show whether the action saves draft, publishes, or enters approval, and identify affected locked days before confirmation. Group import remains atomic draft-only; single-file reimport retains backend guards and invalidates stale preview tokens.
3. **Preparation export:** Excel keeps authoritative numeric quantities and identifiers. Normal exports have distinct summary, per-customer/date/shift allocation and menu sheets, with sheet-local headers, frozen panes and filters. Empty-menu case remains valid. A real workbook contract test compares totals to DTO data.
4. **Audit:** Both tabs show Vietnamese business labels and readable old/new values for known entities/fields; raw identifiers remain inspectable, not substituted with invented names. Source/BOM history paging must match displayed rows and backend result limits. Search uses rendered and technical labels.
5. **Chef:** Dish list shows per-dish servings with date/shift/variant on entry. No stock issue, variance, or source-technical data enters Chef output.
6. **Dialogs:** Only one actionable confirmation surface is active. Unsaved-change prompt appears only for changed input, has explicit keep/discard actions and correct Escape/focus return. Persisted rollback identifies its actual scope. Pending writes remain protected.

## Verification

## Approved requirements correction (2026-11-13)

The original multi-customer, multiyear requirement takes precedence over the earlier permissive historical-scope wording. Dashboard and completed register must offer all-time, a specified historical year and an explicit date interval. The same validated interval/customer must bind rows, totals, paging and completed exports. Source history initializes explicit URL selection before shared workspace customer/batch/day and offers an explicit clear-filter action. Audit search covers the entire authorized batch at the server, with paged results and honest totals for both tabs. Source changes must not load all audit rows merely to paginate in the browser. Dashboard paging must not reload the scope summary. Summary calculations must process bounded batches rather than materializing every active batch and daily line at once. Work queues require reachable server pages and exact totals, with per-kind limits disclosed. Existing MRX authorization, lineage, lock and numeric invariants apply throughout.

Acceptance includes 2024 selection, a 2023–2025 interval, cross-year customer isolation, matching filtered completed exports, scope continuity into source history, an audit match located beyond page one, a large source-history dataset with bounded reads, unchanged summary request count on Dashboard paging, and more than ten reachable queue items.

Each changed owner gets a failing behavior test before product edits and targeted green verification. Run FE build/lint, relevant BE tests and workbook inspection. Native disposable MRX browser tests cover import week switch, audit labels, historical selection, Chef list, workbook download and dialog keyboard flow at representative widths. Inspect cleanup/source/candidate receipts. Overall OPERATIONAL_QUALIFICATION_BLOCKED remains until independent architecture and qualification gates pass.

## Implementation order

First repair visible contradictions and incomplete paging, then shared historical selection, import decision flow, workbook structure, Chef and dialog details, finally native runtime evidence. Preserve inherited working tree and do not commit.
