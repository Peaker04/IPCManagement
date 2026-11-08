# BOM existing-line editing and overview tiers — approved design

Owner approved short design in chat (Duyệt).

- Keep existing `/admin-data?view=bom` workbench and one existing DishBomEditorModal. Visible scope option becomes “Dùng chung toàn hệ thống”; internal scope codes unchanged.
- Each mutable ingredient row gets Chỉnh sửa. Reuse the in-modal form with fixed ingredient/tier/customer/unit context and editable six-decimal quantity, effective date and reason. Published changes use existing versioned PUT, date strictly later than original; never delete/re-add or overwrite historical quantities. Preserve dirty draft exits, pending exclusion, server error/retry. Read-only dish-name inspection never writes.
- Restore overview filters25k/30k/34k using supported-tier endpoint. Existing all-tier view remains default for compatibility. Optional priceTier on existing coverage endpoint scopes line counts/status/KPIs, and nullable response priceTier identifies that scope; cache and snapshot isolate tiers. Opened modal inherits the chosen tier. No per-dish request fanout or arithmetic price scaling.
- Existing read/write Catalog policy remains backend authority; frontend management controls use existing Catalog role guards. No fake data in production, dependency, schema/migration, real-data writes or restart implied.

## Approaches
Frontend-only cosmetic filters rejected because aggregate report has no per-tier data. Existing endpoint optional filter selected over new endpoint or N-per-dish requests. Reuse one form selected over nested modal or destructive delete/recreate.

## Proof
Extend existing backend coverage owner with supported-tier/date/status cases; actual frontend network-to-DOM owners prove tier switching, exact versioned PUT, retained error draft, pending/dirty/cancel/read-only behavior. Existing backend published-version regression owns persistence history. Bounded desktop/tablet fixture browser check is not real data acceptance.
