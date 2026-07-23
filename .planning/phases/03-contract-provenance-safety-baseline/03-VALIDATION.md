---
phase: 3
slug: contract-provenance-safety-baseline
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-16
---

# Phase 3 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | xUnit + FluentAssertions + EF relational/MySQL verification scripts |
| **Config file** | `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj` |
| **Quick run command** | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~Bom|FullyQualifiedName~SampleData"` |
| **Full suite command** | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore` |
| **Estimated runtime** | Measure and record in Wave 0; no watch mode |

## Sampling Rate

- **After every task commit:** Run the focused BOM/sample-data test filter.
- **After every plan wave:** Run the full backend test suite plus migration/baseline command introduced by the plan.
- **Before `$gsd-verify-work`:** Full backend suite, fresh/upgrade migration proof and backup/restore rehearsal must be green.
- **Max feedback latency:** 120 seconds for focused tests; longer recovery drills run at wave/release gates.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 03-01 | 1 | RETIRE-03 | T-03-03/04 | Freeze ownership/behavior and old migration hashes before edits | characterization | characterization + ownership + detect_changes | ✅ planned | ⬜ pending |
| 03-01-02 | 03-01 | 1 | SAFE-05 | T-03-02/05 | Exact lifecycle/retention policy; unknown blocks | policy | policy completeness + ownership + detect_changes | ✅ planned | ⬜ pending |
| 03-01-03 | 03-01 | 1 | SAFE-05, RETIRE-03 | T-03-03/05 | Legacy baseline and identified backup restore before edits | recovery | duplicate baseline + clone restore + ownership + detect_changes | ✅ planned | ⬜ pending |
| 03-02-01 | 03-02 | 2 | CAN-03, CAN-04 | T-03-02/04 | Weighted dedupe and unit resolution fail closed | unit | focused contract/sample-data + ownership + detect_changes | ✅ planned | ⬜ pending |
| 03-02-02 | 03-02 | 2 | CRUD-02 | T-03-02/04 | Bulk/manual share scope, effective and overlay rules | unit/integration | focused invariant/catalog + build + ownership + detect_changes | ✅ planned | ⬜ pending |
| 03-03-01 | 03-03 | 3 | SAFE-04 | T-03-02/04 | Complete run metadata and deterministic idempotency | unit | focused provenance + ownership + detect_changes | ✅ planned | ⬜ pending |
| 03-03-02 | 03-03 | 3 | SAFE-04, RETIRE-03 | T-03-03/04 | Forward schema only; exact legacy fixture retained | integration | full-history script generation + provenance-delta-only DML scan + old-migration hash check + build/ownership/detect_changes | ✅ planned | ⬜ pending |
| 03-03-03 | 03-03 | 3 | RETIRE-03 | T-03-03/04/05 | Fresh/legacy paths and final Gate A block drift | migration/gate | migration proof + full suite/build/hash/ownership/detect_changes | ✅ planned | ⬜ pending |

## Wave 0 Requirements

- [ ] `03-01-01` creates ownership, characterization and applied-migration-hash evidence before production edits.
- [ ] `03-01-02` locks exact lifecycle/retention policy before production edits.
- [ ] `03-01-03` creates legacy-compatible baseline and successful restore rehearsal before production edits.
- [ ] `03-02-02` creates shared invariant fixtures for overlap/effective/tier/customer overlay.
- [ ] `03-03-03` creates repeatable empty-to-latest and exact legacy-to-latest proof.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Restore rehearsal on production-like MySQL clone | SAFE-05 | Requires operator-owned backup target and credentials | Create identified backup, restore to isolated clone, run baseline checksum command, require exact immutable checksum equality |

## Validation Sign-Off

- [x] All planned tasks have automated verify or an explicit blocking recovery command.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Plans 03-01..03 provide every missing test/script reference before its dependent implementation/gate task.
- [x] No watch-mode flags.
- [ ] Focused feedback latency measured and recorded.
- [x] `nyquist_compliant: true` set after planner finalized stable task IDs across revised Waves 1–3.

**Approval:** pending plan-checker verification
