# Development

## Setup

Use Node 22.19+ and npm with root `package-lock.json`; .NET SDK selection is in `global.json`. Backend targets .NET 9 and MySQL 8.0.36. Install from the repository root:

```sh
npm ci
dotnet restore backend/IPCManagement.slnx
```

Create local backend configuration from the matching `.example` file; provide credentials outside Git. See [CONFIGURATION](CONFIGURATION.md). Frontend uses `/api` and Vite proxy `http://localhost:5262` unless `VITE_PROXY_TARGET` overrides it. Start `npm run be` and `npm run fe` in separate terminals; Vite defaults to port 5173. Verify actual listeners/build and `/health/ready`, not remembered process IDs. Startup may validate existing DB state; setup does not authorize migrations/seed/warehouse activation.

## Commands

| Command | Purpose |
|---|---|
| `npm run build:be` / `build:fe` | Backend build / frontend typecheck and Vite build |
| `npm run test:be:ci` | Hermetic/core backend selection; not all DB/recovery tests |
| `npm run test:fe:unit -- --maxWorkers=1` | Frontend unit/contract suite |
| `npm run lint:fe` / `depcruise:fe` | ESLint / dependency boundaries |
| `npm run gen:api` | Regenerate OpenAPI and typed schema; changes tracked contracts |
| `npm run check:api-contract` | Regenerate and reject generated parity drift |
| `npm run verify` | Local quality aggregate; inspect scripts and test prerequisites first |
| `npm run coverage:be` / `coverage:fe` | Coverage; broad backend tests may need DB prerequisites |
| `npm run e2e:happy` / `e2e:weekly` / `e2e:exceptions` | Explicitly authorized mutating business scenarios, not safe startup checks |

Exact executable definitions live in root/frontend package manifests and GitHub workflows, not duplicated command catalogs. API generation restores tools and writes temporary build output; review its diff before promotion.

## Contributions

Use existing TypeScript/C# conventions and existing dependencies. TS app config enforces unused-local/parameter and fallthrough checks; ESLint uses flat config. `@/*` maps to frontend source. No repository formatter is mandated. Keep changes reviewable, run checks matching risk, and update the owning product docs. No automatic commit/push/deploy.

One RTK Query API owner and normalized query args; no hidden mutation in `onChange`. Preserve explicit draft/commit and double-submit guards, including direct-fetch callers. Do not remove StrictMode to hide duplicate work. Dates/precision/permissions follow [architecture](ARCHITECTURE.md), [grain](DATA-GRAIN-MATRIX.md) and domain contracts.

Browser checks use a separate headed Chrome context and confirmed runtime/auth/mode. Never reset a database, switch mode, stop arbitrary processes or reuse stale credentials to make a check pass. See [testing](TESTING.md) and [database recovery](operations/database-recovery.md).
