# Testing and measurement

Exact commands are owned by `package.json`, `frontend/package.json` and `.github/workflows/verify.yml`. Test observable behavior, public contracts, security/data safety or credible regressions; one strongest boundary per contract. Do not preserve historical receipt/hash/line-count inventories as product acceptance. No test-only production seam. A failing behavior test is not disposable process debris.

## Safe core checks

```sh
npm run build:be
npm run build:fe
npm run test:be:ci
npm run test:fe:unit -- --maxWorkers=1
npm run lint:fe
npm run depcruise:fe
node --test scripts/frontend-unit-runner-args.test.mjs scripts/check-ignore-policy.test.mjs scripts/check-frontend-test-taxonomy.test.mjs
```

The core backend selector excludes MySQL integration, EvidenceOwned and recovery-provider tests; it is not whole-product or DB proof. Broad `test:be`, coverage, E2E/recovery/migration/fixture commands require their actual prerequisites. CI uses disposable MySQL targets; never run its DB creation/drop steps against user databases. Current recovery/business-integrity contract tests may execute local PowerShell in temporary directories; their target fences remain mandatory.

## Contract owners

- Generated OpenAPI/TypeScript parity: `npm run check:api-contract` (writes generated contracts; inspect diff).
- Backend behavioral services/handlers, permission/mode/version/stock/lineage tests under `backend/tests`.
- Frontend rendered behavior and accessibility at source owners; contract/browser tests under `frontend/tests`.
- Table metadata: `docs/table-contracts.json`, independently checked against real source/behavior.
- Migration discovery/snapshot and deterministic workbook fixtures remain regressions, not old process state.
- Retained technical tools for backup/recovery/performance do not authorize mutating production; read their source and runbook first.

## Browser and persisted outcomes

Use headed Chrome with confirmed actual FE/BE listener/build, app URL, operation mode/version/capabilities and actor credentials. Separate automation profile; never touch user tabs/processes without attach/ownership. Refresh locators after navigation. Loading, refreshing, empty, error, forbidden, conflict and prerequisite are distinct states; 403 is never empty. Activate retained tabs and relevant open/confirm/dismiss paths before claiming them covered.

Screenshots identify candidate defects; use source/DOM/keyboard/network assertions to prove them. Layout checks include overflow/clipping, hierarchy, focus/trap/return, labels, reduced motion and declared zoom/viewport. Persisted changes need FE control → BE request → state/DB transition → reload. Preserve exact source-line/customer/unit grain; projections do not prove physical stock or procurement authority. Mutation requires explicit target authorization and backup.

## Performance

Declare environment (DEV versus production preview), source/build identity, actor/mode/data, viewport and exact route/action. Separate cold compilation, warm navigation and interaction work; compare identical conditions. Measure request count/timing, long tasks/frame/LoAF/INP/CLS where supported and attribute suspected costs to FE/network/BE/DB. Unsupported metrics stay NEEDS_EVIDENCE; no FPS-only or screenshot performance PASS. DEV results are not production SLO evidence.

Use unique output directories and timestamp-aware errors; Playwright cleans configured output, so never store irreplaceable recovery/business data there. Tool/parser completion, focused test result and task acceptance are separate. Report PASS/FAIL/NEEDS_EVIDENCE/BLOCKED with scope and unrun prerequisites. Do not seed/reset, invent records, lower permissions or change mode to manufacture PASS.
