---
title: Agent artifact storage and retention policy
status: canonical-runbook
owner: GSD
scope: repository-artifact-lifecycle
---
# Artifact storage and retention

`.artifacts/` is a disposable workspace with a small retained-evidence subset. It is not a second history store, build cache, browser profile archive, or task database. GSD state remains in `.planning/`; accepted evidence hashes remain only in `docs/EVIDENCE-INDEX.md`.

## Classes

| Class | Examples | Location | Retention |
|---|---|---|---|
| Accepted evidence | final manifest, result JSON, required screenshot, teardown receipt | immutable timestamped run directory | Keep only when referenced by `MEMORY.md`, `.planning/`, or `docs/`; hash accepted files in `docs/EVIDENCE-INDEX.md` |
| Active checkpoint | current red/green logs, small inventory/ledger | task-named directory | Keep while referenced by the active checklist; remove after closeout unless promoted |
| Reproducible output | `bin/`, `obj/`, Vite output, copied DLLs, coverage, traces, downloaded dependency clone | OS temp or normal tool cache; `.artifacts/` only for a bounded run | Delete at run finalization; never retain merely because generation was expensive |
| Runtime scratch | Chrome profile, Playwright profile, stdout/stderr, screenshots from failed attempts | timestamped attempt directory | Delete after the authoritative attempt is selected and pointers are updated |
| Database backup | rollback dump/checkpoint | external backup root, never the Git worktree | Retain by the database runbook; do not prune with the artifact tool |

## Write discipline

1. Every run writes to one timestamped directory and never overwrites another attempt.
2. Store only the smallest evidence needed for the claim. Prefer JSON/TSV/text plus one final screenshot; do not copy complete build trees or browser profiles into retained evidence.
3. Build with normal `bin/obj/dist` locations or OS temp. If isolation requires `.artifacts`, delete the isolated build tree immediately after recording the command/result.
4. Browser profiles are scratch. The manifest may record their path, but the profile itself is deleted after exact process teardown.
5. Before closeout, promote only final evidence by linking it from the active checklist or `MEMORY.md`; add hashes only for accepted evidence. Unlinked attempts are intentionally pruneable.
6. Keep tracked harness helpers under `.artifacts/` only when an existing canonical path requires them. New executable helpers belong in `tools/`.

## Cleanup

Run from repository root:

```bash
python tools/prune_artifacts.py
python tools/prune_artifacts.py --apply
```

The default is dry-run. The tool protects:

- every `.artifacts/...` path referenced by `MEMORY.md`, `.planning/`, or `docs/`;
- every artifact tracked by Git;
- files newer than the configured minimum age (default seven days).

It prunes only unreferenced children of known high-churn collections and unreferenced top-level artifact trees. Use `--minimum-age-days 0` only during an owner-authorized cleanup after active processes are stopped. Review the printed paths and size before `--apply`.

Cleanup is filesystem retention only. It must not stop user processes, alter a database, remove external backups, rewrite evidence, delete GSD state, or change an evidence hash. If a needed artifact is unreferenced, add the canonical pointer first rather than inventing an ad-hoc keep file.

## Finalization checklist

- Stop only run-owned processes and verify their ports are closed.
- Select the authoritative attempt and update the active GSD pointer.
- Hash accepted evidence in `docs/EVIDENCE-INDEX.md` when required.
- Remove browser profiles and isolated build outputs.
- Run the prune tool in dry-run mode; investigate unexpected candidates.
- Record retained evidence paths and evidence limits, not the entire artifact directory, in handover.
