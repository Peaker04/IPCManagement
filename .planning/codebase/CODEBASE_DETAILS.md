# Codebase Details

**Last updated:** 2026-07-08 (merged from CONVENTIONS, INTEGRATIONS, TESTING, CONCERNS — 2026-06-12 originals; stale items from Phase 1 removed)

---

## Coding Conventions

### Naming Patterns

**Files:**
- Backend C# files use PascalCase matching the main type: `Services/InventoryIssueService.cs`, `Controllers/InventoryIssuesController.cs`.
- Backend interfaces use `I` prefix beside implementations: `IInventoryIssueService.cs`, `IInventoryIssueRepository.cs`.
- Frontend page-level React files use PascalCase: `LoginPage.tsx`, `CoordinationPage.tsx`. Feature components use kebab-case: `order-table.tsx`.
- Shared shadcn/base-ui primitives use lowercase filenames: `button.tsx`, `dialog.tsx`.
- Redux feature files use feature names with suffixes: `authSlice.ts`, `authApi.ts`.

**Functions:**
- Backend public async methods end in `Async`: `CreateAsync`, `GetByIdAsync`.
- Frontend functions, hooks, reducers use camelCase: `handleSubmit`, `useAppDispatch`.
- React components use PascalCase exports: `AppRouter`, `Button`.

**Variables:**
- Backend private fields use `_camelCase`: `_issueRepository`, `_unitOfWork`.
- Frontend state variables use camelCase setter pairs: `username`/`setUsername`.

**Types:**
- Backend DTOs end in `Dto`: `CreateInventoryIssueDto`, `InventoryIssueCreatedDto`.
- Backend validators end in `Validator`: `CreateInventoryIssueDtoValidator`.
- Frontend TypeScript interfaces use PascalCase: `CoordinationState`, `OrderRow`.

### Code Style

- Backend: 4-space indent, block braces on own lines, nullable types enabled, implicit usings enabled.
- Frontend: 2-space indent in React/TSX files. No Prettier config — preserve local file style.
- Tailwind class composition via `cn()` in `frontend/src/lib/utils.ts`.
- Frontend linting: ESLint flat config in `frontend/eslint.config.js` (typescript-eslint, react-hooks, react-refresh).
- Commit quality: commitlint conventional config in `commitlint.config.js`.

### Import Organization

1. Backend `using`: system/framework → third-party → project namespaces. File-scoped namespace.
2. Frontend: external packages first, then app-relative imports.
3. Frontend type-only imports use `import type`.
4. Frontend alias `@` maps to `frontend/src` (configured in `frontend/vite.config.ts`).

### Error Handling

- Backend controllers return `ApiResponse` envelopes; services throw `ArgumentException`/`InvalidOperationException`.
- Global exception handling in `backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs`.
- Transaction failures roll back and rethrow inside service `CreateAsync` methods.
- Backend validation in FluentValidation validators with Vietnamese user-facing messages.
- Frontend: RTK Query calls use `.unwrap()` when branching on success/failure.

### Logging

- Backend: Serilog configured in `Program.cs` — console + rolling file `logs/ipc-.log`, 30-day retention.
- Backend: unhandled exceptions logged through `ILogger<ExceptionMiddleware>`.
- Use structured Serilog message templates: `Log.Information("Listening on {Url}", url)`.

---

## Integrations & Network

### Frontend-to-Backend

- RTK Query baseUrl: `/api` (relative) — Vite proxies to `http://localhost:5262` in dev.
- Auth: JWT bearer token from Redux auth state → `Authorization` header in `apiSlice.ts`.
- Refresh token rotation: automatic in `baseQueryWithAuthHandling` within `apiSlice.ts`.

### Backend API

- 22 controllers under `Controllers/` — full list in `PROJECT.md`.
- Swagger/OpenAPI: `http://localhost:5262/swagger` (Development only).
- Auth: custom username/password → JWT access + refresh token rotation.
  - `JwtSettings`: SecretKey (≥32 chars), Issuer, Audience, ExpiryMinutes, RefreshExpiryDays.
  - Refresh token stored in `refreshtokens` table.

### Data Storage

- **MySQL 8+**: primary DB, EF Core Code-First, Pomelo provider. Migrations in `Migrations/`.
- **localStorage**: frontend stores `token` + `user` snapshot (via `authSlice.ts`).
- **File logs**: `logs/ipc-.log` (Serilog, local only).
- No Redis, S3/blob, external error tracking, or outbound webhooks.

### CI/CD

- **GitHub Actions**: `.github/workflows/verify.yml` — Node 20, .NET 9, build:be → test:be → EF migration check → MySQL schema verify.
- **Husky + commitlint**: pre-commit hooks enforcing conventional commits.
- **Deployment**: `vercel.json` at root and `frontend/vercel.json`.

### CORS & Rate Limiting

- Development: all origins/headers/methods allowed.
- Production: `Cors:AllowedOrigins` restricts origins; wildcard `AllowedHosts` rejected.
- `auth-strict`: fixed window on auth endpoints.
- `api-general`: sliding window on protected utility endpoints.

### Environment Config Keys

| Key | Purpose |
|-----|---------|
| `ConnectionStrings:DefaultConnection` | MySQL connection |
| `JwtSettings:SecretKey` | Signing key (≥32 chars) |
| `JwtSettings:Issuer` | Token issuer |
| `JwtSettings:Audience` | Token audience |
| `JwtSettings:ExpiryMinutes` | Access token lifetime |
| `JwtSettings:RefreshExpiryDays` | Refresh token lifetime |
| `Cors:AllowedOrigins` | Production CORS allowlist |
| `Pagination:MaxPageSize` | Repository pagination cap |

---

## Testing

### Backend (xUnit)

- Runner: xUnit 2.9.2 + FluentAssertions 8.10.0 + NSubstitute 5.3.0.
- Run: `npm run test:be` (root) or `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`.
- Test naming: `Method_Should_ExpectedBehavior_When_Condition`.
- Use constructor setup for shared substitutes; Arrange/Act/Assert pattern; `[Fact]` + `async Task`.
- Mock repositories, `IUnitOfWork`, `IStockLedgerService`, transaction; do NOT mock the service under test.
- Test data built inline; no shared factory directory yet.

**Test file structure (Phase 2 state):**
```
backend/tests/
├── IPCManagement.Api.Tests/
│   ├── AuthServiceTests.cs
│   ├── InventoryIssueServiceTests.cs
│   ├── InventoryReceiptServiceTests.cs
│   ├── WorkflowGenerationTests.cs   ← added Phase 2
│   └── IPCManagement.Api.Tests.csproj
└── IPCManagement.Application.Tests/
    ├── UnitTest1.cs  (placeholder)
    └── IPCManagement.Application.Tests.csproj
```

### Frontend (Playwright)

- Runner: Playwright 1.60.0. Config: `frontend/playwright.config.ts`. Test files: `frontend/tests/`.
- Run: `npm run test:smoke -w frontend` (route smoke) or `npm run test:visual -w frontend` (visual).
- Smoke tests cover protected route access; visual tests use snapshot comparison.

---

## Open Tech Debt & Fragile Areas

> Items resolved in Phase 2 have been removed. The following are still active concerns.

### Active

**EF Core context is large (≈1,500 lines):**
- `Data/IpcManagementContext.cs` and migration snapshot files are fragile for manual edits.
- Fix: treat as schema-owned code; make changes through migrations only; use repo/service tests for mapping regressions.

**Current stock updates have no concurrency control:**
- `StockLedgerService.RemoveStockWithCheckAsync` is read-modify-write without a row-version or atomic SQL UPDATE.
- Fix: add optimistic concurrency token or atomic `UPDATE ... WHERE currentQty >= quantity`.

**Paged repositories inconsistent:**
- `GenericRepository<T>` clamps page params; specialized repositories (`InventoryReceiptRepository`, `InventoryIssueRepository`) use raw values.
- Fix: centralize pagination normalization in a shared helper before all Skip/Take.

**JWT refresh flow skips issuer/audience validation:**
- `JwtTokenService.GetPrincipalFromExpiredToken` sets `ValidateIssuer = false`, `ValidateAudience = false`.
- Workaround: keep signing secret unique. Fix: validate issuer/audience in refresh the same way as bearer validation.

**Frontend pages are large composition shells:**
- `WeeklyMenuPage.tsx`, `DashboardPage.tsx`, `ChefDashboardPage.tsx` mix calculations and UI.
- Fix: extract calculation logic into typed feature selectors/hooks and add unit tests.

**Backend test coverage is service-level only:**
- No controller/integration tests for auth, CORS, rate limit, or concurrent stock updates.
- `UnitTest1.cs` placeholder classes add false confidence.
- Priority: High.

---

*Merged: 2026-07-08 from CONVENTIONS.md + INTEGRATIONS.md + TESTING.md + CONCERNS.md (all dated 2026-06-12). Original files deleted.*
