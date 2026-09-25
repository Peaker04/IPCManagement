# Wave 7.5 — frontend docs, planning and directory-pointer lineage

Date: 2026-09-24
Verdict: `3 EOL FALSE POSITIVES / 3 DIRECTORY-SCANNER FALSE MISSING`

No evidence file, planning file, directory or index entry was changed.

## Two frontend performance reports

Paths:

- `frontend/docs/perf/probe-h1-preview-report.json`
- `frontend/docs/perf/probe-h1-preview-report.md`

Both are valid committed evidence:

- indexed SHA-256 equals the exact `HEAD` Git blob;
- indexed SHA-256 equals the introducing commit `ee18f37058b862533b46ad3ba77a6b6e82d223fb` blob;
- Git reports no content diff;
- LF-normalized Windows checkout bytes reproduce the indexed hashes exactly.

Disposition: `INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE` for both.

Hash integrity no longer blocks moving these files out of `frontend/docs/`. Physical move still requires atomic path updates in the evidence index and the one current audit reference.

## One planning closeout receipt

Path:

- `.planning/phases/28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre/evidence/28-15-frontend-closeout.txt`

The indexed hash equals the exact `HEAD` and introducing commit `61c91f236ee787a09b2e3674731855879b588fb6` Git blob. LF-normalized checkout bytes also reproduce it exactly; Git reports no content diff.

Disposition: `INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE`.

Hash integrity no longer blocks archiving this planning owner. Active-pointer and path-reference review is still required in W7.4.

## Three directory pointers

Paths:

- `.artifacts/information-simplification/f05-20260913-003/`
- `.artifacts/shipyard-live/material-reconciliation-full-e2e/runs/20260913-085032/`
- `.artifacts/shipyard-live/default-full-e2e/runs/20260913-170647/`

All three directories exist. The scanner incorrectly used `Path.is_file()` for every indexed backtick path, so directories were reported missing.

Child verification:

| Directory | Files on disk | Indexed child hashes checked | Match |
|---|---:|---:|---:|
| F05 consumer migration | 1,430 | 15 | 15/15 |
| MRX lifecycle run | 253 | 4 | 4/4 |
| DEFAULT lifecycle run | 255 | 4 | 4/4 |

Disposition: `DIRECTORY_ROOT_VALID_SCANNER_FALSE_MISSING` for all three.

No directory restore, pointer retirement or empty-directory creation is needed. The scanner must recognize directory owner pointers and resolve relative child rows inside each evidence section.

## Machine evidence

- `wave-7-frontend-planning-lineage.json` — Git/LF/CRLF history for the three tracked text files.
- `wave-7-frontend-planning-missing-disposition.json` — final dispositions for all six paths.

## Corrected lineage state so far

From the raw `33 mismatch / 3 missing` report:

- 5 tools SQL mismatches: EOL false positives;
- 10 root artifacts mismatches: EOL false positives;
- 2 frontend docs mismatches: EOL false positives;
- 1 planning mismatch: EOL false positive;
- 3 missing directory pointers: scanner false missing;
- 2 Golden XLSX mismatches: still blocked on deterministic builder/reseal;
- 13 `.artifacts` raw mismatches remain to analyze.

Thus all three missing references are closed as valid, and 18 of 33 raw mismatches are explained scanner/EOL false positives. Fifteen raw mismatches remain unresolved: 13 `.artifacts` plus 2 XLSX.
