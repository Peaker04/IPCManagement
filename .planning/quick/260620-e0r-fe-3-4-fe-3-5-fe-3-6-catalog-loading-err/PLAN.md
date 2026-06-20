# Quick Task: FE-3.4/FE-3.5/FE-3.6 Catalog States And Verification

## Scope

- FE-3.4: Add visible loading, error, and empty states around catalog API usage in Weekly Menu and Chef Dashboard.
- FE-3.5: Verify removal of `DEV_FALLBACK_DISHES` and `DEV_FALLBACK_RAW_MATERIALS`; do not remove unrelated dev-login fallback test/auth behavior.
- FE-3.6: Run frontend build, lint, and route smoke verification.
- Update GSD docs and `Project_Tracking v.xlsx` when done.

## Gates

- GitNexus status before and after code commits.
- Do not fake missing BE-3.2/BE-3.3 APIs.
- Ignore Excel lock files such as `~$Project_Tracking v.xlsx`.

## Verification

- `rg "DEV_FALLBACK_DISHES|DEV_FALLBACK_RAW_MATERIALS" frontend/src`
- `npm run build --workspace frontend`
- `npm run lint --workspace frontend`
- `npm run test:smoke --workspace frontend`
