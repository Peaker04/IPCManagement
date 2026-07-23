# Iter1 Test Coverage Hardening Summary

Updated: 2026-07-10 19:02 ICT

## Scope completed

- Added solution-level backend test gate: `npm run test:be` now runs `backend/IPCManagement.slnx` instead of only `IPCManagement.Api.Tests`.
- Added backend coverage scripts:
  - `npm run clean:coverage:be`
  - `npm run test:be:coverage`
  - `npm run coverage:be:report`
  - `npm run coverage:be`
- Added `backend/coverage.runsettings` to exclude EF migrations from backend coverage noise while keeping services/controllers/models visible.
- Added local ReportGenerator tool manifest in `dotnet-tools.json`.
- Added frontend unit test foundation with Vitest, jsdom, React Testing Library, jest-dom, and user-event.
- Added frontend scripts:
  - `npm run test:unit -w frontend`
  - `npm run test:coverage -w frontend`
  - root alias `npm run test:fe:unit`
  - root alias `npm run coverage:fe`
- Added global frontend test setup cleanup in `frontend/src/test/setup.ts`.
- Added first frontend component test: `frontend/src/components/common/PaginationBar.test.tsx`.
- Extracted weekly menu BOM tier and production-plan paging helpers into `frontend/src/features/projects/weeklyMenuPlanning.ts`.
- Added frontend guard tests for fixed BOM tiers, no nearest-tier inference, production-plan week filtering, daily lazy-loading selection, and page index clamping.
- Added frontend BOM import FormData contract tests for fixed tier, customer override scope, effective date, and empty optional fields.
- Added frontend report planning tests for purchase-plan day/week normalization, shortage totals, and amount totals.
- Added frontend chef readiness tests for sent-to-kitchen, stock/purchase warning, waiting state, and pending kitchen receipt count.
- Extended route smoke coverage so Reports purchase-plan toggles from day to week, sends `groupBy=week`, and renders weekly supplier/period data.
- Extended route smoke coverage so Chef dashboard renders daily production plan code, dish, BOM tier/scope, and exact `Đã gửi bếp` readiness before kitchen signoff.
- Added workflow routing/status tests for Vietnamese warning/success/danger tone mapping and owner-to-lane routing.
- Replaced empty `Application.Tests/UnitTest1.cs` with meaningful `WorkflowReportCalculatorTests`.
- Added backend demand tests for customer BOM override priority, global BOM fallback by price tier, and non-standard menu price rejection.
- Added backend multi-year demand test so BOM effective-date versioning selects the correct tier when service date crosses into a later year.
- Added backend expired-BOM negative test so old BOM versions do not silently apply to future service dates.
- Added backend purchase-plan reconciliation test for day/week grouping, pending receipt subtraction, and duplicate weekly proposal prevention.
- Added backend multi-year purchase-plan test for a week that starts in 2027 and ends in 2028, keeping weekly totals aligned with daily rows.
- Added backend purchase-plan range test so historical/future demand rows do not leak into the requested year.
- Added backend production-plan pagination test so plans spanning multiple years stay newest-first across pages.
- Added backend performance guard for purchase-plan reports with 8 years of demand history, enforcing SQL date filtering and bounded SELECT count.
- Fixed `GetPurchasePlanAsync` to load purchase-request status safely for pending receipt calculation and use split queries for the multi-include report query.
- Added backend daily production send-to-kitchen test for status transition, sender metadata, refreshed kitchen-ready DTO, and audit logging.
- Added backend BOM import tests for multi-dish customer tier import, duplicate/unknown/overlap preview blocking, and commit all-or-nothing behavior.
- Fixed `CommitBomImportAsync` customer-scope lookup so EF can translate it, prevented duplicate tracked navigation attach on imported BOM rows, and added in-file effective-date overlap validation.
- Added testing documentation at `frontend/docs/testing.md`.
- Updated README Testing section with unit/coverage commands and report locations because new `docs/` files are ignored by the current repo rules.

## Baseline coverage

- Backend coverage after excluding EF migrations:
  - Line coverage: 57.4%
  - Branch coverage: 40.0%
  - Method coverage: 63.3%
  - Report: `backend/TestResults/CoverageReport/index.html`
- Frontend coverage:
  - Statements: 1.73%
  - Branches: 0.94%
  - Functions: 1.81%
  - Lines: 1.67%
  - Report: `frontend/coverage/index.html`

## Verification

- `npm run test:unit -w frontend`: passed, 6 files / 22 tests.
- `npm run test:be`: passed, Api.Tests 194 tests and Application.Tests 8 tests.
- `dotnet test backend/IPCManagement.slnx`: passed, Api.Tests 204 tests and Application.Tests 8 tests after expired-BOM, multi-year purchase range, production-plan paging, and multi-year history performance coverage.
- `npm run coverage:fe`: passed and generated coverage report.
- `npm run coverage:be`: passed and generated Cobertura + HTML/TextSummary report.
- `npm run lint:fe`: passed.
- `npm run lint --workspace frontend`: passed after BOM import FormData helper extraction.
- `npm run build --workspace frontend`: passed after report/chef helper extraction.
- `npm run build:fe`: passed.
- `npm run verify`: passed.
- `npm run verify:coverage`: passed.
- `npm run test:smoke --workspace frontend`: passed, 13 tests including purchase-plan day/week toggle and Chef dashboard daily-plan readiness coverage.

## Follow-up backlog

- Frontend domain gaps now covered for weekly menu BOM tiers/paging, BOM import RTK/FormData, report purchase-plan summaries/day-week E2E, and chef-dashboard readiness unit + smoke coverage; remaining frontend work should focus on visual regression or newly found UX defects.
- Backend UAT gaps now covered for demand BOM tiers, multi-year BOM effective dating including expired BOM, purchase-plan day/week including cross-year weeks, historical/future range isolation and multi-year history performance, production-plan multi-year paging, daily send-to-kitchen, and BOM import preview/commit all-or-nothing; remaining backend work should focus on defects discovered by future frontend/E2E flows.
- Introduce soft coverage thresholds only after the next frontend test slice, because frontend baseline is intentionally honest and currently very low.
