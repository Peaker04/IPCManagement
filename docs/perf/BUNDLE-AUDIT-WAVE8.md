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

The manifest must be regenerated before comparing runs. A prior experiment left
stale dynamic API entries in `dist/.vite/manifest.json`; a clean `npm run build`
reduced the measured baseline to 240.16 KiB for Dashboard (from 242.86 KiB) and
similarly reduced every route. The clean baseline still fails all ten budgets,
but the stale-artifact component is now removed from the evidence.

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

## Disposition — preload consumer split experiment (2026-08-21)

An isolated experiment replaced `workflowApi` imports in `routeDataPreloaders.ts`
with domain API imports for Dashboard, Reports, Approvals, Purchasing, Warehouse,
and Approval Rules. Typecheck and production build passed, but the manifest gained
additional dynamic API chunks and every route grew by roughly 0.5 KiB gzip. The
experiment was reverted; no budget or threshold was changed.

This closes the experiment as **not an optimization**. The remaining work is a
shared-source reduction (or a proven route-budget accounting change) rather than
more preload import substitution. The carryover remains open until a manifest
graph identifies a removable shared consumer and the public/cache contracts pass.

## Shared chunk finding — `workflowCacheTags` is a misleading chunk boundary

Inspection of the clean emitted asset shows `workflowCacheTags-*.js` contains the
RTK Query/React-Redux runtime and the `apiSlice` base query/auth machinery; the
small tag object is only the final portion of that asset. Therefore deleting an
individual tag or renaming the chunk cannot materially reduce the 30 KiB gzip
payload. The next implementation wave must break the module boundary/cycle so
the base API runtime is not attributed to a tag-only shared chunk, then re-run
the route-budget script against a clean manifest.

## Boundary-2 measurement — domain consumer migration (2026-08-21)

Three runtime consumers were moved off the `workflowApi` barrel: Approval Rules,
`ServiceRunReportPanel`, and `useChefJournal`/`ServiceRunBlockerPanel`. The clean
build still fails the global gate, but the route-specific effect is measurable:
Approval Rules fell from about 256.40 KiB to **247.54 KiB**, and Coordination fell
from about 246.92 KiB to **237.75 KiB** in the latest manifest closure. This is a
real reduction without changing thresholds or cache identity. The shared `index`
chunk grew, so migration must continue until the remaining barrel consumers are
removed and the net route closure is verified.
