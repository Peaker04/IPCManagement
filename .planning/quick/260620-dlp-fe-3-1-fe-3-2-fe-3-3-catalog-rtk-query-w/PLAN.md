# Quick Task: FE-3.1/FE-3.2/FE-3.3 Catalog Integration

## Scope

- Verify current FE catalog integration against tracker rows FE-3.1, FE-3.2, and FE-3.3.
- Fill missing frontend API hooks for catalog-adjacent data without bypassing SDS/blockers.
- Keep Weekly Menu and Chef Dashboard on real catalog/BOM data.
- Update tracker/docs after verification.

## Gates

- GitNexus status before edits and before final.
- Stop if a required SDS/backend contract is missing for write behavior.
- Exclude `~$Project_Tracking v.xlsx` from commits.

## Verification

- `npm run build --workspace frontend`
- `npm run lint --workspace frontend`
- `git status --short --branch`
- `node .gitnexus/run.cjs status`
