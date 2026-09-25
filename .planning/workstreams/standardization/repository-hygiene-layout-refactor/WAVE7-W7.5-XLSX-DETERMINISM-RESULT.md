# Wave 7.5 — deterministic Golden XLSX reseal

Date: 2026-09-24

## Root cause and fix

`WeeklyMenuTemplateWorkbookBuilder` and the Phase 05 fixture tool created ZIP entries with wall-clock `LastWriteTime`, so identical logical XLSX content produced different archive bytes.

The smallest fix sets the same fixed ZIP timestamp (`2026-07-17T00:00:00Z`) at both owners:

- every production workbook entry in `WeeklyMenuTemplateWorkbookBuilder`;
- every replaced populated worksheet entry in `Phase05WeeklyMenuFixtureTool`.

Entry ordering and workbook XML/content remain unchanged.

## Regression

Added `scripts/test_phase05_fixture_determinism.py`. It runs the real fixture tool twice into OS temp and asserts:

- ANV bytes are identical across runs;
- DAV bytes are identical across runs;
- ANV and DAV hashes remain distinct;
- each workbook contains sheets `25k`, `30k`, `34k`;
- sheet content retains week `17/08/2026` and `MENU MẶN - CA SÁNG`.

Red before fix: identical ANV runs differed. Green after fix: 1/1 PASS.

The gate is wired as `npm run test:phase05-fixture-determinism` in root `verify` and GitHub Verify.

## Fixture reseal

The retained production tool regenerated both fixtures for week `2026-08-17`:

| Fixture | Reviewed deterministic SHA-256 |
|---|---|
| `weekly-menu-golden-ANV.xlsx` | `CBBC430E40E6A4C5CDB6E4AB8A0110D3791DF54A6878E60A1B8ADCFA19F57AD6` |
| `weekly-menu-golden-DAV.xlsx` | `F83EC37727404775036A066D1C7FEF66F7FC7B7641EF27DE0585107F4343D550` |

`docs/EVIDENCE-INDEX.md` was updated in the same batch and now states byte-deterministic production generation.

## Verification

- Determinism regression: 1/1 PASS.
- Evidence scanner regression: 4/4 PASS.
- Weekly-menu parser focused suite: 28/28 PASS.
- Fixture hashes match the reviewed values: 2/2 PASS.
- Fixture tool isolated build: PASS, 0 warnings/errors. The first `--no-restore` invocation was a command-shape failure (`NETSDK1004`, isolated assets absent), not a source/test failure; rerun with restore passed.
- Corrected evidence denominator: 353 references, 0 mismatches, 0 missing.
- No database, runtime, browser, mode, credential, commit or push action occurred.
