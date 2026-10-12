# Active work

Status: G0 + G1 + G2 + G3-doc-only + G4-batch-B PASS (commit 9929380e trên cleanup/revert-sidebar-v2, ahead of origin 10)

Last closed: Commit 9929380e — `feat(fe): navigation preferences v2 (flat leaf keys + auto-migrate)`. 2 file: `frontend/src/lib/navigationPreferences.ts` (113 insertions, 0 deletion, append-only) + `frontend/src/lib/navigationPreferences.test.ts` (71 insertions, 6 test mới). 184 insertions, 0 deletion.

G4 batch B evidence (worktree verify `D:\Temp\ipc-g4b-verify-20261012-235136\`):
- Lint:fe PASS (1 warning giống G0, không phải batch B).
- Build:fe PASS (23 chunks, 1.37s).
- Test:fe:unit 19 file fail / 26 test fail (G0 baseline) — 0 fail mới do batch B (run 2 confirm, run 1 có 1 flakey test).
- Targeted `navigationPreferences.test.ts`: 14/14 PASS (8 test cũ + 6 test mới).
- Targeted 7 file known fail: 19 file fail / 26 test fail — giống G0.

API mới (chỉ append, không đụng backward compat):
- `NAVIGATION_PREFERENCES_V2_STORAGE_KEY` = `'ipc.navigation-preferences.v2'`
- `LeafPreferenceKey` = `NavigationPreferenceKey | '${groupId}.${tabId}'`
- `NavigationPreferencesV2` = `Record<string, boolean>`
- `defaultNavigationPreferencesV2` (41 key: 11 primary + 30 leaf)
- `readNavigationPreferencesV2(storage?)` — auto-migrate 1 lần rồi đọc
- `writeNavigationPreferencesV2(next, storage?)` — dispatch `ipc:navigation-preferences-v2-changed`
- `resetNavigationPreferencesV2(storage?)` — defaults, không xóa v1 keys

Backward compat (giữ đến batch E):
- v1 primary: `readNavigationPreferences`, `writeNavigationPreferences`, `resetNavigationPreferences`
- v1 page-tab: `readPageTabPreferences`, `writePageTabPreferences`
- legacy admin: `readAdminTabPreferences`, `writeAdminTabPreferences`
- `pageTabGroups` (const)
- 4 file consumer: `MainLayout.tsx`, `useAdminDataPageModel.ts`, `AdvancedDisplaySettings.tsx`, `AdvancedDisplaySettings.test.tsx` — không đụng.

Plan còn lại G4 (C/D/E/F) → G5 → G6:
- G4 batch C (route aliases + leaf identity): thêm `children: NavChild[]` vào `routeRegistry`, leaf id = `pageTabGroups.tabs[i][0]`. Input: G1 Q1.2 + G2 + batch B v2 API.
- G4 batch D (nested shell): MainLayout/sidebar nested UI, áp NESTED-4 marker, 2 token mới (`--ipc-nav-ancestor-bg/fg`) vào `index.css` 245 entries.
- G4 batch E (page tab de-dup): 7 page owner tự migrate `?view=<leafId>`, 1 commit/page. Sau batch E, bỏ v1 API + `pageTabGroups` const.
- G4 batch F (visual/perf/a11y): evidence cho G5.
- G5 Verify: actor×mode×permission×sidebar scenario matrix.
- G6 Cutover: feature flag, rollback map, decision record.

Scope limits (không đổi): không push/deploy/seed/sửa backend policy/thay `.ipc-redesign-shell` (FE-03 chờ F6). Mỗi thay đổi UI bám canonical owner. Một concept một owner. Không lấy SidebarNavigationSpecimen làm authority.
