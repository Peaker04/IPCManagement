# Active work

Status: G0 + G1 + G2 PASS (commit e4a44112 trên cleanup/revert-sidebar-v2, ahead of origin 6)

Last closed: Commit e4a44112 — `docs(WORK): record G2 PASS and commit 065dbbcd`. 1 file: `.planning/WORK.md`. 16 insertions, 32 deletions.

G1 evidence (Requirements, 5 câu policy qua AskQuestion, 1 lượt):
- Q1.1 reconciliationRoles: **giữ nguyên** (commit A đã enforce trong `RoleGuard.tsx` + `routeRegistry.reconciliationRoles`).
- Q1.2 capabilities.navigation: **giữ backend id = leaf id** (khớp 1-1, không cần rename). Sau G2, 30 leaf id = `pageTabGroups.tabs[i][0]` (vd `receiving`, `demand`, `exceptions`).
- Q1.3 page-tab classification: **giữ rule G2** (page > 1 tab lên sidebar). Admin-data 7 tabs và reports 9 tabs còn lại nguyên, không tách group, không gộp tab `audit` (audit §5.2 đã nói khác work object).
- Q1.4 actor × mode × capability matrix: **server-authoritative** (ghi chú: source hiện tại là hybrid — backend capabilities + client `RoleGuard` permission check. Hiểu theo nghĩa: backend là source of truth, client `RoleGuard` chỉ là presentation filter, server vẫn enforce thật qua API. Nếu owner muốn bỏ `RoleGuard` thuần, cần xác nhận lại).
- Q1.5 MRX source-changes: **giữ view-only** (không cần capability riêng). `ReconciliationSourceChangeLog.tsx` là sub-feature của reconciliation, không route/permission gate thêm.

Hệ quả cho G4:
- Batch B (resolver): cần `eligibleCapabilityIds` + `eligiblePageTabs` từ `systemOperationEligibility.ts` (đã có). Resolver thêm 1 bước: backend capability id == leaf id thì mới render leaf.
- Batch C (route aliases + leaf identity): leaf id = `pageTabGroups.tabs[i][0]`. Không cần rename.
- Batch D (nested shell): giữ `RoleGuard` + thêm nested leaf route `?view=<leafId>`.
- Batch E (page tab de-dup): 7 page owner tự migrate.
- Batch F: visual/perf/a11y như kế hoạch.

Plan còn lại G3→G6:
- G3 UI System: trả lời 4 NESTED-* owner decisions trong UI-KIT §8. NESTED-2 (breakpoint) và NESTED-3 (drawer z-index) còn chờ F6 (redesign shell opt-in/global — chưa chốt) + backend decision về NESTED-1 (visibility model giữ client localStorage hay backend). Đề xuất: G3 doc-only cho NESTED-4 (active-ancestor token) + khẳng định NESTED-1 (giữ client localStorage đến khi backend sync yêu cầu).
- G4 Implementation: 6 batch theo thứ tự B → C → D → E → F.
- G5 Verify: actor×mode×permission×sidebar scenario matrix.
- G6 Cutover: feature flag, rollback map, decision record.

Scope limits (không đổi): không push/deploy/seed/sửa backend policy/thay `.ipc-redesign-shell` (FE-03 chờ F6). Mỗi thay đổi UI bám canonical owner. Một concept một owner. Không lấy SidebarNavigationSpecimen làm authority.
