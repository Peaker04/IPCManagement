# Active work

Status: G0 + G1 + G2 + G3-doc-only PASS (commit d5d299ad trên cleanup/revert-sidebar-v2, ahead of origin 8)

Last closed: Commit d5d299ad — `docs(IA): resolve NESTED-1 + NESTED-4 (G3 doc-only)`. 1 file: `docs/UI-KIT.md`. 6 insertions, 4 deletions.

G3 evidence (doc-only, 2 NESTED resolved, 2 PENDING):
- NESTED-1 RESOLVED: `localStorage` key `ipc.navigation-preferences.v2`, schema `{ [leafId]: boolean }`, auto-migrate từ v1. Resolver thống nhất `readNavigationPreferences`. Source: `frontend/src/lib/navigationPreferences.ts` mở rộng ở G4 batch B.
- NESTED-2 PENDING: chờ F6 (redesign shell opt-in/global).
- NESTED-3 PENDING: chờ F6.
- NESTED-4 RESOLVED: 2 token mới `--ipc-nav-ancestor-bg` + `--ipc-nav-ancestor-fg` (UI-KIT §1 "Shell layout") + `data-active-ancestor="true"` trên group disclosure. Source: MainLayout/sidebar ở G4 batch D.

Worktree verify: `D:\Temp\ipc-g3-verify-20261012-234630\` (lint:fe PASS 1 warning giống G0, build:fe PASS 23 chunks 1.45s).

Plan còn lại G4→G6:
- G4 Implementation: 6 batch theo thứ tự.
  - Batch B (resolver): mở rộng `navigationPreferences.ts` thêm migration logic, thống nhất `readNavigationPreferences` cho leaf id. Input từ G1 Q1.2 (backend id = leaf id) + G3 NESTED-1.
  - Batch C (route aliases + leaf identity): thêm `children: NavChild[]` vào `routeRegistry`, leaf id = `pageTabGroups.tabs[i][0]`.
  - Batch D (nested shell): MainLayout/sidebar nested UI, áp NESTED-4 marker, token mới vào `index.css`.
  - Batch E (page tab de-dup): 7 page owner tự migrate, mỗi trang 1 commit.
  - Batch F (visual/perf/a11y): verify evidence.
- G5 Verify: actor×mode×permission×sidebar scenario matrix.
- G6 Cutover: feature flag, rollback map, decision record.

Scope limits (không đổi): không push/deploy/seed/sửa backend policy/thay `.ipc-redesign-shell` (FE-03 chờ F6). Mỗi thay đổi UI bám canonical owner. Một concept một owner. Không lấy SidebarNavigationSpecimen làm authority.
