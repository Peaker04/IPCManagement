# Active work

Status: G0 + G1 + G2 + G3-doc-only + G4-batch-B + G4-batch-C + G4-batch-D + G4-batch-E-pilot + G4-batch-E-phase-2 PASS (5 commits trên cleanup/revert-sidebar-v2, ahead of origin 22)

Last closed: Commit 9b9c164d — `refactor(fe): retire inline ViewSwitcher in ReconciliationWarehousePage (G4 batch E phase 2)`. 1 file, 2 insertions, 2 deletions.

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
