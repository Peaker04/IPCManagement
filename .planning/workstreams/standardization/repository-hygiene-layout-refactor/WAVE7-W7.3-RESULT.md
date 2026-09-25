# Wave 7.3 deletion result

Date: 2026-09-24
Verdict: `PASS_DELETE / EVIDENCE_HASH_MISMATCH_INHERITED`

## Applied deletion

Deleted exactly the 65 paths marked `DELETE_CANDIDATE` in `wave-7-e2e-disposition.csv`.

- deleted files: 65;
- deleted bytes: 478,981;
- retained files: 11/11;
- no path outside the reviewed CSV was deleted.

The retained `tools/e2e` surface is now:

- four current `default-campaign-*` scripts;
- current `Test-Phase05GoldenDemoScope.ps1`;
- two Phase 28 evidence-recovery runners;
- two hash-indexed Phase 05 workbooks;
- fixture-builder project and source.

Exact deletion receipt: `wave-7-e2e-delete-receipt.txt`.

## Reference verification

Post-delete scan across package files, CI, current docs, scripts, frontend, backend, Shipyard and remaining tools found zero stale current-reference groups. Archive narrative was not rewritten merely to erase historical filenames.

## Contract/build verification

- frontend launcher/browser-support contracts: 3 files / 45 tests PASS;
- Playwright discovery: dialog 6, field 4, recovery route-smoke 10 PASS;
- frontend taxonomy: 1/1 PASS;
- ignore policy: 4/4 PASS;
- frontend production build: PASS;
- retained `Phase05WeeklyMenuFixtureTool` build: PASS, 0 warnings / 0 errors;
- `git diff --check`: PASS.

## Evidence limitation

The two retained workbooks still do not match their historical `docs/EVIDENCE-INDEX.md` hashes:

| Path | Current SHA-256 | Indexed SHA-256 |
|---|---|---|
| `tools/e2e/fixtures/phase05/weekly-menu-golden-ANV.xlsx` | `2CC485BD146F1F4892DA9830F3F428AD0435387563282177FA94B3B03EA2965E` | `BDB76CC7063339E83D427AC021C80F852A34685AEEAA93DBF4CBC13384A698C1` |
| `tools/e2e/fixtures/phase05/weekly-menu-golden-DAV.xlsx` | `2BD34F7D471DF23E63EFD9DA22D2904BC61E68C5E78EB4A18EFDEE940FCB7AAC` | `F7E14FE5C88A959529E7B80E950A9F7435F019FD18EC551702F9080CC3BE9061` |

These are inherited members of the unresolved evidence-lineage mismatch set. The deletion batch did not modify either workbook or the evidence index. W7.5 remains the owner for reconcile/reseal/retire decisions.

## Boundaries

No database, runtime, operation mode, evidence content, evidence hash, commit or push action occurred.
