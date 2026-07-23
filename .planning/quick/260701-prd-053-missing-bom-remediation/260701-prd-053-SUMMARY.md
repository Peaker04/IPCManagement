# PRD-053 Missing BOM Remediation Summary

## Completed

- Data-quality `missing_bom` issues now route to `/admin-data?view=adjustments&remediate=missing_bom&dishId=...&serviceDate=...&scope=...`.
- Missing BOM checks now respect the report service-date context.
- Admin Data can initialize the BOM editor from query params and can switch in-page from cleanup issues to the affected dish.
- Admin Data shows missing-BOM remediation context and a `Chạy lại demand` action beside the BOM form.
- Re-run demand uses the remediation `serviceDate`, optional `customerId`, and `scope` from the link.
- Regression coverage asserts that missing-BOM data-quality issues include actionable remediation route context.

## Verification

- Targeted backend workflow tests: 18 passed.
- Full backend tests: 86 passed, 1 skipped.
- Backend build: passed with 0 warnings.
- Frontend lint: passed.
- Frontend production build: passed.
- Frontend smoke: 7 passed.
- GitNexus analyze: refreshed to 4,697 nodes, 11,985 edges, 154 clusters, 300 flows.
