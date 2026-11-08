# MRX merged-dish editing and shared customers — scoped design

Status: Owner approved, including combined execution with outstanding real-FE qualification in the preceding request. Implementation plan: `../plans/2026-11-02-mrx-combined-fe-completion.md`.

## Intent and confirmed requirements

Owner confirms one large dish may occupy four source slots; repeated slots represent ONE BOM calculation, not four portions. Servings belong to service date × shift × savory/vegetarian variant, not to visual rows. Customer administration is shared master data and must be accessible in MRX without importing DEFAULT operational workflows. Qualification must use real FE actions and durable outcome readback.

## Approaches and recommendation

1. Always unmerge when editing (current model): simple but obscures the large-dish grouping and makes whole-group replacement repetitive.
2. Keep merged display; offer whole-group replacement or editing individual slots: approved approach, supports both large→large and large→small without changing source representation.
3. Persist a new large-dish entity or manual merge flags: rejected as unnecessary; existing slots and dish IDs express the requirement.

## Proposed editing contract

- Merge adjacent slots only when the dish ID, date, shift, variant and lock state agree. Same label alone is insufficient. Preserve existing read-only horizontal merging separately; no implicit multi-date write.
- A grouped cell exposes “Đổi cả nhóm” and “Sửa từng dòng” using existing controls. Whole-group replacement changes every underlying slot in this group; individual editing exposes every original slot without losing its identity.
- A,A,A,A displays one four-row cell; B,B,B,B likewise. A,B,C,D displays four cells; A,A,B,C displays one two-row A cell and two single cells.
- Recompute merged display when finishing individual group editing; do not collapse a focused editor after each selection. Cancel/review/error behavior preserves the existing draft contract. Final server confirmation remains the existing source-change flow.
- Existing issued-date locks apply to every covered slot and are enforced server-side as well as in FE.

## Servings and quantities

- One servings value per date × shift × variant. Never multiply it by rowSpan or colSpan. Missing servings remain missing, not invented defaults.
- Each distinct dish ID contributes BOM ONCE within the same source meal/variant, including repeated IDs separated by another slot. Visual merging only groups adjacent cells; it does not define quantity arithmetic.
- Never deduplicate across customers, service dates, shifts or savory/vegetarian variants.
- Large dish A repeated four times: BOM(A) × variant servings. Four distinct smaller dishes: sum their applicable BOMs × variant servings. Shared ingredients add their real contributions; retain canonical conversion and six-decimal rounding.
- Source evidence: `ReconciliationMaterialProjection.ProjectLine` already uses `DistinctBy(Variant,DishId)` within a source line and validates split servings. Preserve that owner; inspect other preview/export/coordinated consumers before deciding whether any repair is needed. This is source evidence, not runtime certification.

## Shared customers

Reuse `/admin-data?view=customers`, `AdminCustomersBranch`, `CreateCustomerModal` and existing customer contracts/API. Remove unjustified MRX-only navigation/create prohibition while retaining actual server RBAC, validation and mode authority. Audit backend mode/capability checks before changes. Do not expose DEFAULT meal-order, purchasing or stock workflows. Customer creation does not imply creating menus, servings, stock or reconciliation evidence automatically.

## Verification and execution boundaries

Use existing owner tests and backend DTOs; no test-only seams. Live FE proof on exact-run authorized disposable clones: create customer through navigation/modal, reload and select it for MRX; exercise four-slot large→large, large→four-small and partial split; change servings; inspect real review impact, confirm and reload; compare independent required-quantity expectations and persisted lineage. Include same-label/different-ID protection where existing real catalog permits it, and honest missing-BOM blocking/recovery.

Continue outstanding coordinated multi-customer, disposition UI and other qualification items in bounded, fail-fast phases with visible progress and cleanup. Do not claim unexecuted endurance/memory/zoom gates. No installs, delegation, commits, deployment, main DB mutation, migrations, returns or kitchen acknowledgments.

## Acceptance

- Group editing does not drop slots or change unrelated dates; real FE reload retains intended assignments.
- Repeated dish counts once; split dishes and changed servings produce independently correct quantities.
- MRX customer list/create is usable by authorized roles; unauthorized roles remain denied.
- Durable readback, source integrity and cleanup are recorded; unresolved criteria remain explicitly unqualified.

## Builder decisions and residuals

Use existing UI primitives/styles and source-change review, not a new editing framework or schema. No generalized manual merge feature. Native zoom foreground blocker and overall qualification remain separate open items. This document has parent-only review; no subagent was requested or launched.
