# Bundle audit — Wave 8 carryover

## Evidence

`frontend/scripts/check-route-budgets.mjs` recursively sums each manifest entry,
its CSS and imports, then gzips the emitted files. The current production build
shows the same shared payload on every route:

| Shared asset | Approx. gzip |
|---|---:|
| `assets/index-*.js` | 140.47 KiB |
| `assets/workflowCacheTags-*.js` | 30.05 KiB |

The route-specific largest chunks are Weekly Menu 41.94 KiB, Reports/related
pages 19–31 KiB, Warehouse 21.68 KiB and Admin Data 21.44 KiB. This explains why
all ten route budgets fail together; the failure is not isolated to one page.

## Source closure

`workflowCacheTags` is imported by coordination, dish catalog, approvals, admin,
warehouse, chef, reports and dashboard API modules. `workflowApi.ts` is a public
barrel imported by many page components and also re-exports multiple feature API
surfaces. These are the first candidates for a safe split, but they are shared
contracts and must be changed with focused public-surface/cache-invalidation
regression tests.

## Next wave checklist

- [ ] Capture a manifest asset/import graph before edits.
- [ ] Split only one API surface at a time; preserve endpoint names and cache tags.
- [ ] Run public-surface and cache-contract tests after each split.
- [ ] Build and rerun `check:route-budgets`; never alter budgets to hide overage.
- [ ] Keep runtime probe/load evidence separate from bundle-budget evidence.
- [ ] Remove any superseded barrel or helper only after source-aware consumer proof.

