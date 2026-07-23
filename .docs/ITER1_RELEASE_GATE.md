# Iter1 Release Gate & Scope

> Merged from ITER1_PROD_READY_SCOPE.md + ITER1_RELEASE_QUALITY_GATE.md on 2026-07-08.
> Status: **v1.0 PASSED + Iter1 P0 CLOSED** — release gate evidence at .artifacts/release-gates/20260707-123452/quality-gate-summary.md; production-plan P0 closure evidence refreshed 2026-07-09.

---

## Production-Ready Scope

# Iter1 Production-Ready Scope

Date locked: 2026-07-02
Source of truth: `Project_Tracking (1).xlsx`, sheet `Iter1_Production_Plan`

This document closes PRD-001 by turning the Iter1 tracker into the official release acceptance checklist. The workbook remains the detailed task board; this file records how reviewers should read it and what must be true before LAN/prod release.

## Signed Scope

Iter1 production-ready scope is the operational kitchen workflow:

Contract -> Menu -> Order -> Demand -> Purchase -> Approval -> Warehouse -> Kitchen -> Reports -> Release

The scope is accepted only when every P0 row in `Iter1_Production_Plan` has:

- Owner: the role responsible for delivery or verification.
- Surface: screen, API, report, config, or runbook where the work is visible.
- Trigger: when the task applies.
- Rule: business validation or release gate.
- Output: artifact, record, report, or UI state created by the task.
- Acceptance: the concrete check a stakeholder or QA can repeat.
- Evidence: note with command, test result, commit, or manual verification date.

## Tracker Snapshot

Current implementation count after the 2026-07-09 PRD-201 refresh (workbook synchronization pending):

| Status | Count |
| --- | ---: |
| Done | 80 |
| Backlog | 0 |
| Total | 80 |

Open P0 scope remains:

| Area | PRD rows |
| --- | --- |
| None | All P0 rows are Done |

P1 rows may remain open if they are explicitly documented as follow-up and do not block the P0 happy path.

## Release Acceptance Checklist

Before release, the reviewer should confirm:

1. Tracker hygiene: every P0 row is `Done` or explicitly blocked with owner, reason, and next action.
2. Build gate: backend build, frontend build/lint, backend tests, smoke tests, seed reset, and selected E2E tests have dated evidence from `.docs/ITER1_RELEASE_QUALITY_GATE.md`.
3. Role gate: direct API calls are rejected when the actor lacks the required role or permission.
4. UAT gate: `.docs/ITER1_UAT_MATRIX.md` has at least one happy path and one exception path for each actor.
5. Workflow gate: menu import, quantity confirmation, demand generation, purchase submission, approval, receipt, issue, kitchen signoff, and reports are connected by persisted records.
6. Data gate: missing BOM, missing conversion, price warning, stock shortage, orphan document, and stale workflow data are visible as data-quality issues or validation errors.
7. Deployment gate: environment config, migration plan, seed mode, and release verification command are documented.
8. Documentation gate: actor runbook and daily checklist are current with the implemented UI/API labels.

## Evidence Rules

Use short evidence notes in the tracker:

`[YYYY-MM-DD] Done: <what changed>. Commit: <sha>. Verify: <commands or manual check>.`

If a task is blocked, use:

`[YYYY-MM-DD] Blocked: <reason>. Needed: <dependency or decision>.`

Do not mark a row `Done` based only on implementation intent. It needs repeatable evidence in code, docs, tests, or a checked workbook/runbook artifact.

## Reviewer Path

For a stakeholder read-through:

1. Start at `Iter1_Production_Plan`.
2. Filter `Ưu tiên = P0`.
3. Filter `Trạng thái != Done`.
4. Review the remaining rows against this scope file.
5. Run the current release gates from PRD-002 when that row is complete.

For a demo read-through, use `.docs/MVP_MANUAL_RUNBOOK.md` and `.docs/MVP_DEMO_DATA.md`.

For role onboarding, use `.docs/ITER1_ACTOR_RUNBOOK.md`.

For daily/weekly operations, use `.docs/ITER1_DAILY_CHECKLIST.md`.

For destructive endpoint review, use `.docs/ITER1_DESTRUCTIVE_ENDPOINT_AUDIT.md`.


---

## Quality Gate Checklist

# Iter1 Release Quality Gate

This closes PRD-002. The release candidate is blocked until every required gate has dated evidence.

## Required Gates

| Gate | Command / evidence |
| --- | --- |
| Backend restore | `dotnet restore backend/src/IPCManagement.Api/IPCManagement.Api.csproj` |
| Frontend restore | `npm ci` |
| Backend build | `npm run build:be` |
| Backend tests | `npm run test:be` |
| Frontend lint | `npm run lint:fe` |
| Frontend build | `npm run build:fe` |
| Frontend smoke | `npm run test:smoke -w frontend` |
| Seed reset | `powershell -ExecutionPolicy Bypass -File scripts/Invoke-Iter1SeedMode.ps1 -Mode DemoReset -BaseUrl <api-url>` |
| Selected E2E | `npm run e2e:happy -- -SkipSeedReset` and `npm run e2e:exceptions`, then pass dated log paths to release evidence |

## Runbook

Audit the gate configuration without running release commands:

```powershell
npm run verify:release:audit
```

Run the release gate against a release candidate backend:

```powershell
npm run verify:release -- `
  -BackendBaseUrl http://localhost:5262 `
  -RunSeedReset `
  -E2ELogPath .artifacts/e2e/<dated-e2e-log>.log
```

The script writes:

- `.artifacts/release-gates/<timestamp>/quality-gate.log`
- `.artifacts/release-gates/<timestamp>/quality-gate-summary.md`

## Blocking Rule

Release is blocked when any command fails or when seed reset / selected E2E evidence is missing.

Latest E2E evidence:

- Happy path: `.artifacts/e2e/20260709-004127175/happy-path-e2e-summary.md`
- Exception path: `.artifacts/e2e/20260709-103742321/exception-path-e2e-summary.md`

Latest production-surface hardening evidence:

- PRD-191 mock-surface audit: `npm run lint:fe`, clean `npm run build:fe`, `npm run test:smoke -w frontend`, and production bundle grep for fallback/mock-login strings returned `no_prod_mock_strings_found`.

Latest P1 hardening evidence:

- PRD-142 data-quality cleanup: `POST /api/workflow-reports/data-quality/cleanup` supports dry-run and apply modes for safe orphan/stale workflow cleanup. Verify: backend build pass, `dotnet test ... --filter "DataQuality"` passed 3/3, full backend tests passed 185/185.
- PRD-160 correlation observability: requests accept or generate `X-Correlation-ID`, return it in the response, set `HttpContext.TraceIdentifier`, and enrich scoped Serilog console/file logs so one production-week key can be followed across import, generation, approval, warehouse, and signoff requests. Verify: middleware tests passed 3/3, backend build passed, full backend tests passed 188/188.
- PRD-161 operational monitoring: `operational-kpis` counts failed workflow/import records, data-quality errors, and approvals waiting beyond the operational threshold; Admin > Thống kê exposes the signals with handoff links. Verify: focused KPI test passed, backend tests passed 189/189, frontend lint/build passed, route smoke passed 10/10.
- PRD-172 visual baseline: Playwright now captures 10 workflow routes at desktop 1365x900 and mobile 390x844 using deterministic API fixtures and a settled render state. Verify: visual baseline update passed 20/20, repeated visual comparison passed 20/20, frontend lint/build passed.
- PRD-173 mobile deep UAT: Playwright executes approval, warehouse issue creation, and kitchen receipt signoff as one flow at tablet 768px and mobile 390px, validating payloads, feedback, and zero page overflow after each lane. Verify: focused UAT passed 2/2, full route smoke passed 12/12, frontend lint/build passed.
- PRD-200 large report pagination: stock movement and audit report page endpoints return bounded cursor metadata, support date filtering plus ascending/descending order, and preserve the existing array endpoints for operational consumers. Reports uses server-side Previous/Next cursor navigation instead of loading a fixed 100-row history. Verify: focused paging tests passed 2/2, backend tests passed 190/190, frontend lint/build passed, route smoke passed 13/13, visual suite passed 20/20.
- PRD-201 demand/purchase performance: purchase generation batch-loads quotation, supplier, and latest receipt context before creating lines. `npm run benchmark:workflow` covers 12 customers x 12 ingredients x 7 days (1,008 demand and 1,008 purchase lines) with gates below 120 SELECTs and 10 seconds. Baseline measured 4,102 SELECTs/about 3 seconds; optimized evidence measured 91 SELECTs/1,048 ms. Verify: benchmark passed, backend build passed, backend tests passed 191/191.

The tracker evidence note should include:

`[YYYY-MM-DD] Quality gate: <PASS/BLOCKED>. Summary: <path>. Commit: <sha>.`

