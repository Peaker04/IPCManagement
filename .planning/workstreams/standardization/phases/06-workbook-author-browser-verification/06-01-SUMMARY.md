---
phase: 06-workbook-author-browser-verification
plan: 01
status: complete
completed: 2026-08-03
commit: 904c584
requirements: [WBQA-01, WBQA-02, WBQA-03, WBQA-04]
---

# Phase 6 Plan 01 Summary

Added a deterministic workbook case generator for valid ANV, valid DAV, malformed, checksum-mismatch and two-customer atomic scenarios. It transforms only copies into an isolated future week; repeated generation produced identical case hashes and the source workbook SHA-256 remained unchanged before and after every run.

Added a restricted read-only database evidence command and owned runtime start/stop helpers. The headed E2E clones `ipc_lane1` into `ipc_e2e_template`, migrates only the template, drives the real UI at five viewports, records API/telemetry/screenshots, probes direct database state, rolls both imports back and restores the template from the protected source.

The run exposed and fixed two recovery/UX gaps: rollback of the last DRAFT version now removes the empty canonical tier, and history search accepts the formatted date users see in the table as well as ISO input.

## Verification

- Case generation: 5 deterministic cases; original hash before/after `A7E734...D5A01`, unchanged.
- Headed Chrome: 5/5 viewports, 9 screenshots, 60 API responses, zero console/page error, one expected navigation-abort request, CLS 0, seven long tasks with maximum 70 ms.
- Invalid cases: malformed workbook returns `FILE_READ_ERROR` validation and checksum mismatch returns HTTP 400; direct DB snapshot remains zero for both customers.
- Atomic commit: ANV and DAV each persist 1 DRAFT version, 12 schedules and 1 tier; reload renders both. Rollback leaves 1 `ROLLED_BACK` audit version each and zero schedules/tiers; reload renders both as `Đã hoàn tác`.
- Root gate: Application 49/49; API 726 pass + 1 intentional skip; UI completeness 87/87; frontend 130 files / 750 tests; dependency graph 0 violations / 379 modules / 1,361 dependencies; architecture, lint and both builds pass.
- Runtime ports `3010/8010` were closed and `ipc_e2e_template` was restored from `ipc_lane1` with 61-table clone verification. GitNexus was not used.
