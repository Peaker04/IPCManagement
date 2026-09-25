# Wave 7.5 evidence-lineage preflight

Date: 2026-09-24
Verdict: `PREFLIGHT_PASS / RECONCILIATION_DECISIONS_REQUIRED`

## Why W7.5 precedes W7.4

Planning archival cannot safely remove or move `.planning` paths while the evidence index still contains missing directory references and mismatched hashes. Frontend docs and root artifacts have the same dependency. W7.5 therefore runs before W7.4 physical archival.

## Fresh denominator

A fresh parser scanned indexed paths under `.artifacts/`, `.planning/`, `artifacts/`, `tools/` and `frontend/docs/`, plus external paths.

- indexed references inspected: 336;
- existing hash mismatches: 33;
- missing references: 3;
- mismatches tracked by Git: 25;
- mismatches untracked/local: 8.

The earlier Wave 0 denominator of 21 mismatches omitted root `artifacts/` and `frontend/docs/` because its parser only included `.artifacts`, `.planning` and `tools`. W7.5 uses 33 as the corrected denominator; no evidence bytes or index hashes were changed.

## Mismatch owners

| Owner | Count | Initial disposition |
|---|---:|---|
| `.artifacts/` | 13 | inspect commit/index lineage; separate tracked durable evidence from untracked local attempts |
| `artifacts/` | 10 | root legacy evidence; blocks retiring the root |
| `tools/` | 7 | five reviewed SQL fixtures plus two Golden workbooks; compare Git history/builder provenance |
| `frontend/docs/` | 2 | historical performance report pair; blocks removing `frontend/docs/` |
| `.planning/` | 1 | historical closeout receipt; blocks archival of its owner phase |

## Missing references

All three are directory references rather than individual hash-pinned files:

- `.artifacts/information-simplification/f05-20260913-003/`
- `.artifacts/shipyard-live/material-reconciliation-full-e2e/runs/20260913-085032/`
- `.artifacts/shipyard-live/default-full-e2e/runs/20260913-170647/`

Each needs one decision: restore an immutable referenced manifest/file, replace the directory pointer with a surviving indexed file, or retire the stale pointer with documented supersession. Do not recreate empty directories merely to satisfy existence.

## Required reconciliation method

For each mismatch:

1. Compare current bytes with `HEAD`, relevant historical commits and any referenced builder/source artifact.
2. Determine whether current bytes are accidental drift, a later authoritative artifact, or a stale index entry.
3. Choose exactly one disposition:
   - `RESTORE_INDEXED_BYTES` — restore historical bytes from Git/object lineage;
   - `RESEAL_CURRENT_BYTES` — update index only after current artifact authority is independently proven;
   - `RETIRE_REFERENCE` — remove stale/superseded evidence pointer while preserving historical explanation;
   - `BLOCKED` — insufficient provenance.
4. Move paths only after their hash/reference disposition is closed.

## Safety boundary

No hash update, restore, artifact move, planning archive, database action, commit or push occurred during preflight.

## Evidence

Machine-readable current scan: `wave-7-evidence-lineage-preflight.json`.
