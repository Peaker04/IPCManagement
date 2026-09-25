# Wave 6 clean-candidate CI/deployment proof

Verdict: `FAIL_CI / NEEDS_EVIDENCE_DOCKER`

Date: 2026-09-24
Baseline: `44124e091783765e3c52411d28cc5ee78c192986`

## Candidate construction

A normal local clone was attempted first and was blocked by Git clone protection because the source repository has active local `core.hooksPath=.husky/_`. No protection was disabled.

A detached clean worktree at the baseline HEAD was therefore created under `D:/Temp`, then the complete tracked candidate diff and required task-owned untracked files were overlaid. This preserved the dirty source worktree and provided a clean-baseline candidate tree without committing. The temporary worktree metadata and directory were removed after testing.

## PASS

- `npm ci`: PASS, 597 packages installed from lockfile.
- Ignore policy: 4/4 PASS.
- Frontend taxonomy: 1/1 PASS.
- Architecture gate self-tests: 6/6 PASS.
- Backend build: PASS, 0 warnings / 0 errors.
- Frontend production build: PASS.
- OpenAPI generation/parity: PASS; generated JSON and TypeScript produced no tracked diff.
- EF pending-model check: PASS after adding the required centralized `--msbuildprojectextensionspath`.
- EF idempotent schema generation: PASS, 122,508-byte SQL artifact.
- Backend application tests: 49/49 PASS after making source-root lookup independent of the test output directory.
- Backend API non-integration/non-migration suite: 1,287 PASS / 3 SKIP / 0 FAIL after the same output-root correction.

## Fixes discovered by clean-candidate execution

Centralized .NET outputs exposed two real clone/runtime assumptions:

1. EF tooling could not find `GetEFProjectMetadata` because `UseArtifactsOutput` relocates `obj`. CI and Phase 42 commands now pass `--msbuildprojectextensionspath` explicitly.
2. Four source-scanning backend tests assumed binaries lived below `backend/`. Their root discovery now checks both the process working directory and binary directory, including repository-root and backend-root layouts. Worktree `.git` files are accepted as well as normal `.git` directories.

## FAIL

### Strict architecture gate

`npm run check:architecture-growth` failed against the committed baseline with eight issues:

- three new frontend debt rows;
- worsened `MaterialDemandService` baseline (1,384 → 1,394 lines);
- four new service debt rows.

The architecture gate self-tests pass; the repository baseline/current-source contract does not.

### CI-shaped frontend unit suite

Exact CI mode result:

- 276 files PASS / 1 file FAIL;
- 1,607 tests PASS / 2 SKIP / 1 FAIL.

Failure:

```text
src/features/dashboard/pages/DashboardPage.state.test.tsx
DashboardPage query state boundary > blocks false zero and empty content when the workflow overview fails
Unable to find role="alert"
```

This is a product/test behavior failure, not a discovery or clean-candidate installation failure.

### Phase 42 full contract

Result: 50 PASS / 14 FAIL.

All 14 failures require ignored local evidence under `.artifacts/shipyard-live/phase-04.2-execution`. Those bytes are intentionally absent from a clean candidate. Phase 42 is therefore not clean-clone hermetic despite passing in the original evidence-bearing worktree.

## NEEDS_EVIDENCE

### Docker image

Docker is unavailable on this host:

```text
docker: command not found
```

No Docker build, image boot, health probe, container filesystem or runtime migration claim is made.

### Database integration and deployment runtime

No database credentials, server, seed, operation-mode switch or schema mutation was authorized. Database integration, production startup, deployment-provider execution and post-deploy health remain `NEEDS_EVIDENCE`.

## Dependency observation

`npm ci` reported 18 known dependency findings: 1 low, 8 moderate and 9 high. No automatic audit fix was run because dependency mutation was outside this wave.

## Follow-up resolution

The three source-level FAIL lanes were handled as separate objectives and are now resolved:

- architecture current baseline: PASS with exact nine findings;
- Dashboard CI unit regression: PASS, 1,608/1,608 executed tests;
- Phase 42 separation: 50 clean-hermetic PASS and 15 evidence-owned PASS.

See [`WAVE6-OBJECTIVES-RESULT.md`](WAVE6-OBJECTIVES-RESULT.md). Docker/deployment runtime remains `NEEDS_EVIDENCE`.

## Conclusion

The candidate is buildable and its generated contracts/migration model are coherent, but the repository cannot claim clean-clone CI PASS while the strict architecture baseline, one frontend behavior test and evidence-dependent Phase 42 suite fail. Docker/deployment runtime remains unverified rather than failed.
