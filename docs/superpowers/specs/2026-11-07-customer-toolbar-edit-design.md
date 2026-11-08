# Customer toolbar editing — approved short design

Owner approved the preceding toolbar-edit proposal and minimal create form. Rename discussion was a question only: no rename UI, new name-lock policy or backend name change is authorized.

- `/admin-data?view=customers`: remove action column; select one existing DataGrid row (mouse/keyboard), then toolbar outline Chỉnh sửa beside primary Thêm khách hàng mới. Disabled with no visible current selection/loading/error.
- Existing modal edits note and active status together, one save; show immutable code/name as context only. Preserve dirty-close confirmation, pending exclusion, error/retry, selected identity and returned DTO. PUT only changed note/isActive, never name/code/price/contract fields. No new endpoint/model.
- Keep creation code/name required and optional note, active by default. No additional filler fields.
- BOM question is diagnostic: prove exact tier switching with independently different backend-shaped rows at the actual modal/branch boundary; do not adjust quantities. Real reported dish data needs dish identity/authorized payload and is not inferred from fixtures.

## Approaches
Row-level buttons are rejected by owner. Selected-row toolbar edit is approved and reuses current DataGrid selection/keyboard support. Inline table editing would broaden write/focus behavior unnecessarily. No visual-world redesign or dependencies.
