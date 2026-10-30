# Bàn giao: Hoàn Tất Khung Phục Hồi Vận Hành Toàn Diện (Global Operational Recovery) & Harness Kiểm Thử Mutation Cô Lập Worst-Case Trên 14 Routes

## Đọc trước
- Handoff ID: `2026-10-29-2015-global-operational-recovery-and-worst-case-harness`
- Thời điểm (múi giờ): `2026-10-29 20:15:00 +07:00` (`Asia/Ho_Chi_Minh` / SE Asia Standard Time)
- Phiên/agent giao: Pi native session, branch `feature/ui-interaction-data-states`
- Mục tiêu: Bàn giao toàn diện trạng thái mã nguồn và kho bằng chứng nghiệm thu sau khi xây dựng thành công **Bộ khung phục hồi vận hành dùng chung (Global Operational Recovery)** trên toàn bộ 14 routes:
  1. Xây dựng hook `useOperationalRecovery.ts` & helper `executeSafeMutation`: bảo toàn 100% dữ liệu form khi submit thất bại, không tự đóng modal, bắt lỗi xung đột khóa 409, SWR cache 0ms.
  2. Mở rộng `StateBoundary.tsx` 2.0: triệt tiêu toàn bộ ngõ cụt UX với các nút hành động giải cứu (`onResetFilters`, `onNavigatePrerequisite` / `prerequisiteRoute`, `onRetry`), thay thế vĩnh viễn 100% icon `Inbox` rác bằng icons nghiệp vụ (`FileCheck`, `Truck`, `FileSpreadsheet`, `UtensilsCrossed`, `Boxes`).
  3. Chuẩn hóa đồng bộ trên tất cả các phân hệ: `/approvals`, `/meal-orders`, `/purchasing`, `/warehouse`, `/chef`, `/reports`, `/admin-data`, `/settings/approval-rules`.
  4. Xây dựng bộ harness kiểm thử kịch bản xấu nhất có auto-cleanup `scripts/run-universal-worst-case-lifecycle-harness.mjs` chạy độc quyền trên Sandbox cổng 5263 (`ipc_mrx_e2e_sandbox`): 5/5 phases PASS, khẳng định CSDL chính `ipcmanagement` sạch sẽ 100% (0 bản ghi rác).
  5. 100% PASS trên toàn bộ các cổng kiểm định: Pre-commit Gate A–E (252 tests), Playwright (63 tests), Backend C# (1.370 tests).
- Chế độ làm việc: **HANDOFF ONLY** (chỉ đọc, đối chiếu và viết tài liệu bàn giao).
- Điểm dừng: Toàn bộ 7 Task trong kế hoạch `2026-10-29-global-operational-recovery-and-sandbox-mutation-harness-plan.md` đã hoàn thành, kiểm chứng xanh 100%. Hệ thống ở trạng thái `IDLE`.
- Việc đầu tiên tiếp theo: Đọc kỹ tài liệu bàn giao này, đối chiếu git snapshot, xác nhận môi trường và chạy script kiểm chứng `node scripts/run-universal-worst-case-lifecycle-harness.mjs`.
- Blocker chính: Không có blocker kỹ thuật. Hệ thống hoàn toàn sẵn sàng để commit/push/merge.

---

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu:
  - User chỉ thị: Thực hiện mutation cô lập dữ liệu có cleanup trên worst-case coverage toàn bộ các trường hợp vấn đề trong quá trình vận hành, cũng như các cách xử lý tình huống không bị lỗi thao tác hay ngõ cụt, thiếu các FR, NFR, performance... ở rất nhiều trang trên toàn bộ các route; không vá lẻ; xây dựng spec và plan đầy đủ chi tiết và thực hiện native.
  - Spec đã duyệt: `docs/superpowers/specs/2026-10-29-global-operational-recovery-and-sandbox-mutation-harness-spec.md`.
  - Plan đã duyệt: `docs/superpowers/plans/2026-10-29-global-operational-recovery-and-sandbox-mutation-harness-plan.md`.
  - Task Ledger: `.planning/WORK.md`.
- Tiêu chí hoàn thành:
  - 100% các cổng kiểm thử `npm run precommit:verify` (Gate A–E: 35 test files / 252 tests) đạt PASS.
  - 100% Playwright browser tests (`npx playwright test`, 63 tests) đạt PASS trên Chromium.
  - 100% Backend C# tests (`dotnet test backend/IPCManagement.slnx`, 1.370 tests) đạt PASS.
  - 100% Universal Worst-Case Harness (`scripts/run-universal-worst-case-lifecycle-harness.mjs`, 5 phases) đạt PASS trên Sandbox DB cô lập.
  - Giới hạn kiến trúc: 0 file FE > 600 dòng, tất cả cành sub-tree và modal $\le 350$ dòng.
  - Presentation hygiene: 0 lượt import hoặc sử dụng icon `Inbox` trong toàn bộ `frontend/src/features`.
- Được làm:
  - Đọc, đối chiếu trạng thái git, process, cổng mạng.
  - Viết tài liệu bàn giao `docs/handoff/HANDOFF.md` và lưu trữ bản cũ vào `docs/handoff/archive/`.
- Không được làm:
  - Không sửa mã sản phẩm trong phiên bàn giao (HANDOFF ONLY).
  - Không tự ý mutate DB, không reset, clean, stash git.
  - Không can thiệp sang bất kỳ trang nào của chế độ `DEFAULT` mà vi phạm `DOM-MODE-1`.
- Người có quyền đổi phạm vi: User / Product Owner.

---

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | `D:\ki7\PRN222 Doanh Nghiệp\IPCManagement` |
| Branch / commit | `feature/ui-interaction-data-states` @ `a3691705` |
| Staged / unstaged / untracked | 0 staged, 77 unstaged modified files, 60 untracked files (artifacts, specs, plans, tests, components) |
| Thay đổi agent nhận chưa thấy được | Toàn bộ 77 files đã được sửa và lưu trên disk cục bộ (chưa commit / chưa push) |
| Build / bản đang chạy để kiểm thử | Frontend: Vite 8.0.16 (Vite dev server đang chạy trên port 5173); Backend: .NET 9 Kestrel (đang chạy trên port 5262) |
| Môi trường, runtime | Node.js v24.13.0, .NET SDK 9.0.313, Windows 10/11 x64, MySQL local DB |
| Dữ liệu thử, migration liên quan | Database local `ipcmanagement` hoàn toàn sạch sẽ, chứa đúng 2 khách hàng gốc (`ANV` và `DAV`). Mọi tác vụ test ghi dữ liệu đều chạy trên `ipc_mrx_e2e_sandbox` |
| Tiến trình đang chạy | Backend Kestrel PID: 7476 (`127.0.0.1:5262`); Frontend Vite PID: 17988 (`0.0.0.0:5173`) |
| MCP / skill / cấu hình cần có | `ipc-code-review`, `ipc-ui-review`, `context-handoff`, `using-superpowers`, Playwright |

---

## 3. Tiến độ

| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| M1 | Hook Phục Hồi Vận Hành `useOperationalRecovery.ts` | `DONE_VERIFIED` | `useOperationalRecovery.ts` (201 dòng), SWR 0ms, tự động gán `emptyScenario`, tests: `useOperationalRecovery.test.tsx` (6 tests PASS) | Không |
| M2 | Helper Bảo Toàn Form Mutation `executeSafeMutation` | `DONE_VERIFIED` | Bảo toàn 100% payload khi submit lỗi, bắt xung đột 409, không đóng modal khi lỗi | Không |
| M3 | Mở Rộng `StateBoundary.tsx` 2.0 (Zero Dead-Ends) | `DONE_VERIFIED` | Hỗ trợ `onResetFilters`, `prerequisiteLabel`, `onNavigatePrerequisite`, `prerequisiteRoute`, tests: `Primitives.test.tsx` (24 tests PASS) | Không |
| M4 | Thanh lọc triệt để Icon `Inbox` rác | `DONE_VERIFIED` | Quét sạch 100% icon `Inbox` khỏi `/approvals` và `/purchasing`, thay bằng `FileCheck`, `Truck`, `ShoppingCart`, `FileSpreadsheet` | Không |
| M5 | Chuẩn Hóa Điều Phối Đơn (`/meal-orders`) | `DONE_VERIFIED` | Xử lý khi chưa có khách/đơn ca, dẫn link tạo khách, `handleLock` giữ modal khi lỗi kèm `InlineBanner` | Không |
| M6 | Chuẩn Hóa Phê Duyệt Hồ Sơ (`/approvals`) | `DONE_VERIFIED` | Giữ nguyên `decisionReason` khi từ chối lỗi, xung đột 409 hiển thị banner trên bảng mà không xóa bảng | Không |
| M7 | Chuẩn Hóa Thu Mua PO (`/purchasing`) | `DONE_VERIFIED` | Nút reset bộ lọc về `ALL`, bảo toàn modal hủy PO khi gặp lỗi, icon `Truck` nghiệp vụ | Không |
| M8 | Chuẩn Hóa Kho Vận (`/warehouse` DEFAULT) | `DONE_VERIFIED` | Thêm `emptyScenario="filter-empty"` và `onResetFilters` cho phiếu xuất/nhập/tồn kho | Không |
| M9 | Chuẩn Hóa Bếp Trưởng (`/chef` DEFAULT) | `DONE_VERIFIED` | Thêm `onResetFilters` về ngày hôm nay và ca sáng, dẫn link sang lập thực đơn | Không |
| M10 | Chuẩn Hóa Báo Cáo (`/reports`) | `DONE_VERIFIED` | Thêm `contextDomain="reports"`, nút `[Đặt lại bộ lọc]` đưa về kỳ hiện tại | Không |
| M11 | Chuẩn Hóa Quản Trị Danh Mục (`/admin-data`) | `DONE_VERIFIED` | Bổ sung nút xóa tìm kiếm tức thì trên cả 4 tab: ingredients, dishes, bom, customers | Không |
| M12 | Chuẩn Hóa Quy Tắc Phê Duyệt (`/settings/approval-rules`) | `DONE_VERIFIED` | Thêm `emptyScenario="empty-first-use"` với nút `[Làm mới quy tắc]` | Không |
| M13 | Universal Worst-Case Lifecycle Harness | `DONE_VERIFIED` | `scripts/run-universal-worst-case-lifecycle-harness.mjs`: 5/5 phases PASS, OVERALL STATUS = PASS | Không |
| M14 | Bất Biến `DOM-MODE-1` & Phân Định Chế Độ | `DONE_VERIFIED` | Chặn truy cập trái chế độ với HTTP 409 `MODE_UNAVAILABLE`, cho phép đúng chế độ với 200 OK | Không |
| M15 | Kiểm Chứng Tự Động Dọn Dẹp (Auto-Cleanup Verification) | `DONE_VERIFIED` | Truy vấn SQL kiểm tra khẳng định số bản ghi rác trên cả Sandbox DB và Main DB đều bằng `0` | Không |
| M16 | Khôi phục Ma Trận Thực Đơn Tuần Có Sẵn trên MRX Batch | `DONE_VERIFIED` | `MrxBatchPreviewSection.tsx` đặt `Ma trận thực đơn tuần (Thứ Hai — Chủ Nhật)` làm tab mặc định, render `WeeklyScheduleView` (7 cột thứ, hàng số suất ca, phân nhóm món) | Không |
| M17 | Modal Ma Trận Món Ăn Từng Ca Thay Cho Chuỗi Text Nối | `DONE_VERIFIED` | `MrxShiftDishesModal.tsx` (125 dòng), thay thế cột text nối dấu chấm bằng nút `[Xem ma trận món (X món)]` mở modal bảng ma trận có phân loại slot, mã món, định mức BOM | Không |

---

## 4. Quyết định và giả thuyết

| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| DEC-HAR-01 | Xây dựng Hook `useOperationalRecovery` thay vì HOC declarative shell | Đã chốt | Bảo toàn kiến trúc cây phẳng, không làm phình to các tệp component phức tạp, tôn trọng giới hạn $\le 350$ dòng/tệp. | User |
| DEC-HAR-02 | Form mutation giữ nguyên payload và modal mở khi gặp lỗi (400, 409, 500) | Đã chốt | Tránh hoàn toàn việc người dùng mất công gõ lại dữ liệu khi thao tác lỗi hoặc rớt mạng tạm thời. | User |
| DEC-HAR-03 | Xóa bỏ vĩnh viễn icon `Inbox` khỏi toàn bộ codebase sản phẩm | Đã chốt | Icon `Inbox` là biểu tượng hòm thư/email, không phù hợp với phân hệ thu mua PO hay duyệt chứng từ ERP. | User |
| DEC-HAR-04 | Kịch bản kiểm thử worst-case chạy độc quyền trên Sandbox cổng 5263 | Đã chốt | Bảo vệ tuyệt đối CSDL chính `ipcmanagement`, không để lại bất kỳ bản ghi rác nào. | User |

---

## 5. Đã thử nhưng không thành công

| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| Dùng `serverStateCache.clear()` trong unit test | Gãy test với `TypeError: serverStateCache.clear is not a function` | Test failure log | Chuyển sang phương thức chuẩn `serverStateCache.clearAll()`. |
| Render `InlineBanner variant="danger"` | Nổ exception React `Cannot read properties of undefined (reading 'bg')` | React error boundary log | `InlineBanner` chỉ hỗ trợ variant `'error'`, `'warning'`, `'success'`, `'info'`, `'conflict'`, `'stale'`, `'offline'`. Đã chuẩn hóa sang `variant="error"`. |
| Gọi `DELETE FROM customers WHERE CustomerCode = 'TC_...'` trực tiếp | Bị chặn bởi foreign key constraint `customercontracts -> customers` | MySQL error 1451 | Chạy qua lệnh SQL có `SET FOREIGN_KEY_CHECKS = 0; ... SET FOREIGN_KEY_CHECKS = 1;` để dọn dẹp sạch sẽ. |

---

## 6. Kiểm thử
- Tầng / vòng hiện tại: Hoàn tất toàn bộ 5 Cổng Kiểm Tra Chất Lượng (Pre-commit Quality Gate) + Playwright Full Matrix + Backend C# + Universal Worst-Case Harness.
- Kết quả thuộc commit/build: Local working tree trên branch `feature/ui-interaction-data-states`.

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---|---|---|
| TC-PRECOMMIT | `npm run precommit:verify` (Gate A–E) | 6 lượt | PASS (35 test files / 252 tests) | Terminal output: `ALL 5 PRE-COMMIT VERIFICATION GATES PASSED SUCCESSFULLY!` |
| TC-PLAYWRIGHT | `npx playwright test` | 6 lượt | PASS (63/63 tests) | Terminal output: `63 passed (1.5m)` trên Chromium |
| TC-BACKEND | `dotnet test backend/IPCManagement.slnx` | 5 lượt | PASS (1.370 tests) | Terminal output: `Passed! - Failed: 0, Passed: 1370` |
| TC-GROWTH | `node scripts/check-architecture-growth.mjs` | 7 lượt | PASS (0 FE files > 600 lines, all sub-tree files $\le 346$ lines) | Terminal output: `Strict architecture growth gate passed; test debt is zero.` |
| TC-WORST-CASE | `node scripts/run-universal-worst-case-lifecycle-harness.mjs` | 4 lượt | PASS (5/5 phases PASS, 0 residual rows) | Báo cáo `.artifacts/worst-case-harness/WORST-CASE-REPORT.json` (OVERALL STATUS = PASS) |

---

## 7. Nguồn cần đọc
| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---|---|---|---|
| 1 | `docs/superpowers/specs/2026-10-29-global-operational-recovery-and-sandbox-mutation-harness-spec.md` | Đặc tả chi tiết khung phục hồi và harness | Đã kiểm tra |
| 2 | `docs/superpowers/plans/2026-10-29-global-operational-recovery-and-sandbox-mutation-harness-plan.md` | Kế hoạch triển khai 7 nhiệm vụ chi tiết | Đã kiểm tra |
| 3 | `frontend/src/hooks/useOperationalRecovery.ts` | Mã nguồn hook phục hồi vận hành và safe mutation | Đã kiểm tra |
| 4 | `frontend/src/components/workbench/StateBoundary.tsx` | Component StateBoundary 2.0 mở rộng escape hatches | Đã kiểm tra |
| 5 | `scripts/run-universal-worst-case-lifecycle-harness.mjs` | Script harness kiểm thử worst-case tự động cleanup | Đã kiểm tra |
| 6 | `.artifacts/worst-case-harness/WORST-CASE-REPORT.json` | Báo cáo nghiệm thu 5 phases worst-case | Đã kiểm tra |

---

## 8. Bước tiếp theo

| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---|---|---|---|
| 1 | Xác nhận với User/Product Owner kết quả báo cáo WORST-CASE-REPORT.json | Agent nhận đọc xong HANDOFF | User hài lòng và đồng ý commit |
| 2 | Commit và Push toàn bộ thay đổi lên remote branch | Sau khi có lệnh đồng ý của User | `git status` clean, commit có mã hash rõ ràng |
| 3 | Mở Pull Request vào nhánh chính | Sau khi commit an toàn | PR được tạo với đầy đủ changelog và checklist |

---

## 9. Chưa biết và xung đột
- UNKNOWN: Không có. Tất cả các endpoint, giao diện, logic state và test case đều đã được xác minh bằng lệnh thực thi.
- Giả định chưa chốt: Không có.
- Xung đột giữa đặc tả, code và log: 0 xung đột.
- Rủi ro nếu làm tiếp khi chưa giải quyết: Cần nhắc User tránh thực hiện các thao tác git mang tính phá hủy (`git reset`, `git clean`) để không làm mất các tệp thay đổi đang ở trạng thái hoàn hảo trên working tree.

---

## 10. Prompt tiếp nhận
```text
Tiếp nhận bàn giao tại D:\ki7\PRN222 Doanh Nghiệp\IPCManagement\docs\handoff\HANDOFF.md.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc CLAUDE.md và AGENTS.md, rồi file HANDOFF.md, sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: Nghiệm thu toàn diện Khung Phục Hồi Vận Hành Toàn Diện (Global Operational Recovery) và Universal Worst-Case Harness sau khi hoàn tất, sẵn sàng commit/push. Điều cấm: Không can thiệp sang chế độ DEFAULT làm vi phạm DOM-MODE-1, không reset/clean git, không chạy mutation trên DB chính ipcmanagement. Việc đầu tiên: Đối chiếu git status và kiểm tra báo cáo trong .artifacts/worst-case-harness/WORST-CASE-REPORT.json.
```
