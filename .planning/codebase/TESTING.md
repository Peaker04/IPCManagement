# Testing Map

**Analysis date:** 2026-07-19

## Backend commands

```powershell
dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj --no-restore
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore
```

Backend tests are xUnit tests with FluentAssertions, NSubstitute, SQLite/in-memory fixtures and MVC integration coverage. Workflow lifecycle coverage is under `backend/tests/IPCManagement.Api.Tests/Integration/` and `WorkflowGenerationTests.cs`.

## Frontend commands

```powershell
npm run test:unit --workspace frontend
npm run lint --workspace frontend
npm run build --workspace frontend
npm run test:controls --workspace frontend
npm run test:smoke --workspace frontend
npm run test:ui-audit --workspace frontend
npm run test:visual --workspace frontend
```

Frontend unit tests use Vitest and React Testing Library. Playwright controls, smoke, UI audit and visual tests live in `frontend/tests/`.

## Gate interpretation

- A build failure caused by a running `IPCManagement.Api` process is a file-lock blocker, not a code warning; stop the process or use a separate output only after confirming ownership.
- Visual snapshot mismatches must be classified by route/data/feature ownership before snapshots are updated.
- Protected-route smoke failures must distinguish missing API/auth/seed data from a real UI regression.
- Pagination changes need page-boundary, filter-reset, total-count and request-payload tests.

## Current evidence

- The latest aggregate-demand slice passed backend build, the focused aggregate test, full backend tests, frontend unit tests, lint and build before documentation refresh.
- Browser-level MVP operation still requires a running frontend, a migrated database and the demo seed; a green unit/build gate alone does not prove the web flow is operable.
