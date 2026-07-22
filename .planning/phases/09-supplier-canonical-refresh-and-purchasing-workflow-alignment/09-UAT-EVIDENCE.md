# Phase 09 UAT Evidence

## Execution boundary

- `ImplementationCommit=630670b8513a4e0d12a45f401a816b985b18bd38`
- `LaneCommit=630670b8513a4e0d12a45f401a816b985b18bd38`
- Disposable target only: `ipc_lane1`, restored from `ipc_e2e_template`.
- Source workbook: `IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx`
- Source SHA-256: `4A91F9EA847068ABEB147EFF7ED7401B029D698F73E495641099DD9FA552BC88`
- Policy: `purchase-history-normalization/2026-07-22/v3`; as-of date: `2026-07-20`.
- `REAL_APPLY_NOT_EXECUTED`
- Reconciliation `ApplyCalled=false`; `ReconciliationWrites=0`.
- No real/shared database was reset, cloned, preview-applied, or mutated.

## Restored Shipyard rounds

Both rounds fetched the exact local implementation commit into lane 1 and proved source/lane HEAD equality before execution. Each restore reported:

```text
CLONE=ipc_e2e_template->ipc_lane1
TABLES=56
VERIFY=PASS
```

### Round 1

- `ROUND_1=PASS`
- E2E artifact: `../shipyard-lanes/lane1/.artifacts/e2e/20260723-014325161`
- Clone log: `../shipyard/logs/lane1/phase09-630670b-round1-clone.log`
- Deferred preview: `../shipyard/logs/lane1/phase09-630670b-round1-preview.json`

### Round 2

- `ROUND_2=PASS`
- E2E artifact: `../shipyard-lanes/lane1/.artifacts/e2e/20260723-014527069`
- Clone log: `../shipyard/logs/lane1/phase09-630670b-round2-clone.log`
- Deferred preview: `../shipyard/logs/lane1/phase09-630670b-round2-preview.json`

### Stable operational identities and counts

Both restored rounds produced the same values:

| Evidence | Stable value |
| --- | --- |
| Material request | `MR-DAV-20260618-FULLDAY` |
| Purchase request | `PR-20260618-FULLDAY` |
| Purchase order | `PO-PR-20260618-FULLDAY-2ad2ddea` |
| Inventory issue | `ISS-20260721-213029-982B` |
| Kitchen received at | `2026-07-21T14:30:30` |
| Report rows | purchase-demand 17; stock-movements 20; kitchen-issues 5; audit-changes 20 |

The happy-path log records approval, receipt, and issue retries as skipped/no-op where the completed entity already existed. The scoped real-stack Playwright result is `passed` with no failed tests in both rounds.

## Deferred blocker evidence

The preview was invoked read-only after each independent restore. Ordered blocker identities, manifest, database fingerprint, and action count all match between rounds:

- Manifest: `DA9187F53B3972C0588AD75364740387B02C35AD62E9083FE557529D0DFD5FE8`
- Database fingerprint: `5FBA836102CB8CE9421ED5289527EDE559EE3032F61EFDFDB88EFD15A1416BF9`
- Actions: `9441`
- Blockers: `408`

| Blocker code | Count |
| --- | ---: |
| `DATE_AFTER_AS_OF_WINDOW` | 28 |
| `DATE_INVALID` | 67 |
| `INGREDIENT_CATALOG_AMBIGUOUS` | 184 |
| `INGREDIENT_MISSING` | 23 |
| `INGREDIENT_SUPPLIER_AMBIGUOUS` | 4 |
| `UNIT_AMBIGUOUS` | 4 |
| `UNIT_UNKNOWN` | 98 |

These records remain blocked for later operator-led cleanup. Apply was not called because blockers remain.

## Regression contract

- Phase 09 backend filter: 191 passed, 0 failed.
- Full backend Release: 499 passed, 0 failed. The Debug command was not used as final evidence because a user-owned running API process locked the Debug executable.
- Frontend unit: 166 passed, 0 failed.
- Frontend smoke: 17 passed, 0 failed.
- Frontend UI audit: 8 passed, 0 failed.
- Frontend visual: 28 passed, 0 failed, including all eight Phase 09 snapshots at 1365x900, 1280x900, 768x1024, and 390x844.
- Frontend lint and production build: PASS.
- GitNexus staged test compensation: LOW, 7 test symbols, 0 affected execution flows.
- GitNexus Phase 09 compare to `main`: CRITICAL, 151 files and 48 flows; this is the accumulated phase scope and requires phase-level review, not evidence-only expansion.

## Protected SQL and operator checkpoint

- Protected path remains untracked: `backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql`.
- SHA-256 remains `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53`.
- Source porcelain for that path remains exactly `?? backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql`.
- Shipyard dashboard returned HTTP 200 at `http://127.0.0.1:8090/` during the rounds.

Operator acceptance of this document authorizes only completion of the disposable evidence checkpoint. Any future real apply requires a new explicit target-scoped request, fresh target fingerprint, and target-specific backup/restore proof.
