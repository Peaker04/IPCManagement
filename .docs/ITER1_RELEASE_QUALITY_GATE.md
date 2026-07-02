# Iter1 Release Quality Gate

This closes PRD-002. The release candidate is blocked until every required gate has dated evidence.

## Required Gates

| Gate | Command / evidence |
| --- | --- |
| Backend build | `npm run build:be` |
| Backend tests | `npm run test:be` |
| Frontend lint | `npm run lint:fe` |
| Frontend build | `npm run build:fe` |
| Frontend smoke | `npm run test:smoke -w frontend` |
| Seed reset | `powershell -ExecutionPolicy Bypass -File .docs/MVP_DEMO_SEED_RESET.ps1 -BaseUrl <api-url>` |
| Selected E2E | Provide a dated log path with `-E2ELogPath <path>` and cover `.docs/ITER1_UAT_MATRIX.md` actor/action cases |

## Runbook

Audit the gate configuration without running release commands:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Invoke-Iter1QualityGate.ps1 -AuditOnly
```

Run the release gate against a release candidate backend:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Invoke-Iter1QualityGate.ps1 `
  -BackendBaseUrl http://localhost:5262 `
  -RunSeedReset `
  -E2ELogPath .artifacts/e2e/<dated-e2e-log>.log
```

The script writes:

- `.artifacts/release-gates/<timestamp>/quality-gate.log`
- `.artifacts/release-gates/<timestamp>/quality-gate-summary.md`

## Blocking Rule

Release is blocked when any command fails or when seed reset / selected E2E evidence is missing.

The tracker evidence note should include:

`[YYYY-MM-DD] Quality gate: <PASS/BLOCKED>. Summary: <path>. Commit: <sha>.`
