# Active work

Status: G0 + G1 + G2 + G3-doc-only + G4-batch-B + G4-batch-C PASS (commit cca8acca trên cleanup/revert-sidebar-v2, ahead of origin 12)

Last closed: Commit cca8acca — `feat(fe): routeRegistry children + leaf identity (G4 batch C)`. 2 file: `frontend/src/routes/routeRegistry.ts` (41 insertions, 2 deletions) + `frontend/src/routes/routeRegistry.test.ts` (48 insertions, 4 test mới). 87 insertions, 2 deletions.

G4 batch C evidence (worktree verify `D:\Temp\ipc-g4c-verify-20261013-000559\`):
- tsc: PASS
- lint:fe PASS (1 warning giống G0)
- build:fe PASS (23 chunks, 1.40s)
- targeted routeRegistry.test.ts: 8/8 PASS (4 test cũ + 4 test mới)
- test:fe:unit: 19 file fail / 26 test fail (G0 baseline, 0 fail mới)

API mới:
- `NavChild = { id: string; label: string }`
- `RouteMetadata.children?: readonly NavChild[]`
- `ROUTE_TO_PAGE_TAB_GROUP: Partial<Record<RoutePath, PageTabGroupId>>` (explicit map 7 route)
- `getRouteLeafIds(path: RoutePath): readonly string[] | undefined`
- `RoutePath` type exported

7 route populated (30 leaf total):
WEEKLY_MENU (3), WAREHOUSE (4), APPROVALS (2), PURCHASING (3),
CHEF_DASHBOARD (2), REPORTS (9), ADMIN_DATA (7).

Note: CHEF_DASHBOARD.preferenceKey = 'chef-dashboard', pageTabGroups
id = 'chef' — dùng explicit map, không dùng preferenceKey.

Plan còn lại G4 (D/E/F) → G5 → G6:
- G4 batch D (nested shell): MainLayout/sidebar nested UI, áp NESTED-4 marker, thêm 2 token mới (`--ipc-nav-ancestor-bg/fg`) vào `index.css`.
- G4 batch E (page tab de-dup): 7 page owner tự migrate `?view=<leafId>`, 1 commit/page.
- G4 batch F (visual/perf/a11y): evidence cho G5.
- G5 Verify: actor×mode×permission×sidebar scenario matrix.
- G6 Cutover: feature flag, rollback map, decision record.

Scope limits (không đổi): không push/deploy/seed/sửa backend policy/thay `.ipc-redesign-shell` (FE-03 chờ F6). Mỗi thay đổi UI bám canonical owner. Một concept một owner. Không lấy SidebarNavigationSpecimen làm authority.
