# Native implementation plan

1. Add focused failing DOM tests to the BOM editor and MRX recovery test. Use C# `IngredientDto`, `UnitDto`, `CreateIngredientRequest` fields at the network boundary.
2. Add typed catalog read/create calls to the existing `adminApi`. Keep backend API and persistence unchanged.
3. Add one inline ingredient creation state in `DishBomEditorModal`: units load/retry, duplicate lookup, POST, post-save selection and uncertain-outcome recovery. Extend the existing combobox with an optional server-search callback so catalogs above 100 rows remain selectable. Preserve existing BOM edits and one-modal rule.
4. Add an authorized `Thêm nguyên liệu` action to the ingredient catalog page, using the same API contract and list refresh. Deep-link MRX recovery to the missing-BOM list.
5. Make the bulk Excel flow explicit: missing-dish template → fill new names with blank codes → preview row errors/warnings with pagination → commit → refresh MRX source/recheck. Verify existing parser, UI and caller transitions; change owner code only for a demonstrated gap.
6. Run focused tests, relevant contract tests, lint/build, diff checks and scoped `ipc-code-review`, `ipc-ui-review`, `ipc-test-audit`, `ponytail-review`. Record actual evidence in `.planning/WORK.md`, return state to IDLE.
