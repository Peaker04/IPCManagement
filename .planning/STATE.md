---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Evidence-first UI Contract Migration
status: active
stopped_at: Phase 28 Plan 28-01R baseline recovery ready to execute
last_updated: "2026-08-24T05:45:00.000Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 36
  completed_plans: 21
  percent: 69
current_phase_name: project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
last_activity: 2026-08-24 — Preserved lost baseline truth and prepared fail-closed Plan 28-01R recovery
---

# Project State

## Project Reference

See `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`.

**Current focus:** Phase 28 — project-wide-ui-ux-contract-rollout-and-single-warehouse-pre

## Current Status

- Phase 27 and Phase 27.1 are COMPLETE; their evidence architecture is the foundation, not the final project-wide UI outcome.
- Kỳ explicitly authorized whole-web research, audit and evidence-backed presentation corrections on 23/08/2026.
- Standards research and source inventory are captured in the Phase 28 directory.
- No Phase 28 production edit is authorized until the deterministic audit contract and read-only baseline identify exact owners.
- Business truth: one operational warehouse stores all materials. UI should remove false choice/repetition while retaining warehouse IDs and server enforcement.

## Session Continuity

**Stopped at:** Plan 28-01 complete; ignored sealed bytes were lost to Playwright output cleanup with no backup; recovery authority is planned and pending execution.
**Resume directory:** `.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre`

Next workflow: execute Plan 28-01R into a new immutable `.artifacts/phase28-ui-audit` attempt root, pin fresh read-only evidence, then resume Plan 28-02 from its preserved RED commit.

## Decisions

- Phase 27 is a bounded pilot and evidence foundation; Phase 28 owns whole-web rollout.
- Use existing shadcn/Base UI and shared owners; Fiori/Carbon/Polaris are references only.
- Use one audit harness; deterministic rules precede fresh AI review.
- Prefer token → primitive → formatter/hook → layout → page fixes.
- Keep one operational warehouse passive in routine UI; never erase technical identity or authorization boundaries.

### Roadmap Evolution

- Phase 28 added: Project-wide UI/UX contract rollout and single-warehouse presentation.

### Blockers

- The old ignored baseline bytes are permanently `LOST_NO_BACKUP`; they must never be represented as restored or byte-equivalent.
- Plan 28-02 remains blocked until Plan 28-01R produces and hash-pins a fresh authenticated GET/HEAD-only production-route baseline.
