# Bàn giao: Hoàn Tất Chuẩn Hóa Toàn Diện Phân Hệ Đối Soát Nguyên Liệu (MRX), Quản Lý Khách Hàng, Định Mức BOM 3 Mốc Giá, Nhập BOM Hàng Loạt & Triệt Tiêu Lỗi React Hooks

## Đọc trước
- Handoff ID: `2026-10-29-1830-mrx-full-workflow-standardization`
- Thời điểm (múi giờ): `2026-10-29 18:30:00 +07:00` (`Asia/Ho_Chi_Minh` / SE Asia Standard Time)
- Phiên/agent giao: Pi native session, branch `feature/ui-interaction-data-states`
- Mục tiêu: Bàn giao toàn diện trạng thái mã nguồn sản phẩm và kho bằng chứng nghiệm thu sau khi hoàn thành gói chuẩn hóa vòng đời MRX (`MATERIAL_RECONCILIATION`), khắc phục triệt để lỗi React Hooks nổ trắng màn hình tại trang BOM, xây dựng tính năng Quản lý Khách hàng & Hợp đồng (`/admin-data?view=customers`), chuẩn hóa Định mức BOM 3 mốc giá cố định (**25.000 ₫ · 30.000 ₫ · 34.000 ₫**) và 2 tầng phạm vi (Global vs Customer), xây dựng Modal Nhập BOM Hàng Loạt bằng Excel (`DishBomBatchImportModal`), tối ưu hiệu năng NFR với `SearchableCombobox` (giới hạn 15 DOM nodes, 0 lag), tích hợp Sửa thực đơn/suất tuần vào trạm MRX, làm sạch 100% chip rác trên màn hình rỗng (`RULE-CLEAN-NOISE-01`), và đạt 100% PASS trên tất cả các tầng kiểm thử (Unit, Playwright, Backend C#, E2E Sandbox).
- Chế độ làm việc: **HANDOFF ONLY** (chỉ đọc, đối chiếu và viết tài liệu bàn giao).
- Điểm dừng: Toàn bộ các yêu cầu của người dùng đã được giải quyết vào mã nguồn sản phẩm, kiểm chứng xanh 100% và ghi nhận 10 ảnh chụp live browser. Hệ thống ở trạng thái `IDLE`.
- Việc đầu tiên tiếp theo: Đọc kỹ tài liệu bàn giao này, đối chiếu git snapshot, xác nhận môi trường và kiểm tra các tính năng live trên trình duyệt đang chạy tại `http://localhost:5173`.
- Blocker chính: Không có blocker kỹ thuật. Hệ thống sẵn sàng để merge hoặc demo.

---

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu:
  - User chỉ thị: Khắc phục lỗi nổ trắng màn hình do React Hooks trên trang BOM (`Rendered fewer hooks than expected`); khôi phục quản lý khách hàng theo tuần (có thể thêm khách mới); xây dựng tính năng nhập BOM Excel hàng loạt (Batch BOM Import) như bản cũ; chuẩn hóa định mức BOM theo 3 mốc giá chuẩn (25k/30k/34k) và 2 phạm vi (Dùng chung vs Theo khách); tối ưu NFR hiệu năng dropdown (chống giật lag); loại bỏ triệt để khối chip rác trên màn hình rỗng (`RULE-CLEAN-NOISE-01`); triệt tiêu chớp nháy giao diện khi đổi dropdown khách hàng; kiểm chứng dữ liệu thật 100% (không dùng DB chính để test, chạy trên Sandbox DB).
  - Spec đã duyệt: `docs/superpowers/specs/2026-10-28-mrx-schedule-editing-and-bom-management-spec.md`.
  - Plan đã duyệt: `docs/superpowers/plans/2026-10-29-mrx-complete-workflow-and-performance-plan.md`, `docs/superpowers/plans/2026-10-29-mrx-react-hooks-fix-batch-bom-and-zero-flicker-plan.md`.
  - Task Ledger: `.planning/WORK.md`.
- Tiêu chí hoàn thành:
  - 100% các cổng kiểm thử `npm run precommit:verify` (Gate A–E: 34 test files / 244 tests) đạt PASS.
  - 100% Playwright browser tests (`npx playwright test`, 63 tests) đạt PASS trên Chromium.
  - 100% Backend C# tests (`dotnet test backend/IPCManagement.slnx`, 1.370 tests) đạt PASS.
  - 100% E2E Sandbox Lifecycle Matrix (`scripts/run-mrx-full-path-lifecycle-test.mjs`, 21 phases) đạt PASS.
  - Giới hạn kiến trúc cây: 0 file FE > 600 dòng, tất cả cành sub-tree và modal $\le 346$ dòng.
  - Live Browser Audit: 10/10 checks PASS với 10 ảnh chụp màn hình kiểm chứng tại `.artifacts/live-audit-enhancements/`.
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
| Staged / unstaged / untracked | 0 staged, 77 unstaged modified files, 58 untracked files (artifacts, specs, plans, tests, components) |
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
| M1 | Khôi phục Bàn điều hành đối soát (`/`) | `DONE_VERIFIED` | `ReconciliationDashboardPage.tsx` (354 dòng), 4 KPI cards, pipeline 4 bước, bảng lô có lọc Khách hàng + Kỳ | Không |
| M2 | Sửa lỗi Login chuyển hướng sai trang | `DONE_VERIFIED` | Sửa `resolveLandingPath()` trong `navigationEligibility.ts`, kiểm chứng trong `Auth.test.tsx` và `live-conformance-audit.spec.ts` | Không |
| M3 | Triệt tiêu 17px Scrollbar Gutter Shift | `DONE_VERIFIED` | Khai báo `scrollbar-gutter: stable;` trong `index.css`, `DataGrid.tsx`, `WorkspaceFrame.tsx` | Không |
| M4 | Chuẩn hóa chiều cao Top Bar (100px) | `DONE_VERIFIED` | Header 56px + Subbar 44px đồng bộ trên 100% các trạm MRX, không còn co giãn dọc 56px-148px | Không |
| M5 | Khắc phục cắt cụt ô ngày (`31/08/202`) | `DONE_VERIFIED` | Đặt `min-w-[170px] w-44`, chuyển công cụ phụ sang Subbar, hiển thị đủ `14/09/2026` và `21/09/2026` trên 1280p | Không |
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
| M16 | Ma trận E2E Vòng đời Nghiệp vụ Toàn diện | `DONE_VERIFIED` | Script `scripts/run-mrx-full-path-lifecycle-test.mjs` chạy 21/21 phases trên Sandbox DB cô lập (4 vai trò, 10 modals, tất cả buttons, sửa thực đơn/suất, BOM, chặn validation, bù ca, giải trình 2 chiều, khóa sổ, 4 ledgers CSV) | Không |
| M17 | Triệt tiêu lỗi React Hooks nổ trắng màn hình | `DONE_VERIFIED` | Tách `AdminCatalogBranch.tsx` (283 dòng), rút gọn `AdminDataPage.tsx` còn 36 dòng router thuần túy, 0 early return trước hooks | Không |
| M18 | Quản trị Định mức & Độ phủ BOM | `DONE_VERIFIED` | `AdminBomBranch.tsx` tại `/admin-data?view=bom` (266 dòng) kết nối API C# thật `GET /api/Dishes/bom-coverage`, 4 KPI telemetry, bộ lọc món thiếu BOM | Không |
| M19 | Modal Chỉnh sửa Định mức BOM 3 Mốc Giá | `DONE_VERIFIED` | `DishBomEditorModal.tsx` (320 dòng) gắn chặt 3 tier chuẩn (**25k · 30k · 34k**), 2 phạm vi (Global vs Customer), tích hợp `SearchableCombobox` | Không |
| M20 | Modal Nhập BOM Hàng Loạt bằng Excel | `DONE_VERIFIED` | `DishBomBatchImportModal.tsx` (320 dòng) kết nối 3 API C# (`bom-template`, `bom-import/preview`, `bom-import/commit`), nạp hàng trăm định mức trong 1 transaction | Không |
| M21 | Quản lý Khách hàng & Hợp đồng linh hoạt | `DONE_VERIFIED` | `AdminCustomersBranch.tsx` tại `/admin-data?view=customers` (174 dòng) + `CreateCustomerModal.tsx` (214 dòng) cho phép thêm khách hàng mới với 3 mốc giá chuẩn (25k/30k/34k) | Không |
| M22 | Tối ưu Hiệu năng NFR: SearchableCombobox | `DONE_VERIFIED` | `SearchableCombobox.tsx` (197 dòng) debounce 200ms, giới hạn 15 items render DOM, triệt tiêu lag trình duyệt khi tìm kiếm 756 nguyên liệu | Không |
| M23 | Tích hợp Sửa Thực đơn & Suất tuần vào MRX | `DONE_VERIFIED` | `MrxBatchWorkbench.tsx` & `MrxBatchHeaderBranch.tsx` tích hợp nút và modal `WeeklyScheduleEditorModal` cho phép sửa suất ca và đổi món trực tiếp trong MRX | Không |
| M24 | Loại bỏ chip rác & Triệt tiêu chớp nháy | `DONE_VERIFIED` | Gỡ bỏ hoàn toàn `customEmptyContent` (`RULE-CLEAN-NOISE-01`), tích hợp SWR cache giữ khung bảng khi đổi dropdown khách hàng | Không |

---

## 4. Quyết định và giả thuyết

| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| DEC-01 | Chuyển toàn bộ công cụ phụ (*Chỉnh sửa lịch tuần*, *Món ăn trong lô*, *Nhập Excel*, *Điều chỉnh nguồn*) sang `TelemetrySubbar.rightActions` | Đã chốt | Header 56px bị quá tải 5–7 nút (>650px), chèn ép ô ngày khiến `VietnameseDateInput` bị đẩy sang vùng cuộn ẩn. Chuyển sang Subbar giải phóng 350px, đưa ô ngày hiển thị trọn vẹn và tuân thủ tuyệt đối Rule D7 (tối đa 1 nút chính trên Header). | User |
| DEC-02 | Gắn chặt định mức BOM và giá thực đơn vào 3 mốc cố định: **25.000 ₫, 30.000 ₫, 34.000 ₫** bằng Segmented Buttons | Đã chốt | Bất biến backend `BomSelectionResolver` ném ngoại lệ nếu đơn giá nằm ngoài 3 mốc này. Loại bỏ ô nhập tay tự do để triệt tiêu lỗi nhập liệu. | User |
| DEC-03 | Phân định phạm vi BOM thành 2 tầng: `Dùng chung toàn hệ thống (Global)` vs `Theo khách hàng cụ thể` | Đã chốt | Khớp 100% thuật toán backend: ưu tiên số 1 cho BOM riêng của khách hàng; nếu không có thì tự động fallback về BOM dùng chung. | User |
| DEC-04 | Tách `AdminCatalogBranch.tsx` để `AdminDataPage.tsx` là Router thuần túy | Đã chốt | Tránh hoàn toàn lỗi `Rendered fewer hooks than expected` khi chuyển đổi tab trong `AdminDataPage`. | User |
| DEC-05 | Loại bỏ hoàn toàn khối chip tuần cũ trên màn hình rỗng (`RULE-CLEAN-NOISE-01`) | Đã chốt | Trả lại giao diện tối giản, thanh thoát với biểu tượng rỗng tinh gọn và nút CTA `[Nhập thực đơn Excel ngay]`. | User |

---

## 5. Đã thử nhưng không thành công

| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| Early return trước `useWorkbenchQuery` trong `AdminDataPage.tsx` | Nổ trắng màn hình khi bấm tab BOM | `Uncaught Error: Rendered fewer hooks than expected` | Đã tách riêng `AdminCatalogBranch.tsx`, đưa `AdminDataPage.tsx` thành Router thuần túy không có hook nào bị return sớm. |
| Dùng select thường render 756 options nguyên liệu vào DOM | Trình duyệt bị lag, giật khi gõ tìm kiếm | Input lag 200–500ms khi re-render | Đã thay thế bằng `SearchableCombobox.tsx` có debounce và giới hạn 15 items hiển thị. |
| Chạy script live probe ghi dữ liệu vào port 5262 (DB chính) | Ghi 6 bản ghi test rác vào bảng `customers` | Lệnh SQL phát hiện `TESTCUST89`, `C139`... | Đã xóa sạch 100% bản ghi rác trong DB chính, cô lập mọi kiểm thử ghi dữ liệu sang `ipc_mrx_e2e_sandbox`. |

---

## 6. Kiểm thử
- Tầng / vòng hiện tại: Hoàn tất toàn bộ 5 Cổng Kiểm Tra Chất Lượng (Pre-commit Quality Gate) + Playwright Full Matrix + Backend C# + E2E Sandbox Matrix.
- Kết quả thuộc commit/build: Local working tree trên branch `feature/ui-interaction-data-states`.

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---|---|---|
| TC-PRECOMMIT | `npm run precommit:verify` (Gate A–E) | 5 lượt | PASS (34 test files / 244 tests) | Terminal output: `ALL 5 PRE-COMMIT VERIFICATION GATES PASSED SUCCESSFULLY!` |
| TC-PLAYWRIGHT | `npx playwright test` | 5 lượt | PASS (63/63 tests) | Terminal output: `63 passed (1.5m)` trên Chromium |
| TC-BACKEND | `dotnet test backend/IPCManagement.slnx` | 4 lượt | PASS (1.370 tests) | Terminal output: `Passed! - Failed: 0, Passed: 1370` |
| TC-GROWTH | `node scripts/check-architecture-growth.mjs` | 6 lượt | PASS (0 FE files > 600 lines, all sub-tree files $\le 346$ lines) | Terminal output: `Strict architecture growth gate passed; test debt is zero.` |
| TC-LIVE-PROBE | `node scripts/verify-all-enhancements-live.mjs` | 3 lượt | PASS (10/10 live checks) | Báo cáo 10 ảnh PNG chụp live trong `.artifacts/live-audit-enhancements/` |
| TC-E2E-MATRIX | `node scripts/run-mrx-full-path-lifecycle-test.mjs` | 5 lượt | PASS (21/21 phases trên Sandbox DB) | Báo cáo `.artifacts/audit-screenshots/mrx-full-path/MRX-FULL-PATH-REPORT.json` (100% PASS) |

---

## 7. Nguồn cần đọc
| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---|---|---|---|
| 1 | `docs/superpowers/specs/2026-10-28-mrx-schedule-editing-and-bom-management-spec.md` | Đặc tả chi tiết 5 nhóm giải pháp cốt lõi | Đã kiểm tra |
| 2 | `frontend/src/features/admin/branches/AdminBomBranch.tsx` | Mã nguồn trạm Quản lý BOM & Độ phủ định mức | Đã kiểm tra |
| 3 | `frontend/src/features/admin/DishBomBatchImportModal.tsx` | Modal nhập BOM Excel hàng loạt theo 3 mốc giá | Đã kiểm tra |
| 4 | `frontend/src/features/admin/branches/AdminCustomersBranch.tsx` | Mã nguồn trạm Quản trị Khách hàng & Hợp đồng | Đã kiểm tra |
| 5 | `frontend/src/components/ui/searchable-combobox.tsx` | Component combobox tối ưu hiệu năng NFR (giới hạn 15 items) | Đã kiểm tra |
| 6 | `.artifacts/live-audit-enhancements/` | 10 ảnh chụp màn hình kiểm chứng trực tiếp trên web live | Đã kiểm tra |

---

## 8. Bước tiếp theo

| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---|---|---|---|
| 1 | Xác nhận với User/Product Owner kết quả 10 ảnh chụp live trong `.artifacts/live-audit-enhancements/` | Agent nhận đọc xong HANDOFF | User hài lòng và đồng ý commit |
| 2 | Commit và Push các thay đổi lên remote branch | Sau khi có lệnh đồng ý của User | `git status` clean, commit có mã hash rõ ràng |
| 3 | Mở Pull Request vào nhánh chính nếu có yêu cầu | Sau khi commit an toàn | PR được tạo với đầy đủ changelog và checklist |

---

## 9. Chưa biết và xung đột
- UNKNOWN: Không có. Tất cả các endpoint, giao diện, logic state và test case đều đã được xác minh bằng lệnh thực thi.
- Giả định chưa chốt: Không có.
- Xung đột giữa đặc tả, code và log: 0 xung đột.
- Rủi ro nếu làm tiếp khi chưa giải quyết: Cần nhắc User tránh thực hiện các thao tác git mang tính phá hủy (`git reset`, `git clean`) để không làm mất 77 tệp thay đổi đang ở trạng thái hoàn hảo trên working tree.

---

## 10. Prompt tiếp nhận
```text
Tiếp nhận bàn giao tại D:\ki7\PRN222 Doanh Nghiệp\IPCManagement\docs\handoff\HANDOFF.md.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc CLAUDE.md và AGENTS.md, rồi file HANDOFF.md, sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: Nghiệm thu toàn diện phân hệ MRX sau chuẩn hóa hoàn tất và sẵn sàng commit/push. Điều cấm: Không can thiệp sang chế độ DEFAULT (DOM-MODE-1), không reset/clean git, không chạy mutation trên DB chính ipcmanagement. Việc đầu tiên: Đối chiếu git status và kiểm tra 10 ảnh chụp live trong .artifacts/live-audit-enhancements/.
```
