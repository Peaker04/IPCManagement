# Wave 5 frontend test taxonomy result

Verdict: `PASS_BOUNDED / HISTORICAL_PINNED_PATHS_REMAIN`

## Policy

- Keep `frontend/src/**/*.test.{ts,tsx}` colocated with production modules.
- New cross-module contracts go to `frontend/tests/contracts/`.
- Campaign/evidence validators go to `frontend/tests/evidence/` and are excluded from default product CI by directory.
- New browser specs go to `frontend/tests/browser/` after pinned historical browser paths are retired.
- Shared helpers stay in `frontend/tests/support/`; fixtures stay in `frontend/tests/fixtures/`.

The policy is documented in `frontend/tests/README.md` and `docs/TESTING.md`.

## Physical migration

Moved three campaign-owned validators into `frontend/tests/evidence/`:

- `phase35GeometryDenominator.test.ts`
- `uiAuditBaselineDelta.test.ts`
- `uiAuditRemediationAttribution.test.ts`

Updated their relative repository/helper paths and replaced their three CI filename exclusions with one directory exclusion:

```text
tests/evidence/**/*.test.{ts,tsx}
```

No unit/component test under `frontend/src` was moved.

## Framework separation

The main and focused Playwright configs now declare `testMatch: '**/*.spec.ts'`, preventing Vitest `.test.ts/.test.tsx` files from being treated as browser scenarios.

The root taxonomy debt is count-locked by `scripts/check-frontend-test-taxonomy.test.mjs`:

- root Playwright specs: exactly 32
- root TypeScript contract tests: maximum 57
- root TSX contract tests: maximum 3
- evidence directory: exact reviewed three files
- Playwright configs must keep the `.spec.ts` match

The gate is exposed as `npm run test:frontend-test-taxonomy`, included in root `verify`, and runs in GitHub Actions after the ignore-policy gate.

## Verification

- taxonomy gate: 1/1 PASS
- moved baseline/attribution validators: 2 files / 32 tests PASS
- Phase 35 validator: executes from the new path but remains FAIL because its historical geometry ledger is stale against current production (95 ledger rows versus 108 current rows). It was already excluded from default CI; this is an inherited campaign-evidence failure, not a path-resolution failure.
- CI-shaped focused product tests: 2 files / 25 tests PASS
- focused Playwright discovery: route-smoke 10 tests / 1 spec PASS
- TypeScript build: PASS
- frontend production build: PASS
- ignore gate: 4/4 PASS
- taxonomy gate: 1/1 PASS
- architecture growth: 6/6 PASS

A whole Playwright `--list` remains blocked by the inherited `phase31-convergence.spec.ts` pattern that imports four other spec files. Fixing that requires extracting shared fixtures from spec modules and is outside this bounded taxonomy wave.

## Why browser/contracts were not bulk-moved

Phase 27/28 fixtures, validator pins, snapshot manifests, docs, backend parity tests and source tests contain exact `frontend/tests/...` paths. Bulk-moving the 32 browser specs or 60 root contract tests would rewrite historical lineage and invalidate existing hashes/pins. The taxonomy gate prevents new debt while future owner-specific migrations shrink it safely.

## Boundaries

No artifact/evidence path, database, runtime, worktree metadata, commit or push action occurred.
