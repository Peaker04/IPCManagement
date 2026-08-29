---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Evidence-first UI Contract Migration
status: in_progress
stopped_at: Remediated verifier gaps for 30-04-PLAN.md
last_updated: "2026-08-29T21:38:43.525Z"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 72
  completed_plans: 64
  percent: 89
current_phase_name: closed-loop-menu-issue-reconciliation
last_activity: 2026-08-29 — Completed Phase 30 Plan 04 exact-family corrections and inactive workflow fences
---

# Project State

## Project Reference

See `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`.

**Current focus:** Phase 30 in progress — Plans 01-04 complete; Plan 05 protected evidence and closeout next

## Current Status

- Phases 27, 27.1, 28 and 29 are COMPLETE.
- Phase 30 Plans 01-04 are COMPLETE: closed-loop lineage/capability, focused frontend ownership, exact-one issue authority, exact-family corrections, DEFAULT-only supplemental/legacy disposition, and inactive return-family fences are test-proven.
- Migration `20260828092012_ClosedLoopReconciliationIssueLineage` remains generated and SQL-inspected only; it was not applied to any database. Next action is `30-05-PLAN.md`.
- Protected Retry 16 passed on commit `9e0805cc`: exact `ipc_lane7` is retained at migration 75, operation mode `DEFAULT / 5`, with one `COMPLETED / 4` reconciliation authority and 55/55 positive lines.
- Five headed viewports passed DOM/accessibility → authenticated API → raw-HEX DB → reload identity, zero forbidden requests/errors/overflow/CLS/long tasks.
- Procurement/inventory normalized pre/post diff is exactly 0 bytes; ports 3036/8036 are closed.
- Closeout gates: Application 49/49; API 1,044 pass + 1 intentional skip; frontend serial 191 files / 1,228 tests; focused Phase 29 18/18; lint/checklist/API parity/EF model/Release builds pass.

## Session Continuity

**Last session:** 2026-08-29T21:38:43.484Z
**Resume file:** None

**Stopped at:** Remediated verifier gaps for 30-04-PLAN.md
**Resume directory:** `.planning/phases/30-closed-loop-menu-issue-reconciliation`

Next workflow: execute `30-05-PLAN.md`. Preserve retained migration-75 authority; no protected database mutation is authorized by Plan 30-04.

## Decisions

- Phase 27 is a bounded pilot and evidence foundation; Phase 28 owns whole-web rollout.
- Use existing shadcn/Base UI and shared owners; Fiori/Carbon/Polaris are references only.
- Use one audit harness; deterministic rules precede fresh AI review.
- Prefer token → primitive → formatter/hook → layout → page fixes.
- Keep one operational warehouse passive in routine UI; never erase technical identity or authorization boundaries.
- [Phase 28]: Recovery selects immutable attempt-3; attempts 1 and 2 remain untouched failed history.
- [Phase 28]: Duplicate H1 remains an owner-bearing measured HIER-01 FAIL; capture does not abort before metrics.
- [Phase 28]: Historical baseline hashes remain LOST_NO_BACKUP and a8a4a9dc remains RED_RECONCILED_NOT_COMPLETE.
- [Phase 28]: Recovery attempt-3 exact totals govern remediation; stale pre-recovery FAIL totals are not consumed.
- [Phase 28]: InlineAlert remains unchanged without multi-route identical selector/token provenance.
- [Phase 28]: Attempt-3 authority partitions 1,461 FAIL into 203 Purchasing and 1,258 residual keys.
- [Phase 28]: Aria-hidden tabindex=-1 Base UI internals are excluded from actionable unnamed-control evidence.
- [Phase 28]: Purchasing residual handoff SHA-256 is b8fa28d6f612c719912c89620a5729b83b0264be4fc8b57aadeb9c2ddc98fa6a.
- [Phase 28]: Non-admin route evidence is zero-FAIL across five attempt-38 members plus corrected Weekly Menu attempt-39.
- [Phase 28]: Admin-only handoff contains 152 keys at SHA-256 55b48a6c2ae84dd1b6aca529e1076af9e3b251d587c9d06d7e72d673ac3ad3a3.
- [Phase 28]: Plan 28-05 confines Admin BOM overflow at the owner and preserves shared UI behavior.
- [Phase 28]: Plan 28-06 must reconcile 112 raw Admin Data adapter rows through the locked 28-04 actionable-control and browser-computed contrast predicates.
- [Phase 28]: Retain 112 Admin legacy raw FAIL rows as NON_ACTIONABLE_RAW_RETAINED while reporting zero actionable FAIL.
- [Phase 28]: Require byte-exact two-run equality after schema-defined network ordering and endpoint-observed readiness.
- [Phase 28]: Plan 28-07 qualitative review cannot manufacture PASS from deterministic-only evidence; all 2,142 identities remain NEEDS_EVIDENCE pending separately authorized visual evidence.
- [Phase 28]: Blind-review attempts 1 and 2 remain immutable failed history; attempt-3 alone is selected with fresh isolated reviewer provenance.
- [Phase 28]: Operational singleton resolution observes at most two active rows and requires exact configured byte identity without fallback or repair.
- [Phase 28]: Plan 28-08 startup observation remains separate from Plan 28-09 additive schema and separately authorized activation.
- [Phase 28]: OperationalSingletonKey is a non-writable MySQL-generated nullable discriminator with a normal unique index.
- [Phase 28]: Migration application and operational warehouse activation remain separately operator-authorized checkpoints.
- [Phase 28]: Plan 28-10 trust inventory is the sole mutable registry; Plans 28-11 through 28-13 consume it read-only.
- [Phase 28]: Ordinary warehouse inputs accept omission for resolver derivation while supplied values remain compatibility claims requiring later exact service equality.
- [Phase 28]: Response and internal warehouse identities remain intact for provenance, stock grain, audit, reports, purchasing, and lineage.
- [Phase ?]: Plan 28-11 resolves canonical warehouse before inventory mutations and rejects compatibility/source mismatch without rewriting provenance.
- [Phase ?]: Plan 28-12 derives purchasing/import/selector trust from the operational resolver while preserving fingerprint and historical identity.
- [Phase ?]: Plan 28-14 treats exact-one selector data as passive context and blocks zero/multiple states without implicit selection.
- [Phase ?]: Plan 29-24 reachability uses production controllers/services and forbids direct quantity/reconciliation authority fixtures.
- [Phase ?]: ANV/AMANN 2026-09-07..2026-09-12 remains read-only candidate metadata until protected preflight.
- [Phase ?]: Phase 30 Plan 01 keeps transfer zero-stock and routes reconciliation-origin issues through canonical inventory stock authority.
- [Phase ?]: Closed-loop issued quantity is projected from exact InventoryIssueLine lineage; manual purchased/issued actual commands are mode-excluded.
- [Phase ?]: MATERIAL_RECONCILIATION route, tab and preload ownership is resolved from backend capability at shared seams; DEFAULT remains unchanged.
- [Phase ?]: Reconciliation is a route-owned no-tab page; Weekly Menu and Warehouse no longer embed or mutate reconciliation actuals.
- [Phase ?]: Canonical returns bind exact source family and active operation mode/version before mutation.
- [Phase ?]: Supplemental and explicit legacy lineage disposition remain DEFAULT-only.
- [Phase ?]: Phase 30-04 remediation: reconciliation mutation endpoints are explicitly ReconciliationOnly; warehouse transfer binds the captured operation mode/version inside its transaction.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260828-system-operation-capability-profile | Backend operation-mode capability profile | 2026-08-28 | a9a2d45a | [260828-system-operation-capability-profile](./quick/260828-system-operation-capability-profile/) |

### Roadmap Evolution

- Phase 28 added: Project-wide UI/UX contract rollout and single-warehouse presentation.
- Phase 29 added: System operation mode, material reconciliation and project-wide clarity cleanup.
- Phase 30 added: Closed-loop Menu → Warehouse issue → required-versus-issued reconciliation, constrained to three waves.

### Blockers

- No Phase 29 blocker remains.
- The old ignored baseline bytes are permanently `LOST_NO_BACKUP`; they must never be represented as restored or byte-equivalent.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 28 P01R | 35min | 3 tasks | 18 files |
| Phase 28 P02 | 34min | 3 tasks | 7 files |
| Phase 28 P03 | 21min | 2 tasks | 6 files |
| Phase 28 P04 | 3h | 2 tasks | 31 files |
| Phase 28 P05 | 1h | 2 tasks | 7 files |
| Phase 28 P06 | 7h | 2 tasks | 10 files |
| Phase 28 P07 | 32min | 2 tasks | 8 files |
| Phase 28 P08 | 9min | 2 tasks | 8 files |
| Phase 28 P09 | 8min | 2 tasks | 8 files |
| Phase 28 P10 | 8min | 2 tasks | 8 files |
| Phase 28 P11 | 24m | 2 tasks | 16 files |
| Phase 28 P12 | 23m | 2 tasks | 15 files |
| Phase 28 P13 | 10m | 2 tasks | 4 files |
| Phase 28 P14 | 18m | 2 tasks | 7 files |
| Phase 28 P15 | 34m | 2 tasks | 17 files |
| Phase 29 P23 | 22 min | 2 tasks | 15 files |
| Phase 29 P24 | 31 min | 2 tasks | 7 files |
| Phase 29 P22 | 24 min | 2 tasks | 8 files |
| Phase 30 P01 | 23 min | 2 tasks | 27 files |
| Phase 30 P02 | 27 min | 2 tasks | 27 files |
| Phase 30 P04 | 2h | 3 tasks | 8 files |
