# Bàn giao: Project-wide Loading UX, Surface Matrix & Visual Remediation Conformance

## Đọc trước
- Handoff ID: `2026-10-18-1900-loading-ux-and-matrix-conformance`
- Thời điểm (múi giờ): `2026-10-18 19:00:00 +07:00` (`Asia/Ho_Chi_Minh` / SE Asia Standard Time)
- Phiên/agent giao: Pi native session, branch `feature/greenfield-fe-3zone-workbench`
- Mục tiêu: Hoàn tất 100% chương trình kiểm toán tải dữ liệu bất đồng bộ (Loading UX & Async State Consistency Audit), xử lý triệt để 15 phát hiện từ ảnh chụp thực tế trên clipboard của User, xóa bỏ hiện tượng Skeleton Layout Shift (CLS), thiết lập động cơ Scoped Query Engine không phụ thuộc thư viện thứ ba (`frontend/src/lib/scopedQuery.ts`), kết nối số liệu thật từ MySQL cho Dashboard (4 tasks + 4-stage stepper), chuẩn hóa toàn bộ enum ca tiếng Việt, và kiểm chứng thành công 69/69 Playwright browser tests trên Chromium thật kết nối Live Kestrel API và MySQL.
- Chế độ làm việc: Zero synthetic evidence; 100% C# Backend DTO truth; 100% existing UI Kit components (`docs/UI-KIT.md`); zero inline styles; 100% CSS token purity (`var(--...)`).
- Điểm dừng: 69/69 tests Playwright chạy trên Chromium thật PASS, 121/121 tests unit Vitest PASS (18 files), 28/28 tests conformance checks PASS, ZeroFakeApi guard PASS, ESLint PASS (0 errors, 0 warnings, React 19 purity), Vite production build PASS (built in 592ms, 0 type errors), Depcruise PASS (68 modules, 261 dependencies); git branch ahead origin 44 commits; working tree sạch 100%.
- Việc đầu tiên tiếp theo: Chọn 1 trong các hướng đi: (1) Bổ sung Backend endpoints còn thiếu (`UnitsController` để mở khóa tạo nguyên liệu và `dish-cost report` để hoàn thiện food cost), hoặc (2) Tiến hành kiểm thử tải đồng thời nhiều người dùng (Live Multi-user Load Testing), hoặc (3) Chuẩn bị tích hợp/PR vào nhánh chính.
- Blocker chính: Backend C# hiện chưa có `UnitsController` (nên `CAT.INGREDIENT.CREATE` khóa an toàn `BLOCKED`), chưa có `dish-cost report` (nên `weekly.cost` mang trạng thái `BACKEND_CAPABILITY_GAP`).

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu: Yêu cầu trực tiếp của Owner trong hội thoại; 15 ảnh chụp màn hình kiểm tra lỗi trực quan (`D:\Temp\pi-clipboard-*.png`); live state `.planning/WORK.md`; tài liệu đặc tả `docs/superpowers/specs/2026-10-18-catering-ui-standardization-design.md` và kế hoạch `docs/superpowers/plans/2026-10-18-catering-ui-standardization-plan.md`.
- Tiêu chí hoàn thành: Toàn bộ 14 routes và 25 screens được kiểm kê đầy đủ; hiện tượng Skeleton giật khung hình và rò rỉ mã enum tiếng Anh được giải quyết triệt để; Dashboard hiển thị 4 nhiệm vụ thực tế và tiến độ 4 công đoạn; toàn bộ bộ test tự động xanh hoàn toàn trên Chromium thật kết nối live ASP.NET Core API (port 5262) và MySQL (port 3306).
- Được làm: Direct native execution trên branch hiện tại; sửa Frontend và canonical contracts; giữ nguyên read-only đối với các write surfaces chưa đủ thẩm quyền backend.
- Không được làm: Fake API/data/success, merge `DEFAULT` với `MATERIAL_RECONCILIATION` (`DOM-MODE-1`), package install tùy tiện, destructive Git, push/deploy khi chưa có lệnh, seed/import trái phép, database schema mutation ngoài luồng.
- Người có quyền đổi phạm vi: Owner/user hiện tại.

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | `D:/ki7/PRN222 Doanh Nghiệp/IPCManagement` |
| Branch / commit | `feature/greenfield-fe-3zone-workbench` / `335c4cff` |
| Staged / unstaged / untracked | Không có; `git status` sạch 100% (đã commit đầy đủ) |
| Thay đổi agent nhận chưa thấy được | 44 commits local ahead origin chưa push |
| Build / bản đang chạy để kiểm thử | Production Frontend build PASS (`dist/index.html` built in 592ms, 0 type errors) |
| Môi trường, runtime | Pi; Node 24.13.0, .NET 9.0, MySQL 8.0.36, Playwright 1.60.0 on Chromium |
| Dữ liệu thử, migration liên quan | Database MySQL thật chứa 756 nguyên liệu, 195 món ăn, 35 nhà cung cấp, 8 đơn PO, 17 hồ sơ duyệt, 2 kho vận hành |
| Tiến trình đang chạy | Backend .NET Kestrel tại `http://127.0.0.1:5262` (PID 16664), Frontend Vite tại `http://127.0.0.1:5173` (PID 1632), MySQL port 3306 (PID 8876) |
| MCP / skill / cấu hình cần có | Project skills trong `.pi/skills/`; `context-handoff` ở `.agents/skills/context-handoff/`; `pi-subagents@0.79.1` đã nâng cấp |

## 3. Tiến độ Toàn Chương Trình (Slices 1–8 + Browser Phase 4 + UI Remediation + Loading UX)

| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| FOUNDATION-A | Requirements & Conformance Inventory | DONE_VERIFIED | `docs/conformance-contracts.json`, checker 28/28 PASS | Multi-user load testing |
| FOUNDATION-B | Shared Workbench Skeleton & ActionGuard | DONE_VERIFIED | `WorkbenchSkeleton.tsx`, `workbenchSurfaceRegistry.ts`, ActionGuard | Multi-user concurrency |
| SLICE-1-AUTH | Slice 1: Auth & System Operation Mode | DONE_VERIFIED | ETag versioned PUT mode, 409 conflict recovery, 403 Forbidden | Live cookie rotation testing |
| SLICE-2-CAT | Slice 2: Catalog & Admin | DONE_VERIFIED | Server pagination (756 ings / 195 dishes), ĐVT kg, khóa an toàn create | Cần Backend `UnitsController` |
| SLICE-3-MENU | Slice 3: Weekly Menu & Coordination | DONE_VERIFIED | Ma trận 7 ngày đầy đủ món (tuần 21/09/2026), dịch enum ca sang tiếng Việt | Cần Backend dish-cost |
| SLICE-4-PUR | Slice 4: Purchasing & Approvals | DONE_VERIFIED | Lưới Master PO có cột Badge trạng thái, Rule D7 single primary, SLA format | Cần approved PR workflow |
| SLICE-5-WH | Slice 5: Warehouse & Inventory | DONE_VERIFIED | Badge "Kho đang hoạt động" không vỡ dòng, CTA thoát hiểm cho tồn kho rỗng | Cần live stock snapshot |
| SLICE-6-CHEF | Slice 6: Chef Production Handover | DONE_VERIFIED | Dịch enum ca sáng/chiều, phân trang phiếu xuất, xác nhận Bếp nhận | Live handover signing |
| SLICE-7-RECON | Slice 7: Material Reconciliation (MRX) | DONE_VERIFIED | `DOM-MODE-1` mode isolation, thông báo Chế độ MRX chuẩn mực cho Admin | Cần MRX staging batch |
| SLICE-8-REP | Slice 8: Reports & Dashboard | DONE_VERIFIED | Dashboard 4 tasks thật từ KPI + 4-stage stepper, báo cáo phân trang 25 mục | Staging report data |
| LOADING-UX-ENGINE | Scoped Query Engine & Zero-FOUC | DONE_VERIFIED | `frontend/src/lib/scopedQuery.ts` (React 19 `useSyncExternalStore`), `ScopedQuery.test.ts` (5/5 PASS) | None |
| VISUAL-REMEDIATION | Khắc phục 15 lỗi trực quan từ ảnh chụp live | DONE_VERIFIED | Đã sửa dải chỉ số, cột Quy mô, nhãn enum ca, layout shift skeleton, non-destructive error | 26 ảnh PNG lưu tại `test-results/matrix-screens/` |
| PLAYWRIGHT-SUITE | 69 Playwright Tests on Chromium | DONE_VERIFIED | Chạy 69/69 tests PASS trong 1.9 phút kết nối Live Backend & MySQL | None |

## 4. Quyết định và Giả thuyết

| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| D-01 | `.planning/WORK.md` là live task-state SSOT duy nhất | đã chốt | `AGENTS.md` | Owner/governance |
| D-02 | `DEFAULT != MATERIAL_RECONCILIATION` | đã chốt | `DOM-MODE-1`, approved design | Owner |
| D-03 | Fail closed khi thiếu Backend/data authority | đã chốt | Approved design | Owner |
| D-04 | 100% tái sử dụng UI Kit có sẵn (`docs/UI-KIT.md`) | đã chốt | `AGENTS.md`, user instruction | Owner |
| D-05 | Zero Fake API Data & Anti-Tautology Gate (Rule TA-1 đến TA-5) | đã chốt | `ZeroFakeApiAndTestAuditGuard.test.ts` PASS | Owner |
| D-06 | Triệt tiêu Skeleton Layout Shift: bỏ `p-4`, 12 dòng, header 40px, toolbar 44px | đã chốt | `WorkbenchSkeleton.tsx` + `loading-ux-async-consistency.spec.ts` PASS | Chuyên gia FE / Owner |
| D-07 | Sinh 4 nhiệm vụ ưu tiên và 4 công đoạn từ live KPIs thay vì hardcode mảng rỗng | đã chốt | `dashboardApi.ts` + `matrix-full-coverage-audit.spec.ts` PASS | Chuyên gia BA / Owner |
| D-08 | Dịch 100% enum ca `MORNING/AFTERNOON` thành `Ca 1 (Sáng)` / `Ca 2 (Chiều)` | đã chốt | `ProductionPlanView.tsx`, `MealOrdersPage.tsx`, `ChefDashboardPage.tsx` | Chuyên gia BA / Owner |
| D-09 | Non-destructive error handling: giữ nguyên dữ liệu hợp lệ khi refresh gặp lỗi mạng | đã chốt | `StateBoundary.tsx` + `loading-ux-async-consistency.spec.ts` PASS | Chuyên gia FE / Owner |
| D-10 | Phân vùng cache engine theo `${mode}#${role}#${scope}#${key}` | đã chốt | `scopedQuery.ts` + `ScopedQuery.test.ts` PASS | Lead Architect / Owner |

## 5. Đã thử nhưng không thành công

| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| Dùng `pi-subagents@0.75.0` chạy background children trên `pi-coding-agent@1.3.0` | Báo lỗi thiếu `@earendil-works/chord` do regex nhận diện phiên bản sai | Terminal log | Đã nâng cấp lên `pi-subagents@0.79.1` và tạo package alias, subagents hoạt động 100% |
| Đặt `min-w-[800px]` cho DataGrid trong panel Master 606px | Bảng bị tràn ngang, cột trạng thái bị đẩy mất khỏi màn hình | Ảnh chụp thực tế của User | Đã hạ min-width bảng xuống 550px–580px và giảm cell padding xuống `px-3` |
| Gọi `setData(null)` trong handler khi đổi bộ lọc tuần/khách hàng | Gây sụp đổ giao diện, nhấp nháy skeleton thô bạo (CLS > 0.25) | Ảnh chụp thực tế của User | Đã loại bỏ `setData(null)`, áp dụng `keepPreviousData` giữ bảng cũ mờ nhẹ |

## 6. Kiểm thử
- Tầng / vòng hiện tại: Full static, contract, unit, build, and live browser Playwright on Desktop Chromium.
- Test plans: `docs/superpowers/plans/2026-10-18-catering-ui-standardization-plan.md`.
- Kết quả thuộc commit: `335c4cff`.
- Kết quả không cũ vì: Vừa được chạy lại hoàn tất 100% trên server Kestrel và MySQL đang chạy.

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---|---|---|
| CONF-TESTS | `npm run test:conformance-contracts` | 1 | PASS 28/28 | Terminal output |
| CONF-CHECK | `npm run check:conformance-contracts` | 1 | PASS | Terminal output |
| FE-UNIT | `npm run test:fe:unit` | 1 | PASS 18 files / 121 tests | Terminal output |
| ZERO-FAKE | Focused `ZeroFakeApiAndTestAuditGuard.test.ts` | 1 | PASS 2/2 | Terminal output |
| SCOPED-QUERY | Focused `ScopedQuery.test.ts` | 1 | PASS 5/5 | Terminal output |
| FE-LINT | `npm run lint:fe` | 1 | PASS (0 errors, 0 warnings) | Terminal output |
| FE-BUILD | `npm run build:fe` | 1 | PASS (built in 592ms, 0 type errors) | Terminal output |
| FE-DEPS | `npm run depcruise:fe` | 1 | PASS (68 modules, 261 dependencies) | Terminal output |
| PW-ALL | `cd frontend && npx playwright test` | 1 | PASS 69/69 tests on Chromium | Terminal output (1.8m) |
| MATRIX-SCREENS | Screenshots chụp thực tế 25 màn hình | 1 | 26 ảnh PNG trong `frontend/test-results/matrix-screens/` | File artifacts tồn tại |

## 7. Nguồn cần đọc
| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---|---|---|---|
| 1 | `AGENTS.md` | Quy chuẩn quản trị 5 tầng, các điều cấm Hard Invariants | đã kiểm tra |
| 2 | `.planning/WORK.md` | Single Source of Truth cho trạng thái công việc (đã cập nhật GF-R43) | đã kiểm tra |
| 3 | `.planning/audit/loading-ux-async-consistency-audit.md` | Báo cáo kiểm toán Loading UX và ma trận 14 routes x 9 tương tác | đã kiểm tra |
| 4 | `.planning/audit/requirements-traceability.md` | Ma trận truy vết 54 yêu cầu chuẩn mực | đã kiểm tra |
| 5 | `.planning/audit/route-screen-coverage.md` | Kiểm kê 14 canonical routes và 25 screens/subviews | đã kiểm tra |
| 6 | `.planning/audit/defect-register.md` | Sổ theo dõi 18 khuyết tật (17 đã xử lý, 1 Backend gap) | đã kiểm tra |
| 7 | `frontend/src/lib/scopedQuery.ts` | Động cơ Scoped Query & Mutation Engine React 19 | đã kiểm tra |

## 8. Bước tiếp theo
| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---|---|---|---|
| P0 | Bổ sung `UnitsController` (GET `/api/units`) trong Backend C# | Được Owner phê duyệt quyền sửa Backend C# | Trả về `UnitDto[]` hợp lệ để mở khóa `CAT.INGREDIENT.CREATE` từ BLOCKED sang READY |
| P1 | Bổ sung `dish-cost report` endpoint trong Backend C# | Được Owner phê duyệt quyền sửa Backend C# | Trả về bảng phân rã food cost để unblock `weekly.cost` gap |
| P1 | Chạy kiểm thử tải đồng thời nhiều người dùng (Multi-user concurrency test) | Môi trường staging sẵn sàng | Xác nhận không có deadlock hoặc xung đột version ngoài ý muốn |
| P2 | Chuẩn bị tích hợp và tạo Pull Request vào nhánh chính | Được Owner phát lệnh | Merge sạch sẽ vào main/master |

## 9. Chưa biết và xung đột
- UNKNOWN: Kế hoạch triển khai database migration lên môi trường production của Owner.
- Xung đột: Backend hiện tại chưa có `UnitsController` nhưng `CreateIngredientRequest` lại bắt buộc `UnitId` (đang khóa an toàn `BLOCKED`).
- Rủi ro nếu tự tiện mở write surfaces khi chưa có Backend authority: Sẽ vi phạm nguyên tắc Zero Fake Data và gây crash cơ sở dữ liệu.

## 10. Prompt tiếp nhận
```text
Tiếp nhận bàn giao tại D:/ki7/PRN222 Doanh Nghiệp/IPCManagement/docs/handoff/HANDOFF.md.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc AGENTS.md, rồi file bàn giao, sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: Tiếp tục chương trình Conformance Program sau khi toàn bộ Loading UX, Surface Matrix, 15 phát hiện trực quan và 69 Playwright browser tests trên Chromium thật đã PASS 100%.
Điều cấm: Không fake data/success, không merge DEFAULT/MRX (DOM-MODE-1), không package install/destructive Git/push/deploy/seed/import/database mutation khi chưa có quyền riêng.
Việc đầu tiên: Kiểm tra các tiến trình server đang chạy (port 5173 và 5262), chọn 1 trong các hướng đi tiếp theo: (1) Bổ sung UnitsController ở Backend C#, hoặc (2) Bổ sung dish-cost report ở Backend C#, hoặc (3) Kiểm thử tải đồng thời nhiều người dùng.
```
