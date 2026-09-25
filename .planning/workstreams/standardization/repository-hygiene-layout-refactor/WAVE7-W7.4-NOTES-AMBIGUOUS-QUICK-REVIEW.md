# Wave 7.4 — note and ambiguous-quick lifecycle review

Date: 2026-09-24

Scope: the four former `REVIEW_NOTE_LIFECYCLE` rows plus every owner containing `KEEP_AMBIGUOUS_QUICK` or `ARCHIVE_CANDIDATE_NEEDS_DIRECTORY_REVIEW`. Phase trees were not moved.

## Notes

| Path | Disposition | Reason |
|---|---|---|
| `.planning/notes/evidence-first-ui-contract-architecture.md` | `KEEP_ADOPTED_PHASE_REFERENCE` | Marked `adopted-research-input`; consumed by Phase 27 context and still defines the evidence-first contract architecture. |
| `.planning/notes/nfr-research-and-remediation-PLAN.md` | `KEEP_ACTIVE_REFERENCED_PLAN` | Status remains active with open W4/W5/W6 gates; referenced by NFR primary-source evidence and `docs/harness/manifest.json`. |
| `.planning/notes/production-render-bootstrap-HANDOVER.md` | `KEEP_ACTIVE_SECURITY_HANDOVER` | Front matter says `active-handover`; unresolved production credential-rotation/deployment/bootstrap residuals make archival unsafe even without exact backlinks. |
| `.planning/notes/system-operation-mode-and-material-reconciliation.md` | `KEEP_LOCKED_DOMAIN_DISCOVERY` | Marked `locked-discovery`; consumed by ROADMAP and Phase 29 context/research/spec seed. |

No note moved.

## Ambiguous quick owners

| Owner | Disposition | Reason |
|---|---|---|
| `260717-ui-ux-system-redesign` | `KEEP_REFERENCED_QUICK_HISTORY` | Summary says complete, plan remains paused; v1.1 archived UI review references the directory. |
| `260717-ui-ux-system-refactor-v2` | `KEEP_REFERENCED_QUICK_HISTORY` | Summary says complete, but plan and gap/risk records preserve blocked/superseded decisions; v1.1 archived UI review references the directory. |
| `260719-mvp-web-flow-gap-review` | `KEEP_REFERENCED_QUICK_HISTORY` | Complete/conditional-pass history remains referenced by canonical `docs/MVP_WEB_FLOW.md`. |
| `260820-whz-fix-and-integrate-standalone-playwright-` | `ARCHIVED_COMPLETED_QUICK_ZERO_BACKLINK` | Complete summary supersedes the stale `in_progress` plan; active probe is owned by `frontend/scripts/perf-probe.mjs`; no external old-path backlink. |
| `260821-table-standardization-waves` | `KEEP_OPEN_UNCLOSED_QUICK` | Seven-wave checklist remains unchecked and has no summary/verification closeout. Age is not completion evidence. |

## Physical move

Moved two canonical-byte-identical Markdown files:

```text
.planning/quick/260820-whz-fix-and-integrate-standalone-playwright-/
→ .planning/archive/v1.4/quick/260820-whz-fix-and-integrate-standalone-playwright-/
```

No source, evidence, phase tree, runtime, database or hash changed.

## Revised planning ledger

All 575 rows now have a non-review disposition. Current key counts:

- `ARCHIVED_COMPLETED_QUICK_ZERO_BACKLINK`: 23 files across 10 quick directories;
- `KEEP_REFERENCED_QUICK_HISTORY`: 16 files across 3 directories;
- `KEEP_OPEN_UNCLOSED_QUICK`: 1 file;
- all four reviewed notes have explicit keep dispositions;
- no `REVIEW_NOTE_LIFECYCLE`, `KEEP_AMBIGUOUS_QUICK` or `ARCHIVE_CANDIDATE_NEEDS_DIRECTORY_REVIEW` rows remain.

## Next boundary

Do not move phase trees. The next planning cleanup, if requested, is backlink-aware supersession migration for the three retained referenced quick owners, or explicit closeout of the open table-standardization program. Neither should be inferred automatically.
