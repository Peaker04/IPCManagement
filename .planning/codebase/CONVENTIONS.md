# Coding Conventions

**Analysis Date:** 2026-07-27

## Naming Patterns

**Files:**
- Use PascalCase for React components and their files, such as `frontend/src/components/common/DataTableShell.tsx`; co-locate component tests as `DataTableShell.test.tsx`.
- Use camelCase for frontend utilities, models, API modules, and hooks, such as `frontend/src/lib/actionEligibility.ts`, `frontend/src/api/workflowApi.ts`, and `frontend/src/lib/usePaginatedRows.ts`.
- Use `*.test.ts` / `*.test.tsx` for Vitest tests under `frontend/src/`; use `*.spec.ts` for Playwright scenarios under `frontend/tests/`.
- Use PascalCase and the `Tests.cs` suffix for backend test classes, such as `backend/tests/IPCManagement.Api.Tests/AuthServiceTests.cs`.
- Keep backend production types in feature/layer paths matching `backend/src/IPCManagement.Api/Features/{Feature}/{Contracts|Controllers|Services|Validators}`; `backend/tests/IPCManagement.Application.Tests/FeatureNamespaceConventionTests.cs` enforces the matching namespaces.

**Functions:**
- Use camelCase for frontend functions and hooks; hooks begin with `use`, as in `frontend/src/lib/usePaginatedRows.ts`.
- Use PascalCase for C# methods and append `Async` to methods declared `async`; `backend/.editorconfig` makes this an error-level naming rule.
- Name backend tests as `Method_Should_Expected_When_Condition`, as demonstrated in `backend/tests/IPCManagement.Api.Tests/AuthServiceTests.cs`.
- Name frontend tests with behavior-oriented sentences inside `it(...)` or `test(...)`, as in `frontend/src/lib/actionEligibility.test.ts`.

**Variables:**
- Use camelCase for frontend variables and local C# variables.
- Prefix private/protected C# fields with `_` and use camelCase, as in `_userRepository` in `backend/tests/IPCManagement.Api.Tests/AuthServiceTests.cs`; this is enforced by `backend/.editorconfig`.
- Use `const` by default in TypeScript and reserve uppercase snake case for true shared constants, such as route or query-pattern constants in `frontend/eslint.config.js`.

**Types:**
- Use PascalCase for TypeScript types/interfaces and C# types.
- Prefix C# interfaces with `I`, enforced by `backend/.editorconfig` and visible in dependencies such as `IUserRepository` in `backend/tests/IPCManagement.Api.Tests/AuthServiceTests.cs`.
- Use `Request` for backend input contracts and `Dto` only for response/data-transfer shapes; generated API types live in `frontend/src/shared/api/contracts/schema.ts`.
- Prefer `type` imports in TypeScript when the import is type-only, as in `frontend/tests/navigation-performance.spec.ts`.

## Code Style

**Formatting:**
- No Prettier or Biome configuration is detected. Preserve the formatting of the touched file instead of introducing a formatter.
- Frontend source generally uses two-space indentation, single quotes, trailing commas in multiline constructs, and semicolons inconsistently across older/newer files. Follow the local file style and let ESLint/TypeScript be the authority.
- Backend C# uses four-space indentation, braces on new lines, nullable reference types, and implicit usings as configured in `backend/src/IPCManagement.Api/IPCManagement.Api.csproj` and both test project files.
- Run `git diff --check` after edits to catch whitespace errors; the expected full gate is documented in `docs/CURRENT-STATE.md`.

**Linting:**
- Run `npm run lint:fe` from the root or `npm run lint` from `frontend/`; configuration is `frontend/eslint.config.js`.
- ESLint extends recommended JavaScript, TypeScript, React Hooks, and React Refresh rules for all `*.ts`/`*.tsx` files.
- Do not read RTK Query `data` or `currentData` without also handling `isError`/`error`. The custom `ipc/no-swallowed-query-error` rule in `frontend/eslint.config.js` is warning-level generally and error-level on operational decision screens.
- TypeScript compilation rejects unused locals, unused parameters, and switch fallthrough via `frontend/tsconfig.app.json`.
- Respect dependency boundaries checked by `frontend/.dependency-cruiser.cjs`; run `npm run depcruise -w frontend` and do not add to `frontend/.dependency-cruiser-known-violations.json` merely to silence a new violation.

## Import Organization

**Order:**
1. Import framework/runtime and third-party packages first (`react`, `vitest`, `@testing-library/react`, ASP.NET/EF namespaces).
2. Import project modules next, preferring the `@/` alias in frontend source and feature namespaces in backend code.
3. Import local sibling modules last, such as `./DataTableShell` in `frontend/src/components/common/DataTableShell.test.tsx`.
4. Keep type-only imports marked with `import type` or inline `type` specifiers.

**Path Aliases:**
- Use `@/*` for `frontend/src/*`; it is configured in `frontend/vite.config.ts` and `frontend/tsconfig.app.json`.
- Use relative imports for a directly co-located implementation/test pair where this makes ownership explicit.
- Do not import from removed legacy backend layers. Production types must use `IPCManagement.Api.Features.{Feature}.{Layer}` or `IPCManagement.Api.Shared.Contracts`, enforced by `backend/tests/IPCManagement.Application.Tests/FeatureNamespaceConventionTests.cs`.
- Avoid barrel imports that recreate feature cycles; dependency-cruiser guards the frontend graph via `frontend/.dependency-cruiser.cjs`.

## Error Handling

**Patterns:**
- Backend middleware converts exceptions to a stable API envelope and hides unexpected exception details in production; preserve this behavior and test it through `backend/tests/IPCManagement.Api.Tests/ExceptionMiddlewareTests.cs`.
- Backend service methods use nullable results for expected absence and exceptions for invalid/unexpected conditions. Tests distinguish these outcomes explicitly in files such as `backend/tests/IPCManagement.Api.Tests/AuthServiceTests.cs`.
- Frontend operational queries must render a semantic error state (`QueryErrorAlert` or `EmptyState variant="error"`) instead of presenting failed requests as valid empty data; see `frontend/eslint.config.js` and `frontend/src/components/common/QueryErrorAlert.test.tsx`.
- Mutation/UI errors should preserve server-derived eligibility and recovery reasons. Keep decision logic in pure helpers such as `frontend/src/lib/actionEligibility.ts`, with direct unit coverage in `frontend/src/lib/actionEligibility.test.ts`.
- Do not use broad `catch` blocks to conceal unsupported browser APIs. Where capability fallback is intentional, keep the fallback narrow and documented, as in the Long Tasks observer in `frontend/tests/navigation-performance.spec.ts`.

## Logging

**Framework:** Backend uses `Microsoft.Extensions.Logging`; frontend production code uses application UI feedback, while browser tests use Playwright attachments and targeted console output.

**Patterns:**
- Inject typed `ILogger<T>` into backend services/middleware and log through the framework; substitute it with NSubstitute in isolated tests, as in `backend/tests/IPCManagement.Api.Tests/ExceptionMiddlewareTests.cs`.
- Do not expose secrets, credentials, connection strings, or raw unexpected exception details in responses or committed artifacts.
- In Playwright performance tests, attach structured JSON with `test.info().attach(...)` and emit a stable prefixed log line, as in `frontend/tests/navigation-performance.spec.ts`.
- Use `ITestOutputHelper` for useful backend integration diagnostics, as in `backend/tests/IPCManagement.Api.Tests/Integration/WorkflowLifecycleE2ETests.cs`.

## Comments

**When to Comment:**
- Comment the business invariant, compatibility constraint, or reason for a non-obvious guard—not a restatement of syntax. Examples include the RTK Query error rule rationale in `frontend/eslint.config.js` and MySQL skip policy in `backend/tests/IPCManagement.Api.Tests/Integration/WorkflowLifecycleE2ETests.cs`.
- Keep Arrange/Act/Assert comments in longer backend tests when they improve scanability; short frontend tests normally rely on descriptive test names.
- For intentional compatibility shims or baseline contracts, state what must remain stable and why, as in `frontend/src/api/workflowApi.cacheInvalidation.test.ts`.

**JSDoc/TSDoc:**
- JSDoc is uncommon in application modules; use it for custom tooling/rules whose contract is not obvious, such as `frontend/eslint.config.js`.
- Use XML documentation for reusable C# test infrastructure or attributes with non-obvious runtime/discovery behavior, as in `RequiresMySqlFactAttribute` in `backend/tests/IPCManagement.Api.Tests/Integration/WorkflowLifecycleE2ETests.cs`.

## Function Design

**Size:** Prefer small pure helpers for formatting, status, eligibility, and derived view state under `frontend/src/lib/` or the owning feature. Keep page components as composition layers and extract page models/panels when they grow.

**Parameters:**
- Use typed object parameters when a frontend helper needs several related inputs, as in `resolveIssueCreationAvailability` tested by `frontend/src/lib/actionEligibility.test.ts`.
- Inject backend dependencies through constructors and depend on interfaces, as in `backend/tests/IPCManagement.Api.Tests/AuthServiceTests.cs`.
- Pass `CancellationToken` through asynchronous backend request/service paths where the production signature exposes it.

**Return Values:**
- Return explicit presentation/eligibility objects from frontend domain helpers rather than scattering UI conditionals.
- Return typed API envelopes and generated contract-backed shapes at HTTP boundaries; keep frontend wire types derived from `frontend/src/shared/api/contracts/schema.ts`.
- Use nullable C# return types only for expected absence, and assert null/non-null paths separately.

## Module Design

**Exports:**
- Prefer named exports for frontend components, helpers, API slices, and types. Keep implementation-specific helpers unexported.
- Organize backend by vertical feature and layer: contracts, controllers, services, and validators under `backend/src/IPCManagement.Api/Features/`.
- Keep shared backend code contract-only under `backend/src/IPCManagement.Api/Shared/Contracts`; a reflection test prevents unrelated shared dumping.

**Barrel Files:**
- Avoid adding broad feature barrel files. Import from the owning module to keep dependencies visible and prevent cycles.
- Generated OpenAPI artifacts in `frontend/src/shared/api/contracts/` are the wire-contract source; do not manually duplicate request/response DTOs in feature modules.

---

*Convention analysis: 2026-07-27*
