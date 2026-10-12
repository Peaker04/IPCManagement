# Active work

Status: G0 PASS (commit 5b583044 trên cleanup/revert-sidebar-v2, ahead of origin 3)

Last closed: Commit 5b583044 — `chore(fe): retire stale lint/depcruise baselines`. 2 file: `frontend/eslint.config.js` (thêm `tests/fixtures/specimens/**` vào globalIgnores) + `frontend/.dependency-cruiser-known-violations.json` (chốt lại 86-entry baseline). 1486 insertions, 2 deletions.

G0 evidence đầy đủ tại `D:\Temp\ipc-baseline-fix-verify-20261012-231847\summary.md` (G0.1–G0.7, log files, known-test-failures.json).

Kết quả G0.1–G0.7 trên HEAD `0a6d0c9a`:
- G0.1 git: OK
- G0.2 node/npm: OK (Node v24.13.0, npm 11.6.2)
- G0.3 `npm ci`: OK (554 packages, 21.7s)
- G0.4a `lint:fe`: 1 warning (ReconciliationSourceChangeLog useMemo deps), exit 0
- G0.4b `depcruise:fe`: 86 known ignored, exit 0
- G0.5 `build:fe`: 23 chunks, 1.66s, exit 0
- G0.6 `test:fe:unit`: **1665/1693 PASS, 26 fail (KNOWN), 2 skip, exit 1**
- G0.7 inventory: 11 primary links, 7 pageTabGroups

26 fail ở HEAD (chấp nhận known theo chốt user `test-handling: keep-known-fail`):
- 2 file (`colorBridge`, `vietnameseTypography`) từ commit 428f1770.
- 5 file khác (workflowApi.publicSurface, dataGrainUiContracts, operationalPagePerformanceContracts, modePageComposition, operationalTables) thuộc design system scope.
- Tất cả 7 file UNTRACKED trong working tree, không do commit A gây.
- Chi tiết: `D:\Temp\ipc-baseline-fix-verify-20261012-231847\known-test-failures.json`.

Phát hiện mới từ G0.7 source inventory:
- routeRegistry có 11 primary, flat, không nested. Đã có `reconciliationRoles` ở WEEKLY_MENU, WAREHOUSE, RECONCILIATION. RECONCILIATION có `reconciliationOnly: true`.
- pageTabGroups có 7 nhóm, 30 tabs. `reports` tab `price` label "Biến động giá" (audit §4 FE-01 nói test tìm chuỗi này trong primary nav — test sai, vì chỉ là tab con, source đúng).
- `reports.audit` và `admin-data.audit` cùng tên nhưng khác work object, đúng audit §5.2.

Plan còn lại G1→G6 (gate-by-gate, chờ user duyệt từng gate):
- G1 Requirements: 5 policy qua AskQuestion (reconciliationRoles, capabilities semantics, page-tab classification, actor×mode×capability matrix, source-changes capability).
- G2 IA/UX: chốt URL policy (`/warehouse/receiving` vs `?view=` vs alias), group/child list. Update `docs/DESIGN.md` N-series + `docs/UI-KIT.md` NestedNav variant.
- G3 UI System: NestedNav component spec, token, responsive, a11y, F6 global redesign authority.
- G4 Implementation: batch B (resolver) → C (route aliases + leaf identity) → D (nested shell) → E (page tab de-dup) → F (visual/perf/a11y).
- G5 Verify: actor×mode×permission×sidebar scenario matrix.
- G6 Cutover: feature flag, rollback map, decision record.

Scope limits (không đổi): không push/deploy/seed/sửa backend policy/thay `.ipc-redesign-shell` (FE-03 chờ F6). Mỗi thay đổi UI bám canonical owner. Một concept một owner. Không lấy SidebarNavigationSpecimen làm authority.
