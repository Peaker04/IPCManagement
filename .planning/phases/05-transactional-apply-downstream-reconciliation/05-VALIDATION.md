---
phase: 5
slug: transactional-apply-downstream-reconciliation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-16
---

# Phase 5 — Validation Strategy

## Test Infrastructure

| Property | Value |
|---|---|
| **Framework** | xUnit + FluentAssertions + EF relational/MySQL integration fixtures |
| **Config file** | `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj` |
| **Quick run command** | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~BomApply|FullyQualifiedName~BomRetention|FullyQualifiedName~BomDownstream"` |
| **Full suite command** | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore` |
| **Estimated runtime** | Measure in Wave 0; no watch mode |

## Sampling Rate

- After every mutation task commit: focused transaction/retention/downstream tests.
- After every wave: full backend suite plus invariant checksum command.
- Before verify-work: full suite, MySQL transaction proof and Gate C report.
- Max focused feedback latency: 120 seconds.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|---|---|
| 05-01-01 | 05-01 | 1 | All 10 | T-05-01/03 | Gate A/B, backup, freshness, disabled feature and ownership | artifact/repository | Exact `<automated>` gate/ownership/detect command | ✅ planned | ⬜ pending |
| 05-01-02 | 05-01 | 1 | All 10 | T-05-01..06 | Build-green, TRX-discovered failing-first behavior fixtures only | relational | Build + TRX required-name/prefix/infra rejection command | ✅ planned | ⬜ pending |
| 05-02-01 | 05-02 | 2 | SAFE-03, DOWN-01/02/04 | T-05-03/05 | Forward non-cascading scope-token/lineage schema | migration/MySQL | `Test-BomPhase5Migration.ps1 -ConfirmIsolated` | ✅ planned | ⬜ pending |
| 05-03-01 | 05-03 | 3 | SAFE-03, DATA-04 | T-05-01/02 | Canonical-only Unchanged/Create/Version transaction/idempotency | relational/MySQL | Apply transaction/idempotency filter + vocabulary scan | ✅ planned | ⬜ pending |
| 05-04-01 | 05-04 | 4 | DATA-02..04, DOWN-04 | T-05-03/05 | Legacy-only keep/archive/deactivate/delete/block true-orphan | relational/MySQL | Retention filter + immutable clone runner | ✅ planned | ⬜ pending |
| 05-05-01 | 05-05 | 5 | DOWN-01, DOWN-03 | T-05-04/05 | Tier/unit/customer overlay/math/scoped staleness | unit/integration | Downstream + workflow generation filter | ✅ planned | ⬜ pending |
| 05-06-01 | 05-06 | 6 | SAFE-03, DOWN-01/02/04 | T-05-02/05 | Regenerate-only leaf-first before retention | relational | Downstream/transaction filter + order/vocabulary scan | ✅ planned | ⬜ pending |
| 05-07-01 | 05-07 | 7 | DOWN-05 | T-05-06 | Once-after-commit current cache/report; historical snapshot | integration | Cache/report + transaction filter | ✅ planned | ⬜ pending |
| 05-08-01 | 05-08 | 8 | CRUD-03 | T-05-02 | Actual IDishService/controller/Dish DTO actor+reason audit | hosted/relational | Manual/catalog hosted filter | ✅ planned | ⬜ pending |
| 05-09-01 | 05-09 | 9 | SAFE-03 | T-05-01/05 | Default-disabled Admin apply feature/evidence gate | hosted/API | Apply API feature-gate filter | ✅ planned | ⬜ pending |
| 05-09-02 | 05-09 | 9 | All 10 | T-05-01..06 | Isolated restorable Gate C and PASS evidence ID | full/MySQL/runtime | Gate runner with CloneId/ConfirmIsolated/RestoreOnAnyFailure | ✅ planned | ⬜ pending |

## Wave 0 Requirements

- [ ] `05-01-02` creates injected transaction failure/cancellation and idempotency fixtures before implementation.
- [ ] `05-01-02` creates mixed retention/stock/reference/history, tier/unit/overlay/staleness, lifecycle and cache/report fixtures.
- [ ] Canonical, legacy and downstream action vocabularies are separate fixture types.
- [ ] Wave-0 build succeeds; TRX proves all six required tests executed and failed only with `PHASE5_MISSING_BEHAVIOR:` assertions; discovery/dependency/infra errors fail the gate.

## Manual-Only Verifications

None. Gate C clone rehearsal, restore-on-failure and endpoint feature gating are automated; no human checkpoint substitutes for evidence.

## Validation Sign-Off

- [x] All tasks have automated verification or explicit Wave-0 dependencies.
- [x] Every task has `<verify><automated>`; every mutation has precondition/stop/rollback and ownership/detect_changes checks.
- [x] Canonical, legacy and downstream vocabularies are isolated and downstream leaf handling precedes retention deletion.
- [x] Production apply remains disabled until isolated Gate C PASS evidence is configured.
- [x] No three consecutive mutation tasks without automated sampling.
- [x] No watch-mode flags; unavailable MySQL is BLOCKED, never skipped.
- [x] `nyquist_compliant: true` after stable task mapping.

**Approval:** pending plan-checker verification
