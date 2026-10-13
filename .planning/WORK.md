# Active work

Status: G0 + G1 + G2 + G3-doc-only + G4-batch-B + G4-batch-C + G4-batch-D + G4-batch-E-pilot + G4-batch-E-phase-2 PASS (5 commits trên cleanup/revert-sidebar-v2, ahead of origin 22). F phase = NEEDS_EVIDENCE.

Last closed: Commit 3517284b — `docs(WORK): record G4 batch E phase 2 PASS and 5 page migrations`. 1 file, 27 insertions, 29 deletions.

G4 batch E phase 2 evidence (5 commits, see `git log cleanup/revert-sidebar-v2 --oneline -7`):
- ca8e6c0c `refactor(fe): retire inline ViewSwitcher in ApprovalPage (G4 batch E phase 2)` — 2 files, 18 insertions, 34 deletions
- 84b69d2c `refactor(fe): retire inline ViewSwitcher in PurchasingPage (G4 batch E phase 2)` — 2 files, 13 insertions, 35 deletions
- 553fdf55 `refactor(fe): retire inline ViewSwitcher in ChefDashboardPage (G4 batch E phase 2)` — 1 file, 6 insertions, 31 deletions (2 ViewSwitcher blocks)
- f9276e8a `refactor(fe): retire inline ViewSwitcher in AdvancedDisplaySettingsPage (G4 batch E phase 2)` — 1 file, 3 insertions, 16 deletions
- 9b9c164d `refactor(fe): retire inline ViewSwitcher in ReconciliationWarehousePage (G4 batch E phase 2)` — 1 file, 2 insertions, 2 deletions

Aggregate verify (5 page migrations):
- tsc: PASS
- lint:fe: PASS (1 warning giong G0)
- build:fe: PASS
- Targeted tests: 33/33 passed across 3 file (ApprovalPage.state: 20, PurchasingPage.state: 11, ChefDashboardPage.select-label: 2)
- AdvancedDisplaySettingsPage + ReconciliationWarehousePage: no targeted test file; build pass sufficient

Page scope decision (mid-investigation):
- INCLUDED (5 page-level ViewSwitcher retired): approvals, purchasing, chef, admin/AdvancedDisplaySettings, warehouse/Reconciliation
- EXCLUDED (navigation sub-components, 2-level hierarchical nav — out of scope pilot): reports/ReportsNavigation, weekly-menu/WeeklyMenuNavigation
  - Rationale: these are reusable nav sub-components with own test contracts (`ReportsNavigation.businessGroups.test.tsx`, `WeeklyMenuNavigation.test.tsx`) asserting tab roles. Retiring them would require reframe of 2-level nav hierarchy, not just delete-JSX.
  - Decision recorded in conversation; future batch may scope them if sidebar v3 takes over 2-level nav.

Test refactor pattern (reused across 3 test files):
- `openHistory()` / `click tab` helpers → replaced with `renderXxxView()` using `<MemoryRouter initialEntries={['/route?view=...']}>`
- `getByRole('tab', { name: ... })` assertions → replaced with panel visibility checks (`document.getElementById('xxx-panel')?.hidden`, `queryByTestId`)
- ViewSwitcher-still-renders assertions → removed (ViewSwitcher retired)

Pattern learned for next migration: page-level ViewSwitcher is safe to retire; navigation sub-components require architectural decision first.

## F phase (visual / perf / a11y): NEEDS_EVIDENCE

Attempted evidence collection: `npm run test:visual:update` (10 routes × 2 viewports = 20 screenshots) + perf scripts.

Visual update outcome:
- 21 snapshot files updated (admin-data, dashboard, login, purchasing, reports, warehouse, weekly-menu both viewports)
- 9 of 20 visual tests FAILED with consistent pattern: `toHaveURL` mismatch — `Expected: /<route>` but `Received: /`. Page redirected to root after `page.goto(route.path)`.
- Failing routes: meal-orders, chef-dashboard, approvals, purchasing, reports (5/10 routes; both viewports for most)
- Pass routes: warehouse, weekly-menu, admin-data, dashboard, login (5/10)
- Pre-existing test infrastructure issue: NOT caused by batch E phase 2 (reproduced after discarding snapshot changes). Same redirect behavior in 5 routes regardless of ViewSwitcher changes.
- Root cause not investigated further (out of F phase scope): redirect likely from auth/role-guard flow, or batch D side effect on route protection.

Decision: DISCARDED all 21 snapshot updates and the 1 spec.ts edit (`stabilizeVisuals` purchasing branch). Working tree clean, only 5 batch E refactor commits remain on branch.

Perf scripts (`perf:load`, `perf:inp`, `perf:overflow`, `perf:dual-mode`) NOT executed: per [ENGINEERING.md] browser probes require "authorized isolated headed Chrome and actual server/profile inspection" + "Production probes/SQL authorization belongs to OPERATIONS". Session has no auth for that.

UI audit (`test:ui-audit`) NOT executed: same authorization boundary.

F phase evidence owner: requires separate lane 5 (Component/accessibility) + lane 7 (Operational/security/performance) authorization per [ENGINEERING.md] §"Seven risk-based verification lanes". Not pursued in current session.

Re-baseline of flaky test infrastructure also remains a separate NEEDS_EVIDENCE — see commit a526375a for tooling risk notes.
