---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Evidence-first UI Contract Migration
status: active
stopped_at: Phase 29 discovery locked; research/spec/discussion pending
last_updated: "2026-08-25T08:55:00+07:00"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 37
  completed_plans: 37
  percent: 75
current_phase_name: system-operation-mode-and-material-reconciliation
last_activity: 2026-08-25 — Captured Phase 29 global mode, reconciliation and project-wide clarity discovery authority
---

# Project State

## Project Reference

See `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`.

**Current focus:** Phase 29 discovery — system-operation-mode-and-material-reconciliation

## Current Status

- Phases 27, 27.1 and 28 are COMPLETE; their evidence architecture remains mandatory for Phase 29 UI correction.
- Kỳ locked one server-authoritative system-wide mode, mutable only by Admin: `DEFAULT` or `MATERIAL_RECONCILIATION`.
- Reconciliation mode retains Dashboard, Weekly Menu, Purchasing, Warehouse, Reports, Admin Data and Admin-only Advanced Settings; it excludes Coordination, Approvals, Chef Dashboard and Approval Rules for every role.
- Each import creates an immutable reconciliation batch at grain `batch × ingredient identity × canonical unit`; required/purchased/issued comparisons use tolerance frozen with the batch.
- Project-wide copy/table/empty-state/hierarchy cleanup applies to both modes, including the current default project. No production edit is authorized until Phase 29 research/spec/discussion and planning close their ambiguities.

## Session Continuity

**Last session:** 2026-08-25T08:55:00+07:00
**Resume file:** `.planning/phases/29-system-operation-mode-and-material-reconciliation/29-SPEC-SEED.md`

**Stopped at:** Phase 29 discovery decisions captured; implementation has not started
**Resume directory:** `.planning/phases/29-system-operation-mode-and-material-reconciliation`

Next workflow: read the Phase 29 discovery note and spec seed, then run research/spec/discussion before planning. Phase 28 operational database state and rollback artifacts remain unchanged.

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

### Roadmap Evolution

- Phase 28 added: Project-wide UI/UX contract rollout and single-warehouse presentation.
- Phase 29 added: System operation mode, material reconciliation and project-wide clarity cleanup.

### Blockers

- The old ignored baseline bytes are permanently `LOST_NO_BACKUP`; they must never be represented as restored or byte-equivalent.
- No Phase 28 blocker remains. Full frontend aggregate passes 186 files / 1,209 tests after source-aware authority reconciliation; old baseline bytes remain truthfully LOST_NO_BACKUP.

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
