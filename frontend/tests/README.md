# Frontend test taxonomy

The frontend keeps tests close to the seam they verify. This index describes current locations, not campaign state or a migration-completion report. Acceptance and measurement authority: [TESTING](../../docs/TESTING.md).

| Location | Owner |
|---|---|
| `src/**/*.test.{ts,tsx}` | Unit/component behavior colocated with its production module |
| `tests/config/` | Browser configuration and focused verification settings |
| `tests/browser/**/*.spec.ts` | Playwright/browser suites and their adjacent screenshot baselines |
| `tests/contracts/` | Suggested location for new cross-module contracts; current root contracts remain at their existing owners |
| `tests/support/` | Shared browser/cross-module support code; browser specs must never import another spec |
| `tests/fixtures/` | Browser and contract fixtures |

Browser specs live under `tests/browser` and must remain isolated from Vitest. Screenshot baselines are consumed by their browser assertions; a historical result or snapshot-path manifest is not a current acceptance owner.
