# MRX source and detail surfaces — short design

## Intent and authority
Reduce repeated state messages, clarify grouped editing, preserve useful frozen-lot lookup, and make warehouse issue details readable. This refines the existing ERP surfaces; it does not replace the established workbench.

Owner approved keeping frozen BOM lookup and removing live catalog BOM editing from that lookup, then explicitly approved the complete four-part layout design. Live task state belongs only to `.planning/WORK.md`.

## Approaches
- **Preserve and repair existing surfaces (recommended):** keep the weekly matrix and focused detail modals, place state at its proper scope, and distinguish read-only facts from editing. Least disruption to existing users and callers.
- **Remove lookup or replace workbenches with new screens:** removing lookup loses frozen facts that are not equivalent to current source/catalog data; replacement screens add navigation and unnecessary scope. Not recommended. Owner has already chosen to retain lookup.

## Approved design
1. **Completed source:** show completed status once in the existing lifecycle context. Render dishes and servings as read-only facts, not disabled edit controls with a badge per cell. Do not offer source edit controls for a completed batch. For partially locked batches, keep date-specific lock indicators in date headers; preserve backend day locks and current role authority.
2. **Grouped source editing:** retain grouped cells and their real bulk update semantics. Give the selector a scope label such as `Đổi món cho nhóm · 4 dòng`; replace the ambiguous secondary label with `Tách để sửa riêng`. The latter exposes the existing individual-slot editors; it does not save or change the selected dish. Suppress edit-only affordances in read-only contexts. Preserve date × shift × slot identity and review/apply/submission flows.
3. **Frozen lookup:** name the entry `Món & BOM đã đóng băng`. Keep existing callers and date/shift/servings/material facts. Remove `Chỉnh sửa BOM` and its nested catalog editor from this modal only; the existing authorized catalog editor remains available at its own owner. Display mutually exclusive loading, unavailable-lineage, request-error/retry, empty, and success states; never display missing lineage as a successful zero-dish result. New opens/batch changes must not expose stale data/error. Do not backfill, weaken frozen-lineage checks, or substitute current BOM for frozen facts.
4. **Issue history detail:** retain the modal and its five business columns, with a responsive desktop width up to the existing `max-w-4xl` scale and viewport-bounded sizing. Use one vertical scrolling body with a sticky table header; allow explicit horizontal table scrolling only when needed, preserving ingredient identity during horizontal movement. Keep header/footer and close action reachable. Do not crop `Thực xuất`, reduce type below12px, or truncate six-decimal quantities. Present loading/error/retry distinctly. Apply at the existing detail owner so Warehouse and Reconciliation callers receive the same repair.

## Sketch of hierarchy
```text
Source: [customer / week] [existing lifecycle: Hoàn tất]
        [weekly matrix: readable dishes and servings]
Editable grouped cell:
        Đổi món cho nhóm · 4 dòng
        [dish selector]
        Tách để sửa riêng
Frozen lookup:
        Món & BOM đã đóng băng · [lot scope]
        [one state OR existing dish/material detail]
        [Đóng]
Issue detail:
        [issue / date / warehouse / actor]
        [receipt state]
        [ingredient | name | unit | requested | issued]
        [Đóng]
```

## Boundaries and verification
- FR-MENU/FR-WH/FR-RECON; BR-MRX-EDIT day locks and role authority; DEFAULT/MRX separation unchanged.
- Reuse existing components and styling authority; no new dependencies, primitives, routes, catalog mutations, DB repairs or broad shared-modal redesign.
- Focus checks on existing source-edit, frozen-lookup and warehouse-detail owner tests, plus scoped lint/typecheck. New or changed regressions must fail pre-fix for the intended reason. No automatic full FE/BE suite.
- Rendered viewport, scrolling, focus, Escape, and zoom claims require actual browser evidence; source/DOM tests are not geometry acceptance. No authenticated browser or DB campaign is implied by design approval.
- The inherited `Tiết kiệm` label for issued-below-requested is a separate semantic finding, not silently included in this layout change.
