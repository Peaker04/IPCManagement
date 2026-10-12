# Active work

Status: G0 + G1 + G2 + G3-doc-only + G4-batch-B + G4-batch-C + G4-batch-D PASS (commit eb029154 trên cleanup/revert-sidebar-v2, ahead of origin 14)

Last closed: Commit eb029154 — `feat(fe): nested sidebar minimal + NESTED-4 marker (G4 batch D)`. 4 file: `frontend/src/styles/index.css` (2 token), `frontend/src/styles/components/shell.css` (4 rule), `frontend/src/app/layout/MainLayout.tsx` (66 insertions, 17 deletions), `frontend/src/app/layout/MainLayout.ownership.test.tsx` (1 test mới). 115 insertions, 17 deletions.

G4 batch D evidence (worktree verify `D:\Temp\ipc-g4d-verify-20261013-001720\`):
- tsc: PASS
- lint:fe PASS (1 warning giống G0)
- build:fe PASS (23 chunks, 1.73s)
- targeted MainLayout.ownership.test.tsx: 8/8 PASS (7 cũ + 1 mới)
- targeted routeRegistry.test.ts: 8/8 PASS
- test:fe:unit: 19 file fail / 26 test fail (G0 baseline, 0 fail mới)

CSS contract (NESTED-4 RESOLVED):
- `--ipc-nav-ancestor-bg`: `var(--ipc-slate-50)`
- `--ipc-nav-ancestor-fg`: `var(--ipc-slate-900)`
- `[data-active-ancestor='true'].ipc-nav-link { bg/fg = token }`
- `.ipc-nav-leaf-link` (font-size 0.8125rem, slate-700, hover slate-100, is-active primary-soft)
- `.ipc-nav-group` (flex column wrapper)
- `.ipc-nav-leaf-list` (padding-left 24px)

MainLayout logic:
- `isAncestorOfCurrent(item)`: pathname.startsWith OR same preferenceKey, AND not isActive
- Top Link gets `data-active-ancestor="true"` + `is-ancestor` class
- Inline `<nav className="ipc-nav-leaf-list">` rendered below when ancestor && children
- Leaf Link: `to={item.path}?view={child.id}`, `aria-current="page"` when pathname match + currentView === child.id

Plan còn lại G4 (E/F) → G5 → G6:
- G4 batch E (page tab de-dup): 7 page owner tự migrate `?view=<leafId>`, 1 commit/page. Sau batch E, bỏ v1 API + `pageTabGroups` const.
- G4 batch F (visual/perf/a11y): evidence cho G5.
- G5 Verify: actor×mode×permission×sidebar scenario matrix.
- G6 Cutover: feature flag, rollback map, decision record.

Scope limits (không đổi): không push/deploy/seed/sửa backend policy/thay `.ipc-redesign-shell` (FE-03 chờ F6). Mỗi thay đổi UI bám canonical owner. Một concept một owner. Không lấy SidebarNavigationSpecimen làm authority.
