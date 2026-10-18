# Bàn giao: Requirements-to-Runtime Conformance Program

## Đọc trước
- Handoff ID: `2026-10-18-1420-conformance-visual-verified`
- Thời điểm (múi giờ): `2026-10-18 14:20:00 +07:00` (`Asia/Ho_Chi_Minh` / SE Asia Standard Time)
- Phiên/agent giao: Pi native session, branch `feature/greenfield-fe-3zone-workbench`
- Mục tiêu: Toàn bộ 8 lát cắt chức năng của chương trình Requirements-to-Runtime Conformance Program (Foundation A, B và Slice 1 đến Slice 8), bộ kiểm thử Playwright trực tiếp trên trình duyệt Chromium thật, và khắc phục triệt để các lỗi hiển thị hình ảnh phát hiện qua 3 ảnh chụp live (null crash weekly-menu, header text collision, raw english status enums, 0-line PO empty state) đã hoàn tất 100% tại các ranh giới static, contract, unit, build, và browser acceptance.
- Chế độ làm việc: Zero synthetic evidence; 100% C# Backend DTO truth; 100% existing UI Kit components (`docs/UI-KIT.md`); zero custom primitives; zero ad-hoc CSS.
- Điểm dừng: 28/28 tests Playwright chạy trên Chrome thật PASS, 116/116 tests unit Vitest PASS, 28/28 tests conformance PASS, ZeroFakeApi guard PASS, ESLint PASS, Vite production build PASS, Depcruise PASS; git branch ahead origin 37 commits; working tree sạch.
- Việc đầu tiên tiếp theo: Chọn 1 trong 3 hướng đi: (1) Soạn thảo Spec & Plan bổ sung 2 Backend endpoints còn thiếu (`UnitsController` và `dish-cost report`) để unblock form tạo nguyên liệu, hoặc (2) Triển khai ma trận điều hướng 2 chế độ `DOM-MODE-1` trên Sidebar v2, hoặc (3) Mở các bề mặt ghi khi đủ concurrency authority.
- Blocker chính: Backend C# hiện chưa có `UnitsController` (nên `CAT.INGREDIENT.CREATE` bị khóa `BLOCKED`), chưa có `dish-cost report` (nên `weekly.cost` có gap `BACKEND_CAPABILITY_GAP`).

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu: Yêu cầu trực tiếp của Owner trong hội thoại; 3 ảnh chụp màn hình kiểm tra lỗi trực quan (`D:\Temp\pi-clipboard-*.png`); approved specs trong `docs/superpowers/specs/`; live state `.planning/WORK.md`.
- Tiêu chí hoàn thành: Toàn bộ 246 Backend HTTP actions được ánh xạ 1:1 sang các capabilities độc lập; toàn bộ các giá trị hardcode/data ảo bị xóa bỏ; 100% UI Kit có sẵn được sử dụng; toàn bộ lỗi đè chữ và null crash được khắc phục tận gốc; bộ test tự động xanh hoàn toàn trên trình duyệt thật kết nối live ASP.NET Core API và MySQL.
- Được làm: Direct native execution trên branch hiện tại; sửa Frontend và canonical contracts; giữ nguyên read-only đối với các write surfaces chưa đủ thẩm quyền.
- Không được làm: Fake API/data/success, merge `DEFAULT` với `MATERIAL_RECONCILIATION` (`DOM-MODE-1`), package install, destructive Git, push/deploy, seed/import, database mutation hoặc migration apply.
- Người có quyền đổi phạm vi: Owner/user hiện tại.

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | `D:/ki7/PRN222 Doanh Nghiệp/IPCManagement` |
| Branch / commit | `feature/greenfield-fe-3zone-workbench` / `d59d94ba` |
| Staged / unstaged / untracked | Không có; `git status` sạch (đã commit đầy đủ) |
| Thay đổi agent nhận chưa thấy được | 37 commits local ahead origin chưa push |
| Build / bản đang chạy để kiểm thử | Production Frontend build PASS (`dist/index.html` built in 1.21s, zero type errors) |
| Môi trường, runtime | Pi; Node 24, .NET 9, MySQL 8, Playwright 1.60 on Chromium |
| Dữ liệu thử, migration liên quan | Database MySQL thật chứa 756 nguyên liệu, 195 món ăn, 35 nhà cung cấp, 8 đơn PO, 17 hồ sơ duyệt, 2 kho vận hành |
| Tiến trình đang chạy hoặc bị ngắt | Backend .NET Kestrel tại `http://localhost:5262` (PID 18204), Frontend Vite tại `http://localhost:5173` (PID 25912), MySQL port 3306 (PID 9552) |
| MCP / skill / cấu hình cần có | Project skills trong `.pi/skills/`; `context-handoff` ở `.agents/skills/context-handoff/` |

## 3. Tiến độ Toàn Chương Trình (8 Slices + Phase 4 + UI Remediation)

| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| FOUNDATION-A | Requirements & Conformance Inventory | DONE_VERIFIED | `docs/conformance-contracts.json`, checker 28/28 PASS | Live multi-user load testing |
| FOUNDATION-B | Shared Workbench Skeleton & ActionGuard | DONE_VERIFIED | `WorkbenchSkeleton.tsx`, `workbenchSurfaceRegistry.ts`, ActionGuard | Multi-user concurrency |
| AUTH-SYSTEM | Slice 1: Auth & System Operation Mode | DONE_VERIFIED | Bỏ sample credentials, ETag versioned PUT mode, 409 conflict recovery | Live cookie rotation testing |
| CATALOG-ADMIN | Slice 2: Catalog & Admin | DONE_VERIFIED | Bỏ `categoryName` giả, server pagination (756 ings / 195 dishes), khóa `CAT.INGREDIENT.CREATE` | Cần Backend `UnitsController` |
| MENU-COORD | Slice 3: Weekly Menu & Coordination | DONE_VERIFIED | Bỏ giá cứng `25k`, bỏ category giả, thêm refresh đơn ăn | Cần Backend dish-cost |
| PUR-APPR | Slice 4: Purchasing & Approvals | DONE_VERIFIED | Bỏ `(35 đối tác)` cứng, bắt buộc lý do từ chối duyệt | Cần approved PR workflow |
| WAREHOUSE | Slice 5: Warehouse & Inventory | DONE_VERIFIED | Sửa `isEmpty={false}`, từ chối bịa tồn kho từ phép tính 0 | Cần live stock snapshot |
| CHEF | Slice 6: Chef Production Handover | DONE_VERIFIED | Xác thực 25 capabilities ca bếp, empty state chuẩn | Live handover signing |
| RECON | Slice 7: Material Reconciliation (MRX) | DONE_VERIFIED | `DOM-MODE-1` mode isolation, `RECON.BATCH.COMPLETE` action guard | Cần MRX staging batch |
| REP-DASH | Slice 8: Reports & Dashboard | DONE_VERIFIED | Bỏ ngày tĩnh, bổ sung reload/retry báo cáo, tách data quality | Staging report data |
| PHASE-4-BROWSER | Phase 4: Runtime Browser & Popstate | DONE_VERIFIED | `conformance-runtime.spec.ts`, `DirtyNavigation.tsx` popstate listener | Đã chạy 16/16 tests PASS |
| UI-REMEDIATION | GF-R42: Khắc phục lỗi hình ảnh từ ảnh chụp live | DONE_VERIFIED | `weeklyMenuApi.ts` null safety, `DataGrid.tsx` minWidth chống đè chữ, dịch tiếng Việt PO status | Đã chạy 28/28 Playwright tests PASS |

## 4. Quyết định và Giả thuyết

| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| D-01 | `.planning/WORK.md` là live task-state SSOT duy nhất | đã chốt | `AGENTS.md` | Owner/governance |
| D-02 | `DEFAULT != MATERIAL_RECONCILIATION` | đã chốt | `DOM-MODE-1`, approved design | Owner |
| D-03 | Fail closed khi thiếu Backend/data authority | đã chốt | Approved design | Owner |
| D-04 | Mỗi Backend HTTP action map đúng một operation-grain capability | đã chốt | Conformance checker (28/28 PASS) | Owner |
| D-05 | 100% tái sử dụng UI Kit có sẵn (`docs/UI-KIT.md`) | đã chốt | `AGENTS.md`, user instruction | Owner |
| D-06 | Zero Fake API Data & Anti-Tautology Gate (Rule TA-1 đến TA-5) | đã chốt | `ZeroFakeApiAndTestAuditGuard.test.ts` PASS | Owner |
| D-07 | Chặn lùi trang trình duyệt (`popstate`) khi có draft bẩn | đã chốt | `DirtyNavigation.tsx` + `Primitives.test.tsx` PASS | Owner |
| D-08 | Dịch 100% trạng thái đơn PO sang tiếng Việt chuẩn `UXR-04` | đã chốt | `PurchasingPage.tsx` + `Purchasing.test.tsx` PASS | Owner |
| D-09 | Bổ sung `minWidth ?? 'min-w-[720px]'` cho DataGrid chống đè chữ | đã chốt | `DataGrid.tsx` + Playwright visual audit PASS | Owner |
| D-10 | Null safety `menuResponse?.rows || []` trong Weekly Menu | đã chốt | `weeklyMenuApi.ts` + `WeeklyMenu.test.tsx` PASS | Owner |

## 5. Đã thử nhưng không thành công

| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| Chạy Playwright song song 3 workers kết nối vào Kestrel backend | Gặp lỗi 429 RateLimit trên auth-strict và proxy timeout | Terminal Playwright output | Cấu hình `workers: 1` trong `playwright.config.ts` để kiểm thử tuần tự ổn định 100% |
| Đọc `categoryName` trong DishCostSummaryItem | Gặp lỗi không khớp schema C# DTO | Terminal build error | Sửa sang `dishType` và `dishGroup` từ `DishDto.cs` |
| Truy cập `menuResponse.rows` trực tiếp khi khách hàng chưa có KHSX | Văng lỗi `TypeError: Cannot read properties of null (reading 'rows')` | Screenshot user cung cấp | Sửa sang optional chaining `menuResponse?.rows || []` |

## 6. Kiểm thử
- Tầng / vòng hiện tại: Full static, contract, unit, build, and live browser Playwright on Chromium.
- Test plan: `docs/superpowers/plans/2026-10-18-ui-remediation-and-visual-audit-plan.md`.
- Kết quả thuộc commit: `89438d4a` và `d59d94ba`.
- Kết quả không cũ vì: Vừa được chạy lại hoàn tất 100% trên server đang chạy.

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---|---|---|
| CONF-TESTS | `npm run test:conformance-contracts` | 1 | PASS 28/28 | Terminal output |
| CONF-CHECK | `npm run check:conformance-contracts` | 1 | PASS | Terminal output |
| FE-UNIT | `npm run test:fe:unit` | 1 | PASS 17 files / 116 tests | Terminal output |
| ZERO-FAKE | Focused `ZeroFakeApiAndTestAuditGuard.test.ts` | 1 | PASS 2/2 | Terminal output |
| FE-LINT | `npm run lint:fe` | 1 | PASS (0 errors, 0 warnings) | Terminal output |
| FE-BUILD | `npm run build:fe` | 1 | PASS (built in 1.21s) | Terminal output |
| FE-DEPS | `npm run depcruise:fe` | 1 | PASS (68 modules, 260 dependencies) | Terminal output |
| BROWSER-PW | `cd frontend && npx playwright test` | 1 | PASS 28/28 tests on Chromium | Terminal output (26.0s) |
| LIVE-SCREENS | Screenshots chụp thực tế từ Chrome thật | 1 | 7 ảnh PNG trong `test-results/live-screens/` | File artifacts tồn tại |

## 7. Nguồn cần đọc
| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---|---|---|---|
| 1 | `AGENTS.md` | Quy chuẩn quản trị 5 tầng, các điều cấm Hard Invariants | đã kiểm tra |
| 2 | `.planning/WORK.md` | Single Source of Truth cho trạng thái công việc (đã cập nhật GF-R42) | đã kiểm tra |
| 3 | `docs/superpowers/specs/2026-10-18-ui-remediation-and-visual-audit-design.md` | Báo cáo chẩn đoán và đặc tả sửa lỗi giao diện | đã kiểm tra |
| 4 | `docs/UI-KIT.md` | Danh mục 10 UI Primitives và 5 Composite Workbenches | đã kiểm tra |
| 5 | `docs/conformance-contracts.json` | Danh mục 246 capabilities đã disaggregate | đã kiểm tra |
| 6 | `frontend/tests/browser/live-data-display-audit.spec.ts` | Bộ test Playwright kiểm tra dữ liệu thật từ MySQL | đã kiểm tra |

## 8. Bước tiếp theo
| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---|---|---|---|
| P0 | Bổ sung `UnitsController` (GET `/api/units`) trong Backend C# | Được Owner phê duyệt quyền sửa Backend | Trả về `UnitDto[]` hợp lệ để mở khóa `CAT.INGREDIENT.CREATE` từ BLOCKED sang READY |
| P1 | Bổ sung `dish-cost report` endpoint trong Backend C# | Được Owner phê duyệt quyền sửa Backend | Trả về bảng phân rã food cost để unblock `weekly.cost` gap |
| P1 | Cấu hình Sidebar v2 lọc động theo `operationalMode` | Bắt đầu phiên mới | Khi ở `MATERIAL_RECONCILIATION`, tự động ẩn Thu mua và hiển thị nổi bật Đối soát |
| P2 | Mở các write surfaces nhạy cảm (tạo PO từ PR đã duyệt, chốt số suất) | Backend hoàn thiện concurrency token | UI chuyển từ read-only sang có form mutation an toàn |

## 9. Chưa biết và xung đột
- UNKNOWN: Kế hoạch triển khai database migration lên môi trường staging/production của Owner.
- Xung đột: Backend hiện tại chưa có `UnitsController` nhưng `CreateIngredientRequest` lại bắt buộc `UnitId` (đang khóa `BLOCKED`).
- Rủi ro nếu tự tiện mở write surfaces khi chưa có Backend authority: Sẽ vi phạm nguyên tắc Zero Fake Data và gây crash cơ sở dữ liệu.

## 10. Prompt tiếp nhận
```text
Tiếp nhận bàn giao tại D:/ki7/PRN222 Doanh Nghiệp/IPCManagement/docs/handoff/HANDOFF.md.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc AGENTS.md, rồi file bàn giao, sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: Tiếp tục chương trình Conformance Program sau khi toàn bộ 8 slices và kiểm thử browser trên Chrome thật đã PASS 100%.
Điều cấm: Không fake data/success, không merge DEFAULT/MRX (DOM-MODE-1), không package install/destructive Git/push/deploy/seed/import/database mutation khi chưa có quyền riêng.
Việc đầu tiên: Kiểm tra các tiến trình server đang chạy (port 5173 và 5262), chọn 1 trong các hướng đi tiếp theo: (1) Bổ sung UnitsController ở Backend C#, hoặc (2) Lọc Sidebar v2 theo operationalMode, hoặc (3) Mở các bề mặt ghi khi đủ concurrency token.
```
