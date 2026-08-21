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

## Historical baseline and rejected barrel experiment (2026-08-21)

The route-budget thresholds were introduced at `e1beedd1`. A clean build of that
snapshot, using the same dependency install, emitted an entry of **97.00 KiB
gzip** and a separate `select` shared chunk of **39.67 KiB gzip**. The current
clean build emits an entry of about **141.5 KiB gzip**. CSS accounts for only
about 2 KiB of the increase; the material change is the shared JavaScript
closure.

The current entry source map contains Base UI popover/floating-ui modules,
`chefApi`, table-preference helpers and `ServiceRunBlockerPanel` that were not
in the historical entry. An experiment changed the Advanced Settings route from
the common barrel to direct component imports. It increased the entry to
**147.48 KiB gzip** and was reverted. Import-path substitution alone is not a
safe optimization for this graph.

### Decision

- Keep route-budget thresholds unchanged.
- Do not add `manualChunks` or create a second RTK Query slice merely to make the
  report pass; that would change the runtime/cache contract without proving a
  smaller route closure.
- The next implementation must isolate the shared UI/runtime seam itself (or
  use a verified dynamic reducer/endpoint registration seam), then compare a
  clean manifest and route closure. Accept a candidate only when the entry and
  affected route closures both decrease and public/cache tests remain green.

## Wave 9 result — auth timeout dialog split (2026-08-21)

`SessionTimeoutModal` was an eager `AppRouter` import even though it only becomes
useful after session expiry. Loading it through a `Suspense` boundary moves its
Base UI dialog/floating runtime to a separate emitted chunk. A clean build
reduced the shared entry from about **141.5 KiB** to **128.8 KiB gzip** and
reduced every measured route by roughly 12–13 KiB. Route budgets still fail,
which is expected: the remaining shared API/UI closure is larger than the
existing thresholds.

Wave 9 checklist:

- [x] No threshold or cache identity change.
- [x] Production build passes.
- [x] Lint, dependency-cruiser and workflow API boundary pass.
- [x] Route contract tests pass (3 files / 12 tests).
- [x] Full unit suite: `158 files / 891 tests` passed in 214.30s.
- [ ] Stage only the lazy-load hunk; `AppRouter.tsx` contains unrelated working-tree edits.

## Wave 10 experiments — rejected candidates (2026-08-21)

Two candidates were measured and reverted because route closure is the governing
metric, not entry size alone:

- Moving `MainLayout` refresh invalidation into a lazy module reduced the entry
  by about 2 KiB but increased measured route closure by about 0.6 KiB and did
  not reduce the shared `workflowCacheTags` payload.
- Replacing the eager auth pages' common barrel imports with direct component
  imports produced a smaller entry but introduced a larger shared `common`
  closure; route totals were worse. The common barrel remains a candidate only
  after its exports are split without creating a new shared route dependency.
- Dynamically importing `coordinationApi` inside coordination thunks did not
  change the entry closure because other eager consumers still retain the API
  runtime. It was reverted to avoid unnecessary async seams.

These candidates are **not optimizations**. Thresholds and cache identity remain
unchanged. The next candidate must remove a shared consumer from the complete
manifest closure, not merely move bytes between entry and shared chunks.

## Wave 10 accepted seam — lazy auth-only pages (2026-08-21)

`LoginPage` and `ForbiddenPage` were eagerly imported by `AppRouter`, although
neither is part of the normal protected operational entry. `LoginPage` also
used the common UI barrel, which made the protected entry retain unrelated
shared UI/API code. Both pages now load behind `Suspense`; the route registry
source contract was extended to resolve lazy page owners, preserving explicit
route ownership evidence.

Measured clean build:

- Entry: **98.22 KiB gzip** (down from 128.8 KiB after the timeout-dialog split).
- Dashboard route closure: **235.12 KiB gzip**.
- Coordination route closure: **238.11 KiB gzip**.
- Approval-rules route closure: **247.73 KiB gzip**.

Wave 10 checklist:

- [x] One RTK Query slice and cache identity preserved.
- [x] No route-budget threshold change.
- [x] Build, lint, dependency-cruiser and workflow API boundary pass.
- [x] Route ownership tests pass (`3 files / 12 tests`).
- [x] Full suite rerun after the source-registry parser change: `158 files / 891 tests` passed in 211.04s.
- [x] Lazy-auth changes staged separately from unrelated working-tree edits.

## Wave 11 accepted seam — remove unused ServiceRun barrel exports (2026-08-21)

`ServiceRunBlockerPanel` and `ServiceRunTrackPanel` had no runtime consumers
through `components/common/index.ts`; Warehouse and Purchasing already import
the leaf module directly. Removing the dead barrel edge keeps the shared API
surface honest without changing cache identity or route policy.

Measured clean build after the change:

- Entry: **98.25 KiB gzip**.
- `workflowCacheTags` chunk: **0.51 KiB gzip** (the RTK runtime no longer leaks into this named chunk).
- Dependency-cruiser: **432 modules / 1613 dependencies**, no violations.
- Representative route closures: dashboard **234.09**, weekly-menu **293.64**, reports **265.69**, coordination **237.05**, approval-rules **246.64 KiB gzip**.

The existing route budgets still report failures on several closures; this wave
does not alter those thresholds and records the remaining debt for the next
shared-boundary wave.

Wave 11 checklist:

- [x] Source-aware search found no barrel consumer before deletion.
- [x] Build, lint and dependency-cruiser pass.
- [x] Full unit suite: `158 files / 891 tests` passed.
- [x] No threshold, cache, or API-slice changes.
- [x] Atomic commit: `a2d0b8a`.

## Wave 12 accepted seam — remove unused SwimlaneProgress barrel export (2026-08-21)

Repository-wide source search found `SwimlaneProgress` only in its declaration;
there is no application consumer, direct or through the common barrel. The
component file remains untouched for safe future recovery, while the public
shared barrel no longer advertises an unconnected runtime surface.

Wave 12 gates:

- [x] Clean TypeScript/Vite build; entry remains **98.25 KiB gzip**.
- [x] ESLint pass.
- [x] Dependency-cruiser pass: **432 modules / 1612 dependencies**.
- [x] No route threshold or cache-policy change.
- [x] Atomic commit: `efc8cfe2`.
- [ ] Full unit rerun is reserved for the next grouped barrel wave; this export-only deletion is covered by compile/build and dependency closure gates.

## Wave 13 accepted seam — remove unconsumed page/stat exports (2026-08-21)

Source search showed `PageHeader`, `PageSection`, and `StatCard` only in their
own declarations and the barrel; no feature, route, or test imports them. The
three dead public exports were removed while their leaf files remain preserved.

Wave 13 gates:

- [x] TypeScript/Vite build pass; entry remains **98.25 KiB gzip**.
- [x] ESLint pass.
- [x] Dependency-cruiser pass: **432 modules / 1609 dependencies**.
- [x] No route-budget, cache, or API-slice changes.
- [x] Atomic commit: `78bff080`.

## Wave 14 accepted seam — remove dead table utility exports (2026-08-21)

`DataTableShell`, `Toolbar`, and `WorkQueue` were present only in their leaf
declarations/tests and the common barrel. No application runtime consumer
imports any of them, so their barrel exports were removed without deleting
the leaf files.

Wave 14 gates:

- [x] TypeScript/Vite build pass; entry remains **98.25 KiB gzip**.
- [x] ESLint pass.
- [x] Dependency-cruiser pass: **432 modules / 1606 dependencies**.
- [x] No route-budget, cache, or API-slice changes.
- [x] Atomic commit: `79e90fa2`.

## Wave 16 boundary cleanup — trim unused auth barrel hooks (2026-08-21)

The auth feature barrel exported `useRevokeTokenMutation` and
`useLogoutMutation`, but repository consumers use the underlying auth API
module directly for those lifecycle operations. They were removed from the
public feature barrel; the hooks and implementation remain intact.

Wave 16 checklist:

- [x] Source search confirmed no consumer of either barrel export.
- [x] Build, lint and dependency-cruiser pass (`432 modules / 1606 dependencies`).
- [x] Entry remains **98.25 KiB gzip**; no route/cache/API-slice policy changes.
- [x] Atomic commit: `73448125`.

## Wave 17 closure — remove unreferenced Chef feature barrel (2026-08-21)

Repository search found no import of `features/chef/index.ts`; Chef routes and
runtime modules use explicit leaf paths. The barrel contained only a page and
type re-export surface with no consumer, so it was deleted rather than kept as
an unconnected architectural promise.

Wave 17 checklist:

- [x] Targeted auth/route regression: **4 files / 22 tests passed**.
- [x] Build and lint pass.
- [x] Dependency-cruiser pass: **431 modules / 1604 dependencies**.
- [x] No route threshold, cache, or API-slice changes.
- [x] Atomic commit: `18c2972b`.

## Wave 18 closure — narrow coordination feature barrel (2026-08-21)

Only the `coordinationReducer` barrel export has repository consumers (store and
route guard tests). The wildcard re-exports of slice actions, API endpoints and
types were unused; those modules remain available through their canonical leaf
paths and the feature barrel now exposes only the reducer contract.

Wave 18 checklist:

- [x] Build, lint and dependency-cruiser pass (`431 modules / 1602 dependencies`).
- [x] Route guard regression: `1 file / 5 tests passed`.
- [x] Entry remains **98.25 KiB gzip**; no route/cache/API-slice policy changes.
- [x] Atomic commit: `acddf56a`.

## Wave 19 closure — full regression and boundary inventory (2026-08-21)

After the shared-barrel and feature-barrel reductions, the complete frontend
unit suite was rerun. Remaining feature barrels are now intentional contracts:
`auth` exposes selectors/login primitives used by shell/guards, and
`coordination` exposes only the reducer used by store/guards. Chef has no barrel
because all consumers use explicit leaf imports.

Wave 19 checklist:

- [x] Full unit suite: **158 files / 891 tests passed** in 251.06s.
- [x] Prior build, lint and dependency-cruiser gates remain green.
- [x] No unverified wildcard feature barrel remains in the audited scope.

## Wave 26 candidate audit — no independent eager feature seam (2026-08-21)

All top-level operational pages are already loaded through the route loader and
the router Suspense boundary. Remaining large modules are page-internal tabs
and sections that share the page's query/state model; splitting them would
introduce new loading states and duplicate orchestration rather than remove a
dead boundary. No independent eager feature seam met the acceptance criteria
for a controlled lazy move.

Wave 26 checklist:

- [x] Route-level lazy ownership verified.
- [x] Page-internal coupling classified before any code movement.
- [x] No speculative lazy import merged.
- [ ] Revisit only when a tab/section gets an explicit data and Suspense
  contract as part of a product feature change.

## Wave 27 audit summary — checklist and open debt (2026-08-21)

Completed cleanup waves removed unconsumed shared/API surfaces without changing
behavior: ServiceRun exports, SwimlaneProgress, PageHeader/PageSection/StatCard,
DataTableShell/Toolbar/WorkQueue, unused auth hook exports, the unused Chef
barrel, and coordination wildcard exports. Build, lint, dependency-cruiser and
full unit evidence were collected across the waves.

Open, explicitly bounded debt:

- Route closures still exceed unchanged budgets because the shared entry/common/
  apiSlice floor is approximately **173.8 KiB gzip**.
- `ConfirmDialog` remains synchronous until a controlled lazy wrapper provides
  fallback, focus, keyboard and leaf-test contracts.
- Page-internal tabs/sections remain coupled to their page query/state models;
  they are not dead code and must not be split for bytes alone.

Wave 27 checklist:

- [x] Every accepted change has an atomic code commit and evidence commit.
- [x] Every deferred candidate has a reason and reopening criteria.
- [x] Thresholds, cache identity and API-slice topology remained unchanged.
- [x] Full regression evidence: **158 files / 891 tests passed**.
- [ ] Route-budget debt requires a separate product/runtime architecture wave.

## Wave 28 architecture finding — API slice is a shell contract (2026-08-21)

`apiSlice` is not merely a feature endpoint bundle: `store.ts` owns its reducer
and middleware, while `MainLayout.tsx` dispatches its invalidation tags during
cross-route lifecycle transitions. Route preloaders also rely on the same cache
identity. Moving it behind route imports or creating per-route slices would
break the shared cache contract and duplicate middleware state.

Wave 28 checklist:

- [x] Store, shell invalidation and route-preloader ownership traced.
- [x] API-slice split rejected as an architectural violation, not a metric
  workaround.
- [x] No duplicate slice, threshold or cache-policy change.
- [ ] Any future reduction must preserve one reducer/middleware/cache identity
  while changing only the emitted loading boundary.

## Wave 29 handoff — current state and next-wave gates (2026-08-21)

Completed state is stable and verified: dead barrel/API surfaces are removed,
the full frontend suite is green, and all accepted changes are documented with
atomic commits. The remaining route-budget overages are architecture debt, not
an unverified cleanup failure.

Next wave must begin with these gates:

1. Preserve one `apiSlice` reducer, middleware and cache identity.
2. Preserve synchronous confirmation behavior until a tested lazy wrapper exists.
3. Measure manifest closure before and after every boundary change.
4. Run build, lint, dependency-cruiser and the full unit suite before closing.
5. Do not alter route thresholds to make a candidate pass.

Wave 29 checklist:

- [x] Completed/deferred/open work separated explicitly.
- [x] Reopening criteria and required gates recorded.
- [x] Handoff committed for the next architecture wave.

## Wave 30 hygiene gate — working tree boundary (2026-08-21)

`git diff --check` passes. The remaining dirty files are pre-existing,
unrelated application/report/UI work and were not staged or altered by the
cleanup waves. All wave commits are isolated to the documented boundary/code
changes and their evidence.

Wave 30 checklist:

- [x] No whitespace errors in the working tree diff.
- [x] No unrelated files staged by the wave sequence.
- [x] Existing user changes preserved.
- [ ] Architecture implementation remains a future scoped wave, not a cleanup
  commit hidden in this handoff.

## Wave 31 closure — delete proven-dead common leaf files (2026-08-21)

The previously removed barrel exports had no runtime consumers; this wave
completed the cleanup by deleting their leaf implementations and the
`DataTableShell` leaf test: `PageHeader`, `PageSection`, `StatCard`,
`DataTableShell`, `Toolbar`, `WorkQueue`, and `SwimlaneProgress`.

The presentation inventory baseline was updated from **54/51** owners/tables
to **53/50**; dialogs and switchers remain unchanged.

Wave 31 checklist:

- [x] Targeted inventory test: **5 tests passed**.
- [x] Full unit suite: **157 files / 888 tests passed**.
- [x] Build, lint and dependency-cruiser pass (`423 modules / 1587 dependencies`).
- [x] Unrelated working-tree edits preserved; corrected staging before commit.
- [x] Atomic commit: `ca3506be`.

## Wave 32 inventory — reports surface retained by explicit consumers (2026-08-21)

A source-aware scan of the reports feature found no additional dead leaf: the
legacy reconciliation panel, empty-row primitive, navigation, service-run
panel and report view-models all have explicit page or contract-test consumers.
They remain in scope and were not deleted merely because their names suggest
legacy behavior.

Wave 32 checklist:

- [x] Reports source inventory completed.
- [x] Consumer references verified for each candidate.
- [x] No unjustified deletion merged.
- [x] Existing full-suite baseline remains the acceptance gate.

## Wave 33 backend inventory — DI registrations are live contracts (2026-08-21)

Backend static search confirms the service/repository surface is explicitly
registered in `DependencyInjection.cs` (`AddScoped`, `AddSingleton`) and the
EF model uses assembly configuration discovery. A no-reference search cannot
classify these classes as dead because controllers, handlers and runtime DI
resolution are the consumers. No backend deletion was made without a runtime
registration/endpoint proof.

Wave 33 checklist:

- [x] DI registration boundary inspected.
- [x] Assembly-discovery risk recorded.
- [x] No speculative backend service deletion.
- [ ] Backend cleanup requires endpoint/DI integration evidence in a dedicated
  backend test wave.

## Wave 34 completion audit against the cleanup objective (2026-08-21)

| Objective requirement | Evidence | Status |
| --- | --- | --- |
| Work split into waves and closeout checklists | Waves 11–34 in this audit | Proven |
| Follow-on effects handled before closing | Inventory baseline updated; build/lint/depcruise/full unit rerun | Proven for accepted changes |
| Remove unused/dead code | Dead exports, Chef barrel, eight common leaf/test files removed | Proven for audited frontend scope |
| Preserve unrelated work | Atomic staging, corrected staging incident, hygiene gate | Proven |
| Do not hide failures by changing policy | Route thresholds/cache/API topology unchanged | Proven |
| Remove all dead code project-wide | Backend runtime/DI and remaining feature scopes lack exhaustive endpoint evidence | Not proven |

The cleanup objective is materially advanced but not globally complete: a
project-wide claim would require backend endpoint/DI integration coverage and
new product/runtime scope for the route-budget architecture debt.

## Wave 20 route-budget audit — boundary debt recorded (2026-08-21)

The unchanged route-budget gate was rerun against the current clean build. It
still fails on all ten measured routes; the largest overages are coordination
`+41.05 KiB`, approval `+37.54 KiB`, and dashboard `+35.09 KiB`. This is an
accurate remaining boundary-debt signal, not a threshold dispute, so no budget
or cache-policy adjustment was made.

Wave 20 checklist:

- [x] `check:route-budgets` executed against current artifacts.
- [x] Exact current route values and overages captured in command evidence.
- [x] No threshold, manualChunks, cache identity, or API-slice changes.
- [ ] Route closure reduction remains the next implementation wave; it requires
  per-route ownership analysis rather than further barrel-only cleanup.

## Wave 21 ownership analysis — shared floor identified (2026-08-21)

Manifest decomposition shows the dominant closure is shared, not a single
feature barrel:

- Entry `index-DdwtW-w5.js`: **95.0 KiB gzip** on every measured route.
- `common-CT-5WFXE.js`: **54.3 KiB gzip** on every route.
- `apiSlice-P-ROsRIJ.js`: **24.5 KiB gzip** on every route.

That shared floor is already about **173.8 KiB gzip** before a route's own page,
dialog, selector, or API chunks. Therefore dashboard/coordination/approval
budgets cannot be reached by more leaf-export deletion alone; the next wave
must analyze entry/runtime ownership and shared API loading boundaries. No
manual chunk or threshold change is justified by this evidence.

Wave 21 checklist:

- [x] Per-route manifest closure decomposed into top contributing assets.
- [x] Shared floor and route-specific ownership recorded.
- [x] No policy, threshold, or cache identity changes.
- [ ] Design a runtime-safe entry/API split with before/after closure evidence.

## Wave 22 boundary design — dialog/select shared pull-in (2026-08-21)

Source tracing shows the shared `dialog` chunk is pulled by `ConfirmDialog`,
which is exported by the common barrel and consumed across operational routes.
`select` is route-owned and appears in feature/page modules rather than the
common barrel. Therefore the next safe experiment is a lazy, route-owned
confirmation seam (or an explicit lightweight confirmation primitive), not a
global `manualChunks` rule or API-slice duplication. This wave records the
design boundary without speculative code movement.

Wave 22 checklist:

- [x] Dialog/select import ownership traced to concrete source files.
- [x] Shared versus route-owned pull-in distinguished.
- [x] No threshold, cache, or API policy change.
- [ ] Prototype confirmation seam and compare route closure plus interaction
  behavior before accepting a runtime split.

## Wave 23 experiment disposition — confirmation seam not accepted (2026-08-21)

`ConfirmDialog` has eight runtime consumers across admin, weekly-menu and
purchasing surfaces. Replacing the synchronous barrel export with a lazy
component would require a `Suspense` boundary at every consumer (including
non-route tests) and would alter confirmation timing/focus behavior. The
current app-level boundary cannot guarantee those leaf consumers are mounted
under Suspense, so the experiment is rejected without a controlled wrapper.

Wave 23 checklist:

- [x] Consumer count and route spread measured.
- [x] Interaction/focus and test boundary risk identified.
- [x] No speculative lazy change merged.
- [ ] If pursued later, introduce an explicit `LazyConfirmDialog` wrapper with
  its own fallback/focus tests before changing the shared contract.

## Wave 24 closure — controlled wrapper deferred (2026-08-21)

The confirmation seam is intentionally deferred. Current evidence does not
justify introducing a new wrapper solely to chase route bytes: eight consumers
would need coordinated fallback, focus restoration, keyboard and test
coverage. The shared synchronous contract remains the verified behavior.

Wave 24 checklist:

- [x] No speculative runtime/API change merged.
- [x] Deferral criteria recorded (fallback, focus, keyboard and leaf tests).
- [x] Route-budget thresholds and cache identity unchanged.
- [x] Next candidate must provide measurable closure reduction without a
  cross-route interaction contract rewrite.
- [x] No route-budget, cache, API-slice, or threshold changes.

## Wave 15 closure — full regression after barrel cleanup (2026-08-21)

The shared-barrel cleanup chain was rerun against the complete frontend unit
suite, not only compile-time checks.

- [x] Full unit suite: **158 files / 891 tests passed** in 250.02s.
- [x] Build, lint and dependency-cruiser remain green after the suite.
- [x] No changed route thresholds, cache identity, or API-slice topology.
- [x] Unrelated working-tree changes remain uncommitted and untouched.

## Wave 25 boundary matrix — no safe byte-only move yet (2026-08-21)

| Asset | Owner pattern | Decision |
| --- | --- | --- |
| `apiSlice` | MainLayout/store contract plus every endpoint family | Keep shared; splitting risks cache identity and invalidation behavior. |
| `common` | Cross-route UI primitives, including synchronous confirmation | Keep shared until an explicit lazy wrapper contract exists. |
| `select` | Feature/page consumers across several routes | Keep shared; duplicating it per route trades cache reuse for bytes. |

The next implementation candidate must be a route-level feature that is
currently eager and can be lazy-loaded under an existing Suspense boundary.
