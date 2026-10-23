# Bàn giao: Complete MRX Production Program — Master Tasks 4, 5 & 6 Handoff

## Đọc trước
- Handoff ID: `2026-10-22-0820-mrx-tasks-4-to-6`
- Thời điểm (múi giờ): `2026-10-22 08:20:00 +07:00` (`Asia/Ho_Chi_Minh` / SE Asia Standard Time)
- Phiên/agent giao: Pi native session, branch `feature/greenfield-fe-3zone-workbench`
- Mục tiêu: Hoàn thiện chương trình **Complete MRX Production Program** (13 master tasks) khép kín chu trình điều hành chế độ Đối soát nguyên liệu (`MATERIAL_RECONCILIATION`), bảo toàn bất biến nghiệp vụ và cô lập triệt để với `DEFAULT` (`DOM-MODE-1`).
- Chế độ làm việc: Native execution, TDD / test-audit gate, zero synthetic evidence, no fake API fallbacks, single styling authority (`index.css`), immutable operational audit.
- Điểm dừng:
  - Sửa lỗi Login 403 / Forbidden: Landing resolver tự động điều hướng đúng theo role × mode (`/reconciliation` cho Manager MRX, `mrx-batch` cho Coordinator/Admin MRX).
  - Master Task 4 (Source change execution & delta staging): `DONE_VERIFIED` tại source/unit/relational-static boundary.
  - Master Task 5 (Warehouse Initial Issue Workbench `/warehouse?view=mrx-daily`): `DONE_VERIFIED` tại source/unit/relational-static boundary, route đã mở `READY`.
  - Master Task 6 (Delta queue, supplemental issue & physical return): `IN_PROGRESS` / `BLOCKED ON LOCAL MIGRATION AUTHORIZATION`. Backend transaction cho positive/negative delta đã hoàn thành và kiểm thử; migration `20261020065952_ResolveReconciliationSourceDeltas` đã sinh nhưng **chưa apply** vào MySQL cục bộ; route `/warehouse?view=mrx-issues` giữ `BLOCKED` an toàn.
- Việc đầu tiên tiếp theo: Xin quyền Owner backup DB rồi apply migration `20261020065952_ResolveReconciliationSourceDeltas` lên MySQL (`localhost:3306/ipcmanagement`), probe schema; sau đó chuyển route `mrx.issues` sang `READY` và bổ sung test UI cho luồng hoàn trả vật lý.
- Blocker chính: Cần sự cho phép rõ ràng của Owner để backup và apply migration DDL `20261020065952_ResolveReconciliationSourceDeltas` vào MySQL database `ipcmanagement`. Chưa có quyền commit/push git.

---

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu:
  - User chỉ thị triển khai Native, tuần tự, không subagent.
  - Spec: `docs/superpowers/specs/2026-10-18-mrx-production-vertical-slice-design.md`
  - Master Plan: `docs/superpowers/plans/2026-10-18-complete-mrx-production-program-plan.md`
  - Task Ledger: `.planning/WORK.md`
- Tiêu chí hoàn thành:
  - Toàn bộ 13 Master Tasks của Complete MRX Program hoàn thành với đầy đủ bằng chứng source/unit/relational/runtime.
  - Dữ liệu và luồng nghiệp vụ của MRX nối liền xuyên suốt từ Customer, MenuVersion, ca/ngày, món/BOM, số suất, QuantityImport, ReconciliationBatch, daily line, delta, issue/return, stock movement, disposition đến completion.
  - Không fallback sang DEFAULT ở bất kỳ view/route MRX nào.
- Được làm:
  - Chỉnh sửa code Backend và Frontend trong checkout hiện tại.
  - Chạy unit tests, conformance tests, build, lint, depcruise.
  - Khởi động/dừng server BE (port 5262) và FE (port 5173) cục bộ phục vụ kiểm thử.
  - Sinh migration mã nguồn C# (`dotnet ef migrations add`).
- Không được làm:
  - Không commit, không push git khi chưa được cấp quyền riêng.
  - Không git reset, git restore, git clean, không xóa các thay đổi kế thừa dở dang.
  - Không tự ý mutate DB schema hoặc apply migration mà không có lệnh và backup.
  - Không tạo fake API, không fake data/seed trong production path.
  - Không phá vỡ DOM-MODE-1 (`DEFAULT != MATERIAL_RECONCILIATION`).
- Người có quyền đổi phạm vi: User / Product Owner.

---

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | `D:/ki7/PRN222 Doanh Nghiệp/IPCManagement` |
| Branch / commit | `feature/greenfield-fe-3zone-workbench` / `8e474699635f9553ba39c59d92412f8fdff75bfe` (ahead origin 45 commits) |
| Staged / unstaged / untracked | Staged: 0 files. Unstaged: 70 files (MRX Tasks 1–6, Unit catalog, navigation fixes, conformance contracts). Untracked: 30 files (xem chi tiết mục 9). |
| Thay đổi agent nhận chưa thấy được | Toàn bộ 70 unstaged files và 30 untracked files chỉ tồn tại cục bộ trên máy, chưa commit và chưa push. |
| Build / bản đang chạy để kiểm thử | Backend Release build: PASS (0 errors, 0 warnings). Frontend build: PASS (`tsc -b && vite build`, built in 855ms). |
| Môi trường, runtime | .NET SDK 9.0.313 / ASP.NET Core 9.0; Node v20+; Vite 8.0.16; Vitest v4.1.10; MySQL 8.0/9.0 (port 3306). |
| Dữ liệu thử, migration liên quan | Local MySQL: `localhost:3306/ipcmanagement`. Đã apply 3 migration MRX: `20261019144828`, `20261019151504`, `20261019154437`. Đã tạo bản dump backup trước đó tại `D:\Temp\IPCManagement-backups\mrx-task4-20261020-075201\ipcmanagement-before-mrx-task4.sql`. Migration mới `20261020065952_ResolveReconciliationSourceDeltas` **chưa apply**. |
| Tiến trình đang chạy | Frontend: PID `19988` (port 5173, HTTP 200). Backend API: PID `26416` (port 5262, Swagger HTTP 200). MySQL: PID `9608` (port 3306). |
| MCP / skill / cấu hình cần có | Skills: `context-handoff`, `executing-plans`, `test-audit`, `systematic-debugging`, `ipc-ui-review`, `ipc-code-review`. Runner: native PowerShell/bash. |

---

## 3. Tiến độ

| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| FIX-AUTH | Landing resolver theo role × mode sau login và trên 403 Forbidden | `DONE_VERIFIED` | `Auth.test.tsx` 8/8 PASS; `AppShell.test.tsx` 19/19 PASS; depcruise PASS | Không có |
| TASK-1 | Authorization / permission vocabulary & mode isolation | `DONE_VERIFIED` | Backend `SystemOperationCapabilityProfileTests.cs` PASS; `AuthorizationPoliciesTests.cs` PASS | Không có |
| TASK-2 | Canonical paged batch summary & exact `batchId` list/detail split | `DONE_VERIFIED` | `ReconciliationWeeklyMenuControllerTests.cs` PASS; `MrxBatchWorkbench.tsx` | Không có |
| TASK-3 | Source authoring, preview, specialist submit, Admin approve/reject/confirm | `DONE_VERIFIED` | `MrxMenuAmendmentTests.cs` PASS; `WeeklyMenuImportsControllerContractTests.cs` PASS | Không có |
| TASK-4 | Source revision, delta queue, unissued replacement, issued freeze, disposition invalidation, completion blocker | `DONE_VERIFIED` | `ReconciliationSourceDeltaProjectorTests.cs` PASS; `MrxMenuAmendmentTests.cs` (rollback + concurrency) PASS; 410 broad BE tests PASS | Task 6 sở hữu giải quyết vật lý |
| TASK-5 | Warehouse Initial Daily Issue Workbench (`/warehouse?view=mrx-daily`) | `DONE_VERIFIED` | `MrxDailyIssueWorkbench.tsx`; `Warehouse.test.tsx` 10/10 PASS; `ReconciliationWarehouseIssueApplicationPathTests.cs` PASS; route `READY` | Không có |
| TASK-6 | Source delta queue, supplemental issue, physical return & stock movement (`/warehouse?view=mrx-issues`) | `IN_PROGRESS` | Unit/relational test `Pending_positive_source_delta...` PASS; `Phase30WarehouseReturnFamily_ReconciliationCorrection...` PASS; `MrxSourceDeltaWorkbench.tsx` | Apply migration `20261020065952`, test UI hoàn trả vật lý, mở route `mrx.issues` sang `READY` |
| TASK-7 | Atomic Multi-Customer Preparation | `TODO` | Plan task 7 | Triển khai sau Task 6 |
| TASK-8 | Supplier Classification and Workbook | `TODO` | Plan task 8 | Triển khai sau Task 7 |
| TASK-9 | Manager Daily Decision and Completion | `TODO` | Plan task 9 | Triển khai sau Task 8 |
| TASK-10 | Chef Cooking-Only Surface (`/chef?view=mrx-cooking`) | `TODO` | Plan task 10 | Triển khai sau Task 9 |
| TASK-11 | Dashboard, Queues, Notifications, Reports, and Audit | `TODO` | Plan task 11 | Triển khai sau Task 10 |
| TASK-12 | Cross-feature Compatibility and Regression Suite | `TODO` | Plan task 12 | Triển khai sau Task 11 |
| TASK-13 | End-to-End Production Acceptance and Operational Signoff | `TODO` | Plan task 13 | Triển khai sau Task 12 |

---

## 4. Quyết định và giả thuyết

| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| DEC-AUTH-01 | Landing path sau login và nút 403 recovery giải quyết qua `resolveLandingPath` inject từ `App.tsx` vào `AuthProvider` | đã chốt | Ngăn chặn reverse dependency `features/auth → routes` và tuân thủ depcruise R3 | Đã kiểm chứng (depcruise 0 errors) |
| DEC-MRX-01 | Phân tách ranh giới Task 4 và Task 6: Task 4 stage delta và block completion; Task 6 xử lý stock mutation và resolve delta | đã chốt | Đảm bảo tính toàn vẹn kho: phê duyệt thực đơn không bao giờ tự ý cộng/trừ tồn kho vật lý | Master Plan |
| DEC-MRX-02 | Positive delta giải quyết qua `InventoryIssue` (loại `isSupplemental = true`); negative delta giải quyết qua `InventoryReturn` (loại `RETURN`) | đã chốt | Tái sử dụng tối đa canonical stock transaction runner hiện hữu, không sinh parallel entity | Đã kiểm chứng qua tests |
| DEC-MRX-03 | Delta `RETURN_REQUIRED` chỉ chuyển sang `RESOLVED` khi Thủ kho xác nhận nhận hàng (`ConfirmReceiptAsync`) | đã chốt | Tạo phiếu trả chỉ là đề nghị từ Bếp; tồn kho và đối soát chỉ đổi khi hàng thực sự nhập lại kho | Đã kiểm chứng qua tests |
| DEC-MRX-04 | Giữ route `/warehouse?view=mrx-issues` ở trạng thái `BLOCKED` cho tới khi database migration được áp dụng | đã chốt | Tránh lỗi runtime 500 do thiếu cột trên bảng MySQL thật | AGENTS.md rule truthful surface gate |

---

## 5. Đã thử nhưng không thành công

| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| Import trực tiếp `CANONICAL_ROUTES` và `resolveLandingPath` vào `LoginPage.tsx` và `ForbiddenPage.tsx` | Depcruise báo lỗi 4 violations quy tắc `R3-feature-khong-goi-app` | `depcruise` output | Đã chuyển sang pattern inject `resolveLanding` callback từ `App.tsx` vào `AuthProvider`, feature component chỉ đọc `landingPath` |
| Chạy `dotnet test` song song trong khi tiến trình backend đang lock file `apphost.exe` | MSBuild retry 10 lần và thất bại với mã `MSB3027` | Build log output | Phải dừng tiến trình Backend API (port 5262) trước khi chạy full build hoặc integration tests |
| Khởi động Backend Release bằng lệnh `Start-Process dotnet` trỏ vào dll với working directory sai | Backend crash ngay khi khởi động vì không đọc được `appsettings.Development.json` | `backend.err.log`: `Connection string 'DefaultConnection' is not configured` | Đã sửa lệnh: dùng file `.exe` hoặc `dotnet run --no-build -c Release` chạy từ đúng thư mục `backend/src/IPCManagement.Api` |

---

## 6. Kiểm thử
- Tầng / vòng hiện tại: Unit / Integration / Contract / Static Verification.
- Test plan: `docs/superpowers/plans/2026-10-18-complete-mrx-production-program-plan.md`.
- Kết quả thuộc commit/build: Working tree hiện tại (ahead `8e474699` 45 commits).
- Kết quả có thể đã cũ vì: Không, các lệnh test cốt lõi vừa được chạy lại và đạt GREEN.

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---|---|---|
| TC-BE-TASK4-CONCURRENCY | `dotnet test ... --filter "FullyQualifiedName~Concurrent_admin_approvals"` | 3 | PASS | 1 pass, 0 fail (1s) |
| TC-BE-TASK4-ROLLBACK | `dotnet test ... --filter "FullyQualifiedName~Admin_approval_rolls_back"` | 3 | PASS | 1 pass, 0 fail (2s) |
| TC-BE-TASK4-BROAD | `dotnet test ... --filter "FullyQualifiedName~Reconciliation|FullyQualifiedName~MenuAmendment|FullyQualifiedName~Auth"` | 2 | PASS | 410 passed, 1 skipped |
| TC-BE-TASK5-ISSUE | `dotnet test ... --filter "FullyQualifiedName~ReconciliationWarehouseIssueApplicationPathTests"` | 3 | PASS | 36 passed, 0 fail |
| TC-BE-TASK6-RESOLVE | `dotnet test ... --filter "FullyQualifiedName~Pending_positive_source_delta|FullyQualifiedName~Phase30WarehouseReturnFamily_ReconciliationCorrection"` | 2 | PASS | 2 passed, 0 fail |
| TC-FE-AUTH-LANDING | `npm --prefix frontend run test:unit -- src/__tests__/Auth.test.tsx` | 3 | PASS | 8 passed, 0 fail |
| TC-FE-WAREHOUSE-DAILY | `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx` | 3 | PASS | 10 passed, 0 fail |
| TC-FE-WAREHOUSE-FULL | `npm --prefix frontend run test:unit -- src/__tests__/Warehouse.test.tsx src/__tests__/AppShell.test.tsx src/__tests__/ApiContracts.test.ts src/__tests__/Primitives.test.tsx` | 2 | PASS | 57 passed, 0 fail |
| TC-CONFORMANCE | `npm run check:conformance-contracts && node --test scripts/check-conformance-contracts.test.mjs` | 2 | PASS | 24/24 PASS, Conformance PASS |
| TC-BUILD-FE | `npm --prefix frontend run build` | 4 | PASS | Vite built in 855ms, 0 errors |
| TC-LINT-FE | `npm --prefix frontend run lint` | 3 | PASS | 0 errors, 1 inherited warning |
| TC-DEPCRUISE-FE | `npm --prefix frontend run depcruise` | 3 | PASS | 0 violations (74 modules, 299 dependencies) |

---

## 7. Nguồn cần đọc

| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---|---|---|---|
| 1 | `AGENTS.md` | Nguyên tắc bất biến, rào chắn an toàn và lifecycle governance | đã kiểm tra |
| 2 | `.planning/WORK.md` | Task ledger - nguồn chân lý duy nhất cho tiến độ thực tế | đã kiểm tra |
| 3 | `docs/superpowers/plans/2026-10-18-complete-mrx-production-program-plan.md` | Kế hoạch tổng thể 13 Master Tasks của Complete MRX Program | đã kiểm tra |
| 4 | `backend/src/IPCManagement.Api/Migrations/20261020065952_ResolveReconciliationSourceDeltas.cs` | Migration vừa sinh cần được review trước khi xin quyền apply | đã kiểm tra |
| 5 | `backend/src/IPCManagement.Api/Features/Inventory/Services/ReconciliationInventoryIssueCreator.cs` | Logic giải quyết positive supplemental issue delta | đã kiểm tra |
| 6 | `backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReturnService.cs` | Logic giải quyết negative physical return delta khi confirm receipt | đã kiểm tra |
| 7 | `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx` | UI workbench xử lý queue delta nguồn cho Thủ kho | đã kiểm tra |
| 8 | `frontend/src/routes/routeRegistry.ts` | Route registry và điều kiện eligibility của 14 canonical routes | đã kiểm tra |

---

## 8. Bước tiếp theo

| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---|---|---|---|
| 1 | Xin lệnh Owner: Tạo bản backup MySQL mới và apply migration `20261020065952_ResolveReconciliationSourceDeltas` | Owner duyệt bằng văn bản | Dump file SHA-256 được lưu; `dotnet ef database update` hoàn tất; probe các cột mới trên MySQL thành công |
| 2 | Bổ sung owner test Frontend cho trường hợp xử lý negative delta (hoàn trả vật lý) trong `Warehouse.test.tsx` | Bước 1 xong | Test mô phỏng click hoàn trả gọi đúng `createReturn` và `confirmReturn`, test PASS |
| 3 | Chuyển readiness của route `mrx.issues` trong `routeRegistry.ts` từ `BLOCKED` sang `READY` và cập nhật capabilities trong `SystemOperationEligibility.cs` | Bước 1 & 2 xong | `AppShell.test.tsx`, `SystemOperationCapabilityProfileTests.cs` và conformance tests đều PASS |
| 4 | Đánh dấu Master Task 6 `COMPLETE` trong `.planning/WORK.md` | Bước 3 xong | Ledger cập nhật, verification gates đều PASS |
| 5 | Bắt đầu Master Task 7 (Atomic Multi-Customer Preparation) theo TDD | Task 6 COMPLETE | Viết failing tests cho gộp nguyên liệu theo nhà cung cấp/ngày nhưng tách giao dịch theo customer |

---

## 9. Chưa biết và xung đột
- UNKNOWN: Chưa xác minh thời điểm Owner muốn commit và push git nhánh này lên remote.
- Giả định chưa chốt: Giả định rằng database MySQL cục bộ (`localhost:3306/ipcmanagement`) là môi trường thử nghiệm duy nhất cần apply migration cho lượt kiểm tra này.
- Xung đột giữa đặc tả, code và log: Một test cũ kế thừa `Reconciliation.test.tsx` có hard-code ngày `2026-10-19` bị lệch 1 ngày so với ngày hệ thống thực tế `2026-10-20` khi chạy toàn bộ suite; cần lưu ý khi chạy filter rộng.
- Rủi ro nếu làm tiếp khi chưa giải quyết: Nếu tự ý apply migration mà không backup, nếu có lỗi DDL với foreign key MySQL như lần trước sẽ gây rủi ro toàn vẹn dữ liệu thử nghiệm.

---

## 10. Prompt tiếp nhận

```text
Tiếp nhận bàn giao tại D:\ki7\PRN222 Doanh Nghiệp\IPCManagement\docs\handoff\HANDOFF.md.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc AGENTS.md, rồi file bàn giao, sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: Hoàn tất Complete MRX Production Program, bắt đầu từ việc hoàn thiện Master Task 6.
Điều cấm: Không commit/push git, không tự ý apply migration/mutate DB mà không có backup và lệnh duyệt của Owner, không phá vỡ DOM-MODE-1.
Việc đầu tiên: Xin lệnh Owner backup MySQL và apply migration 20261020065952_ResolveReconciliationSourceDeltas, sau đó bổ sung test UI cho physical return queue.
```
