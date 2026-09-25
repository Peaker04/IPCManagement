# Wave 7.3 — root scripts audit

Date: 2026-09-24
Verdict: `AUDIT_PASS / DELETE_AWAITS_EXPLICIT_APPROVAL`

## Scope

Audited the 13 root `scripts/` files that had zero current filename references in the broader W7.3 scan. Filename references were not treated as sufficient proof; each file was inspected for command ownership, convention loading, indexed evidence, hard-coded runtime identity and active implementation seams.

## Result

| Disposition | Count | Meaning |
|---|---:|---|
| `KEEP_AND_WIRE` | 1 | Valid regression for the active canonical frontend unit launcher; currently not part of a package/CI gate |
| `DELETE_CANDIDATE` | 12 | Completed Phase 6/service-run evidence generator or unused decomposition helper, with no current command consumer and no indexed script-path ownership |

The 12 delete candidates total 137,312 bytes.

## Keep and wire

- `scripts/frontend-unit-runner-args.test.mjs`
  - Tests `scripts/frontend-unit-runner-args.mjs`, which is imported by the active `scripts/run-frontend-unit-with-heap.mjs` launcher.
  - Focused command: `node --test scripts/frontend-unit-runner-args.test.mjs` → 2/2 PASS.
  - The test is useful but currently unwired. It should be added to a small root policy test command rather than deleted.

## Delete candidates

- `scripts/Assert-TestSuiteDecomposition.ps1`
  - No callsite remains; exact hash/count checklist mechanism belongs to completed decomposition work.
- `scripts/standardization/New-WeeklyMenuWorkbookCaseMatrix.ps1`
- `scripts/standardization/Start-Phase6Runtime.ps1`
- `scripts/standardization/Stop-Phase6Runtime.ps1`
- `scripts/standardization/weekly-menu-headed-e2e.mjs`
  - Completed Phase 6 workbook campaign; hard-coded August 2026 artifact/runtime/source-workbook contracts. Durable outputs are separately indexed.
- `scripts/standardization/current-week-bom-e2e.mjs`
- `scripts/standardization/full-project-lifecycle-e2e.mjs`
- `scripts/standardization/purchase-supplier-e2e.mjs`
- `scripts/standardization/service-run-lifecycle-e2e.mjs`
- `scripts/standardization/service-run-reports-e2e.mjs`
- `scripts/standardization/service-run-surfaces-e2e.mjs`
- `scripts/standardization/service-run-variance-waiver-e2e.mjs`
  - One-off headed mutation/readback generators for August 2026 lanes and fixtures. Result artifacts remain indexed in `docs/EVIDENCE-INDEX.md`; script paths themselves are not indexed or used by current runbooks, package scripts, CI or source contracts.

Nine of the twelve candidates contain mutation, cleanup or owned-process-stop terms. None was executed during audit.

## Why output evidence does not require keeping these executors active

The evidence index pins result artifacts, not these script paths. Current project policy treats historical evidence as immutable receipts; it does not require old mutation executors to remain in the active command surface. Re-running these scripts would target stale ports, lanes, dates and fixtures and is specifically unsafe without a new authorized campaign.

## Broader owner decisions

- `frontend/scripts/`: all seven files have active consumers; keep.
- `backend/tools/`: SDK project globbing owns compiled source; keep.
- `shipyard/`: provider hooks/profile files are convention-owned; keep unless Shipyard integration is explicitly retired.

## Evidence

Per-file hashes and dispositions: `wave-7-root-scripts-disposition.csv`.

## Next action

With explicit approval, delete exactly the 12 `DELETE_CANDIDATE` paths from the CSV and retain `scripts/frontend-unit-runner-args.test.mjs`. Then wire that regression into a bounded root policy gate, run it, run reference scan and `git diff --check`.
