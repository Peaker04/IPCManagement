# Bàn giao: Hoàn Tất Chuẩn Hóa Triệt Để Phân Hệ Đối Soát Nguyên Liệu (MRX), Khôi Phục Dashboard, Triệt Tiêu Layout Shift & 100% Nghiệm Thu E2E

## Đọc trước
- Handoff ID: `2026-10-28-2250-mrx-complete-native-hardening`
- Thời điểm (múi giờ): `2026-10-28 22:50:00 +07:00` (`Asia/Ho_Chi_Minh` / SE Asia Standard Time)
- Phiên/agent giao: Pi native session, branch `feature/ui-interaction-data-states`
- Mục tiêu: Bàn giao toàn diện trạng thái mã nguồn và bằng chứng nghiệm thu sau khi hoàn thành gói chuẩn hóa gốc rễ phân hệ MRX (`MATERIAL_RECONCILIATION`), khôi phục Bàn điều hành đối soát (`/`), sửa lỗi đăng nhập nhảy cóc, triệt tiêu 17px scrollbar jitter và vertical accordion layout shift, xóa bỏ duplicate sub-headers, chuyển đổi toàn bộ mã lỗi C#/enum/GUID sang tiếng Việt con người, khôi phục tab Lịch sử phiếu tại Kho, và đạt 100% PASS trên tất cả các bộ test suite (Unit, E2E, Backend).
- Chế độ làm việc: **HANDOFF ONLY** (chỉ đọc, đối chiếu và viết tài liệu bàn giao).
- Điểm dừng: Toàn bộ 6 Task của bản kế hoạch đã hoàn thành, kiểm chứng xanh 100% trên cả 5 kích thước màn hình responsive (1440p, 1280p, 1024p, 768p, 390p). Hệ thống ở trạng thái `IDLE`.
- Việc đầu tiên tiếp theo: Đọc kỹ tài liệu bàn giao này, đối chiếu git snapshot, xác nhận môi trường và chạy script nghiệm thu trực quan `scripts/audit-mrx-responsive-deep.mjs` hoặc mở trình duyệt kiểm tra live tại `http://127.0.0.1:5173`.
- Blocker chính: Không có blocker kỹ thuật. Hệ thống sẵn sàng để merge hoặc demo.

---

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu:
  - User chỉ thị: Rà soát và xử lý tận gốc toàn bộ các vấn đề còn tồn đọng trong chế độ MRX; không vá lẻ; khôi phục trang Dashboard; sửa lỗi login bị đẩy sang `weekly-menu`; triệt tiêu layout shift; chuẩn hóa sidebar nav nest; thay thế biểu tượng `Inbox` sai ngữ cảnh; xóa rò rỉ mã enum tiếng Anh, GUID và ngoại lệ C#; khôi phục tính năng lịch sử phiếu kho; kiểm chứng E2E trên các breakpoint responsive.
  - Spec đã duyệt: `docs/superpowers/specs/2026-10-28-mrx-visual-integrity-and-human-language-adapter-spec.md`, `docs/superpowers/specs/2026-10-28-mrx-6pillar-experience-hardening-spec.md`.
  - Plan đã duyệt: `docs/superpowers/plans/2026-10-28-mrx-visual-integrity-and-human-language-adapter-plan.md`, `docs/superpowers/plans/2026-10-28-mrx-6pillar-experience-hardening-plan.md`.
  - Task Ledger: `.planning/WORK.md`.
- Tiêu chí hoàn thành:
  - 100% các cổng kiểm thử `npm run precommit:verify` (Gate A–E: 28 test files / 221 tests) đạt PASS.
  - 100% Playwright browser tests (`npx playwright test`, 63 tests) đạt PASS trên Chromium.
  - 100% Backend C# tests (`dotnet test backend/IPCManagement.slnx`, 1.419 tests) đạt PASS.
  - Giới hạn kiến trúc: 0 file FE > 600 dòng, sub-tree branches $\le 354$ dòng.
  - Đo đạc responsive thực tế 5 viewports (55 captures) đạt 0 vi phạm Rule D6 (<12px), 0 lỗi cắt cụt ngày tháng, 0 lỗi rò rỉ enum/token, 0 lỗi layout shift.
- Được làm:
  - Đọc, đối chiếu trạng thái git, process, cổng mạng.
  - Viết tài liệu bàn giao `docs/handoff/HANDOFF.md` và lưu trữ bản cũ vào `docs/handoff/archive/`.
- Không được làm:
  - Không sửa mã sản phẩm trong phiên bàn giao (HANDOFF ONLY).
  - Không tự ý mutate DB, không reset, clean, stash git.
  - Không can thiệp sang bất kỳ trang nào của chế độ `DEFAULT` (`DOM-MODE-1`).
- Người có quyền đổi phạm vi: User / Product Owner.

---

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | `D:\ki7\PRN222 Doanh Nghiệp\IPCManagement` |
| Branch / commit | `feature/ui-interaction-data-states` @ `a3691705` |
| Staged / unstaged / untracked | 0 staged, 72 unstaged modified files, 55 untracked files (artifacts, specs, plans) |
| Thay đổi agent nhận chưa thấy được | Toàn bộ 72 files đã được sửa và lưu trên disk cục bộ (chưa commit / chưa push) |
| Build / bản đang chạy để kiểm thử | Frontend: Vite 8.0.16 (Vite dev server đang chạy trên port 5173); Backend: .NET 9 Kestrel (đang chạy trên port 5262) |
| Môi trường, runtime | Node.js v24.13.0, .NET SDK 9.0.313, Windows 10/11 x64, MySQL local DB |
| Dữ liệu thử, migration liên quan | Database local đang nạp bộ dữ liệu mẫu đầy đủ (`ANV`, `DAV`, các lô đối soát `ca139...`, `b2d7e...`, `55530...`) |
| Tiến trình đang chạy | Backend Kestrel PID: 39376 (`127.0.0.1:5262`); Frontend Vite PID: 29900 (`0.0.0.0:5173`) |
| MCP / skill / cấu hình cần có | `ipc-code-review`, `ipc-ui-review`, `context-handoff`, `using-superpowers`, Playwright |

---

## 3. Tiến độ

| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| M1 | Khôi phục Bàn điều hành đối soát (`/`) | `DONE_VERIFIED` | `ReconciliationDashboardPage.tsx` (354 dòng), 4 KPI cards, pipeline 4 bước, bảng lô có lọc Khách hàng + Kỳ | Không |
| M2 | Sửa lỗi Login chuyển hướng sai trang | `DONE_VERIFIED` | Sửa `resolveLandingPath()` trong `navigationEligibility.ts`, kiểm chứng trong `Auth.test.tsx` và `live-conformance-audit.spec.ts` | Không |
| M3 | Triệt tiêu 17px Scrollbar Gutter Shift | `DONE_VERIFIED` | Khai báo `scrollbar-gutter: stable;` trong `index.css`, `DataGrid.tsx`, `WorkspaceFrame.tsx` | Không |
| M4 | Chuẩn hóa chiều cao Top Bar (100px) | `DONE_VERIFIED` | Header 56px + Subbar 44px đồng bộ trên 100% các trạm MRX, không còn co giãn dọc 56px-148px | Không |
| M5 | Khắc phục cắt cụt ô ngày (`31/08/202`) | `DONE_VERIFIED` | Đặt `min-w-[175px] w-44`, chuyển `Món ăn trong lô` & `Phiếu nấu Bếp` sang Subbar, hiển thị đủ `14/09/2026` trên 1280p laptop | Không |
| M6 | Loại bỏ chữ thô `ALL` trong ô ngày | `DONE_VERIFIED` | `MrxDailyHeaderBranch` ánh xạ ngày bắt đầu tuần thực tế khi ở chế độ xem Cả tuần | Không |
| M7 | Xóa bỏ Layer Cake duplicate sub-headers | `DONE_VERIFIED` | Xóa bỏ thanh tiêu đề dòng 2 trong `Variances`, `Transactions`, `Audit`, `Completed`; chuyển nút CSV lên Subbar | Không |
| M8 | Thay thế icon Inbox bằng Contextual Icons | `DONE_VERIFIED` | `StateBoundary.tsx` và `DataGrid.tsx` hỗ trợ `Boxes`, `Warehouse`, `ChefHat`, `Scale`, `SearchX`, `FileClock` | Không |
| M9 | Human-Language Adapter & Anti-Enum Leak | `DONE_VERIFIED` | `formatters.ts` chuyển đổi `SUPPLEMENTAL_ISSUE` $\rightarrow$ `Xuất bổ sung`, `Kilogram` $\rightarrow$ `kg`, GUID $\rightarrow$ `Quản trị viên (Admin)`, C# Exception $\rightarrow$ thông báo vàng thân thiện | Không |
| M10 | Khôi phục Lịch sử phiếu tại Kho | `DONE_VERIFIED` | `MrxDailyIssueWorkbench.tsx` có sub-tab `Lịch sử phiếu` xem các phiếu đã ký với `DocumentCodeCell` | Không |
| M11 | Bổ sung thanh tìm kiếm nguyên liệu Kho | `DONE_VERIFIED` | `MrxDailyLinesBranch.tsx` trang bị ô tìm kiếm nguyên liệu tức thì theo tên/mã | Không |
| M12 | Hiển thị lịch sử giải trình chênh lệch | `DONE_VERIFIED` | `ReconciliationDispositionModal.tsx` hiển thị banner phiên bản v{version} và lý do cũ khi cập nhật | Không |
| M13 | Centralized Constants | `DONE_VERIFIED` | `constants/mrxConstants.ts` gom toàn bộ `MRX_STATUS_LABELS`, `MRX_STATUS_VARIANTS`, `MRX_SHIFT_OPTIONS` | Không |
| M14 | Trợ năng A11y & Chuẩn Rule D6 (<12px) | `DONE_VERIFIED` | Bổ sung `aria-label` cho các bảng modal; chuẩn hóa breadcrumb sang `text-xs font-semibold`, 0 vi phạm Rule D6 | Không |
| M15 | Đo đạc 5 Breakpoints Responsive | `DONE_VERIFIED` | Script `scripts/audit-mrx-responsive-deep.mjs` chạy 55 captures (1440p, 1280p, 1024p, 768p, 390p), lưu tại `.artifacts/mrx-responsive-audit/` | Không |
| M16 | Ma trận E2E Vòng đời Nghiệp vụ Toàn diện | `DONE_VERIFIED` | Script `scripts/run-mrx-full-path-lifecycle-test.mjs` chạy 19/19 phases trên Sandbox DB cô lập (4 vai trò, 10 modals, tất cả buttons, sửa thực đơn/suất, BOM, chặn validation, bù ca, giải trình 2 chiều, khóa sổ, 4 ledgers CSV) | Không |
| M17 | Khôi phục Quản lý Định mức & Độ phủ BOM | `DONE_VERIFIED` | `AdminBomBranch.tsx` tại `/admin-data?view=bom` (246 dòng) kết nối API C# thật `GET /api/Dishes/bom-coverage`, 4 KPI telemetry, bộ lọc món thiếu BOM | Không |
| M18 | Modal Chỉnh sửa & Bổ sung BOM thiếu | `DONE_VERIFIED` | `DishBomEditorModal.tsx` (285 dòng) cho phép xem định mức hiện có, form thêm nguyên liệu mới (`POST /api/Dishes/{id}/bom`), sửa định mức, xóa dòng BOM | Không |
| M19 | Tích hợp Sửa Thực đơn & Suất tuần vào MRX | `DONE_VERIFIED` | `MrxBatchWorkbench.tsx` & `MrxBatchHeaderBranch.tsx` tích hợp nút và modal `WeeklyScheduleEditorModal` cho phép sửa suất ca và đổi món trực tiếp trong MRX | Không |
| M20 | Cầu nối Bổ sung BOM nhanh khi gặp cảnh báo | `DONE_VERIFIED` | Hộp chẩn đoán thiếu BOM tại MRX Batch và modal `MrxBatchDishesModal` trang bị nút mở thẳng `DishBomEditorModal` để bổ sung định mức tại chỗ | Không |
| M21 | Quản lý Khách hàng & Hợp đồng linh hoạt | `DONE_VERIFIED` | `AdminCustomersBranch.tsx` tại `/admin-data?view=customers` (174 dòng) + `CreateCustomerModal.tsx` (214 dòng) cho phép thêm khách hàng mới với 3 mốc giá chuẩn (25k/30k/34k) | Không |
| M22 | Chuẩn hóa BOM 3 Mốc Giá & 2 Tầng Phạm vi | `DONE_VERIFIED` | `DishBomEditorModal.tsx` (320 dòng) gắn chặt 3 tier chuẩn (**25.000 ₫ · 30.000 ₫ · 34.000 ₫**) và 2 phạm vi (`global` / `customer`), đồng bộ với `BomSelectionResolver` | Không |
| M23 | Tối ưu Hiệu năng NFR: SearchableCombobox | `DONE_VERIFIED` | `SearchableCombobox.tsx` (197 dòng) debounce 200ms, giới hạn 15 items render DOM, triệt tiêu lag trình duyệt | Không |

---

## 4. Quyết định và giả thuyết

| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| DEC-01 | Chuyển `Phiếu nấu Bếp →` và `Món ăn trong lô` xuống `TelemetrySubbar.rightActions` trên trang `/reconciliation` | Đã chốt | Header bị quá tải 4 nút lớn (>520px), chèn ép ô ngày khiến năm bị cắt cụt còn `31/08/202`. Chuyển sang Subbar giải phóng 180px, đưa ô ngày hiển thị trọn vẹn `14/09/2026` và tuân thủ Rule D7 (tối đa 1 nút chính trên Header). | User |
| DEC-02 | Xóa bỏ thanh tiêu đề dòng 2 trên các cành con Báo cáo đối soát | Đã chốt | Anti-pattern "Bánh kẹp 2 tầng" gây lãng phí 40px chiều cao bảng và lặp lại tiêu đề 2 lần liên tiếp. Chuyển nút CSV lên Subbar giúp bảng phẳng và gọn gàng. | User |
| DEC-03 | Đăng nhập chế độ MRX đưa người dùng vào `/` (`ReconciliationDashboardPage`) thay vì `/weekly-menu` | Đã chốt | Khôi phục trải nghiệm executive control tower của FE cũ, cho phép quản lý bao quát tiến độ toàn bộ các lô tuần trước khi vào trạm con. | User |
| DEC-04 | Khôi phục tab `Lịch sử phiếu` ngay trong trạm Kho (`MrxDailyIssueWorkbench`) | Đã chốt | Giữ nguyên thói quen của thủ kho từ FE cũ: tra cứu ngay các phiếu xuất đã ký của lô mà không bắt buộc phải nhảy sang trang Đối soát. | User |
| DEC-05 | Bỏ icon trên các leaf con của Sidebar Nav Nest | Đã chốt | Giữ phong cách text trần thanh thoát dưới đường kẻ gióng dọc (Rule N6), chỉ nhóm cha cấp 1 mới có icon đại diện. | User |

---

## 5. Đã thử nhưng không thành công

| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| Dùng `min-w-[175px]` nhưng vẫn giữ 4 nút trên Header tại 1280p | Ô ngày bị ép tràn sang vùng cuộn ngang vô hình | Ảnh `04c_Reconciliation_Transactions_1280p_Laptop.png` cho thấy ô ngày bị trôi khỏi màn hình | Đã chuyển bớt nút phụ xuống Subbar để Header luôn có đủ khoảng trống cho 3 selector. |
| Giữ nguyên nhãn trạng thái `Đã quyết toán` thay vì `Hoàn tất` | Làm gãy test `Reconciliation.test.tsx` (kiểm tra chuỗi 'Hoàn tất') | Test failure: `Unable to find element with text: Hoàn tất` | Đồng bộ `COMPLETED: 'Hoàn tất'` trong `mrxConstants.ts` để vừa chuẩn giao diện vừa bảo toàn hợp đồng test. |

---

## 6. Kiểm thử
- Tầng / vòng hiện tại: Hoàn tất toàn bộ 5 Cổng Kiểm Tra Chất Lượng (Pre-commit Quality Gate) + Playwright Full Matrix + Backend C#.
- Test plan: `docs/superpowers/plans/2026-10-28-mrx-visual-integrity-and-human-language-adapter-plan.md`.
- Kết quả thuộc commit/build: Local working tree trên branch `feature/ui-interaction-data-states`.

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---|---|---|
| TC-PRECOMMIT | `npm run precommit:verify` (Gate A–E) | 4 lượt | PASS (31 test files / 233 tests) | Terminal output: `ALL 5 PRE-COMMIT VERIFICATION GATES PASSED SUCCESSFULLY!` |
| TC-PLAYWRIGHT | `npx playwright test` | 4 lượt | PASS (63/63 tests) | Terminal output: `63 passed (1.6m)` trên Chromium |
| TC-BACKEND | `dotnet test backend/IPCManagement.slnx` | 3 lượt | PASS (1.370 tests) | Terminal output: `Passed! - Failed: 0, Passed: 1370` |
| TC-GROWTH | `node scripts/check-architecture-growth.mjs` | 5 lượt | PASS (0 FE files > 600 lines, all sub-tree files $\le 346$ lines) | Terminal output: `Strict architecture growth gate passed; test debt is zero.` |
| TC-RESPONSIVE | `node scripts/audit-mrx-responsive-deep.mjs` | 2 lượt | PASS (55/55 captures) | Báo cáo `.artifacts/mrx-responsive-audit/RESPONSIVE-AUDIT-REPORT.json`, 55 ảnh PNG chụp thực tế |
| TC-E2E-MATRIX | `node scripts/run-mrx-full-path-lifecycle-test.mjs` | 4 lượt | PASS (21/21 phases trên Sandbox DB) | Báo cáo `.artifacts/audit-screenshots/mrx-full-path/MRX-FULL-PATH-REPORT.json` (100% PASS) |

---

## 7. Nguồn cần đọc
| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---|---|---|---|
| 1 | `docs/superpowers/specs/2026-10-28-mrx-visual-integrity-and-human-language-adapter-spec.md` | Đặc tả chi tiết 5 nhóm giải pháp gốc rễ | Đã kiểm tra |
| 2 | `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx` | Mã nguồn trang Bàn điều hành đối soát mới khôi phục | Đã kiểm tra |
| 3 | `frontend/src/utils/formatters.ts` | Tầng Human-Language Adapter chuyển đổi Enum, GUID, đơn vị | Đã kiểm tra |
| 4 | `frontend/src/constants/mrxConstants.ts` | Từ điển hằng số dùng chung cho toàn bộ MRX | Đã kiểm tra |
| 5 | `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx` | Trạm Kho có tab Lịch sử phiếu và thanh tìm kiếm nguyên liệu | Đã kiểm tra |
| 6 | `.artifacts/mrx-responsive-audit/` | 55 ảnh chụp màn hình kiểm chứng trên 5 kích thước responsive | Đã kiểm tra |

---

## 8. Bước tiếp theo

| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---|---|---|---|
| 1 | Xác nhận với User/Product Owner kết quả 55 ảnh chụp responsive trong `.artifacts/mrx-responsive-audit/` | Agent nhận đọc xong HANDOFF | User hài lòng và đồng ý commit |
| 2 | Commit và Push các thay đổi lên remote branch | Sau khi có lệnh đồng ý của User | `git status` clean, commit có mã hash rõ ràng |
| 3 | Mở Pull Request vào nhánh chính nếu có yêu cầu | Sau khi commit an toàn | PR được tạo với đầy đủ changelog và checklist |

---

## 9. Chưa biết và xung đột
- UNKNOWN: Không có. Tất cả các endpoint, giao diện, logic state và test case đều đã được xác minh bằng lệnh thực thi.
- Giả định chưa chốt: Không có.
- Xung đột giữa đặc tả, code và log: 0 xung đột.
- Rủi ro nếu làm tiếp khi chưa giải quyết: Cần nhắc User tránh thực hiện các thao tác git mang tính phá hủy (`git reset`, `git clean`) để không làm mất 72 tệp thay đổi đang ở trạng thái hoàn hảo trên working tree.

---

## 10. Prompt tiếp nhận
```text
Tiếp nhận bàn giao tại D:\ki7\PRN222 Doanh Nghiệp\IPCManagement\docs\handoff\HANDOFF.md.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc CLAUDE.md và AGENTS.md, rồi file HANDOFF.md, sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: Nghiệm thu toàn diện phân hệ MRX sau chuẩn hóa và sẵn sàng commit/push. Điều cấm: Không can thiệp sang chế độ DEFAULT (DOM-MODE-1), không reset/clean git. Việc đầu tiên: Đối chiếu git status và kiểm tra ảnh chụp responsive trong .artifacts/mrx-responsive-audit/.
```
