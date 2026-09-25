# Wave 7.4 — planning active/history ledger and first archive batch

Date: 2026-09-24

## Authority used

- `.planning/STATE.md` and `.planning/ROADMAP.md` for phase lifecycle;
- each workstream `STATE.md` for open/ready/complete status;
- `MEMORY.md` for current pointers;
- `docs/EVIDENCE-INDEX.md` for indexed planning lineage;
- exact external backlinks across tracked repository text;
- directory-local status and summary files for quick-task completion.

Ledger: `wave-7-planning-active-history-inventory.csv`.

## Enriched denominator

The ledger retains all 575 originally tracked `.planning` files and records original/current path, owner, lifecycle, disposition, MEMORY/STATE/ROADMAP/evidence references, external exact-backlink count and reason.

| Disposition | Files |
|---|---:|
| Completed phases retained because current paths have source/docs/planning consumers | 322 |
| Workstreams retained until their own state is closed | 58 |
| Existing v1.1 archive retained | 53 |
| Standardization owner retained | 39 |
| Open Phase 30 retained | 24 |
| Completed zero-backlink quick files archived in this batch | 21 |
| Reference research/sketch history retained | 15 |
| Ambiguous quick history retained | 9 |
| GSD codebase reference retained | 7 |
| GSD top-level core retained | 6 |
| Referenced quick history retained | 6 |
| Notes requiring semantic lifecycle review | 4 |
| Remaining per-file archive candidates requiring directory review | 4 |
| Milestone history retained | 3 |
| Pending todos retained | 2 |
| Current MEMORY pointer retained | 1 |
| Harness-manifest planning path retained | 1 |

## First physical archive batch

Nine completed quick-task directories, 21 tracked Markdown files, moved from `.planning/quick/` to `.planning/archive/v1.4/quick/`:

1. `260721-stw-hoan-thien-shipyard-mysql-template-resto`
2. `260730-w4a-fix-weeklymenulifecycle-pc-permission-ga`
3. `260802-ola-synchronize-current-frontend-backend-con`
4. `260802-plv-remediate-four-evidence-backed-shipyard-`
5. `260802-qdk-audit-and-remediate-every-shipyard-page-`
6. `260803-p7b-adopt-the-ui-ux-fe-be-database-standardi`
7. `260803-pwg-continue-standardization-rollout-by-migr`
8. `260822-phase-27-current-stock-label-correction`
9. `260822-phase-27-h1-correction`

Each directory had a complete summary/status, zero exact external backlink to its old directory path, no dirty pre-move file and no relative Markdown link. No file was deleted or rewritten semantically; destination bytes are the exact canonical Git blobs for all 21 files. `.gitignore` now narrowly permits Markdown under `.planning/archive/v1.4/` so the moved history remains reviewable instead of becoming ignored deletion-only state.

## Explicit non-moves

- Phases 27, 27.1, 28 and 29 are complete but retain active source/test/docs/planning consumers; keep current paths.
- Phase 30 remains open/BLOCKED on MRX-06P authority; keep.
- `dashboard-ui-rules-conformance` remains `in_progress`; keep.
- `lifecycle-standardization` remains `ready_for_discussion`; keep.
- the Fiori goal workstream remains `ready` with broad historical authority; keep.
- Quick `260820-whz` has conflicting `PLAN status: in_progress` and complete summary; keep.
- Quick `260821-table-standardization-waves` has no completion marker; keep.
- Four notes without current exact pointers require semantic owner review; no bulk archive.

## Verification

- Ledger rows: 575/575.
- Archived directories: 9.
- Archived files: 21.
- Old-path exact external backlinks: 0.
- Relative links inside moved files: 0; broken: 0.
- Canonical Git byte identity after move: 21/21.
- Ignore policy: 4/4 PASS.
- `git diff --check`: PASS.
- Git index remains clean; no commit/push.
- Harness checker and its self-test remain BLOCKED by inherited `MEMORY.md exceeds 12288 bytes`; this task did not edit or expand MEMORY.

## Follow-up status

Completed in [`WAVE7-W7.4-NOTES-AMBIGUOUS-QUICK-REVIEW.md`](WAVE7-W7.4-NOTES-AMBIGUOUS-QUICK-REVIEW.md): all four note rows and every ambiguous quick owner now have explicit dispositions. Completed zero-backlink `260820-whz` added two files to the v1.4 archive; referenced/open owners remain in place.
