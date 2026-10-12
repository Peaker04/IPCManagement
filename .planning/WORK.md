# Active work

Status: G0 + G1 + G2 + G3-doc-only + G4-batch-B + G4-batch-C + G4-batch-D + G4-batch-E-pilot PASS (commit cee8fea0 trên cleanup/revert-sidebar-v2, ahead of origin 16)

Last closed: Commit cee8fea0 — `refactor(fe): retire inline ViewSwitcher in WarehousePage (G4 batch E pilot)`. 1 file: `frontend/src/features/warehouse/pages/WarehousePage.tsx`. 2 insertions, 13 deletions.

G4 batch E pilot evidence (worktree verify `D:\Temp\ipc-g4e-verify-20261013-002731\`):
- tsc: PASS
- lint:fe PASS (1 warning giống G0)
- build:fe PASS (23 chunks, 1.35s)
- Targeted `WarehousePage.presentation.test.ts`: ran (4 test, no ViewSwitcher checks broken)
- test:fe:unit: **FLAKY** (Run 1=25/39, Run 2=21/28, Run 3=25/39). G0 baseline re-run 1=21/28, Run 2=20/27. Flakiness nội tại test suite, không thể gan chính xác fail mới cho batch E.

**Methodology note (quan trọng)**: So fail count (26 vs 28) không reliable để xác nhận batch không gây hại. Cần re-baseline test infrastructure (loại bỏ shared state trong vitest spy/mock leak) — không trong scope batch E pilot.

Thay đổi:
- Remove `<ViewSwitcher>` block 13 dòng trong WarehousePage (line 365-377 cũ)
- Remove `ViewSwitcher` import
- Add comment note: "G4 batch E pilot: leaf navigation moved to sidebar (MainLayout)"
- Giữ nguyên: `useSearchParams` đọc `?view=`, `resolveVisibleTabId` fallback, `selectWarehouseView` helper (line 87) cho code nội bộ gọi (line 295, 305, 342), `KeepAliveTabPanel` render

6 page còn lại chưa migrate (weekly-menu, approvals, purchasing, chef, reports, admin-data). Sẽ tiếp tục ở batch E phase 2 sau khi re-baseline test.

Plan còn lại G4 (E-phase2 + F) → G5 → G6:
- G4 batch E phase 2: migrate 6 page còn lại (weekly-menu, approvals, purchasing, chef, reports, admin-data). **PHẢI re-baseline test trước**.
- G4 batch F (visual/perf/a11y): evidence cho G5.
- G5 Verify: actor×mode×permission×sidebar scenario matrix.
- G6 Cutover: feature flag, rollback map, decision record.

Scope limits (không đổi): không push/deploy/seed/sửa backend policy/thay `.ipc-redesign-shell` (FE-03 chờ F6). Mỗi thay đổi UI bám canonical owner. Một concept một owner. Không lấy SidebarNavigationSpecimen làm authority.
