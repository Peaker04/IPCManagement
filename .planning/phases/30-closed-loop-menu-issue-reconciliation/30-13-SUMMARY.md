---
phase: 30-closed-loop-menu-issue-reconciliation
plan: 13
subsystem: reconciliation-request-contract
tags: [rtk-query, vitest, dotnet, request-contract, stale-authority]
status: complete
requires:
  - phase: 30-11
    provides: stale reconciliation issue transaction fence and zero-effect ledger
  - phase: 30-12
    provides: production cross-tab authority propagation
provides:
  - deterministic credential-free production RTK reconciliation request fixture
  - byte-parity fixture regeneration gate
  - C# fixture consumer proving stale authority rejection through the public controller/service seam
  - local MRX-06L evidence
affects: [phase-30-verification, reconciliation-issue-contract, mrx-03, mrx-05, mrx-06l]
tech-stack:
  added: []
  patterns: [production-request capture, canonical JSON fixture, cross-language contract replay, complete zero-effect ledger]
key-files:
  created:
    - contracts/phase30/reconciliation-stale-request.json
    - frontend/scripts/generate-phase30-request-contract.mjs
    - frontend/src/features/reconciliation/reconciliationRequestContract.fixture.test.ts
    - backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueRequestFixtureTests.cs
  modified:
    - frontend/package.json
key-decisions:
  - "Capture the production RTK Query Request at fetch transport rather than maintaining a second serializer."
  - "Persist only sorted accept/content-type headers, parsed stable JSON, relative path, method, and schema version."
  - "Replay the exact fixture body through InventoryIssuesController and InventoryIssueService after a real mode revision, with all ledgers compared after the mode change baseline."
metrics:
  duration: 45min
  completed: 2026-08-31
actuals:
  tokens: 4483
  tasks: 2
  commits: 5
---

# Phase 30 Plan 13: Cross-Language Reconciliation Request Contract Summary

**Production RTK Query serialization now generates one SHA-256-pinned, credential-free request artifact that the C# controller/service seam replays to prove stale authority conflict with zero workflow or inventory effects.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-31T08:30:00Z
- **Completed:** 2026-08-31T09:20:00Z
- **Tasks:** 2
- **Files changed:** 5 implementation/contract files plus execution metadata

## Accomplishments

- Captured the real `createReconciliationIssue` RTK mutation at the production `fetch` transport boundary with fixed public identifiers and no credential/session input.
- Added deterministic recursively sorted JSON serialization, relative URL normalization, sorted allowlisted headers, trailing-newline stability, explicit forbidden-header denial, byte parity, and a bounded generator command.
- Added a dedicated C# fixture reader that validates schema/header policy, reflects the public controller route, deserializes the exact body into `CreateInventoryIssueRequest`, changes system mode/version, invokes the real controller/service path, and receives the established `SystemOperationConflictException`.
- Proved complete zero effects after the mode-change baseline across reconciliation workflow status/version, issue, line, stock movement, current stock, lifecycle transition, audit, and lifecycle command receipt ledgers.

## Fixture Contract

- **Artifact:** `contracts/phase30/reconciliation-stale-request.json`
- **Schema:** `schemaVersion: 1`
- **Method/path:** `POST /api/inventory-issues`
- **Allowlisted headers:** `accept`, `content-type`
- **SHA-256:** `9a1fceb4bde7967c416941b312e4debe457245bb90847482d8f7cc041346c3e7`
- **Regeneration:** `npm run generate:phase30-request-contract -w frontend`
- **Parity:** a second regeneration was diff-clean.

## Task Commits

1. **Task 1 RED: production RTK fixture parity gate** - `ddbacfbb` (test)
2. **Task 1 GREEN: deterministic tracked RTK request** - `c01c0c82` (feat)
3. **Task 2 RED: backend fixture replay proof** - `7b774591` (test)
4. **Task 2 GREEN: stale conflict and zero ledger proof** - `26c529b9` (feat)
5. **Build deviation fix: Node test typing** - `4cfb0497` (fix)

## Files Created/Modified

- `contracts/phase30/reconciliation-stale-request.json` - canonical credential-free cross-language request bytes.
- `frontend/src/features/reconciliation/reconciliationRequestContract.fixture.test.ts` - production RTK capture, denial checks, stable generation, and byte parity.
- `frontend/scripts/generate-phase30-request-contract.mjs` - bounded generator runner with an explicit update environment.
- `frontend/package.json` - fixture generation command.
- `backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueRequestFixtureTests.cs` - schema/header validation and public-seam stale replay with full ledger comparison.

## Decisions Made

- No production serializer was added or exposed: the test dispatches the existing RTK endpoint and captures its actual `Request` before transport.
- C# does not duplicate the request body or expected header values; request values come from the tracked JSON and route ownership comes from controller reflection.
- The post-change ledger baseline intentionally includes the legitimate mode-change audit, so equality proves the stale request itself contributes zero effects.

## Verification

### Passed

- Focused frontend fixture plus closed-loop workflow: **2 files, 9 tests passed**.
- Fixture generator and second byte-diff check: **passed, diff-clean**.
- Focused backend fixture/application/bijection matrix: **37 tests passed**.
- Frontend lint: **passed**.
- Frontend production build: **passed** after adding Node type visibility to the filesystem-backed test.
- Full backend aggregate: **1,186 passed, 1 skipped; one unrelated performance assertion failed**, then the exact failed test passed alone in 8 seconds.
- `git diff --check`: **passed**.

### Deferred pre-existing aggregate failures

- Full frontend aggregate completed within its bound: **191/202 files and 1,223/1,236 tests passed**; 13 unrelated source-inventory/count-lock assertions failed. Plan 30-13 focused tests remain green.
- API contract parity exposed already-present generated contract drift unrelated to Plan 30-13. Generated files were restored individually and were not committed.
- Details are recorded in `.planning/phases/30-closed-loop-menu-issue-reconciliation/deferred-items.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected generator test selection**
- **Found during:** Task 1
- **Issue:** Passing `--update -- <file>` caused Vitest to execute unrelated tests and did not expose the update signal to the test.
- **Fix:** Added a small Node runner that invokes the exact fixture test and passes an explicit update environment variable.
- **Files modified:** `frontend/scripts/generate-phase30-request-contract.mjs`, `frontend/package.json`, fixture test
- **Commit:** `c01c0c82`

**2. [Rule 1 - Bug] Preserved fixture test in production TypeScript build**
- **Found during:** Full frontend build
- **Issue:** Node filesystem/path globals in the new test lacked local Node type visibility.
- **Fix:** Added a file-local Node type reference; build and parity both pass.
- **Files modified:** fixture test
- **Commit:** `4cfb0497`

## Security and Threat Review

- Fixed identifiers are public synthetic GUIDs; no runtime target, query string, user token, cookie, API key, host, origin, referer, forwarded value, or secret is captured.
- The header policy is allowlist-first and separately denies credential/session fragments in both TS and C#.
- No browser, protected API, MySQL connection, reset, seed, GitNexus operation, or `ipc_lane7` command/configuration was used.

## Requirements and Blocker Status

- **MRX-03:** locally evidenced by production request serialization and exact backend request mapping.
- **MRX-05:** locally evidenced by stale conflict and complete zero-effect ledger.
- **MRX-06L:** COMPLETE — all Plan 30-13 bounded fixture and C# application-path gates pass.
- **MRX-06P BLOCKED** — protected authorization was not granted; no claim is made for protected execution or protected DEFAULT restoration.

## Known Stubs

None.

## Next Phase Readiness

- The local cross-language artifact is deterministic, tracked, and directly consumable by protected verification once separately authorized.
- Protected `ipc_lane7` remains untouched and MRX-06P remains blocked.

## Self-Check: PASSED

All created artifacts and all five task/TDD commits were verified on disk/in Git.

## Final Local Closeout Reconciliation

- **Final verdict:** PASS; MRX-06L is COMPLETE at verified HEAD `6bfbd9f9`.
- Exact plan commits: `ddbacfbb`, `c01c0c82`, `7b774591`, `26c529b9`, `4cfb0497`.
- The aggregate failures recorded during initial Plan 30-13 execution were real historical failures. They were subsequently remediated and independently closed by the phase-level commit range ending at `6bfbd9f9`; they are not silently waived.
- Canonical final results are 203/203 frontend files and 1,276/1,276 tests, 49/49 Application tests, 1,196 API tests plus one intentional skip, clean API/fixture/EF/build/lint/architecture/dependency/route-budget gates.
- MRX-06P remains BLOCKED, protected migration remains unapplied, and aggregate MRX-06 remains BLOCKED. See `30-VERIFICATION.md`.
