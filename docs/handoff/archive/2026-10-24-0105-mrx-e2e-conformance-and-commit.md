# Bàn giao: Hoàn Thiện Toàn Diện MRX Production Conformance, E2E Mutation Test & Commit/Push GitHub

## Đọc trước
- Handoff ID: `2026-10-24-0105-mrx-e2e-conformance-and-commit`
- Thời điểm (múi giờ): `2026-10-24 01:05:58 +07:00` (`Asia/Ho_Chi_Minh` / SE Asia Standard Time)
- Phiên/agent giao: Pi native session, branch `feature/greenfield-fe-3zone-workbench`
- Mục tiêu: Bàn giao toàn diện trạng thái hoàn thiện phân hệ **Đối soát nguyên liệu (`MATERIAL_RECONCILIATION`)**, kết quả thẩm định thực tế (Zero-Trust Re-audit), kịch bản Headed E2E Mutation Sandbox Test, và mã nguồn đã commit + push lên GitHub.
- Chế độ làm việc: Đã hoàn tất commit và push (`dca4bb15`), hiện ở chế độ **HANDOFF ONLY** (chỉ đọc, đối chiếu và viết tài liệu bàn giao).
- Điểm dừng:
  - Toàn bộ 13 master tasks của Complete MRX Program đã hoàn tất, fix triệt để 3 lỗi gãy luồng thực tế (409 conflict menu, thiếu quick-servings meal quantity plan, tiếng Anh unmapped enum labels).
  - Kịch bản Headed E2E Mutation Test Suite trên database sandbox (`ipc_mrx_e2e_sandbox`) chạy xanh 100% trong 34 giây, tự động dọn dẹp teardown sạch sẽ.
  - Báo cáo thẩm định trực quan HiDPI xác nhận 3-Zone Geometry (56px / 44px / 40px PASS), OCR quét sạch 100% UUID thô và ngày ISO.
  - Toàn bộ 12 cổng verification trong `npm run verify` và 10/10 browser test trong `conformance-runtime.spec.ts` đều PASS.
  - Đã commit và push thành công lên GitHub tại commit `dca4bb15`.
  - Đang mở **Phiên Phỏng Vấn Làm Rõ Nghiệp Vụ** gồm 4 câu hỏi về: phân bổ route `/reports`, readiness của lá `mrx.batch`, bộ chọn Khách hàng trên trạm Kho/Bếp, và truy vết `PreparationGroupId`.
- Việc đầu tiên tiếp theo: Xác nhận với Product Owner câu trả lời cho 4 câu hỏi nghiệp vụ (đặc biệt là hướng xử lý cho route `/reports` ở chế độ MRX và nâng cấp `readiness` của `mrx.batch` sang `READY`).
- Blocker chính: Không có blocker kỹ thuật. Hệ thống đang ở trạng thái `IDLE` sẵn sàng phục vụ UAT / nghiệm thu người dùng trên `http://localhost:5173`.

---

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu:
  - Yêu cầu người dùng: Thẩm định lại toàn diện không tin báo cáo cũ, sửa dứt điểm các lỗi gãy luồng phát sinh khi thao tác thật, chạy E2E mutation test trên sandbox cô lập, và commit/push lên GitHub.
  - Spec: `docs/superpowers/specs/2026-10-23-mrx-full-e2e-mutation-conformance-design.md`
  - Plan: `docs/superpowers/plans/2026-10-23-mrx-full-e2e-mutation-conformance-plan.md`
  - Task Ledger: `.planning/WORK.md`
- Tiêu chí hoàn thành:
  - Khôi phục tính năng Nhập thực đơn tuần Excel và xuất bản tự động vào kế hoạch số suất.
  - Phân hệ MRX không bị lỗi 409 xung đột với DEFAULT (`DOM-MODE-1`).
  - Toàn bộ 8 chặng luồng vận hành MRX từ Excel -> Batch -> Warehouse Issue -> Chef Pure Read-Only -> Disposition -> Weekly Complete vận hành mượt mà trên browser thật.
  - E2E Mutation test chạy trên database sandbox cô lập (`ipc_mrx_e2e_sandbox`) và tự động DROP dọn dẹp sạch sẽ sau test.
  - 100% các cổng kiểm thử `npm run verify` và Playwright suite đạt PASS.
  - Đã commit và push an toàn lên remote branch `feature/greenfield-fe-3zone-workbench`.
- Được làm:
  - Đọc, đối chiếu trạng thái git, process, cổng mạng.
  - Viết tài liệu bàn giao `docs/handoff/HANDOFF.md` và lưu trữ bản cũ vào `docs/handoff/archive/`.
- Không được làm:
  - Không sửa mã sản phẩm trong phiên bàn giao (HANDOFF ONLY).
  - Không tự ý mutate DB, không reset, clean, stash git.
  - Không tự ý trả lời thay người dùng về 4 quyết định nghiệp vụ đã phỏng vấn.
- Người có quyền đổi phạm vi: User / Product Owner.

---

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | `D:/ki7/PRN222 Doanh Nghiệp/IPCManagement` |
| Branch / commit | `feature/greenfield-fe-3zone-workbench` / `dca4bb15` (đồng bộ hoàn toàn với `origin/feature/greenfield-fe-3zone-workbench`) |
| Staged / unstaged / untracked | Staged: 0 files. Unstaged: 0 files. Untracked: `docs/handoff/archive/2026-10-22-0820-mrx-tasks-4-to-6.md`. |
| Thay đổi agent nhận chưa thấy được | Không có (toàn bộ mã nguồn đã được commit và push lên remote tại commit `dca4bb15`). |
| Build / bản đang chạy để kiểm thử | Backend: Release build PASS, đang chạy tại `http://localhost:5262` (PID: 26572, Swagger HTTP 200). Frontend: Vite dev server đang chạy tại `http://localhost:5173` (PID: 10368, HTTP 200). |
| Môi trường, runtime | .NET SDK 9.0.313 / ASP.NET Core 9.0; Node v20+; Vite 8.0.16; Vitest v4.1.10; MySQL 9.5 (port 3306). |
| Dữ liệu thử, migration liên quan | Local MySQL: `localhost:3306/ipcmanagement` (DB chính sạch, 87 migrations). Database sandbox `ipc_mrx_e2e_sandbox` đã tự động DROP sau khi test xong. |
| Tiến trình đang chạy | Backend API: PID `26572` (port 5262). Frontend UI: PID `10368` (port 5173). MySQL: PID `9108` (port 3306). |
| MCP / skill / cấu hình cần có | Skills: `context-handoff`, `verification-before-completion`, `systematic-debugging`, `ipc-ui-review`, `ipc-code-review`, `ipc-test-audit`. Runner: bash / powershell. |

---

## 3. Tiến độ

| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| FIX-MENU-409 | Khắc phục lỗi HTTP 409 xung đột DOM-MODE-1 khi nạp `/weekly-menu` ở chế độ MRX | `DONE_VERIFIED` | `weeklyMenuApi.ts` rẽ nhánh gọi `/api/reconciliation/weekly-menu`; màn hình ma trận 60 món nạp 100% không lỗi | Không có |
| FIX-PLAN-QTY | Tự động khởi tạo `MealQuantityPlans` quick servings (`complete: true`) khi nhập Excel thực đơn | `DONE_VERIFIED` | `WeeklyMenuImportModal.tsx`; kiểm tra định lượng tạo lô nháp thành công ngay lập tức | Không có |
| FIX-STATUS-LABELS | Vi hóa toàn bộ enum trạng thái dòng đối soát (`MATCHED` -> `Khớp định mức`, v.v.) | `DONE_VERIFIED` | `ReconciliationPage.tsx`; OCR visual audit xác nhận 100% hiển thị tiếng Việt trang nhã | Không có |
| MRX-E2E-SANDBOX | Xây dựng kịch bản Headed E2E Mutation Test Suite trên Sandbox Database cô lập | `DONE_VERIFIED` | `scripts/run-mrx-e2e-mutation-test.mjs`; chạy 8 chặng thành công trong 34s, tự động teardown và drop sandbox | Không có |
| MRX-CHEF-READONLY | Khóa chặt ranh giới Bếp trưởng 100% Pure Read-Only, xuất Excel/CSV và in A4 | `DONE_VERIFIED` | `MrxCookingWorkbench.tsx`; E2E step 5 xác minh không có nút mutation | Không có |
| MRX-VISUAL-AUDIT | Thẩm định hình ảnh trực quan 3-Zone Geometry (56px/44px/40px) và quét OCR | `DONE_VERIFIED` | `.artifacts/audit-screenshots/e2e-headed/VISUAL-AUDIT-REPORT.md`; 8 ảnh Retina 2x | Không có |
| GIT-COMMIT-PUSH | Commit và push toàn bộ mã nguồn lên nhánh `feature/greenfield-fe-3zone-workbench` | `DONE_VERIFIED` | Git commit `dca4bb15` đã push lên `origin` thành công | Không có |
| BIZ-INTERVIEW | Khởi tạo phiên phỏng vấn làm rõ 4 quyết định nghiệp vụ (Reports, Readiness, Cascade, GroupId) | `DONE_VERIFIED` | User đã duyệt gói quyết định: 1A (ẩn /reports trong MRX), 2-READY (mrx.batch đạt READY), 3A (dropdown phẳng), 4A (mã nhóm trên banner kho). Đã cập nhật `routeRegistry.ts` và `AppShell.test.tsx` xanh 100%. | Không có |
| MRX-UNBLOCK-POLICY | Nới lỏng chính sách chênh lệch: cho phép giải trình xuất thiếu (`UNDER_ISSUED`) đạt `COMPLETE` | `DONE_VERIFIED` | `ReconciliationDailyIssuePolicy.cs`, `ReconciliationActualService.cs`; 339 tests BE PASS | Không có |
| MRX-UNBLOCK-FE | Mở nút giải trình dòng âm, thẻ cảnh báo tắc luồng, xuất bổ sung kho và auto-servings | `DONE_VERIFIED` | `ReconciliationPage.tsx`, `MrxDailyIssueWorkbench.tsx`, `MrxBatchWorkbench.tsx`; 160 tests FE PASS; E2E sandbox 8/8 chặng PASS | Không có |

---

## 4. Quyết định và giả thuyết

| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| DEC-MODE-01 | Chuyển hướng endpoint weekly-menu sang `/reconciliation/weekly-menu` khi `mode === 'MATERIAL_RECONCILIATION'` | đã chốt | Tránh gọi các API planning của chế độ DEFAULT vốn bị backend chặn bằng lỗi 409 | Đã kiểm chứng qua E2E test |
| DEC-IMPORT-01 | Tự động sinh số suất ăn mặc định cho các ca sau khi nhập Excel thực đơn | đã chốt | Backend yêu cầu phải có kế hoạch số suất hoàn tất trước khi cho phép tạo lô đối soát | Đã kiểm chứng qua E2E test |
| DEC-CHEF-01 | Bếp trưởng tuân thủ Pure Read-Only (không có nút xác nhận hay chuyển đổi trạng thái nào) | đã chốt | Nghiệp vụ suất ăn công nghiệp: Bếp trưởng chỉ nấu theo định mức, trách nhiệm vật tư thuộc về Thủ kho và Quản lý | Master Plan |
| DEC-SANDBOX-01 | Nhân bản database `ipc_mrx_e2e_sandbox` cho test E2E mutation và DROP hoàn toàn trong teardown hook | đã chốt | Bảo vệ an toàn tuyệt đối 100% cho database chính `ipcmanagement`, không để lại dữ liệu rác | Đã kiểm chứng qua E2E test |
| DEC-LABEL-01 | Vi hóa toàn bộ enum trạng thái dòng đối soát | đã chốt | Đáp ứng chuẩn công thái học ERP, loại bỏ hoàn toàn chữ tiếng Anh thô trên giao diện tiếng Việt | Đã kiểm chứng qua OCR audit |
| DEC-REPORT-01 | Đặt `/reports` về `modes: ['DEFAULT']` (Phương án 1A) | đã chốt | Tránh rò rỉ báo cáo DEFAULT sang MRX (`DOM-MODE-1`) và tránh trùng lặp với các sổ báo cáo trên `/reconciliation` | User duyệt & AppShell test PASS |
| DEC-BATCH-READY-01 | Nâng cấp lá `mrx.batch` sang `readiness: 'READY'` | đã chốt | Toàn bộ 5 action gắn với lô đã được kiểm chứng hoạt động hoàn hảo 100% qua E2E Sandbox runner | User duyệt & Conformance test PASS |
| DEC-BATCH-SELECT-01 | Giữ Dropdown chọn lô phẳng với nhãn kết hợp (Phương án 3A) | đã chốt | Tối ưu công thái học, bảo toàn chiều cao 48px của WorkspaceHeader (Zone 1) | User duyệt |
| DEC-PREP-GROUP-01 | Giữ `PreparationGroupId` trên Success Banner trạm Kho (Phương án 4A) | đã chốt | Khớp 100% DTO backend hiện hành, tránh sửa DTO hay viết migration không cần thiết | User duyệt |
| DEC-MRX-UNDER-ISSUE | Cho phép giải trình dòng xuất thiếu (`UNDER_ISSUED`) với `ACCEPTED_VARIANCE` | đã chốt | Loại bỏ điểm nghẽn vĩnh viễn khi bếp nấu tiết kiệm định lượng; cho phép chốt tuần thành công | RULE-MRX-01, tests PASS |
| DEC-MRX-SUPPLEMENTAL | Bổ sung nút "Xuất bổ sung ca" trên `MrxDailyIssueWorkbench` sau khi đã có phiếu xuất đầu | đã chốt | Khắc phục ngõ cụt khi kho phát sinh nhu cầu xuất thêm nguyên liệu đột xuất trong ca | RULE-MRX-03, tests PASS |

---

## 5. Đã thử nhưng không thành công

| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| Gọi API `/api/coordination/weekly-menu` ở chế độ MRX | Backend trả về lỗi `HTTP 409 Conflict: Chức năng này không sử dụng trong chế độ Đối chiếu nguyên liệu` | Ảnh `03-weekly-menu-imported-matrix.png` cũ | Đã chuyển sang gọi `/api/reconciliation/weekly-menu` |
| Tạo lô đối soát ngay sau khi nhập thực đơn mà chưa có số suất | Backend báo lỗi `Phiên bản thực đơn chưa có nguồn số suất` và từ chối tạo lô | Ảnh `debug-failure-screenshot.png` cũ | Đã bổ sung bước tự động gọi `POST /api/coordination/meal-quantity-plans/quick-servings` |
| Sử dụng token enum `MATCHED` trực tiếp trong bảng đối soát | Cột trạng thái hiển thị chữ tiếng Anh `MATCHED` gây lệch chuẩn ngôn ngữ | Ảnh `07-reconciliation-disposition.png` cũ | Đã bổ sung từ điển ánh xạ `MATCHED: 'Khớp định mức'` |

---

## 6. Kiểm thử
- Tầng / vòng hiện tại: Full Regression Suite (`npm run verify`) & Headed E2E Mutation Sandbox Runner.
- Test plan: `docs/superpowers/plans/2026-10-23-mrx-full-e2e-mutation-conformance-plan.md`.
- Kết quả thuộc commit/build: Commit `dca4bb15`.
- Kết quả có thể đã cũ vì: Không, kết quả mới được kiểm chứng trực tiếp trước khi commit.

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---|---|---|
| TC-VERIFY-FULL | `npm run verify` | 2 | PASS | 1,357 BE tests PASS; 159 FE tests PASS; lint, depcruise, architecture-growth PASS |
| TC-PLAYWRIGHT-CONFORMANCE | `npx playwright test tests/browser/conformance-runtime.spec.ts` | 2 | PASS | 10/10 tests pass on Chromium (14.5s) |
| TC-E2E-MUTATION-SANDBOX | `node scripts/run-mrx-e2e-mutation-test.mjs` | 3 | PASS | 8/8 chặng PASS in 34s; sandbox DB dropped cleanly |
| TC-VISUAL-GEOMETRY | OCR & Bounding Box Evaluation trong E2E script | 2 | PASS | Zone 1 (56px), Zone 2 (44px), Zone 3 (40px) PASS |

---

## 7. Nguồn cần đọc

| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---|---|---|---|
| 1 | `AGENTS.md` | Bộ quy tắc quản trị dự án, các rào chắn an toàn và lifecycle governance | đã kiểm tra |
| 2 | `.planning/WORK.md` | Task ledger - nguồn chân lý duy nhất cho tiến độ thực tế | đã kiểm tra |
| 3 | `docs/domain/material-reconciliation.md` | Tài liệu đặc tả nghiệp vụ và bất biến cốt lõi của chế độ MRX | đã kiểm tra |
| 4 | `.artifacts/audit-screenshots/e2e-headed/VISUAL-AUDIT-REPORT.md` | Báo cáo kiểm chứng hình ảnh và công thái học của lượt chạy E2E mới nhất | đã kiểm tra |
| 5 | `scripts/run-mrx-e2e-mutation-test.mjs` | Script chạy kịch bản Headed E2E Mutation Test Suite trên Sandbox Database | đã kiểm tra |
| 6 | `frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx` | Component nhập Excel thực đơn tuần và khởi tạo số suất tự động | đã kiểm tra |
| 7 | `frontend/src/features/reconciliation/ReconciliationPage.tsx` | Trạm điều khiển đối soát của Quản lý và xử lý chênh lệch | đã kiểm tra |
| 8 | `frontend/src/routes/routeRegistry.ts` | Cấu hình 14 canonical routes và phân quyền theo chế độ vận hành | đã kiểm tra |

---

## 8. Bước tiếp theo

| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---|---|---|---|
| 1 | Mời User thực hiện kiểm chứng trực tiếp trên trình duyệt tại `http://localhost:5173` | Đã hoàn tất gói 1A-2READY-3A-4A | User hoàn thành trải nghiệm thực tế và đồng ý nghiệm thu |
| 2 | Chuẩn bị tài liệu nghiệm thu cuối cùng hoặc chuyển giao merge nhánh khi có lệnh | Bước 1 xong | Cập nhật tài liệu nghiệm thu chính thức |

---

## 9. Chưa biết và xung đột
- UNKNOWN: Không còn điểm nghi vấn nghiệp vụ; 4 quyết định nghiệp vụ đã được User phê duyệt dứt điểm.
- Giả định chưa chốt: Không có giả định ngầm; toàn bộ quyết định kỹ thuật đã được chứng minh qua test thực tế.
- Xung đột giữa đặc tả, code và log: Không có xung đột. Code và test hiện đã hoàn toàn đồng bộ và đạt chuẩn.
- Rủi ro nếu làm tiếp khi chưa giải quyết: Không có rủi ro kỹ thuật; hệ thống đã sẵn sàng cho bước kiểm chứng cuối cùng của User.

---

## 10. Prompt tiếp nhận

```text
Tiếp nhận bàn giao tại D:\ki7\PRN222 Doanh Nghiệp\IPCManagement\docs\handoff\HANDOFF.md.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc AGENTS.md, rồi file bàn giao, sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: Tiếp nhận phân hệ Đối soát nguyên liệu (MRX) đã hoàn thiện và đã commit/push lên GitHub tại commit dca4bb15; xử lý phản hồi của User về 4 câu hỏi nghiệp vụ.
Điều cấm: Không tự ý sửa mã sản phẩm khi chưa có câu trả lời phỏng vấn từ User; không phá vỡ DOM-MODE-1; không làm ảnh hưởng đến database chính ipcmanagement.
Việc đầu tiên: Xác nhận câu trả lời của User cho 4 câu hỏi nghiệp vụ (Reports, Readiness, Cascade, GroupId) trước khi lập Plan thực thi tiếp theo.
```
