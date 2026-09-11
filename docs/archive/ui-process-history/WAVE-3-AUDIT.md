# Wave 3 — Long-lived ledger/document audit

> **HISTORICAL / NO EXECUTION AUTHORITY.** Trạng thái trong file phản ánh thời điểm tạo. Dùng `MEMORY.md`, `docs/README.md` và phase hiện hành để quyết định công việc.


Status: **IN PROGRESS — pagination implementation landed; runtime/data evidence pending**

## Findings

| Surface | Current evidence | Risk | Disposition |
| --- | --- | --- | --- |
| Admin audit | Cursor pagination is wired from query model through `CursorPaginationBar`; filters reset cursor history. | Low | Verified; retain. |
| Stock movement | Shared table supports server cursor pagination; local pagination is only used when the parent supplies a bounded snapshot. | Medium | Verified contract; add response-size evidence in Wave 6. |
| Weekly-menu import history | Previously returned an unpaged array. | High for multi-year retention | Implemented server page/date/customer filters across controller, service, API type and FE model; retain runtime response-size verification for Wave 6. |
| Weekly-menu import jobs | In-memory jobs are a current import-session queue, not a retained ledger. | Low | Keep local; do not add server pagination. |

## Required Wave 3/6 checklist

- [x] Audit and movement tables use canonical viewport and stable row keys.
- [x] Admin audit filters reset cursor state.
- [x] Import history has server-side date/customer/page boundaries.
- [x] Backend API test suite (WorkflowGeneration filter) passes: 141 tests.
- [x] Backend and frontend production builds pass after the contract change.
- [x] `node frontend/scripts/perf-probe.mjs --check` passes (9 routes, 27 targets, 8 interactions; thresholds loaded).
- [x] Runtime availability check recorded: ports 3037/5173/5000/5001 were not serving in this session.
- [x] Preview runtime load probe executed for `reports-data-quality` under H.1 throttle: `t0=7650.7ms`, `tsettled=8538.3ms`, `deltaTop=0`, `CGR=0/900`, `scroll growth=0/102`, `CLS window=0.0025`, `rowsSkeletonAtT0=0`, integrity violations=0. Evidence: `frontend/artifacts/perf-probe-report.{json,md}`.
- [x] Probe confirms the bundle mounts and settles even while the API proxy is unavailable; proxy refusal is recorded separately and is not misclassified as a UI pass.
- [ ] Query projection and response size are measured on a multi-year fixture.
- [x] Authenticated bundle rerun identified 8 skeleton rows at `t0` (48px each) and 8 data rows at settled. Moving line-clamp boxes inside table cells and compacting stacked SLA/entity content reduced the settled row from 130.06px to 53px. Final `clientHeight=438→478`, `scrollHeight=438→478`, growth ratio `0.0913`, `CGR=0`, CLS window `0.0025`; all gates and integrity checks pass without changing thresholds. Evidence: `artifacts/perf-probe-report.{json,md}`.
- [ ] DTO null/date/timezone semantics are covered by a regression test.
- [ ] Detail/rollback action preserves list context after refetch.

Wave 4 must not claim the full program complete while the import-history finding remains open.
