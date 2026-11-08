---
phase: 29
status: seed
created: 2026-08-25
source: .planning/notes/system-operation-mode-and-material-reconciliation.md
---

# Phase 29 Spec Seed — System Operation Mode and Material Reconciliation

## Problem

IPCManagement currently exposes one complete workflow and extensive operational copy. The next product branch needs a globally selected material-reconciliation workflow while the existing default workflow also needs systematic removal of redundant, technical and visually noisy content.

## Outcome

Deliver a server-authoritative Admin-controlled operation mode with `DEFAULT` and `MATERIAL_RECONCILIATION`, enforce mode eligibility consistently across backend, routes, navigation and actions, and provide a frozen-batch reconciliation workflow comparing required, purchased and issued material quantities. Apply the locked clarity/table/empty-state/hierarchy rules to both modes.

## Locked requirements

1. One global persisted mode; only Admin may mutate it.
2. Mode changes are confirmed, audited and propagated without deleting data.
3. Existing permissions remain mandatory and are checked after mode eligibility.
4. `DEFAULT` preserves the current golden path.
5. `MATERIAL_RECONCILIATION` retains Dashboard, Weekly Menu, Purchasing, Warehouse, Reports, Admin Data and Admin-only Advanced Settings.
6. It excludes Coordination, Approvals, Chef Dashboard and Approval Rules for every role.
7. Excluded direct routes render a mode-unavailable state rather than permission denial.
8. Each import creates an independently identified reconciliation batch.
9. Batch grain is batch × ingredient identity × canonical unit.
10. Demand and tolerance authority freeze when Purchasing begins actual entry; later menu/config changes cannot rewrite historical results.
11. The three exact comparisons are purchase variance, issue variance and purchase-to-issue flow gap.
12. Exact differences remain visible; `Cần kiểm tra` depends on frozen tolerance.
13. Raw document/material IDs remain intact for API, search, export, audit and lineage; routine tables use concise user-language presentation with full-value access.
14. Content cleanup applies project-wide to both modes and must preserve business meaning, permissions and evidence-backed states.

## Required research before planning

- Current configuration persistence and audit seams suitable for one global mode.
- Mode enforcement boundary for backend commands/queries without scattering string checks.
- Exact role × retained-route × action matrix.
- Import authority and batch/version relationship with current Weekly Menu demand grain.
- Canonical unit and tolerance model, including conversion and rounding ownership.
- Purchasing actual-entry source and Warehouse issued-quantity source without fabricating stock lineage.
- Reconciliation report API/table grain, filtering, export and immutable history.
- Project-wide copy inventory grouped by lowest UI owner: shared primitive, mapper, feature section or route.
- Direct-route transition behavior when an Admin changes mode while users are active.

## Planning constraints

- Use one RTK Query `apiSlice`; preserve reducer, middleware and cache identity.
- Do not use `localStorage` as mode authority.
- Do not hide backend operations only at navigation level.
- Do not create a generic page renderer, UI DSL or second audit framework.
- Preserve current public API unless the planned mode/reconciliation contract explicitly introduces a versioned endpoint.
- Preserve warehouse IDs, stock grain, FK, audit and lineage.
- Do not manufacture stock records or silently bypass warehouse authorization.
- Apply copy cleanup at the lowest demonstrated owner and verify in production DOM, not screenshots alone.
- Keep `DEFAULT` behavior intact unless an explicitly planned content/presentation correction changes only user-facing clarity.

## Suggested plan decomposition

1. Research, domain/route/role inventory and UI content inventory.
2. Mode persistence, read contract, Admin mutation, audit and fail-closed validation.
3. Frontend mode bootstrap/cache, navigation and direct-route enforcement.
4. Reconciliation batch/import/freeze domain model.
5. Purchasing actual and Warehouse issue capture with provenance.
6. Comparison service/API/report/export and tolerance semantics.
7. Material-reconciliation UI vertical slice.
8. Project-wide default-mode content/table/empty-state cleanup in bounded owner waves.
9. Role/mode E2E matrix, accessibility, responsive, performance and documentation closeout.

## Acceptance direction

No completion claim until mode and permission combinations are tested at frontend route/control, backend response, persisted state/audit and post-refresh UI. UI cleanup must demonstrate reduced redundant copy and preserved next-action meaning through semantic DOM assertions and headed evidence; screenshots remain reviewer artifacts only.
