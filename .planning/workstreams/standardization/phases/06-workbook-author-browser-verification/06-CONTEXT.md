# Phase 6: Workbook Author and Browser Verification — Context

**Gathered:** 2026-08-03
**Status:** Ready for execution
**Mode:** Autonomous from accepted standardization contract

## Phase boundary

Prove the authored weekly-menu workbook and the real import UI through deterministic valid, malformed, stale/mismatched-token and two-customer atomic cases. Evidence must use headed Google Chrome at the five desktop viewports and join FE control, API request/response, direct database state and FE reload/rollback.

## Locked decisions

- Treat `C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx` as immutable input and verify SHA-256 `A7E734CEFBD409E7220C4FF19B3E1B7FDDD4E33D202A3F24E63309D60D4D5A01` before and after the run.
- Generate all cases under `.artifacts/`; never edit the source workbook. Valid cases move the embedded dates to an isolated future week and derive a DAV copy by changing workbook identity only.
- Clone `ipc_lane1` read-only into `ipc_e2e_template`, apply current migrations only there, run the evidence on ports `3010/8010`, rollback imported versions, then restore the template from `ipc_lane1`.
- Add a read-only DatabaseTool evidence command so before/commit/rollback database snapshots are explicit and machine-readable.
- Chrome must be headed, use a dedicated persistent profile and record screenshot, API response bodies, console/page/request errors, CLS and long tasks.
- GitNexus is not active. SAP Fiori Phases 27–30 remain out of scope.

## Verification contract

- Matrix generation is deterministic and source hash is unchanged.
- Valid preview is exercised at all five viewports; malformed and mismatched-token cases fail without a DB delta.
- Two-customer commit uses the UI atomic batch action, creates both scopes together, survives reload and is then rolled back to the exact pre-run scope state.
- Direct database snapshots, API records and rendered state agree.
