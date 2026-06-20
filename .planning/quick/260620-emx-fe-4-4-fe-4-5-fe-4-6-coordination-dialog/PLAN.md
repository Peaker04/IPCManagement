---
quick_id: 260620-emx
status: in_progress
created: "2026-06-20T10:32:18+07:00"
description: FE-4.4 FE-4.5 FE-4.6 coordination dialogs validation empty state
---

# Plan

Implement the next coordination frontend slice from `Project_Tracking v.xlsx`.

## Scope

- FE-4.4: replace direct lock/export execution with local shadcn-style confirmation dialogs.
- FE-4.5: make the export button perform an authenticated report fetch and download a CSV file for the current shift.
- FE-4.6: run frontend build, lint, and smoke verification.

## Gates

- Do not fake backend signoff/completed behavior. Existing FE-4.3 blocker remains separate.
- Treat backend export capability as the current contract: `POST /api/coordination/orders/export` returns an authorized `downloadUrl` for `/api/workflow-reports/order-export`.
- If export cannot create an actual Excel file because the backend endpoint only returns rows, create a CSV client download and document the exact limitation.

## Verification

- `npm run build --workspace frontend`
- `npm run lint --workspace frontend`
- `npm run test:smoke --workspace frontend`
- `git status --short --branch`
- `node .gitnexus/run.cjs status`
