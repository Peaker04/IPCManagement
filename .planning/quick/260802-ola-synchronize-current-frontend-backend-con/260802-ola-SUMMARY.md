---
quick_id: 260802-ola
status: complete
date: 2026-08-02
source_commit: 406ab5b
---

# Shipyard current-source baseline summary

The current frontend and backend contracts, builds, guarded runtime and headed Shipyard evidence were synchronized before any production UI edit.

## Completed

- Regenerated the API contract with no tracked drift.
- Passed backend build, Application 49/49, API 705 pass plus one intentional skip, frontend 123 files / 724 tests, UI completeness 87/87, ESLint, dependency-cruiser and production build.
- Confirmed API port 8001 and frontend port 3001 were current-source and the API readiness gate reported the guarded `ipc_lane1` connection healthy.
- Captured all 50 canonical states at five approved desktop viewports: 250/250 cells and screenshots, 962 successful API responses, 1,345 rendered rows, no empty render, document overflow, ownership miss, browser error or escaped mutation.
- Measured 190 tab interactions and 20 cold/warm sidebar navigations. Existing tab and navigation budgets passed with zero CLS, duplicate reads or timeout.

## Evidence-led disposition

- Do not change tab selection, routing or cache behavior: the live timings are already within the existing warm budgets.
- Carry four presentation findings into a separate quick task: ten-column report allocation, seven-column audit allocation, oversized purchasing empty state, and raw current-stock quantity formatting.
- The naive header/body alignment counter is not authoritative because rowspan/colspan rows create false positives; individual screenshots and table geometry authorize fixes instead.

## Safety

The run did not seed, import, reset, restore, sanitize or otherwise mutate `ipc_lane1`. No production source changed in this baseline task.
