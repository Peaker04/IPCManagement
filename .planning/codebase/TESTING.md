# Testing Patterns

**Analysis Date:** 2026-07-27

## Test Framework

**Runner:**
- xUnit 2.9.2 for backend unit and integration tests in `backend/tests/IPCManagement.Api.Tests/` and `backend/tests/IPCManagement.Application.Tests/`.
- Vitest 4.1.10 with jsdom for frontend unit/component tests under `frontend/src/`; config: `frontend/vite.config.ts`.
- Playwright 1.60.0 for browser contract, visual, smoke, control-surface, and performance scenarios under `frontend/tests/`; config: `frontend/playwright.config.ts`.

**Assertion Library:**
- Backend: FluentAssertions 8.10.0, with xUnit assertions available.
- Frontend unit: Vitest `expect` plus `@testing-library/jest-dom` matchers loaded by `frontend/src/test/setup.ts`.
- Browser: Playwright `expect` with role/label-driven locators.

**Run Commands:**
```bash
npm run test:be                # Run both backend test projects
npm run test:fe:unit           # Run all frontend Vitest tests once
npm run test:unit:watch -w frontend  # Watch frontend unit tests
npm run verify                 # Backend build/tests + frontend unit/lint/graph/build
npm run coverage:be            # Backend Coverlet + HTML/text report
npm run coverage:fe            # Frontend V8 coverage
npm run test:smoke -w frontend # Playwright route smoke suite
npm run test:visual -w frontend # Playwright visual contracts
```

## Test File Organization

**Location:**
- Backend tests are separate from production code in `backend/tests/IPCManagement.Api.Tests/` and `backend/tests/IPCManagement.Application.Tests/`.
- Frontend unit/component tests are co-located with the implementation under `frontend/src/`, for example `frontend/src/lib/actionEligibility.test.ts` and `frontend/src/components/common/DataTableShell.test.tsx`.
- Browser tests live separately in `frontend/tests/`; shared browser fixtures live alongside them, such as `frontend/tests/phase9-test-fixture.ts`.
- Real-stack E2E orchestration scripts live in `scripts/`, including `scripts/Invoke-WeeklyHappyPathE2E.ps1` and `scripts/Invoke-Iter1ExceptionPathE2E.ps1`.

**Naming:**
- Backend: `{Subject}Tests.cs`; integration suites may live below `Integration/` and still use `Tests.cs`.
- Frontend unit/component: `{module}.test.ts` or `{Component}.test.tsx`.
- Playwright: `{scenario}.spec.ts`; snapshot assets belong to Playwright-generated snapshot directories.

**Structure:**
```text
backend/tests/
├── IPCManagement.Application.Tests/   # Pure application/domain and architecture contracts
└── IPCManagement.Api.Tests/
    ├── Infrastructure/                 # WebApplicationFactory and shared test host setup
    ├── Integration/                    # Real-MySQL/API lifecycle tests
    └── *Tests.cs                       # Service, controller, repository, middleware tests

frontend/
├── src/**/*.test.{ts,tsx}              # Co-located Vitest tests
├── src/test/setup.ts                   # Global cleanup and jest-dom matchers
└── tests/*.spec.ts                     # Playwright suites and fixtures
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it } from 'vitest'

describe('project-wide action eligibility', () => {
  it('blocks issue creation with a recovery reason when candidates are exhausted', () => {
    expect(resolveIssueCreationAvailability({
      canManageWarehouse: true,
      isFetching: false,
      candidateCount: 0,
    })).toEqual({
      canCreate: false,
      disabledReason: expect.any(String),
    })
  })
})
```
Pattern source: `frontend/src/lib/actionEligibility.test.ts`.

**Patterns:**
- Backend unit tests use constructor setup for substitutes/system-under-test and Arrange/Act/Assert sections, as in `backend/tests/IPCManagement.Api.Tests/AuthServiceTests.cs`.
- Frontend pure-function tests construct small typed fixtures and assert complete domain results with `toEqual` or selected fields with `toMatchObject`.
- Component tests render with Testing Library and query by accessible role/name, as in `frontend/src/components/common/DataTableShell.test.tsx`.
- Async frontend API/cache tests create a real Redux store around the RTK Query slice and wait for observable state transitions, as in `frontend/src/api/workflowApi.cacheInvalidation.test.ts`.
- Playwright tests authenticate/stub at the network seam, navigate through public routes, and assert semantic UI plus URL/request effects. Use fresh locators after navigation/DOM changes.
- Backend integration tests use `CustomWebApplicationFactory` from `backend/tests/IPCManagement.Api.Tests/Infrastructure/CustomWebApplicationFactory.cs` and isolate real MySQL via `IPC_TEST_CONNECTION_STRING`.

## Mocking

**Framework:**
- Backend: NSubstitute 5.3.0.
- Frontend unit: Vitest `vi`, including `vi.fn`, `vi.mock`, `vi.stubGlobal`, and `vi.waitFor`.
- Browser contract tests: Playwright `page.route(...)` and `route.fulfill(...)`.

**Patterns:**
```typescript
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
    return new Response(JSON.stringify({ success: true, data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})
```
Pattern source: `frontend/src/api/workflowApi.cacheInvalidation.test.ts`.

**What to Mock:**
- Mock repository/service interfaces in isolated backend service/controller tests; create substitutes in the test constructor and configure only behavior relevant to the case.
- Stub browser APIs such as `fetch`, `Request`, `navigator.connection`, or network routes only at explicit unit/browser-contract seams.
- Use deterministic API envelopes in Playwright tests and record requests when the contract includes query parameters, cursor pagination, or mutation count.
- Replace EF providers deliberately: InMemory for simple repository behavior, SQLite for relational semantics, and real MySQL for provider-specific/migration/lifecycle behavior.

**What NOT to Mock:**
- Do not mock the subject under test or pure domain calculation being verified.
- Do not use Playwright mock-login/API suites as proof that the deployed/current runtime works. Real-stack evidence requirements are documented in `docs/TESTING.md` and `AGENTS.md`.
- Do not replace MySQL with InMemory/SQLite when verifying MySQL collation, generated columns, migrations, transactions, or provider SQL.
- Do not update visual snapshots simply to make failures pass; review the rendered change first.

## Fixtures and Factories

**Test Data:**
```csharp
private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();

var user = new User
{
    UserId = userIdBytes,
    Username = "testuser",
    IsActive = true,
    Role = new Role { RoleName = "Admin" }
};

_userRepository.GetWithRoleAsync(Arg.Any<byte[]>()).Returns(user);
```
Pattern source: `backend/tests/IPCManagement.Api.Tests/AuthServiceTests.cs`.

**Location:**
- Binary workbook fixtures are declared as copied content in `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj` and stored under `backend/tests/IPCManagement.Api.Tests/Fixtures/`.
- Frontend browser fixture builders/stubs live in `frontend/tests/`, including `frontend/tests/phase9-test-fixture.ts`.
- Shared API test hosting lives in `backend/tests/IPCManagement.Api.Tests/Infrastructure/CustomWebApplicationFactory.cs`.
- Keep small one-test fixtures local; extract builders only when reused or when setup obscures the behavior assertion.

## Coverage

**Requirements:** No numeric coverage threshold is enforced. Coverage is informational but expected to accompany meaningful changes; current gates prioritize all tests, lint, dependency graph, and builds.

**View Coverage:**
```bash
npm run coverage:be        # Writes Cobertura under backend/TestResults and HTML to CoverageReport
npm run coverage:fe        # Writes text/html/lcov under frontend/coverage
npm run verify:coverage    # Runs both coverage pipelines
```
- Backend configuration: `backend/coverage.runsettings`; migrations under `**/Migrations/*.cs` are excluded.
- Frontend configuration: `frontend/vite.config.ts`; excludes tests, `frontend/src/test/`, `frontend/src/main.tsx`, and assets.
- Do not combine Playwright execution with Coverlet/V8 percentages; report browser evidence separately.

## Test Types

**Unit Tests:**
- Pure calculations, parsing, validation, status/eligibility, presentation models, cache tags, middleware, and services.
- Prefer exhaustive edge/permission/terminal-state cases around business decisions, as shown by `frontend/src/lib/actionEligibility.test.ts` and `backend/tests/IPCManagement.Api.Tests/BoundaryValueAndValidationTests.cs`.

**Integration Tests:**
- API host tests use `Microsoft.AspNetCore.Mvc.Testing` and `CustomWebApplicationFactory`.
- Real-MySQL lifecycle tests use `[RequiresMySqlFact]`, disable parallelization through an xUnit collection, and must fail rather than silently skip in CI; see `backend/tests/IPCManagement.Api.Tests/Integration/WorkflowLifecycleE2ETests.cs`.
- Repository tests may use EF Core InMemory or SQLite when the provider behavior under test permits it.
- Contract drift is checked by `npm run check:api-contract`, comparing generated `frontend/src/shared/api/contracts/openapi.json` and `schema.ts`.

**E2E Tests:**
- Local browser-contract suites use Playwright config `frontend/playwright.config.ts`, Chromium Desktop Chrome, retained trace/video on failure, screenshot on failure, reduced motion, and a 2% visual diff ratio.
- Real-stack weekly/exception E2E uses root scripts in `scripts/` and must correlate frontend controls/rendering, backend request/response, database transitions, and final browser state.
- Current headed-browser evidence helpers and artifact requirements are documented in `docs/TESTING.md` and `docs/CURRENT-STATE.md`; preserve database lineage and do not reset/seed merely to rerun a check.

## Common Patterns

**Async Testing:**
```typescript
await store.dispatch(workflowApi.endpoints.getDataQuality.initiate())
await vi.waitFor(() => expect(releaseRefetches).toHaveLength(2))
expect(Object.values(store.getState().api.queries)
  .filter((query) => query?.status === 'pending')).toHaveLength(2)
```
Pattern source: `frontend/src/api/workflowApi.cacheInvalidation.test.ts`.

For components, await user actions and use `findBy*`, `waitFor`, or Playwright auto-waiting locators. Avoid arbitrary sleeps except when the timing itself is the contract; performance tests in `frontend/tests/navigation-performance.spec.ts` use explicit settling and measurable budgets.

**Error Testing:**
```csharp
var middleware = CreateMiddleware(_ => throw new Exception("sensitive detail"));

await middleware.InvokeAsync(context);

context.Response.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
var body = await ReadJsonBodyAsync(context);
body.GetProperty("message").GetString()
    .Should().Be("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
```
Pattern source: `backend/tests/IPCManagement.Api.Tests/ExceptionMiddlewareTests.cs`.

- Assert both the failure signal and absence of forbidden side effects/details.
- For frontend dependency failures, assert a semantic alert, retry affordance, successful refetch recovery, and removal of the error state.
- For negative real-stack cases, compare database state before/after so failed requests cannot leave partial transactions.

---

*Testing analysis: 2026-07-27*
