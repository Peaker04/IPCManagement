---
quick_id: 260620-emx
status: complete
completed: "2026-06-20T10:45:00+07:00"
code_commit: 00c5baf
---

# Summary

Completed FE-4.4, FE-4.5, and FE-4.6 for the coordination workflow.

## Changes

- Added custom confirmation dialogs for the coordination lock and export actions.
- Kept the existing edit-request dialog behavior intact.
- Changed export from opening an authorized report URL in a new tab to fetching the report rows with the current bearer token and downloading a UTF-8 CSV file.
- Preserved the backend contract: `POST /api/coordination/orders/export` returns a `downloadUrl` for `/api/workflow-reports/order-export`.

## Verification

- `npm run build --workspace frontend` passed.
- `npm run lint --workspace frontend` passed.
- `npm run test:smoke --workspace frontend` passed 7/7.
- Focused Playwright interaction check passed: `/meal-orders` opens the `Chốt đơn ca này?` confirmation dialog.

## Notes

- FE-4.5 produces a CSV download from API report rows. The backend does not currently return a direct Excel/blob file from the export URL.
- Existing FE-4.3 Completed/signoff blocker remains separate because the signoff endpoint/state machine is still absent.
