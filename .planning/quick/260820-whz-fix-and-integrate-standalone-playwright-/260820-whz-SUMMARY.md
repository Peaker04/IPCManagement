---
quick_id: 260820-whz
status: complete
date: 2026-08-20
---

# Summary

- Integrated a repo-local ESM Playwright probe at `frontend/scripts/perf-probe.mjs`.
- Corrected all route paths to the current React route contract.
- Added cold-context tab activation with `aria-selected` verification because tabs are not deep-linkable in the current app.
- Added one-time credential bootstrap with in-memory storage state; missing credentials fail closed.
- Added route/shell/login mismatch errors and preserved Q22/Q23 integrity gates.
- Restored `docs/DASHBOARD-UI-RULES.md` from `HEAD` after confirming the working-tree copy was empty.
- Added `perf:load`, `perf:inp`, and `perf:overflow` npm scripts.

## Verification

- `node --check frontend/scripts/perf-probe.mjs` — pass.
- `node frontend/scripts/perf-probe.mjs --check` — pass (9 routes, 28 targets, 8 interactions).
- Package script presence check — pass.
- Browser measurement was not run because no credentials were supplied in this turn; the probe now fails closed without them.
