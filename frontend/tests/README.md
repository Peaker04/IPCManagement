# Frontend test taxonomy

The frontend keeps tests close to the seam they verify. This is a migration contract, not a reason to move every historical file at once.

| Location | Owner |
|---|---|
| `src/**/*.test.{ts,tsx}` | Unit/component behavior colocated with its production module |
| `tests/evidence/` | Campaign/evidence validators; excluded from default product CI unless explicitly selected |
| `tests/browser/**/*.spec.ts` | Playwright/browser suites and their adjacent screenshot baselines |
| `tests/contracts/` | New cross-module contracts; historical root contracts remain bounded migration debt |
| `tests/support/` | Shared browser/cross-module support code; browser specs must never import another spec |
| `tests/fixtures/` | Browser and contract fixtures |

All Playwright specs have moved out of the test root. Phase 27/28/35 path contracts and snapshot manifests were migrated with the specs and remain covered by their existing lineage validators.
