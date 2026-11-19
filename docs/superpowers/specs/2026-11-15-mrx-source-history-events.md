# MRX source history as operational events

## Job and scope

Warehouse and management users need to understand who changed the MRX source, whether a request was reviewed, and which ingredient quantities changed without scanning a 1560px matrix. The route remains `/warehouse?view=mrx-issues` in `MATERIAL_RECONCILIATION`, read only, with the existing customer, batch and service-date filters.

## Read model

- One list item per MRX `MenuAmendment` (including pending, rejected and executed), plus one item per source revision without an amendment. Linked revisions are shown under their amendment, never as duplicate list items.
- Status labels distinguish review (`Chờ duyệt`, `Từ chối`, `Cần đối chiếu`) from source application (`Đã áp dụng`); direct Admin/Manager apply is labeled `Áp dụng trực tiếp`, never `Đã duyệt`.
- Summaries are server paged and filtered by customer, batch and service date. Batch scope must be established from MRX lineage; do not join DEFAULT data. Sort newest event first with a deterministic ID tie-break.
- Detail includes requester, reviewer, executor, timestamps, reason, batch/revision IDs and all persisted delta lines, or the stored proposed impact lines when no revision exists. Missing evidence is explicit, not inferred. Detail loading has pending/error/retry states.

## Interface

- Desktop list: time/person, customer/week, affected scope, route of change, status and a `Chi tiết` action. At narrower widths, the same facts become compact stacked rows with no horizontal travel. Server pagination stays visible.
- A single read-only `Modal` shows decision timeline and a compact ingredient table. Long IDs appear as secondary copyable codes. No approval command is added here; existing weekly-menu approval remains the write owner.
- Loading, empty, error, denial, partial and stale-scope transitions preserve `StateBoundary`. Existing design tokens, 12px typography floor, 36–40px list density, and one primary action per region remain binding.

## Verification

Backend tests cover applied/direct/approved/pending/rejected, multi-revision grouping, filters, paging, mode/permission separation, and no synthetic approval. Browser and component tests cover desktop/mobile, dialog focus/close, detail error, and no long horizontal list scroll. Live clone screenshot is needed for actual populated visual proof.
