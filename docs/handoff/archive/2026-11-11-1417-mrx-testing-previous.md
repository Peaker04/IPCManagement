# Bàn giao: MRX Full-Stack Audit, Runtime Hotfix & Seam-Flash Closure (`BUG-1..BUG-4`, `G1..O3`)

## Đọc trước
- Handoff ID: `2026-11-10-1408-mrx-fullstack-audit-closure`
- Thời điểm (múi giờ): `2026-11-10 14:08 +07:00`
- Phiên/agent giao: Antigravity (`c0515f2f-4afb-4fe7-8999-21a972a5aaf0`)
- Mục tiêu: Hoàn tất rà soát và xử lý triệt để toàn bộ lỗi runtime, treo skeleton, căn chỉnh biểu tượng/trạng thái rỗng và hiệu năng/tương tác trên toàn bộ FE & BE chế độ `MATERIAL_RECONCILIATION` (`MRX`).
- Chế độ làm việc: **HANDOFF ONLY / READ & VERIFY** (toàn bộ hạng mục trong scope của phiên giao đã `DONE_VERIFIED`, `.planning/WORK.md` đang ở trạng thái `IDLE`).
- Điểm dừng: Đã hoàn tất sửa lỗi `BUG-1..BUG-4` và đóng các đợt kiểm toán `G1..G9`, `H1..H12`, `I1..I10`, `J1..J6`, `K1..K6`, `L1..L5`, `M1..M10`, `N1..N7`, `O1..O3`; đã vượt qua `241/241` Vitest tests (11 suites MRX), `501/501` Backend xUnit tests (`Reconciliation|Mrx|SystemOperation`), `npm run lint` (`0` errors) và `npm run build` (`PASS` trong `1.39s`). Chưa stage/commit/push.
- Việc đầu tiên tiếp theo: Đọc `AGENTS.md`, `.planning/WORK.md`, và `docs/handoff/HANDOFF.md`; đối chiếu git snapshot ở mục 2; xác nhận 5 ý `A–E` với user trước khi nhận yêu cầu mới (nếu user cần chạy thử trên trình duyệt thì khởi động lại BE port `5262` và FE port `5173`).
- Blocker chính: Không có.

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu: Chuỗi yêu cầu của user trong phiên (`fix bug 1..4`, `căn chỉnh phần hiển thị`, và `/using-superpowers /ponytail-audit /ponytail-review Kiểm tra lại toàn bộ FE và BE chế độ MRX xem còn tồn đọng các vấn đề nào không cần xử lý hết`), kết thúc bằng lệnh `/context-handoff giao`.
- Tiêu chí hoàn thành:
  1. Không còn lỗi `Uncaught TypeError: *.find is not a function` trên `/weekly-menu?view=mrx-batch`, `/reconciliation`, `/warehouse?view=mrx-daily`, `/chef?view=mrx-cooking`, `/settings/approval-rules` hay các modal MRX khi đọc cache L1/L2 (`sessionStorage`).
  2. Không còn lỗi treo `<WorkbenchSkeleton>` 60 giây khi cache `mrx_inspection_source_*` có giá trị `null` (tuần chưa có thực đơn).
  3. Toàn bộ trạng thái rỗng (`DataGrid`, `SplitView`, `StateBoundary`) có biểu tượng `<EmptyIcon />` và căn giữa dọc-ngang chuẩn xác; `InlineBanner` và `AppShell` căn giữa biểu tượng theo trục dọc.
  4. Toàn bộ 11 bộ test MRX Frontend (`241/241` tests), bộ test MRX Backend (`501/501` tests), `npm run lint` và `npm run build` đều `PASS`.
- Được làm (khi ở chế độ NHẬN):
  - Bắt đầu ở chế độ **READ & VERIFY**: đọc tài liệu quản trị, kiểm tra `git status`, đối chiếu snapshot và báo cáo 5 mục `A–E` cho user.
  - Chỉ thực hiện thay đổi mới hoặc khởi chạy dịch vụ khi user xác nhận yêu cầu tiếp theo.
- Không được làm:
  - Cấm `git reset`, `git restore`, `git clean`, `git stash`, tự ý `git commit` / `git push` hoặc xóa các file untracked/unstaged trong working tree.
  - Cấm vi phạm bất biến `DOM-MODE-1` (`DEFAULT != MATERIAL_RECONCILIATION`), cấm tạo token CSS ngoài `frontend/src/styles/index.css`, cấm tạo fake API fallback (`Rule TA-5`), cấm hạ assertion trong test (`Rule TA-3`).
- Người có quyền đổi phạm vi: Chỉ user.

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | `d:\ki7\PRN222 Doanh Nghiệp\IPCManagement` |
| Branch / commit | `main...origin/main` · HEAD `bbd55009a77a6e83f79027a7784deb4b7f323928` (`bbd55009 feat(mrx,fe,auth): complete MRX source/audit/UX closures and auth startup migration guard`) |
| Staged / unstaged / untracked |Trước khi ghi HANDOFF: `0` staged, `108` unstaged modified (`6291 insertions(+), 945 deletions(-)`), `21` untracked (`10` plans trong `docs/superpowers/plans/2026-11-09-*.md`, `10` specs trong `docs/superpowers/specs/2026-11-09-*.md`, `1` file `tools/perf/k6/mrx-concurrency.js`). Sau khi lưu trữ HANDOFF cũ và ghi HANDOFF mới: thêm `1` modified (`docs/handoff/HANDOFF.md`) và `1` untracked (`docs/handoff/archive/2026-11-05-2009-mrx-preparation-layout.md`). |
| Thay đổi agent nhận chưa thấy được | Toàn bộ `109` file modified và `22` file untracked đang nằm trên working tree local tại `d:\ki7\PRN222 Doanh Nghiệp\IPCManagement` (chưa commit/push lên remote). |
| Build / bản đang chạy để kiểm thử | Frontend production build đã xác minh tại `frontend/dist/assets/index-Bvq1MDRI.js` (`482.86 kB`) và `frontend/dist/assets/index-DUncppQF.css` (`68.28 kB`). Backend build tại `.artifacts/dotnet/bin/IPCManagement.Api/debug/IPCManagement.Api.dll`. |
| Môi trường, runtime | OS Windows, PowerShell, .NET 9.0 (`net9.0`), Vite `v8.0.16`, Vitest `v4.1.10`. |
| Dữ liệu thử, migration liên quan | Không tạo migration mới trong phiên này. Startup guard của Backend tự động kiểm tra schema/mode theo cấu hình hiện hữu. |
| Tiến trình đang chạy hoặc bị ngắt | Hệ thống vừa gửi thông báo `[Notice] All your subagents and background tasks have been stopped due to server restart` lúc `2026-11-10T14:07:25+07:00`; kiểm tra `netstat -ano \| findstr ":5173 :5262"` xác nhận hiện **không có** tiến trình nào đang chiếm cổng `5173` hay `5262`. |
| MCP / skill / cấu hình cần có | Skills dự án: `.pi/skills/ipc-codebase-design/SKILL.md`, `.pi/skills/ipc-debugging/SKILL.md`, `.pi/skills/ipc-test-audit/SKILL.md`, `.pi/skills/ipc-ui-review/SKILL.md`, `.pi/skills/ipc-code-review/SKILL.md`, `.agents/skills/context-handoff/SKILL.md`. |

## 3. Tiến độ
| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| `BUG-1 & BUG-4` | Sửa lỗi `Uncaught TypeError: customers.find / (cachedCustomers ?? []).find is not a function` tại `MrxBatchWorkbench.tsx` và `useReconciliationWorkspace.ts` do `useWorkbenchQuery` bọc `catalog_customers` trong `CacheWrapper` | `DONE_VERIFIED` | `frontend/src/hooks/useWorkbenchQuery.ts`, `frontend/src/store/serverStateCache.ts`, `frontend/src/__tests__/useWorkbenchQuery.test.ts` (`13/13` PASS) | Không có |
| `BUG-2` | Sửa lỗi treo `<WorkbenchSkeleton>` 60 giây trên `/weekly-menu?view=mrx-materials` và `mrx-plans` khi `mrx_inspection_source_*` cache giá trị `null` | `DONE_VERIFIED` | `frontend/src/hooks/useWorkbenchQuery.ts` (`hasResolvedKey`), `frontend/src/__tests__/useWorkbenchQuery.test.ts` (`Bug 2` test PASS), `WeeklyMenu.test.tsx` (`50/50` PASS) | Không có |
| `BUG-3` | Khôi phục biểu tượng `<EmptyIcon />` bị mất và căn giữa dọc-ngang toàn bộ trạng thái rỗng (`DataGrid`, `MrxDailyIssueWorkbench`, `MrxQuantityInspectionPage`, `MrxCookingDishListBranch`, `InlineBanner`, `AppShell`) | `DONE_VERIFIED` | `frontend/src/components/workbench/DataGrid.tsx`, `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`, `Primitives.test.tsx`, `Warehouse.test.tsx` (`57/57` PASS) | Không có |
| `O1–O3` | Kiểm toán `/ponytail-audit` & `/ponytail-review` toàn diện FE/BE MRX: tự động bóc lớp `CacheWrapper` cũ trong `serverStateCache.ts`, chuẩn hóa `isCacheWrapper` cho `snapshot:*`, dùng `getCachedArray` trên mọi mảng cache MRX, thêm `flex flex-col` cho khung bảng trống tại `ReconciliationDashboardPage.tsx` | `DONE_VERIFIED` | `11/11` Vitest suites (`241/241` PASS), `501/501` Backend xUnit tests PASS, `npm run lint` (`0` errors), `npm run build` (`PASS` trong `1.39s`) | Không có |
| `G1–N7` | Toàn bộ các đợt đóng lỗi kiến trúc, seam-flash, customer/date switch và tối ưu SQL MRX trước đó trong phiên (`G1–G9`, `H1–H12`, `I1–I10`, `J1–J6`, `K1–K6`, `L1–L5`, `M1–M10`, `N1–N7`) | `DONE_VERIFIED` | Ghi nhận chi tiết tại `.planning/WORK.md` (dòng 1–250) và các spec/plan `docs/superpowers/*/2026-11-09-*.md` | Không có |

## 4. Quyết định và giả thuyết
| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| `D1` | Lưu dữ liệu nguyên bản (`result`) vào `serverStateCache` dưới `cacheKey`, chỉ bọc `CacheWrapper` `{ data, isCompatibilityBlocked }` cho các khóa `snapshot:*` hoặc khi `isCompatibilityBlocked = true` | đã chốt | Tránh xung đột kiểu dữ liệu giữa `useWorkbenchQuery` và các consumer đọc trực tiếp `serverStateCache.get(key)` | Đã kiểm chứng qua `useWorkbenchQuery.test.ts` & `FullMrxModernizationSmoke.test.tsx` |
| `D2` | Tự động bóc lớp `{ data, isCompatibilityBlocked: false }` ngay trong `serverStateCache.hydrateFromSession()` và `serverStateCache.get()` đối với mọi khóa không bắt đầu bằng `snapshot:` | đã chốt | Bảo vệ ứng dụng khỏi dữ liệu `sessionStorage` cũ còn lưu từ các bản build trước trên trình duyệt của user | Đã kiểm chứng qua `useWorkbenchQuery.test.ts` |
| `D3` | Giữ `<table>` và `<thead className="sticky top-0 z-20 ...">` luôn mount khi `data.length === 0`, đồng thời đặt `h-full` cho `<table>`, `<tr>`, `<td>` và hiển thị huy hiệu `<EmptyIcon size={22} />` phía trên `emptyState`/`emptyMessage` | đã chốt | Vừa chống giật mất header bảng (`AC-H2`), vừa bảo đảm mọi bảng trống luôn có biểu tượng và căn chính giữa vùng nhìn của bảng (`BUG-3`) | Đã kiểm chứng qua `Primitives.test.tsx`, `Warehouse.test.tsx`, `Reconciliation.test.tsx` |

## 5. Đã thử nhưng không thành công
| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| Truyền trực tiếp `null` vào `isDatasetEmpty(data ?? (null as TData))` trong `useWorkbenchQuery.ts` | `FAIL`: Một số callback `isDatasetEmpty` giả định `data` khác `null` và truy cập `data.batches.length` / `data.page.items`, gây `TypeError` | Lỗi trong lần chạy thử đầu của `WeeklyMenu.test.tsx` | Đã sửa trong `useWorkbenchQuery.ts` (dòng 338–342): chỉ gọi `isDatasetEmpty(data)` khi `hasHydratedData && data` khác `null`, còn khi `!hasHydratedData && hasResolvedKey` thì đánh dấu `isRowsEmpty = true` trực tiếp |
| Chạy đồng thời `eslint`, `tsc -b && vite build` và `vite` dev server song song trên cùng phiên Windows | `FAIL`: Quá tải worker / bộ nhớ (`OOM` / `spawn EINVAL`) trên Windows | Lịch sử phiên làm việc | Luôn chạy tuần tự `npm run lint` rồi mới chạy `npm run build` (`npm run lint; if ($LASTEXITCODE -eq 0) { npm run build }`) |

## 6. Kiểm thử
- Tầng / vòng hiện tại: Kiểm thử Unit/Contract Frontend (Vitest), Kiểm thử tích hợp Backend (xUnit), Kiểm tra tĩnh ESLint + TypeScript Production Build.
- Test plan: Các kế hoạch tại `docs/superpowers/plans/2026-11-09-*.md` và mục `VERIFY` trong `.planning/WORK.md`.
- Kết quả thuộc commit/build: Working tree trên nền HEAD `bbd55009a77a6e83f79027a7784deb4b7f323928`, bundle `frontend/dist/assets/index-Bvq1MDRI.js`.
- Kết quả có thể đã cũ vì: Không — code sản phẩm không thay đổi sau lần chạy test/lint/build cuối cùng (chỉ cập nhật `.planning/WORK.md` và `docs/handoff/HANDOFF.md`).

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---:|---|---|
| `FE-MRX-11-SUITES` | `Set-Location frontend; npx vitest run src/__tests__/useWorkbenchQuery.test.ts src/__tests__/Render1CacheHitVerification.test.tsx src/__tests__/MrxFiveLayerStateMachine.test.tsx src/__tests__/FullMrxModernizationSmoke.test.tsx src/__tests__/MrxDashboard.test.tsx src/__tests__/WeeklyMenu.test.tsx src/__tests__/Warehouse.test.tsx src/__tests__/Reconciliation.test.tsx src/__tests__/Chef.test.tsx src/__tests__/ApprovalRules.test.tsx src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts` | 2 | Lượt 1: `9 PASS / 2 FAIL` (do `isCacheWrapper` thiếu `{ data }` 1-key và test thiếu mock `getEditScope`); Lượt 2 (sau khi sửa): **`11/11` suites PASS (`241/241` tests PASS)** | Log task `task-6232` và lần chạy lại 3 suite (`27/27` PASS) |
| `FE-LINT-BUILD` | `Set-Location frontend; npm run lint; if ($LASTEXITCODE -eq 0) { npm run build }` | 1 | `PASS` (`0` lint errors, `tsc -b && vite build` thành công trong `1.39s`) | Log task `task-6274` |
| `BE-MRX-XUNIT` | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~Reconciliation\|FullyQualifiedName~Mrx\|FullyQualifiedName~SystemOperation" --nologo --verbosity minimal` | 1 | `PASS` (`501/501` tests PASS, `0` failed, `0` skipped, `19s`) | Log task `task-6278` |

## 7. Nguồn cần đọc
| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---:|---|---|---|
| 1 | `AGENTS.md` | Quy tắc bất biến (`DOM-MODE-1`, Single Styling Authority, 5-Layer Governance, Mandatory Phase Gates) | đã kiểm tra |
| 2 | `.planning/WORK.md` | Single Source of Truth cho trạng thái tác vụ (đang `IDLE`, mục đầu tiên là `MRX Full-Stack Ponytail Audit & Review Closure`) | đã kiểm tra |
| 3 | `docs/handoff/HANDOFF.md` | Tài liệu bàn giao hiện tại (bản cũ đã chuyển vào `docs/handoff/archive/2026-11-05-2009-mrx-preparation-layout.md`) | đã kiểm tra |
| 4 | `frontend/src/store/serverStateCache.ts` & `frontend/src/hooks/useWorkbenchQuery.ts` | Trái tim của cơ chế SWR Cache L1/L2, `unwrapLegacyCachePayload`, `getCachedArray` và máy trạng thái 5 tầng `L1–L5` | đã kiểm tra |
| 5 | `frontend/src/components/workbench/DataGrid.tsx` | Chuẩn hiển thị bảng, sticky header và căn giữa dọc + `<EmptyIcon />` khi bảng trống | đã kiểm tra |
| 6 | `.pi/skills/ipc-test-audit/SKILL.md`, `.pi/skills/ipc-ui-review/SKILL.md`, `.pi/skills/ipc-code-review/SKILL.md` | Các cổng kiểm định bắt buộc khi sửa code hoặc test | đã kiểm tra |

## 8. Bước tiếp theo
| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---:|---|---|---|
| 1 | Tiếp nhận bàn giao ở chế độ `READ & VERIFY`: đọc `AGENTS.md`, `.planning/WORK.md`, `docs/handoff/HANDOFF.md` và đối chiếu `git status` | Khi phiên mới bắt đầu nhận lệnh tiếp nhận | Báo cáo ngắn gọn 5 mục `A–E` cho user |
| 2 | Khởi động lại Backend (`http://localhost:5262`) và Frontend (`http://127.0.0.1:5173`) nếu user cần kiểm tra trực tiếp trên trình duyệt | Khi user yêu cầu chạy FE/BE hoặc kiểm tra giao diện live | Cả 2 cổng `5262` và `5173` lắng nghe thành công và `/api/system-operation-mode` trả về `200 OK` |
| 3 | Thực hiện yêu cầu nghiệp vụ hoặc đóng gói commit tiếp theo | Khi có chỉ đạo cụ thể mới từ user | Tuân thủ đúng vòng đời `INTAKE -> PLAN -> EXECUTE -> VERIFY -> CLOSE` trong `AGENTS.md` |

## 9. Chưa biết và xung đột
- UNKNOWN: Trạng thái `sessionStorage` hiện tại trong tab trình duyệt cá nhân của user (tuy nhiên code mới trong `serverStateCache.ts` đã có `unwrapLegacyCachePayload` và `getCachedArray` để tự động làm sạch mọi dữ liệu bọc kiểu cũ ngay khi trang nạp lại).
- Giả định chưa chốt: Không có.
- Xung đột giữa đặc tả, code và log: Không có.
- Rủi ro nếu làm tiếp khi chưa giải quyết: Nếu user mở trình duyệt tại `http://localhost:5173` ngay lúc này mà chưa khởi động lại tiến trình BE (`5262`) và FE (`5173`) (vốn vừa bị dừng do server restart của hệ thống), trình duyệt sẽ không kết nối được hoặc báo `502 Bad Gateway` nếu chỉ bật FE mà chưa bật BE.

## 10. Prompt tiếp nhận
```text
Tiếp nhận bàn giao tại d:\ki7\PRN222 Doanh Nghiệp\IPCManagement\docs\handoff\HANDOFF.md.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc AGENTS.md, .planning/WORK.md, rồi file bàn giao docs/handoff/HANDOFF.md, sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: Tiếp nhận trạng thái hoàn tất kiểm toán & sửa lỗi toàn diện FE/BE chế độ MRX (BUG-1..BUG-4, G1..O3) và sẵn sàng cho yêu cầu tiếp theo của user. Điều cấm: Không chạy git reset/restore/clean/stash/commit/push khi chưa được phép, không vi phạm DOM-MODE-1 hoặc Single Styling Authority. Việc đầu tiên: Đối chiếu git snapshot tại mục 2, báo cáo 5 mục A–E và hỏi user có cần khởi động lại server FE (5173) + BE (5262) hay thực hiện tác vụ mới.
```
