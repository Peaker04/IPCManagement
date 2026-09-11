# Phase 4: Effective-Range Audit Coverage — Context

**Gathered:** 2026-08-03
**Status:** Ready for execution
**Mode:** Autonomous from accepted standardization contract

## Phase boundary

Persist request correlation alongside actor-attributed audit facts for customer-contract effective-range changes and week-scoped menu-version transitions. Prove each API action, database transition and audit record in the same scenario.

## Locked decisions

- Reuse `HttpContext.TraceIdentifier`, which `CorrelationIdMiddleware` already sets from the validated `X-Correlation-ID`; do not create a second request-correlation mechanism.
- Add one nullable `auditlogs.correlationId` column so historical rows remain valid and all other audit producers remain source-compatible.
- Contract `EffectiveFrom`/`EffectiveTo` rows continue using the existing field-level old/new facts and receive the same mutation correlation ID.
- A menu-version status change adds one `EffectiveRange` audit fact for `weekStart..weekEnd|oldStatus -> weekStart..weekEnd|newStatus`; per-schedule status rows share its correlation.
- API-level regressions instantiate real controllers/services against relational fixture data and assert response, persisted state, actor and correlation together.
- Migration is additive and is not applied to `ipc_lane1`. GitNexus is not active.

## Verification contract

- Contract API test changes an effective boundary and finds the exact old/new row with the authenticated actor and request correlation.
- Menu-version API test changes a week-scoped status and finds the range plus schedule rows under one actor/correlation.
- Existing authorization, validation, concurrency/transaction and response shapes remain unchanged.

## Deferred

Backfilling correlation for historical audit rows is intentionally out of scope; the new column is nullable.
