# Phase 8 operational page baseline

Recorded: 2026-07-19 before production-source extraction.

## Page ownership

| Page | Lines | SHA-256 | GitNexus upstream risk |
| --- | ---: | --- | --- |
| `frontend/src/features/projects/pages/WeeklyMenuPage.tsx` | 4,014 | `376BEE1DF8B3F25A55A1DA65EA66F65D96DE67CB9C85BB1A89ED2B5CF22DA17A` | LOW, 0 affected flows |
| `frontend/src/features/workflow/pages/PurchasingPage.tsx` | 899 | `F55E243F6C6825099BAE695130B5948FB7D4201E27D3276DEA671D9B5C7D19C0` | LOW, 0 affected flows |
| `frontend/src/features/chef/pages/ChefDashboardPage.tsx` | 633 | `0C023826FF20E1FC911BA9D72DE2E7F9F1B511A7EFADC2F49F039AA32898B892` | LOW, 0 affected flows |

The source tree was clean at the boundary except for the intentionally untracked local `.codex/` tooling directory.

## Locked API and interaction contracts

- Weekly Menu: preview/commit Excel import, bulk schedule update, quick servings, material-demand generation, production plan filtering and paging.
- Purchasing: server-paged material-request candidates, purchase request creation/submission, supplier quotations, purchase orders and receipt mutations.
- Chef: daily production plan, kitchen issue receipt confirmation, supplemental material request and inventory return mutations.
- Routes remain `/weekly-menu`, `/purchasing` and `/chef-dashboard`.

`frontend/src/features/operationalPageContracts.test.ts` locks these routes, visible action labels and required query/mutation hooks. Existing Playwright coverage locks protected-route headings, Weekly Menu dialog accessibility, paged purchasing creation and kitchen receipt confirmation.

## Verification baseline

- Focused contract tests: 4/4 passed.
- Full frontend unit suite: 89/89 passed with one Vitest worker.
- Lint/build attempts did not produce source diagnostics; Node was terminated by the operating system when committed virtual memory was exhausted. At capture time Windows reported about 76 MB free virtual memory, while unrelated desktop/browser applications held most committed memory. These gates must be rerun after memory is available and remain mandatory before phase completion.
