# Bàn giao: Requirements-to-Runtime Conformance Program

## Đọc trước
- Handoff ID: `2026-10-18-0300-requirements-runtime-complete`
- Thời điểm (múi giờ): `2026-10-18 03:00:00 +07:00` (`Asia/Ho_Chi_Minh` / SE Asia Standard Time)
- Phiên/agent giao: Pi native session, branch `feature/greenfield-fe-3zone-workbench`
- Mục tiêu: Toàn bộ 8 lát cắt chức năng của chương trình Requirements-to-Runtime Conformance Program (Foundation A, B và Slice 1 đến Slice 8) cùng bộ kiểm thử chấp nhận trình duyệt Phase 4 đã hoàn tất 100% tại các ranh giới static, contract, unit, build, và browser acceptance.
- Chế độ làm việc: Zero synthetic evidence; 100% C# Backend DTO truth; 100% existing UI Kit components (`docs/UI-KIT.md`); zero custom primitives; zero ad-hoc CSS.
- Điểm dừng: Toàn bộ 28 bài test conformance, 114 bài test unit, ZeroFakeApi guard, ESLint, Vite build và Depcruise đều PASS; git branch ahead origin 28 commits; working tree sạch.
- Blocker chính cần Owner cấp quyền tiếp theo: Khởi chạy môi trường staging tích hợp đa người dùng kết nối live ASP.NET Core API (`localhost:5262`) và cơ sở dữ liệu thật; bổ sung Backend endpoint `UnitsController` (để unblock `CAT.INGREDIENT.CREATE`) và `dish-cost report` (để unblock `weekly.cost`).

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu: Yêu cầu trực tiếp của Owner trong hội thoại; approved spec `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`; live state `.planning/WORK.md`.
- Tiêu chí hoàn thành: Toàn bộ 246 Backend HTTP actions được ánh xạ 1:1 sang các capabilities độc lập; toàn bộ các giá trị hardcode/data ảo bị xóa bỏ; 100% UI Kit có sẵn được sử dụng; bộ test tự động xanh hoàn toàn; không coi unit-green là production readiness cho đến khi có live staging runtime.
- Được làm: Direct native execution trên branch hiện tại; sửa Frontend và canonical contracts; giữ nguyên read-only đối với các write surfaces chưa đủ thẩm quyền.
- Không được làm: Fake API/data/success, merge `DEFAULT` với `MATERIAL_RECONCILIATION` (`DOM-MODE-1`), package install, destructive Git, push/deploy, seed/import, database mutation hoặc migration apply.

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | `D:/ki7/PRN222 Doanh Nghiệp/IPCManagement` |
| Branch / commit | `feature/greenfield-fe-3zone-workbench` / `65ea7da0` |
| Staged / unstaged / untracked | Không có; `git status` sạch (chỉ có file này `docs/handoff/HANDOFF.md`) |
| Build / bản đang chạy để kiểm thử | Production Frontend build PASS (`dist/index.html` built in 768ms, zero type errors) |
| Môi trường, runtime | Pi; Node/.NET toolchain hiện hữu; không cài package mới |
| Dữ liệu thử, migration liên quan | Chỉ fixtures bám sát C# DTOs 100%; không seed/import/migration/database mutation |
| MCP / skill / cấu hình cần có | Project skills trong `.pi/skills/`; `context-handoff` ở `.agents/skills/context-handoff/` |

## 3. Tiến độ Toàn Chương Trình (8 Slices + Phase 4)

| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| FOUNDATION-A | Requirements & Conformance Inventory | DONE_VERIFIED | `docs/conformance-contracts.json`, checker 28/28 PASS | Live multi-user staging |
| FOUNDATION-B | Shared Workbench Skeleton & ActionGuard | DONE_VERIFIED | `WorkbenchSkeleton.tsx`, `workbenchSurfaceRegistry.ts`, ActionGuard | Staging live matrix |
| AUTH-SYSTEM | Slice 1: Auth & System Operation Mode | DONE_VERIFIED | Bỏ sample credentials, ETag versioned PUT mode, 409 conflict recovery | Live cookie rotation |
| CATALOG-ADMIN | Slice 2: Catalog & Admin | DONE_VERIFIED | Bỏ `categoryName` giả, server pagination, khóa `CAT.INGREDIENT.CREATE` | Cần Backend `UnitsController` |
| MENU-COORD | Slice 3: Weekly Menu & Coordination | DONE_VERIFIED | Bỏ giá cứng `25k`, bỏ category giả, thêm refresh đơn ăn | Cần Backend dish-cost |
| PUR-APPR | Slice 4: Purchasing & Approvals | DONE_VERIFIED | Bỏ `(35 đối tác)` cứng, bắt buộc lý do từ chối duyệt | Cần approved PR workflow |
| WAREHOUSE | Slice 5: Warehouse & Inventory | DONE_VERIFIED | Sửa `isEmpty={false}`, từ chối bịa tồn kho từ phép tính 0 | Cần live stock snapshot |
| CHEF | Slice 6: Chef Production Handover | DONE_VERIFIED | Xác thực 25 capabilities ca bếp, empty state chuẩn | Live handover signing |
| RECON | Slice 7: Material Reconciliation (MRX) | DONE_VERIFIED | `DOM-MODE-1` mode isolation, `RECON.BATCH.COMPLETE` action guard | Cần MRX staging batch |
| REP-DASH | Slice 8: Reports & Dashboard | DONE_VERIFIED | Bỏ ngày tĩnh, bổ sung reload/retry báo cáo, tách data quality | Staging report data |
| PHASE-4-BROWSER | Phase 4: Runtime Browser & Popstate | DONE_VERIFIED | `conformance-runtime.spec.ts`, `DirtyNavigation.tsx` popstate listener | Chạy headed Playwright khi được cấp quyền |

## 4. Quyết định và Bất biến đã chốt

| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| D-01 | `.planning/WORK.md` là live task-state SSOT duy nhất | đã chốt | `AGENTS.md` | Owner/governance |
| D-02 | `DEFAULT != MATERIAL_RECONCILIATION` | đã chốt | `DOM-MODE-1`, approved design | Owner |
| D-03 | Fail closed khi thiếu Backend/data authority | đã chốt | Approved design | Owner |
| D-04 | Mỗi Backend HTTP action map đúng một operation-grain capability | đã chốt | Conformance checker (28/28 PASS) | Owner |
| D-05 | 100% tái sử dụng UI Kit có sẵn (`docs/UI-KIT.md`) | đã chốt | `AGENTS.md`, user instruction | Owner |
| D-06 | Zero Fake API Data & Anti-Tautology Gate (Rule TA-1 đến TA-5) | đã chốt | `ZeroFakeApiAndTestAuditGuard.test.ts` PASS | Owner |
| D-07 | Chặn lùi trang trình duyệt (`popstate`) khi có draft bẩn | đã chốt | `DirtyNavigation.tsx` + `Primitives.test.tsx` PASS | Owner |

## 5. Kết quả Kiểm thử Tổng thể
- **Conformance Tests**: `npm run test:conformance-contracts` PASS 28/28 tests.
- **Conformance Check**: `npm run check:conformance-contracts` PASS.
- **Frontend Unit Tests**: `npm run test:fe:unit` PASS 17 files / 114 tests.
- **Zero Fake API Guard**: `ZeroFakeApiAndTestAuditGuard.test.ts` PASS 2/2 tests.
- **ESLint**: `npm run lint:fe` PASS (0 warnings, 0 errors).
- **Production Build**: `npm run build:fe` PASS (0 errors, build in 768ms).
- **Dependency Cruiser**: `npm run depcruise:fe` PASS (68 modules, 260 dependencies, 0 violations).
- **Git Diff Check**: `git diff --check` PASS (clean).

## 6. Bước tiếp theo đề xuất cho phiên mới
1. **Chạy Playwright Browser Test**: Chạy `npx playwright test tests/browser/conformance-runtime.spec.ts` trên Chromium có sẵn khi được cấp quyền mở cổng dev server.
2. **Bổ sung Backend Gaps**: Viết `UnitsController` (GET `/api/units`) ở Backend để mở form tạo nguyên liệu `CAT.INGREDIENT.CREATE`.
3. **Mở Write Surfaces**: Kích hoạt tạo PO từ PR đã duyệt và các workflow chốt sổ khi Backend đã sẵn sàng cơ sở dữ liệu thật.
