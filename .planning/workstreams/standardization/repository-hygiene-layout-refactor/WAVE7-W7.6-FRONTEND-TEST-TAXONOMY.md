# Wave 7 — W7.6 frontend test physical taxonomy

Date: 2026-09-24

## Result

`PASS_FOCUSED`

- Moved all 32 Playwright specs from `frontend/tests/` to `frontend/tests/browser/`.
- Moved both adjacent screenshot-baseline directories with their specs.
- Extracted the four Phase 31 shared production-query fixtures into `frontend/tests/support/`; browser specs no longer import other browser specs.
- Migrated active package scripts, Phase 27.1 path matrices/manifests, Phase 28 runners, unit contracts and documentation to the new paths.
- Updated the Phase 27.1 golden identity-manifest hash because normalized spec identity now includes `tests/browser/`; screenshot bytes were not changed.
- Root browser-spec debt is now zero. Existing root cross-module `.test.ts/.test.tsx` debt remains intentionally bounded; colocated `frontend/src` tests were not moved.

## Staging review

This boundary is currently staged as the first commit candidate together with the earlier W7.2 config/evidence taxonomy migration it completes. Cached scope: 116 files, 973 insertions, 774 deletions; only `.planning` Phase 27.1 lineage, `frontend`, the taxonomy gate, and two Phase 28 runners. No product source, credentials, diagram tooling, generated runtime, commit or push is included. Cached diff check, taxonomy 1/1, Playwright discovery 250/32 and focused lineage 92/92 pass.

A Git index can represent only one next commit. Remaining boundaries intentionally stay unstaged until this candidate is either committed or explicitly unstaged.

## Gates

- Taxonomy contract: 1/1 PASS.
- Playwright whole discovery: 250 tests in 32 files; no decrease from pre-move discovery.
- Spec-to-spec import scan: zero.
- Focused Phase 27.1 lineage contracts: 8 files / 92 tests PASS.
- Full frontend unit suite: 277 files / 1,608 PASS / 2 SKIP.
- ESLint for `tests/browser` and `tests/support`: PASS.
- Frontend production build: PASS, 2,334 modules.
- `git diff --check`: PASS.

The first full unit rerun exposed only expected path-lineage failures; those were closed by migrating the Phase 27.1 path records and recomputing the deterministic identity hash. One subsequent aggregate run hit an unrelated existing async select-option flake in `AdminSourceChangesPanel.test.tsx`; immediate full rerun passed 1,608/1,608. No browser runtime, database, evidence bytes, commit or push occurred.
