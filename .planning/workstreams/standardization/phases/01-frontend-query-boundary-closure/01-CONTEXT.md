# Phase 1: Frontend Query Boundary Closure — Context

**Gathered:** 2026-08-03
**Status:** Ready for execution
**Mode:** Autonomous from accepted standardization contract

## Phase boundary

Inventory every production RTK query-hook owner, migrate the remaining unsafe/manual purchase-summary boundary, and explicitly disposition specialized owners whose session, composite-support or multi-source action-gating semantics are intentionally not a one-query visual boundary.

## Locked decisions

- A query hook used only to compose another query result is not itself a rendered boundary.
- Session bootstrap in `ProtectedRoute` remains an authentication gate, not a data-empty view.
- Supporting readiness/staleness/audit probes may remain inside an owning composite view when their failure is surfaced as blocked/unknown rather than empty authoritative data.
- Existing Warehouse stock/movement `QueryView` owners remain unchanged; its multi-source issue dialog may keep equivalent local action gating, but must be listed with a concrete rationale and source markers.
- Mutation loading/error state is outside this phase.
- No route, permission, API, database or visual-layout change is authorized.

## Verification contract

- Source-aware AST discovery must fail when a new production query owner has neither a shared adapter nor an approved exception.
- Exceptions are an exact, reasoned map with source-marker assertions; stale exceptions fail.
- Purchase summary must use `QueryView`/`QueryViewBoundary` and rendered tests must prove error, retry, initial loading and refreshing-with-stale-data behavior.

## Deferred

None within FE query-state follow-up. Backend/import items remain in Phases 2–5.
