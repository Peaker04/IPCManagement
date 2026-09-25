# Wave 7.3 root-script deletion result

Date: 2026-09-24
Verdict: `PASS_DELETE_AND_WIRE`

## Applied deletion

Deleted exactly the 12 paths marked `DELETE_CANDIDATE` in `wave-7-root-scripts-disposition.csv`.

- deleted files: 12;
- deleted bytes: 137,312;
- retained files: 1/1;
- retained path: `scripts/frontend-unit-runner-args.test.mjs`;
- no path outside the reviewed CSV was deleted.

Exact receipt: `wave-7-root-scripts-delete-receipt.txt`.

## Retained regression wiring

Added root command:

```text
npm run test:frontend-unit-launcher
```

The command runs `node --test scripts/frontend-unit-runner-args.test.mjs`, is included in root `verify`, and has a dedicated GitHub Actions step before broader architecture/build/test gates. `docs/TESTING.md` documents the contract.

## Verification

- post-delete current-reference groups: 0;
- frontend unit launcher policy: 2/2 PASS;
- package policy source check: PASS;
- ignore policy: 4/4 PASS;
- frontend taxonomy: 1/1 PASS;
- `git diff --check`: PASS;
- Git index: clean.

## Boundaries

No historical evidence output, database, runtime, operation mode, commit or push action occurred.
