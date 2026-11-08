---
phase: 30-closed-loop-menu-issue-reconciliation
plan: 11
subsystem: inventory-reconciliation
tags: [ef-core, reconciliation, idempotency, concurrency, stock-ledger, tdd]
requires:
  - phase: 30-10
    provides: closed application-path command and reporting owners
  - phase: 30-04
    provides: canonical source-family inventory returns and corrections
provides:
  - Immutable persisted READY snapshots across shared-master edits
  - A deterministic pre-first-write mode/version fence with a zero-effect stale ledger
  - Exactly-once response replay and synchronized duplicate issue submission coverage
  - Regression proof that corrections remain exact to DEFAULT or RECONCILIATION source families
  - backend Wave 4 slice D: READY snapshot immutability, stale-race fencing, and exactly-once reconciliation issue projection
  - deterministic replay / duplicate-submit coverage through InventoryIssueService with one stock-ledger effect
  - phase-30 regression evidence that canonical corrections remain source-family exact
  - build/model parity evidence for the complete backend solution
  - relational SQLite evidence using independent DbContexts and transactions for stale-authority and duplicate-submit races
  - canonical InventoryReturnService replay/confirmation followed by ReconciliationCompletionService family-exact completion
  - MRX-03
  - MRX-04
  - MRX-06L
affects: [30-12, 30-13, inventory-issue, reconciliation-completion, warehouse-returns]
actuals:
  tokens: 12681
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns:
    - optional deterministic pre-write test gate followed by transaction-local authority revalidation
    - persisted frozen-value capture and exact record equality across mutable authority edits
    - barrier-started duplicate submissions with complete before/after effect-ledger comparison
key-files:
  created:
    - .planning/phases/30-closed-loop-menu-issue-reconciliation/30-11-SUMMARY.md
  modified:
    - backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs
    - backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs
key-decisions:
  - "Keep the transaction-owner repair minimal: pause at an injectable pre-write seam, then revalidate mode/version immediately before the first reconciliation issue mutation."
  - "Treat an existing READY batch as immutable persisted fact; changed shared authority is represented only by a separately materialized batch/version."
  - "Reuse Plan 30-04 canonical InventoryReturnService create/confirm/replay flows rather than creating synthetic negative issue quantities, and invoke reconciliation completion over their persisted net."
  - "Use file-backed SQLite with independent contexts and deferred transactions so concurrent submissions reach the same pre-write barrier before a canonical SQLite lock/conflict loser."
patterns-established:
  - "Pre-write race tests use TaskCompletionSource barriers and never timing sleeps."
  - "Exactly-once assertions compare issue, line, lifecycle, audit, replay, and stock-command ledgers before and after replay."
requirements-completed: [MRX-03, MRX-04, MRX-06L]
coverage:
  - id: D1
    description: READY reconciliation snapshots remain byte/value exact after authorized shared-master edits, while only a new materialization reflects changed authority.
    requirement: MRX-04
    verification:
      - kind: integration
        ref: backend/tests/IPCManagement.Api.Tests/ReconciliationQuantityImportApplicationPathTests.cs#Ready_projection_is_frozen_after_authorized_master_edits_and_new_source_version_uses_new_authority
        status: pass
    human_judgment: false
  - id: D2
    description: A deterministic pre-first-write mode/version race fails with zero issue, line, stock, lifecycle, audit, replay, or batch residue.
    requirement: MRX-03
    verification:
      - kind: integration
        ref: backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs#Reconciliation_issue_loses_separate_context_mode_change_with_relational_zero_ledger
        status: pass
    human_judgment: false
  - id: D3
    description: Response replay and synchronized duplicate issue submissions retain exactly one issue projection and stock effect.
    requirement: MRX-06L
    verification:
      - kind: integration
        ref: backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs#Reconciliation_issue_response_loss_replay_and_true_relational_duplicate_are_exactly_once
        status: pass
    human_judgment: false
  - id: D4
    description: Canonical DEFAULT and RECONCILIATION corrections affect only their exact source-family net and remain idempotent on retry.
    requirement: MRX-06L
    verification:
      - kind: integration
        ref: backend/tests/IPCManagement.Api.Tests/Phase30WarehouseReturnFamilyTests.cs
        status: pass
    human_judgment: false
duration: 63min
completed: 2026-08-31
status: complete
---

# Phase 30 Plan 11: Closed-Loop Menu Issue Reconciliation Summary

**Immutable READY facts, a separate-transaction authority race, true concurrent SQLite submissions, and canonical return/completion netting proven through public services with deterministic executable evidence.**

## Performance

- **Duration:** 63 min
- **Started:** 2026-08-31T02:48:26+07:00
- **Completed:** 2026-08-31T03:51:07+07:00
- **Tasks:** 3
- **Files modified:** 2 production/test files plus this summary

## Accomplishments

- Materialized and readied a real batch through the quantity-import/reconciliation public service path, captured batch/line/contributor identities and values, edited ingredient plus canonical-unit assignment, customer, dish, and published BOM authority through retained authorized services, clearing tracking and reloading after each authority class; the READY projection remained exactly unchanged.
- Created a genuine second menu version, schedule, completed quantity plan, import, and reconciliation batch through the same application path; only this new source reflected the edited BOM quantity and canonical unit (`G` / `Gram`, required quantity `2000`), while the old READY source remained `KG` / `Kilogram` with required quantity `1`.
- Paused a real relational issue command before first write, committed a mode change through `SystemOperationModeService` in a separate DbContext/transaction, and proved the stale command left every durable issue/stock/lifecycle/batch ledger unchanged except the expected authority audit/version.
- Started two fresh submissions with independent contexts and deferred SQLite transactions, synchronized both immediately before first write, and proved one issue, line, stock movement, current-stock delta, lifecycle transition, and command receipt; SQLite supplied the deterministic canonical loser conflict and replay returned the winner identity.
- Created, confirmed, and replayed canonical DEFAULT and RECONCILIATION returns through `InventoryReturnService`; then invoked `ReconciliationCompletionService` and proved its persisted linked net was exactly 3 while DEFAULT remained outside reconciliation netting.
- Passed 30 focused tests, three repeated deterministic 4-test race/snapshot/completion runs, all 1,185 backend tests (plus 1 pre-existing skipped E2E), backend and frontend builds, EF model parity, and hygiene/protected-data scans.

## Frozen Snapshot Comparison

The relational quantity-import regression compares batch identity, menu/import source IDs, source customer identity, status/version/creator/timestamp, every batch-line and ingredient identity, canonical unit ID/code/name, required quantity, tolerance source/value/version, and every contributor identity/source reference/quantity. It performs retained authorized ingredient/canonical-unit, customer, dish, and BOM edits, clears EF tracking after each authority class, reloads the same persisted projection, and requires exact value equality each time. A genuine second published menu version and completed quantity-plan source is previewed, committed, and materialized through the same controller/services; it alone resolves the changed canonical unit as `G` / `Gram` and required quantity `2000.000000`, while the original READY batch remains `KG` / `Kilogram` and `1.000000`.

## Complete Concurrency Ledgers

- **Stale race:** a separate authority context commits `SystemOperationModeService.ChangeAsync`; only `SystemOperationMode.Version + 1` and its one legitimate authority audit are added. Issue count, line count, movement count, current-stock values, lifecycle transitions, command receipts, reconciliation batch status, and reconciliation batch version remain byte/value equal to the pre-command ledger.
- **Replay/duplicate:** two independent file-backed SQLite contexts begin deferred transactions and rendezvous at the real pre-write gate without a serializing semaphore. Exactly one result commits; the loser receives SQLite's deterministic relational lock conflict. Durable state is one issue, one exact source line, one movement, stock `20 -> 18`, one lifecycle transition, and one command receipt. A fresh replay context returns the winner issue ID with no further effects.
- **Correction/completion:** canonical DEFAULT and RECONCILIATION return commands are created, confirmed, and replayed through `InventoryReturnService`. Stock is restored once per family. `ReconciliationCompletionService.CompleteAsync` then reads persisted linked issued/returned quantities and completes with `IssuedQuantity = 3`; DEFAULT-family issue lines contribute zero to that reconciliation batch.

## Task Commits

1. **Task 1: Freeze one READY batch across authorized master edits** - `a9e58aa0` (test)
2. **Task 2 RED: Add failing pre-write race regression** - `be7ccac0` (test)
3. **Task 2 GREEN: Fence reconciliation issue before first write** - `79e538d1` (fix)
4. **Task 3: Commit one net projection under replay, duplicate submit and correction** - `ddbc129c` (test)
5. **Verification remediation: replace simulated evidence with relational/public-service proof** - `c2475fbb` (test)
6. **Final closure: exercise authorized unit/customer authority edits** - `eea626a5` (test)

## Files Created/Modified

- `backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs` - independent-context relational stale race, deferred concurrent duplicate transaction harness, real repositories, real stock ledger, and exhaustive durable ledgers.
- `backend/tests/IPCManagement.Api.Tests/ReconciliationQuantityImportApplicationPathTests.cs` - public materialize/READY path, authorized ingredient/canonical-unit/customer/dish/BOM edits, complete frozen identity projection including source customer and canonical unit identity/code/name, and genuine next-version materialization.
- `backend/tests/IPCManagement.Api.Tests/Phase30WarehouseReturnFamilyTests.cs` - canonical return create/confirm/replay plus real reconciliation completion over persisted family-exact net.
- `backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs` - existing optional deterministic pre-write seam and immediate protected mode/version revalidation before first reconciliation issue write; no remediation production change was required.
- `.planning/phases/30-closed-loop-menu-issue-reconciliation/30-11-SUMMARY.md` - execution evidence, ledgers, coverage, and verification results.

## Decisions Made

- The gate is optional and inert in normal production resolution; correctness is owned by the mandatory mode guard revalidation immediately after the gate and before mutation.
- No reconciliation snapshot data is refreshed from mutable masters after READY. New authority requires a new materialized batch/version.
- Corrections remain canonical `InventoryReturnService` facts from Plan 30-04; no synthetic negative issue quantities were introduced, and completion is now invoked directly in executable evidence.
- SQLite's deferred transaction mode is test-only and permits both independent transactions to finish validation and rendezvous before writes; the production services, repositories, stock ledger, lifecycle recorder, and authority service remain real.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical concurrency fence] Added immediate pre-first-write authority revalidation**
- **Found during:** Task 2
- **Issue:** The transaction runner protected commit, but there was no deterministic seam proving authority was rechecked immediately after validation and before the first write.
- **Fix:** Added an optional pre-write gate and invoked `SystemOperationModeGuard.ValidateAsync` immediately after it, before constructing or adding the issue.
- **Files modified:** `InventoryIssueService.cs`, `ReconciliationWarehouseIssueApplicationPathTests.cs`
- **Verification:** 14 focused application-path tests and full backend suite passed.
- **Committed in:** `79e538d1`

**2. [Rule 3 - Verification command path] Corrected the requested solution build path**
- **Found during:** Overall verification
- **Issue:** `IPCManagement.slnx` does not exist at repository root.
- **Fix:** Ran the repository solution at `backend/IPCManagement.slnx`.
- **Files modified:** None
- **Verification:** Build succeeded with 0 warnings and 0 errors.

**3. [Rule 1 - Evidence gap] Replaced simulated concurrency and hand-built snapshot proof with relational/public-service evidence**
- **Found during:** Post-plan verification remediation
- **Issue:** The original evidence used EF InMemory state, a mocked stock ledger, a serializing semaphore, direct READY entity construction, and no completion invocation, so it did not execute the required trust-boundary behavior.
- **Fix:** Added file-backed SQLite contexts/transactions, a deferred relational concurrency harness, real repositories/stock ledger/authority service, public import/materialization/READY/catalog-edit paths, and canonical return/completion execution.
- **Files modified:** `ReconciliationWarehouseIssueApplicationPathTests.cs`, `ReconciliationQuantityImportApplicationPathTests.cs`, `Phase30WarehouseReturnFamilyTests.cs`
- **Verification:** 30 focused tests, three repeated critical runs, full backend suite, both builds, EF parity, and hygiene gates passed.
- **Committed in:** `c2475fbb`

**4. [Rule 1 - Acceptance coverage gap] Added retained authorized unit and customer master edits**
- **Found during:** Adversarial re-verification after remediation
- **Issue:** The immutable READY regression exercised ingredient, dish, and BOM authority but omitted the declared canonical-unit and customer authority classes.
- **Fix:** Seeded a valid distinct `G` canonical unit and exact customer, changed the ingredient's canonical-unit assignment through `IngredientService`, changed the exact customer through `CustomerContractService`, cleared tracking/reloaded after each authority class, and extended the deterministic persisted projection with source customer identity plus canonical unit ID/code/name. The next materialization alone reflects `G` / `Gram` and converted quantity `2000`; the old READY remains byte/value equal.
- **Files modified:** `ReconciliationQuantityImportApplicationPathTests.cs`, `30-11-SUMMARY.md`
- **Verification:** Focused 30/30, critical deterministic reruns 12/12, full API 1,185 pass + 1 pre-existing skip, solution build, EF parity, and hygiene all passed.
- **Committed in:** `eea626a5`

---

**Total deviations:** 4 auto-fixed (3 Rule 1/2 correctness or evidence gaps, 1 Rule 3 verification path)
**Impact on plan:** Both changes were bounded to concurrency correctness and verification execution; no architectural or scope expansion occurred.

## Verification

- Focused quantity-import, issue application-path, and return-family suite: **30 passed**
- Four remediation-critical tests repeated three times after unit/customer closure: **12/12 passed**, no timing sleeps or serializing semaphore
- Full `IPCManagement.Api.Tests` after final closure: **1,185 passed, 1 skipped, 0 failed**
- `dotnet build backend/IPCManagement.slnx --no-restore`: **passed, 0 warnings, 0 errors**
- `npm --prefix frontend run build`: **passed**
- `dotnet ef migrations has-pending-model-changes ...`: **passed, no pending model changes**
- `git diff --check`: **passed**
- Protected-data filename and added-diff secret scans: **passed**
- Stub/timing/serialization scan on modified tests: **no TODO, FIXME, placeholder, `Thread.Sleep`, `Task.Delay`, or `SemaphoreSlim` found**

## Issues Encountered

- The plan-level root `.slnx` path was absent; the authoritative backend solution path was used.
- Full suite retains one existing skipped protected integration E2E test; no new skipped tests were introduced.
- The first attempt to use `dotnet test --repeat` was rejected because that switch is unsupported; the deterministic gate was rerun with an explicit three-iteration shell loop and passed all iterations.

## Known Stubs

None.

## Threat Flags

No new endpoint, authentication path, file access, schema, or trust boundary was introduced beyond the plan threat model. The only production surface is an internal optional pre-write test seam plus the planned authority revalidation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 30-12 may proceed with immutable READY facts and exactly-once issue ownership established. No blocker remains from Plan 30-11.

## Self-Check: PASSED

- Modified production and test files exist.
- Task commits `a9e58aa0`, `be7ccac0`, `79e538d1`, `ddbc129c`, remediation commit `c2475fbb`, and final closure commit `eea626a5` exist in history.
- Focused, full-suite, build, model parity, and hygiene claims were verified from command output.

---
*Phase: 30-closed-loop-menu-issue-reconciliation*
*Completed: 2026-08-30*

## Final Local Closeout Reconciliation

- **Final verdict:** PASS at verified HEAD `6bfbd9f9`.
- Exact commits: `a9e58aa0`, `be7ccac0`, `79e538d1`, `ddbc129c`, `c2475fbb`, `eea626a5`.
- Immutable READY, pre-write authority race, exactly-once stock projection, return netting, and customer/unit freeze coverage remain green in the final local aggregate.
- No protected database or browser evidence is implied.
