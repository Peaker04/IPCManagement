# Active work

Status: G0 + G2 PASS (commit 065dbbcd trên cleanup/revert-sidebar-v2, ahead of origin 5)

Last closed: Commit 065dbbcd — `docs(IA): nested sidebar invariant + pattern (G2)`. 2 file canonical: `docs/DESIGN.md` (thêm N6, N7, N8 MUST) + `docs/UI-KIT.md` (thêm §4.E pattern, cập nhật §5 N count 5→8, thêm 4 NESTED-* vào §8). 37 insertions, 1 deletion.

G2 evidence: `D:\Temp\ipc-g2-verify-20261012-233922\`
- Worktree verify: lint:fe PASS (1 warning useMemo deps giống G0), build:fe PASS (23 chunks, 1.23s).
- Brainstorm (Bounded path) theo skill superpowers: 4 câu policy qua AskQuestion.
  - URL: `?view=` (giữ route cũ, không nested path, không alias).
  - Tab promotion: mỗi page > 1 tab thì lên sidebar (= 1 tab giữ primary link).
  - Tab bar trong trang: bỏ, sidebar leaf = navigation duy nhất (audit §5.2).
  - Deep link default: missing `?view=` → leaf đầu tiên (giữ behavior cũ, không redirect).

Plan còn lại G1, G3→G6:
- G1 Requirements: 5 câu policy vẫn chờ user (reconciliationRoles, capabilities semantics, page-tab classification, actor×mode×capability matrix, source-changes capability). Có thể làm song song với G3; không block.
- G3 UI System: trả lời 4 NESTED-* owner decisions trong UI-KIT §8 (NESTED-1 visibility model, NESTED-2 canonical breakpoint, NESTED-3 drawer z-index, NESTED-4 active-ancestor marker). Update token/S1-S4 trong UI-KIT §1, §12.
- G4 Implementation: 6 batch theo kế hoạch.
- G5 Verify: actor×mode×permission×sidebar scenario matrix.
- G6 Cutover: feature flag, rollback map, decision record.

Scope limits (không đổi): không push/deploy/seed/sửa backend policy/thay `.ipc-redesign-shell` (FE-03 chờ F6). Mỗi thay đổi UI bám canonical owner. Một concept một owner. Không lấy SidebarNavigationSpecimen làm authority.
