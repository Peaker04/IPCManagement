# Phase 29 Research — System Operation Mode and Material Reconciliation

**Date:** 2026-08-25  
**Status:** pre-planning research complete  
**Authority:** `.planning/notes/system-operation-mode-and-material-reconciliation.md`

## Research purpose

Identify the current implementation seams and constraints that Phase 29 must respect before specification, discussion and planning. This document records source-grounded findings; it does not authorize production or database changes.

## Current-state findings

### 1. Global operation mode has no existing persistence aggregate

- Runtime deployment configuration is read through `IConfiguration`; for example, `OperationalWarehouseResolver` reads `OperationalWarehouse:WarehouseId` from application configuration.
- Deployment configuration cannot satisfy an Admin-mutated, audited, server-authoritative business setting without restart/config-file ownership problems.
- The project already has a durable `AuditLog` entity and feature services append actor/time/reason records, but there is no current operation-mode entity or service.

**Planning implication:** introduce one durable singleton business-setting authority and reuse the existing audit model rather than treating `appsettings` or browser storage as mutable authority or creating a second audit framework.

### 2. Frontend route and permission concerns are currently separate seams

- Canonical paths are declared in `frontend/src/lib/routeConfig.ts`.
- Lazy component/data preloading is owned by `frontend/src/routes/routeLoaders.ts` and `routeDataPreloaders.ts`.
- Permission denial is owned by `frontend/src/routes/RoleGuard.tsx`, which redirects to `/403`.
- Navigation, route rendering, preload and backend eligibility do not currently consume a shared operation-mode contract.

**Planning implication:** mode eligibility must be explicit and evaluated before permission eligibility, while preserving the existing permission result for routes retained by the active mode. Excluded routes must not preload data and must render a mode-unavailable state rather than `/403`.

### 3. Existing material-demand generation belongs to the full golden workflow

- `MaterialDemandService.GenerateAsync` resolves completed meal quantities, published menus, effective BOM rows, portion/yield rules and current stock.
- It creates/updates production plans and material requests, reserves stock context and records audit entries.
- Existing demand may become stale or be cancelled after menu re-import, which is valid for the default workflow but cannot rewrite immutable reconciliation history.

**Planning implication:** reconciliation demand must freeze a snapshot derived from existing source identities without making the mutable default-workflow material request the historical comparison authority.

### 4. Ingredient and unit identity cannot be inferred from display names

- Material demand and inventory flows identify ingredients and units by IDs and preserve source-line relationships.
- The project has unresolved legacy unit-normalization decisions; `G`, counted units and conversion factors cannot be silently corrected or rounded.
- Current project invariants prohibit deduplication or React keys by ingredient name.

**Planning implication:** reconciliation grain must use ingredient identity plus canonical unit identity. Aggregated lines must retain their contributing source lines. A batch cannot become ready while ingredient/unit identity remains unresolved.

### 5. Existing purchasing and warehouse documents are too strong for the bounded branch

- The default path links material requests, purchase requests/orders, receipts, inventory issues, stock movements and stock balances.
- Reusing posted receipt or issue quantities as the only Phase 29 authority would require the complete golden lifecycle.
- Discovery explicitly prohibits manufacturing stock records merely because the early branch assumes sufficient material.

**Planning implication:** purchased and issued actual quantities need batch-owned entry/revision records. These records must retain actor/time/reason provenance but must not create or mutate procurement documents, warehouse documents, stock movements, lots, snapshots or current stock.

### 6. Immutable history needs explicit lifecycle and concurrency contracts

The locked lifecycle emerging from discovery/spec interview is:

1. A successful Weekly Menu import establishes a draft reconciliation batch linked to import and meal-quantity sources.
2. Explicit “Sẵn sàng đối chiếu” confirmation validates non-empty resolved material identity and freezes required quantity plus tolerance.
3. Purchasing and Warehouse independently enter actual quantities.
4. Corrections before completion are append-only revisions with old/new value, actor, time and reason.
5. Completion requires explicit purchased/issued values, including explicit zero, for every line and a disposition/reason for every exceptional line.

Concurrent mode changes, ready confirmation and actual entry require stale-write rejection rather than last-write-wins.

### 7. Tolerance is historical comparison data, not a live presentation preference

- Discovery permits ingredient-specific or unit-group-specific tolerance with a system fallback.
- The applicable tolerance and its configuration/version must freeze with each batch line.
- Exact differences are always visible; equality at the tolerance boundary is within tolerance because only `abs(difference) > tolerance` is exceptional.

**Planning implication:** later tolerance edits cannot recompute historical verdicts. Rounding/conversion ownership must be explicit before comparison; display formatting cannot change stored comparison authority.

### 8. Project-wide clarity cleanup must be owner- and evidence-driven

- Phase 27/28 already established route/state/actor/viewport identity, semantic DOM, geometry, runtime evidence and lowest-owner remediation rules.
- Shared primitives, feature mappers, feature sections and routes are distinct candidate owners.
- Screenshot appearance alone is not a pass/fail oracle.

**Planning implication:** inventory cleanup candidates before edits, preserve raw IDs and decision-bearing data, and execute bounded owner waves. Short identifiers require full-value inspect/copy/search and collision-safe presentation.

## Source seams for planning

| Concern | Current seams |
|---|---|
| Route constants | `frontend/src/lib/routeConfig.ts` |
| Permission boundary | `frontend/src/routes/RoleGuard.tsx` |
| Lazy route/data preload | `frontend/src/routes/routeLoaders.ts`, `frontend/src/routes/routeDataPreloaders.ts` |
| Demand calculation | `backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs` |
| Audit persistence | `backend/src/IPCManagement.Api/Models/Entities/AuditLog.cs`, feature services appending `Auditlogs` |
| Inventory provenance | `backend/src/IPCManagement.Api/Features/Inventory/Services/*`, inventory entity configurations |
| Operational singleton precedent | `OperationalWarehouseResolver` and Phase 28 singleton migration/verification artifacts |
| Generated frontend API contract | `frontend/src/shared/api/contracts/openapi.json` and existing single RTK Query `apiSlice` conventions |

## Risks to address during discussion/planning

1. Mode read failure must fail closed without accidentally making the whole login/public surface unavailable.
2. Mode changes racing with mutations must not permit an excluded operation to commit under stale mode.
3. Draft batches must not become immutable historical clutter from previews or invalid imports.
4. Batch aggregation must not erase source-line contributors or combine same-name ingredients.
5. Actual-entry correction must preserve every revision and reject stale concurrent writes.
6. Unit/tolerance semantics must not silently resolve legacy normalization decisions.
7. Clarity cleanup must not remove audit identity, authorization distinctions, error states or authorized next actions.
8. Retained routes may contain actions that belong only to the default workflow; action-level mode inventory is required in addition to route-level eligibility.

## Research conclusion

Phase 29 requires three coordinated but separately verifiable capabilities: a durable global operation-mode authority, an immutable batch-owned reconciliation workflow that does not mutate stock/procurement lifecycle, and evidence-driven clarity remediation across both modes. Existing source seams are reusable, but no current aggregate spans these concerns. Planning must therefore preserve current permissions, RTK Query cache identity, warehouse lineage and default golden-path behavior while introducing explicit mode and batch boundaries.
