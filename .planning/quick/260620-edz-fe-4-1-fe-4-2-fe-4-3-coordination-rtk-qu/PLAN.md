# Quick Task: FE-4.1/FE-4.2/FE-4.3 Coordination API Integration

## Scope

- FE-4.1: Move the Coordination screen's active order load/lock/export path to RTK Query hooks where backend APIs exist.
- FE-4.2: Add optimistic actual-serving updates after lock with rollback on API failure.
- FE-4.3: Show a real-time status banner for available API states.
- Stop instead of faking BE-4.3 signoff/Completed behavior because the backend endpoint/SDS is absent.
- Update `Project_Tracking v.xlsx` and GSD docs after verification.

## Gates

- GitNexus status before and after commits.
- Do not invent `/api/coordination/orders/{id}/signoff` or Completed state in FE.
- Exclude Excel lock files from tracked commits.

## Verification

- `npm run build --workspace frontend`
- `npm run lint --workspace frontend`
- `npm run test:smoke --workspace frontend`
