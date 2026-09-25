# Wave 7 — performance evidence owner migration

Date: 2026-09-24

## Moves

- 34 files moved from root `artifacts/` to `.artifacts/performance/legacy-root-probes/`.
  - 10 retained tracked files and 2 additional indexed local files.
  - 22 other local companions moved without deletion.
- 2 indexed files moved from `frontend/docs/perf/` to `.artifacts/performance/probe-h1-preview/`.
- Empty `artifacts/` and `frontend/docs/` roots were removed.

The 12 retained tracked files were written at the destination using their canonical Git blob bytes. Together with the two indexed local schedule files, all 14 indexed moved files retain their existing SHA-256 values; no hash was resealed.

## Updated contracts

- `docs/EVIDENCE-INDEX.md` paths updated atomically.
- `docs/UI-TAB-CONTENT-AUDIT.md` and archived Wave 3 audit pointers updated.
- `frontend/scripts/perf-probe.mjs` now defaults to `.artifacts/performance/perf-probe-report.json`.
- `.gitignore` exposes only the 12 reviewed tracked files under the new owner; other performance scratch remains ignored.
- Ignore-policy regression now requires the root owner to remain absent and all 12 retained paths to exist and remain indexed.

## Gates

- Corrected evidence scan: 358 references, 9 mismatches, 0 missing.
- All 14 moved indexed files match their unchanged hashes.
- Ignore policy: 4/4 PASS.
- Evidence scanner regression: 3/3 PASS.
- No stale current `artifacts/perf-probe-*` or `frontend/docs/perf/probe-h1-preview-report*` reference.
- `artifacts/` absent; `frontend/docs/` absent.

## Planning history boundary

A first tracked inventory contains 575 `.planning` files. Direct exact-path checks alone classify 573 as `REVIEW_HISTORY_CANDIDATE`, one as a current `MEMORY.md` pointer and one as indexed lineage. This is deliberately not sufficient authority for a physical move: many active owners are referenced by directory/section, GSD conventions and relative links rather than exact full paths. Ledger: `wave-7-planning-active-history-inventory.csv`.

Therefore no `.planning` history was moved in this batch. The next W7.4 step must enrich the ledger with GSD active checkpoint, relative-link and phase-status ownership before any archive operation.
