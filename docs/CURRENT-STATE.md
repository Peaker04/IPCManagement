<!-- generated-by: gsd-doc-writer -->
# Trạng thái làm việc hiện tại

Tài liệu này là handoff sống cho các phiên làm việc mới. Nó tóm tắt mục tiêu nghiệp vụ, trạng thái Shipyard, các quyết định đã chốt, evidence và phần còn hở tính đến ngày 27/07/2026. Code đang chạy, database lane và evidence mới nhất vẫn là nguồn sự thật cao hơn tài liệu này.

## Phạm vi người dùng đã chốt

- Chạy E2E trên Shipyard bằng template ANV mặc định mức giá `25k`, bao quát cả tuần thay vì chỉ ngày 20. Ngày 20 từng có dữ liệu nghiệp vụ sai và được phép sửa lại để tiếp tục kiểm thử.
- Không kết luận pass từ backend test đơn lẻ. Mỗi bước quan trọng phải đối chiếu đồng thời: control/trạng thái FE → request/response BE → transition trong DB → trạng thái render lại trên FE.
- Ma trận kiểm thử áp dụng cho toàn bộ trang và tab: happy path → negative → boundary → permission → regression → integration/third-party failure.
- Happy path dùng workbook ANV mặc định; negative/worst-case phải tạo bản sao rồi chỉnh dữ liệu có chủ đích, không sửa đè file template gốc. Mỗi case phải ghi rõ dữ liệu đã thay đổi và cleanup/correction tương ứng.
- Khi luồng hiện tại thiếu nghiệp vụ, được bổ sung feature để E2E đúng hơn, ví dụ thiếu nguyên liệu → yêu cầu bổ sung → kho xử lý → chuyển thu mua → chọn giá/NCC → duyệt → PO → nhập kho → cấp tiếp → bếp xác nhận; nguyên liệu dư phải đi qua trả kho/hao hụt.
- Thay đổi UI phải giữ cấu trúc SAP Fiori: work object tách bằng tab, trạng thái/action rõ ràng, không ẩn lỗi dependency thành empty state, layout ổn định khi refetch và có evidence Chrome/Playwright.
- Button/action và dữ liệu hiển thị phải được đối chiếu với permission, eligibility và terminal state do server trả về. Action không hợp lệ phải ẩn hoặc disable kèm lý do; không được chỉ ẩn trên FE trong khi BE vẫn cho phép mutation sai.
- Không tự gộp nguyên liệu theo tên. Chứng từ chi tiết giữ document/line grain; báo cáo aggregate theo ID, unit và phạm vi nghiệp vụ.
- Kiểm thử UI/visual hiện chỉ bao phủ website desktop/tablet web. Dùng `1365×900`,
  `1280×900` và `768×1024`; mobile chưa nằm trong phạm vi cho tới khi Kỳ yêu cầu.
- Không dùng mock API, mock login, snapshot/baseline visual cũ hoặc tự update snapshot để kết luận UI hiện tại pass. Phải boot đúng working tree/source hiện tại, xác minh database qua runtime health và chạy Chrome headed trực tiếp vào URL thật.

## Môi trường Shipyard hiện tại

| Thành phần | Giá trị đã kiểm tra ngày 27/07/2026 |
|---|---|
| Git branch | `feature/production-plan` |
| Shipyard UI | `http://localhost:8090` |
| Frontend lane 1 | `http://localhost:3001` — source-backed từ working tree hiện tại |
| API lane 1 | `http://localhost:8001` — source-backed từ working tree hiện tại |
| Database | `ipc_lane1`, đã đồng bộ từ `ipcmanagement` sau khôi phục |
| Tài khoản demo | username `admin`; mật khẩu phải lấy từ credential đã xoay, không dùng giá trị mặc định |
| Template happy path | `C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx` |

Ba port `8090`, `3001`, `8001` đang listen tại thời điểm cập nhật. `/health/ready` trả `Healthy` cho cả `database` và `migrations`. Không giả định trạng thái này còn đúng ở phiên sau; phải kiểm tra lại trước khi mở browser hoặc chạy test.

Ngày 27/07, `ipc_lane1` cũ được xác nhận chỉ có 38 migration và cũ hơn database chính đã khôi phục. Theo lệnh của Kỳ, đã backup cả hai DB vào `D:\Backups\ipc-lane-sync-20260727`, ghi migration no-op `20260726203853_RenameEntitiesToPascalCase` vào database chính, rồi restore `ipcmanagement` sang `ipc_lane1`. Gate sau restore: **61/61 bảng, 53.416/53.416 dòng, 0 row-count mismatch, 0 checksum mismatch, 41/41 migration**. Từ mốc này, lane là bản sao của database chính sau khôi phục; lineage E2E cũ của lane không còn là baseline hiện hành, nhưng vẫn có trong file backup lane trước đồng bộ.

Checkout `shipyard-lanes/lane1` vẫn ở commit cũ `e025d13` và có nhiều thay đổi chưa commit; không reset hoặc ghi đè nó. Stack hiện tại được Shipyard quản lý PID/log nhưng boot source-backed từ checkout chính sau các commit Bước 10, nên UI tại `3001` phản ánh đúng working tree đang kiểm tra.

Re-audit hiệu năng ngày 2026-07-26 đã chuyển sang đúng database ứng dụng `ipcmanagement` (read-only). P0 ledger
đã được sửa để aggregate ở MySQL, bảo toàn khóa current-only/movement-only, chọn movement mới nhất ổn định và
dùng chung cho data-quality cleanup. Cache snapshot data-quality có khóa chống tính trùng; page/KPI dùng cùng
snapshot scan 500 và phát `IsTruncated` khi vượt giới hạn. Không đồng bộ dữ liệu E2E từ lane vào database chính.

## Kết quả E2E đã xác minh

Luồng bổ sung bếp đã đi hết trên FE + BE + DB:

```text
Bếp báo thiếu
  → Kho cấp một phần
  → Chuyển Thu mua
  → Chọn báo giá/nhà cung cấp
  → Gửi duyệt và duyệt
  → Tạo PO
  → Nhập đúng kho gắn với yêu cầu bổ sung
  → Kho cấp phần còn lại
  → Bếp xác nhận
```

Lineage evidence chính:

- Supplemental request `SUP-20260725-120919-B7B3` → `FULFILLED`.
- Purchase request `PR-SUP-20260725-1EA7`.
- Purchase order `PO-PR-SUP-20260725-1EA7-431ac9d3` → `RECEIVED`.
- Inventory issue `ISS-SUP-20260725-130550-CEB4` có `receivedAt`.
- Tồn Bầu tại kho đích còn `0.1 kg`; kho nhập nhầm cũ còn `0 kg` sau bút toán điều chỉnh có audit.
- Dữ liệu thử bỏ dở đã được đóng có kiểm soát: `SUP-20260725-120328-5C8E` → `REJECTED`; `SUP-20260725-120426-DC5B` → `FULFILLED` sau correction có transaction.

Chi tiết action checkbox bếp đã chốt:

- Mở trang hoặc tick checkbox không được phát `POST` và không được tự ẩn dòng.
- Tick dòng chờ nhận chỉ mở dialog.
- Chỉ nút `Đã kiểm đếm và nhận` mới gọi đúng một lần `POST /api/inventory-issues/{id}/confirm-receipt`.
- Dòng terminal lấy từ server, hiển thị checked + disabled và giữ mã phiếu xuất để phân biệt cùng nguyên liệu ở nhiều chứng từ.

Phiếu nhập cho PO liên kết supplemental phải bị khóa vào kho đang xử lý yêu cầu. FE khóa selector và BE từ chối nhập sang kho khác.

## Các thay đổi UI và hiệu năng gần nhất

- Thu mua: `Quản lý báo giá nhà cung cấp` đã thành tab độc lập. Tab báo giá chỉ tải danh mục nguyên liệu/NCC/báo giá; purchase workbench được skip khi tab này active.
- Bếp trưởng: bốn thẻ Ngày làm việc/Ca làm việc/Cụm bếp/Tổng suất ăn nằm ngay trước bảng kế hoạch sản xuất và dùng lại cùng `productionPlan`.
- Biến động giá: bốn sub-tab chỉ query/render dataset active. Lần đo gần nhất đều `0` long task và `CLS 0`, mỗi tab aggregate gọi đúng endpoint tương ứng.
- Quản trị dữ liệu: query được giới hạn theo active tab; dialog BOM chỉ mount khi mở; bộ lọc nặng dùng deferred value; chuyển tab dùng transition. Lần đo headed gần nhất: BOM, Contract, Dữ liệu lỗi, Tồn kho và Thống kê có `0` long task; Audit có một long task `51 ms`, Nhân viên có một long task `60 ms`; `CLS 0` trên cả bảy tab. Các số cold-run có thể dao động giữa lần chạy nên phải đọc JSON evidence thay vì chép lại kết luận cũ.
- Tab Thống kê Admin giảm từ 8 API xuống 4 API sau khi bỏ workflow overview không được hiển thị đúng vùng.
- Kế hoạch tuần: query demand và production chỉ active theo tab; 6 request staleness chỉ chạy ở tab Nhu cầu. Các panel nặng được split thành chunk riêng và preload tuần tự sau 1 giây trong idle slot, bỏ qua Data Saver/2G. Main chunk giảm từ `107.38 kB` xuống `83.50 kB`.
- Bếp trưởng: production/receipt/exception query dừng khi xem Chứng từ bếp; journal query dừng khi xem Ca sản xuất. Kho: demand page và cụm 4 workflow-overview query dừng ngoài tab Nhu cầu xuất.
- Weekly/Chef/Warehouse tách selected tab khỏi deferred rendered panel. Tab được chọn cập nhật ngay; panel cũ được giữ với overlay `Đang cập nhật` cho tới frame mới, panel shell có chiều cao tối thiểu ổn định, transition 150 ms chỉ dùng opacity và tự tắt với reduced motion.
- Browser-use live sau idle preload: Weekly demand, Chef và Warehouse đều `CLS 0`, không có long task >50 ms; chuyển lại không phát API. Cold click Weekly trước idle preload vẫn có thể có một long task compile khoảng `124 ms`, nhưng không flash/blank vì panel cũ được giữ. Evidence: `.artifacts/shipyard-live/tab-performance-controlled-lazy-2026-07-25.json`.
- Sidebar: cả 10 route vẫn lazy-load theo route, nhưng module của các route được preload tuần tự trong idle slot sau khi shell ổn định. Scheduler chỉ chạy cho route người dùng có quyền, không bulk-prefetch data và tự tắt với Data Saver/2G; hover/focus/touch tiếp tục warm code + data theo intent.
- Route loader cache component đã resolve, nên route đã warm render đồng bộ thay vì mount Suspense fallback. Lần đo production Chromium: preload đủ route trong `419 ms`, không long task; 9 chuyển trang từ sidebar có click-to-content `65–83 ms`, click-to-stable `90–113 ms`, `CLS 0`, `0` fallback mount và `0` page chunk tải sau click.

Evidence performance chi tiết nằm trong `.artifacts/shipyard-live/live-visual-performance.json`; baseline trước tối ưu dialog Admin nằm trong `.artifacts/shipyard-live/live-visual-performance-before-admin-dialog-fix.json`.
Evidence before/after của toàn bộ sidebar nằm trong `.artifacts/shipyard-live/sidebar-navigation-performance-2026-07-25.json`.

## Kiểm thử hiệu năng NFR bằng k6 ngày 26/07/2026

Kit đo nằm ở `tools/perf/` (untracked, giữ local): `k6/smoke.js|load.js|stress.js|lib.js` + `RUNBOOK.md` + `sql/`. Điều kiện đo lịch sử: backend Release cổng `8001` (`dotnet run -c Release --no-launch-profile`, env Development), database chính `ipcmanagement` read-only và tài khoản `admin` với credential tại thời điểm đó; hiện phải truyền mật khẩu đã xoay qua `K6_PASSWORD`. k6 cài qua winget (`C:\Program Files\k6\k6.exe`).

Kết quả theo trình tự RUNBOOK:

| Kịch bản | Điều kiện | Kết quả | Đạt? |
|---|---|---|---|
| Baseline | 1 VU, warm | p95 danh sách 6–21 ms; tìm kiếm 8 ms; price-variance 75 ms; KPI 101 ms | Đạt toàn bộ |
| Load | 20 VU, 5 phút, think-time 0.5–2 s | 2.817 request, 9.3 RPS, 0% lỗi; p95 danh sách 16–32 ms | Đạt toàn bộ |
| Stress trước fix | ramp 5→60 RPS trộn 9 endpoint | Điểm gãy p95 danh sách >800 ms từ ~25 RPS, bão hòa ~55 RPS (p95 2–3 s, 163 dropped, 168 VU); 0% lỗi — suy giảm bằng latency, không phải error | — |
| Stress sau fix | cùng kịch bản | Giữ 60 RPS ổn định: p95 danh sách 16–18 ms, báo cáo ≤165 ms, 0 dropped, 50 VU; chưa tìm thấy điểm gãy trong phạm vi 60 RPS | — |

Fix đã commit (`110e3c0` trên `feature/production-plan`): ba báo cáo `price-variance` (by-supplier/by-period/by-dish-group và các bản `/page`) chuyển `GroupBy` dịch xuống SQL thay vì tải toàn bộ receipt lines về RAM; aggregate qua `double` để tương thích SQLite trong test. Baseline price-variance giảm 256 ms → 75 ms. Trọng số BOM của by-dish-group cũng aggregate ở database.

Ghi chú vận hành:

- Rate limit `api-general` đọc từ config `RateLimiting:ApiPermitLimit` (mặc định 100 như production); `appsettings.Development.json` đang đặt `100000` để load/stress không dính 429. Smoke 1 VU không cần nới.
- `/api/coordination/orders` bắt buộc `dayOfWeek` (t2..cn) và `shiftName` (MORNING/AFTERNOON), thiếu sẽ 422 — `lib.js` đã gắn sẵn, tùy biến qua `K6_DAY`/`K6_SHIFT`.
- `load.js` mô phỏng journey 8 endpoint, không gọi `coordination-customers` — số p95=0 của endpoint này trong summary load là "không có mẫu", không phải nhanh.
- KPI `/operational-kpis` đã có cache controller TTL 15 s + single-flight + invalidate theo remediation (khối P0); đo tay: cold 123 ms → cache hit 4–5 ms. Điểm nóng KPI coi như đã xử lý ở tầng cache, phần fan-out ~12 query chỉ còn chạy mỗi 15 s.
- Evidence trước/sau giữ tại `tools/perf/k6/results-{smoke,stress}-before-fix.json` và `results-{smoke,load,stress}.json`.

## Browser runtime và quy ước evidence hiện tại

- Evidence cũ ngày 25–26/07 chỉ là lịch sử, không được dùng để kết luận Bước 10 hiện tại pass. `frontend/playwright.config.ts` vẫn bật `VITE_ENABLE_MOCK_LOGIN=true`, nên các visual snapshot spec cũ không phải gate runtime cho lượt này.
- Helper mới `.artifacts/shipyard-live/current-runtime-desktop-audit.mjs` mở Google Chrome headed trực tiếp vào FE `3001`, chỉ chạy `1365×900` và `1440×900`, ghi screenshot, API response, console/page error, request failure, CLS và long task. Không có mobile viewport trong ma trận.
- `SEED_USER_PASSWORD` trong Shipyard local config đã được Kỳ cập nhật sau khi probe đầu phát hiện credential cũ trả `401`. Audit chỉ dùng giá trị runtime qua environment, không ghi password/token vào script, JSON hay docs.
- Audit headed trên runtime thật đã đi hết **10 route × 2 viewport = 20/20 PASS**: 20 screenshot route, 179 API response không có status `>=400`, 0 console error, 0 page error, 0 horizontal overflow và 0 long task. Tám `ERR_ABORTED` là request bị navigation/context close hủy (một KPI và bảy Vite idle preload), không phải response lỗi.
- Full sweep có một CLS outlier `0,0474` ở Warehouse cold `1365×900`; retry có capture shift-source cho kết quả cold `0,00531`, warm `0,00518`, đều dưới gate `0,02`. Evidence hiện hành: `.artifacts/shipyard-live/current-runtime-desktop-2026-07-27/current-runtime-desktop-audit.json`, 20 screenshot route và `warehouse-desktop-cls-probe.json`. File `*-error.json`/`fatal-error.png` chỉ lưu attempt credential cũ, không phải kết quả cuối.

## Duplicate ingredient và data grain

| Hiện tượng đã đo | Kết luận |
|---|---|
| 23 nhóm master trùng tên; 13 nhóm có nhiều record active | Data-quality issue, cần preview quan hệ và duyệt merge/deactivate; không gộp tự động trên FE. |
| 49 nhóm demand lặp `ingredientId + unitId` trong tuần 20–26/07 | Hợp lệ ở line grain theo món/BOM/ca; màn tổng hợp dùng endpoint aggregate. |
| 0 duplicate line nội bộ trong inventory issue | Không có lỗi duplicate line trong phiếu xuất của tuần đã kiểm tra. |
| Cùng nguyên liệu ở nhiều phiếu hoặc kho | Hợp lệ; phải hiển thị mã phiếu/kho và không cộng chéo dimension. |

Khóa đúng theo ngữ cảnh:

- Chứng từ: document ID + line ID.
- Báo cáo: ingredient ID + unit ID + ngày/phạm vi.
- Tồn kho: thêm warehouse ID.
- Tên giống nhưng ID khác: cảnh báo data quality, không phải khóa deduplication.

## Quality gates gần nhất

| Phạm vi | Tests | Line | Branch | Function/method |
|---|---:|---:|---:|---:|
| Backend | **626 pass / 0 fail / 1 skip** (27/07) — `npm run test:be` gồm 2 project: Api.Tests 586, Application.Tests 41 | 69.4% | 53.8% | 75.5% method |
| Frontend | **328/328 pass trên 60 file** (27/07) | 39.68% | 29.21% | 32.00% function |

Số coverage phần trăm là của lần chạy coverage 25/07; các lần sau chỉ chạy lại test suite, chưa chạy lại coverage.

Gate tầng database bổ sung từ 27/07 (xem mục sự cố bên dưới):

- `dotnet ef migrations has-pending-model-changes`: exit 0.
- Schema dựng từ migration == schema dựng từ model: **723/723** dòng khớp.
- 2 test replay migration trên MySQL thật: pass.
- Cài `IPCmanagement.sql` vào database rỗng: 47 bảng / 102 FK, exit 0. Chạy lại trên database không rỗng: dừng ở ERROR 1062, không mất bảng nào.

- Backend build Release: 0 warning.
- Frontend lint: pass (còn 9 warning tồn đọng của rule `ipc/no-swallowed-query-error`).
- Frontend production build: pass.
- Browser E2E không được cộng vào phần trăm V8/Coverlet; browser được kiểm riêng theo action → request → DB → rendered state.

## Audit kiến trúc toàn dự án ngày 26/07/2026

Đã chạy audit bốn trục (tầng dữ liệu, bảo mật, vận hành, frontend + hợp đồng API) trên FE + BE + database thật. Kết quả đầy đủ kèm plan bốn giai đoạn nằm ở `docs/ARCHITECTURE-AUDIT-2026-07-26.md`. Bốn rủi ro nguy cấp:

1. **Không có lưới an toàn dữ liệu**: không backup, không PITR, không soft-delete, không rollback được backend (không Dockerfile/artifact) lẫn migration. `stockmovements` 17.256 dòng không tái tạo được từ nguồn khác.
2. **Ba lỗ hổng chiếm quyền**: `POST /api/admin/employees/seed` là `[AllowAnonymous]` tạo `admin/admin` quyền Admin không rào chắn môi trường; JWT secret hardcode trong `DeploymentConfigurationValidator.cs:7` được commit; `ApprovalRulesController` chỉ `[Authorize]` trần nên mọi tài khoản tự đặt mình làm người duyệt. Gốc rễ là hai hệ permission không đồng bộ (policy phân biệt hoa/thường theo `RoleName`, `ResolvePermissions` thì không).
3. **Sai lệch thời gian xuyên suốt**: backend không gắn `Z` khi serialize DateTime nên mọi timestamp FE hiển thị sớm 7 giờ; ba bug ranh giới ngày đã xác nhận (`getNextDayInputValue` mất tác dụng hoàn toàn, "hôm nay" trả về hôm qua trong khung 00:00–07:00 ICT, workbench mua hàng lùi một tuần sáng thứ Hai).
4. **Contract FE↔BE viết tay, không versioning**: `ApprovalDecision` map bằng magic number `0/1` — đảo thứ tự enum C# biến duyệt thành từ chối im lặng; 9 điểm lệch khác đã liệt kê.

### P0 đã thực hiện ngày 26/07/2026 (6 lane song song + main gom)

| Việc | Trạng thái | Evidence runtime |
|---|---|---|
| Seed endpoint `[AllowAnonymous]` | Đã đóng: bỏ AllowAnonymous, chặn ngoài Development, mật khẩu ngẫu nhiên 16 ký tự | `POST /api/admin/employees/seed` chưa đăng nhập → **401** |
| Policy 3 controller `[Authorize]` trần | ApprovalRules→AdminAccess; Stocktakes→InventoryAccess (approve/reject→**InventoryApproveAccess** mới = Admin+Quản lý); WorkflowReports siết theo nhóm endpoint | `beptruong` → 403 price-variance/audit/approval-rules, 200 current-stock; `thumua` → 200 price-variance + purchase-plan, 403 audit; `quanly` duyệt kiểm kê được (422 do id giả), `thukho` → 403 |
| JWT secret hardcode | Bỏ hằng số, thay bằng kiểm tra độ dài + số ký tự phân biệt | grep chuỗi secret cũ trong `backend/src` → 0 |
| Ngày nghiệp vụ | Thêm `Helpers/ServiceCalendar.cs` (giờ VN, đúng bất kể TZ process); 21 vị trí `DateTime.*` được phân loại timestamp/mã chứng từ/ngày nghiệp vụ | `grep DateTime.Today backend/src` → **0** |
| Serialize DateTime | `Helpers/UtcDateTimeJsonConverter.cs` + đăng ký trong `AddJsonOptions` | `movementAt`/`receivedAt` (nullable) đều có `Z`; `purchaseForDate` (DateOnly) vẫn `yyyy-MM-dd` |
| Enum wire-format | `JsonStringEnumConverter` toàn cục; FE bỏ magic number `0/1` | Converter đọc được cả chuỗi lẫn số → không có cửa sổ gãy giữa 2 lần deploy |
| 3 bug ranh giới ngày FE | `getNextDayInputValue` (vô tác dụng), `getTodayInputValue` (ra hôm qua), `toIsoMonday` (lùi 1 tuần) | 3 file test mới, chạy xác định ở mọi TZ |
| Tab Báo cáo theo quyền | Ẩn tab/sub-tab theo permission, ép fallback khi URL trỏ tab mất quyền, 403 không biến thành empty state | 9 test permission pass |
| Backup + diễn tập restore | `tools/db/` (Backup/Restore + README) | Dump 12,5 MB/1,0s → zip 2,84 MB; restore 4,2s; **61/61 bảng, 53.396 dòng, 0 sai lệch**; fingerprint MD5 `stockmovements` trùng khớp |

Quality gates: backend **595/595**, frontend **316/316** (57 file), `tsc --noEmit` 0 lỗi, build 0 warning, k6 smoke **9/9 ĐẠT** (không thoái hóa).

Hai điều chỉnh so với plan gốc, đều do phân tích impact thay vì làm máy móc:
1. Audit đề xuất `DateTime.Today → DateTime.UtcNow` — **sai**, sẽ lùi ngày trong khung 00:00–07:00 ICT. Đã thay bằng `ServiceCalendar` theo giờ Việt Nam.
2. `Stocktakes.approve` đặt `AdminAccess` sẽ khiến role `Quản lý` mất quyền duyệt kiểm kê. Đã thêm policy `InventoryApproveAccess`.

Phát hiện khác với audit ban đầu: **binlog đang bật sẵn** (`log_bin=1`, `gtid_mode=ON`, giữ 30 ngày) nên PITR khả thi ngay; hai lỗ hổng thật là binlog nằm cùng ổ với data và chưa có quy trình PITR được diễn tập.

### Xoay bí mật — ĐÃ THỰC HIỆN 26/07/2026 (Kỳ tự làm, đã xác minh)

| Việc | Trạng thái | Bằng chứng xác minh |
|---|---|---|
| Đổi mật khẩu 6 tài khoản trùng username | **Đã xong** | `POST /api/auth/login` với `admin`/`admin` → **401** |
| Xoay JWT secret | **Đã xong** | Secret cũ không còn trong `appsettings.json`; `git grep` toàn repo → **0 file** |
| Dọn secret cũ trong file test | **Đã xong** | `DeploymentConfigurationValidatorTests.cs:17` thay bằng fixture vô hại; 587/587 test vẫn pass |
| Đổi mật khẩu MySQL + tạo user `ipc_app` | **LOẠI khỏi phạm vi** theo quyết định của Kỳ | — |

Hệ quả cần biết ở phiên sau:
- **Mật khẩu `admin` không còn là `admin`.** Mọi script/test runtime cần đặt biến môi trường: k6 dùng `K6_PASSWORD`, tài liệu cũ nào ghi `admin/admin` đều đã lỗi thời (kể cả `AGENTS.md` và runbook Shipyard).
- Refresh token phát trước lúc xoay secret đã mất hiệu lực — người dùng phải đăng nhập lại. Đây là hành vi đúng.
- Mật khẩu MySQL của user `root` **vẫn còn trong lịch sử git tại `fdbc0e3`** và vẫn đang dùng — đã được Kỳ quyết định chấp nhận rủi ro này cho môi trường hiện tại. Nếu đưa hệ thống ra ngoài mạng nội bộ thì phải xử lý lại. *(Giá trị mật khẩu đã được gỡ khỏi tài liệu này ở P1.4 khi `docs/` bắt đầu được track vào git; tra trong `appsettings.json` local nếu cần.)*

Không được mô tả các mục P2–P3 là đã xử lý cho tới khi có evidence sửa thật.

### P1 đã thực hiện ngày 26/07/2026 (6 lane song song + main gom)

| Mục | Trạng thái | Ghi chú |
|---|---|---|
| 1.1 Health check + logging | Xong | `/health/live` (không chạm DB) + `/health/ready` (`DatabaseHealthCheck`, timeout 5s); `UseSerilogRequestLogging`; log JSON `CompactJsonFormatter` → `logs/ipc-.jsonl` bọc `WriteTo.Async`; `Log.CloseAndFlush()`. `health.sh` chuyển sang `/health/ready`, có nhánh chẩn đoán "alive nhưng not ready" |
| 1.2a Hạ tầng phân loại lỗi | Xong | `Exceptions/{BusinessRule,ResourceNotFound,ResourceConflict}Exception` (kế thừa thẳng `Exception`) → 400/404/409; `correlationId` vào body lỗi dùng lại `CorrelationIdMiddleware`; `WithExposedHeaders("X-Correlation-ID")`; thêm arm `BadHttpRequestException` để upload quá cỡ ra **413** thay vì 500 |
| 1.2b Phân loại `InvalidOperationException` | **CHƯA** | Cố ý hoãn — xem phần còn hở |
| 1.3 CI thật | Xong | CI chạy FE unit test; `IPC_TEST_CONNECTION_STRING` trỏ service container; **đảo thứ tự step** vì schema đang được dựng SAU khi test chạy; `RequiresMySqlFact` (thiếu biến ở local → Skipped có lý do, trong CI → chạy thật, không skip); step đếm integration test đã chạy, **exit 1 nếu = 0**; xóa `UnitTest1.cs`; concurrency, cache NuGet/npm, dependabot, CodeQL |
| 1.4 Gỡ `.gitignore` | Xong | `docs/` + `scripts/` vào git (8 + 3 file). `tools/perf/` hóa ra **đã track sẵn** — audit lỗi thời. Xóa 2 npm script trỏ `Invoke-Iter1QualityGate.ps1` (không tồn tại) |
| 1.5 Transaction + toàn vẹn | Xong | 9 transaction (6 mới) ở 5 service; unique constraint `uxStocktakeActiveWarehouse` qua cột sinh (MySQL không có partial index); 8 chỗ chuyển sang `ResourceConflictException` (409) |
| 1.5b Bọc execution strategy | **CHƯA** | Cố ý hoãn — xem phần còn hở |
| 1.6 Security headers | Xong | API: HSTS ngoài Development, nosniff, `X-Frame-Options: DENY`, CSP. Vercel: header đặt ở **root `vercel.json`**, đã xóa `frontend/vercel.json` |
| 1.7 Forwarded headers, cookie, rate limit | Xong | `UseForwardedHeaders` là middleware đầu tiên; cookie `Secure` qua `CookiePolicyOptions`; `api-general` thành **global limiter** (opt-out). `ApiPermitLimit=100000` của k6 nguyên vẹn |
| 1.8 Upload + parser XLSX | Xong | `[RequestSizeLimit(10 MB)]` cho **5** endpoint upload (audit đếm 4, sót stub `weekly-menu/import`); chặn merged-cell bomb, zip bomb 2 lớp, XXE, tràn số nguyên tên cột |
| 1.9 Lỗi hiện lên FE | Xong nhóm 1 | 20/20 call-site màn ra quyết định; custom lint rule `ipc/no-swallowed-query-error`; `EmptyStateProps` là discriminated union nên `variant="error"` thiếu `onRetry` là lỗi biên dịch |

Quality gates ngày 26/07 sau P1: backend **626 pass / 0 fail / 1 skip** (baseline 595), frontend **324/324** (baseline 316), `tsc --noEmit` 0 lỗi, `eslint` 0 error + 15 warning có chủ đích, build backend **0 warning 0 error**, FE production build pass. `detect-changes` báo 51 file / 114 symbol / risk critical — đó là **phạm vi tích lũy của cả 6 lane**, mọi flow bị chạm đều có test phủ và đều xanh.

Điều chỉnh so với plan audit, đều do phân tích impact chứ không làm máy móc:

1. **`EnableRetryOnFailure` đã bị gỡ.** Audit (1.5) yêu cầu bật, nhưng codebase có **26 chỗ `BeginTransactionAsync` ở 15 file và 0 chỗ bọc `CreateExecutionStrategy`** — `UnitOfWork.BeginTransactionAsync` là wrapper dùng chung cho 7 service, riêng `CoordinationService` có 6 chỗ. Bật retry mà bọc thiếu là vỡ runtime hàng loạt luồng, trong khi unit test mock `IUnitOfWork` nên vẫn xanh (pass giả). Giữ `CommandTimeout(30)`, tách việc bọc thành P1.5b.
2. **`InvalidOperationException` vẫn map 400.** Audit (1.2) yêu cầu để rơi về 500, nhưng toàn bộ service đang ném nó cho lỗi nghiệp vụ hợp lệ — đổi ngay sẽ biến hàng loạt 400 đúng thành 500. Đã thêm log `Warning "Unclassified exception"` kèm service/endpoint để P1.2b có danh sách chính xác.
3. **`CurrentStockRepository` giữ `ExecuteUpdateAsync`.** Audit coi đây là đường vòng bỏ qua RowVersion. Kiểm trên DB thật: `rowVersion` là `timestamp(6) on update CURRENT_TIMESTAMP(6)` nên database vẫn đẩy token lên; điều kiện `currentQty >= quantity` trong `WHERE` là compare-and-set nguyên tử, mạnh hơn optimistic lock cho bài toán trừ kho. Lỗ hổng thật chỉ là bản sao cũ trong change-tracker, đã xử lý đúng chỗ đó.
4. **Lỗ hổng XLSX rộng hơn audit mô tả**: cùng merged-cell bomb còn nguyên ở `PurchaseHistorySourceParser`. Đã trích `XlsxSecurityLimits` làm nguồn sự thật duy nhất (14 hằng số + helper), `XlsxWorkbookReader` giảm 712 → 332 dòng, toàn repo còn đúng **một** chỗ parse `<mergeCell>` và **một** `XDocument.Load`.

## Ma trận test P1.9 trên browser thật — lane 1, ngày 26/07/2026

Kịch bản `.artifacts/p19-error-matrix/p19-error-matrix.mjs` (viết theo pattern của
`.artifacts/e2e-project-wide/all-tabs-audit.mjs`: login thật, seed `localStorage`
customerId + weekStartDate, query param tuần `2026-07-20`, Chrome headed 1440×1000).
Lỗi được dựng bằng `page.route` chặn đúng endpoint nghiệp vụ của từng tab.

| Mục tiêu (trang · tab) | happy | negative 500 | permission 403 | đứt mạng | boundary rỗng | regression retry |
|---|---|---|---|---|---|---|
| Kế hoạch tuần · Nhu cầu | PASS | PASS 2 alert / 2 retry | PASS | PASS | PASS | PASS 2→0 |
| Kế hoạch tuần · Kế hoạch sản xuất | PASS | PASS 1/1 | PASS | PASS | PASS | PASS 1→0 |
| Kho · Luân chuyển | PASS | PASS 4/4 | PASS | PASS | PASS | PASS 4→0 |
| Kho · Nhu cầu xuất | PASS | PASS 3/3 | PASS | PASS | PASS | PASS 3→0 |
| Thu mua · Xử lý thu mua | PASS | PASS 2/1 | PASS | PASS | PASS | PASS 2→0 |
| Bếp · Ca sản xuất | PASS | PASS 1/1 | PASS | PASS | PASS | PASS 1→0 |

**36/36 PASS.** Tiêu chí từng ca: happy = API khỏe thì 0 alert; negative/403/đứt mạng = phải
ra alert **và** có đường thoát; boundary = rỗng thật thì **không** được có nút thử lại
(nút thử lại là tín hiệu của lỗi, không phải của rỗng); regression = bấm hết nút thử lại
sau khi API hồi phục thì alert về 0 và không tràn ngang (`scrollWidth 1430 ≤ 1440`).

Một lỗi thật do ma trận phát hiện, đã sửa trong cùng đợt: `WarehousePage.tsx` khối
`isWorkflowDocumentError || isSupplementalRequestError` dùng `InlineAlert` + `<span role="alert">`
thay vì `QueryErrorAlert`, nên báo lỗi mà **không có nút thoát** và **không tự tắt khi API hồi phục** —
alert lì lại khiến thủ kho tưởng dữ liệu vẫn hỏng, trong khi chính khối ngay trên nó đã dùng đúng
`QueryErrorAlert`. Sau khi sửa: Kho · Luân chuyển từ `4 alert / 3 retry` thành `4/4`, regression từ
`4→1` thành `4→0`.

Hai điều đã tự bác bỏ trong quá trình đo, ghi lại để phiên sau không kết luận vội:
1. Lần chạy đầu ra 24 FAIL là **lỗi phép đo**, không phải lỗi app: `page.route('**/*')` chặn cả
   module Vite dev nên trang trắng. Đã thêm chốt `rendered` (bodyText > 200, có tab, không ở /login)
   để trang không render bị đánh dấu `INVALID` thay vì `FAIL`.
2. Lọc endpoint bằng `url.includes('/api/')` là **sai**: Vite dev serve `/src/api/apiSlice.ts` cũng
   khớp, nên script trả HTTP 500 cho chính bundle của app. Phải so khớp `pathname.startsWith('/api/')`.

## Hiệu năng điều hướng sau P1.9 — lane 1, ngày 26/07/2026

Kịch bản `.artifacts/p19-perf/nav-perf.mjs`, 9 trang sidebar × 3 lượt, lấy **trung vị**.
Đo trên **production build qua preview cổng 4174** (`.artifacts/p19-perf/serve-dist.mjs`
phục vụ `frontend/dist` + proxy `/api` sang lane API 8001) — vì baseline `afterProduction`
trong `sidebar-navigation-performance-2026-07-25.json` cũng đo trên production preview,
không phải Vite dev. `vite.config.ts` chỉ khai proxy cho `server` nên phải dựng preview riêng.

| Chỉ số | Baseline 25/07 (afterProduction) | Sau P1.9 (26/07) | Kết luận |
|---|---|---|---|
| clickToContent | 65–83 ms | 11–22 ms | không chậm hơn (xem cảnh báo bên dưới) |
| clickToStable | 90–113 ms | 39–49 ms | không chậm hơn |
| Long task | 0 trên 9 trang | **0 trên 9 trang** | giữ nguyên |
| CLS (warm) | 0 | **0** | giữ nguyên |

**Cảnh báo khi đọc hai dòng đầu**: baseline định nghĩa mốc là "route-specific visible content",
kịch bản mới lấy mốc là "tiêu đề trang đổi + URL đổi". Hai định nghĩa không chắc trùng nhau nên
**không được kết luận là nhanh hơn 3–4 lần**; chỉ đủ để khẳng định không có thoái hóa. Muốn so
tuyệt đối thì phải thống nhất lại mốc đo trước.

**CLS chỉ phát sinh ở lượt cold đầu tiên**: Kho nguyên liệu lượt 1 = `0.1989`, lượt 2 và 3 = `0`;
Thu mua lượt 1 = `0.0498`, sau đó `0`; Bếp trưởng lượt 1 = `0.0088`, sau đó `0`. Truy nguyên bằng
`.artifacts/p19-perf/cls-attribution.mjs`: nguồn dịch chuyển là các `section.ipc-section-panel`
(Đơn mua chờ nhập kho, Tồn kho hiện tại, Luân chuyển kho) co giãn khi dữ liệu về lần đầu, không
phải thành phần nào P1.9 thêm vào. Đây là dao động cold-run đã được ghi nhận từ trước, không phải
thoái hóa — nhưng nếu muốn CLS bằng 0 cả ở lượt cold thì phải đặt chiều cao tối thiểu ổn định cho
ba panel đó, xếp vào việc tồn đọng.

Bundle sau P1.9: entry `307.28 kB / 96.66 kB gzip` (baseline `95.5 kB` gzip), `WeeklyMenuPage`
`84.39 kB` (baseline `83.50 kB`) — tăng ~1,2% do thêm nhánh xử lý lỗi.

## Sự cố mất dữ liệu và củng cố tầng database — 26–27/07/2026

### Sự cố

`backend/database/IPCmanagement.sql` hard-code `USE ipcManagement;` (dòng 18) rồi chạy 46 lệnh `DROP TABLE`. Chỉ định database đích ở dòng lệnh **không có tác dụng** — `USE` bên trong file ghi đè tham số. Lúc **26/07 23:44:34**, chạy file này vào một database nháp đã xoá sạch database chính: 46 bảng bị drop, 5 bảng mất hẳn (`stockmovements`, `currentstocklots`, `stocksnapshots`, `stocktakes`, `stocktakelines`), phần còn lại rỗng.

Đúng rủi ro số 1 của bản audit ("không có lưới an toàn dữ liệu") xảy ra trên thực tế.

### Khôi phục — PITR, và một bài học về mốc base

MySQL local có `binlog_format=ROW`, `binlog_row_image=FULL`, `gtid_mode=ON`, giữ binlog 30 ngày → PITR khả thi. Vì GTID bật, phải replay bằng `mysqlbinlog --skip-gtids` (không có thì MySQL bỏ qua sạch vì GTID đã nằm trong `gtid_executed`), kèm `--rewrite-db` để replay vào database tạm rồi mới swap.

**Lần khôi phục đầu tiên SAI** và đã swap lên database chính. Nguyên nhân: các snapshot kiểu `ipcmanagement_unit_research_*` được **tạo rỗng rồi nạp từ file dump cũ hơn** trong `D:\IPCManagement-backups\`, nên mốc nội dung của chúng là **giờ trong tên file dump**, không phải giờ `CREATE DATABASE` trong binlog. Lấy nhầm mốc (15:07:48 thay vì 14:53:02) làm bỏ sót cả đợt cleanup, 6 bảng sai dữ liệu mà mọi kiểm tra "hợp lý" vẫn xanh. Khoảng lặng binlog quanh lúc tạo database chỉ chứng minh không ai ghi, **không** chứng minh nội dung thuộc mốc nào.

Cái bắt được lỗi là **oracle**: script phá hoại chỉ có 46 lệnh `DROP TABLE` nên **11 bảng không bị đụng** và giữ nguyên dữ liệu tiền sự cố; dump database hỏng lại trước khi swap là có ngay một bộ đối chiếu chính xác tuyệt đối. Bản khôi phục thứ hai (start position `TUANKY-bin.000670 @ 13319`) khớp **11/11 số dòng và 11/11 md5 nội dung**.

Kết quả cuối trên `ipcmanagement`: 61 bảng, **130/130 khoá ngoại 0 dòng mồ côi**, dữ liệu tới ghi cuối cùng trước sự cố (26/07 16:34:36 giờ local = 09:34:37 UTC), mật khẩu admin giữ đúng bản đã xoay. Artifact ở `D:\MySQL-recovery-20260726\`.

### Củng cố sau sự cố

| Việc | Nội dung |
|---|---|
| Chốt an toàn `IPCmanagement.sql` | Bỏ `CREATE DATABASE`/`USE`. Chốt bằng bảng `TEMPORARY` + va chạm PRIMARY KEY: chưa chọn database → ERROR 1046; database đích không rỗng → ERROR 1062; **không để lại dấu vết** khi abort. Không dùng biến `@` vì MySqlConnector hiểu `@tên` là parameter. |
| Lỗi có sẵn được phát hiện kèm | File khai trùng 2 index (`ixApprovalHistoriesTarget`, `IX_approvalassignments_approverUserId` — vừa `KEY` trong `CREATE TABLE` vừa `CREATE INDEX` rời) nên **chưa bao giờ cài trọn được**, chết ở ERROR 1061 tại bảng thứ 47. Test cũ che bằng `.Replace(..., "")`. Đã xoá bản khai trùng và ghim regression. |
| **B13 đã đóng** | Cơ chế thật của lỗ hổng: `IPC_RUN_MYSQL_MIGRATION_TESTS` chỉ có trong 2 file test, **chưa bao giờ được set trong `.github/`** → 4 test replay im lặng return sớm mỗi lượt CI. Nay có step chạy 2 test fresh-install trên MySQL thật, cộng step **so schema từ migration với schema từ model**. |
| Hoà giải baseline ↔ model | Đường cài mới trước đây sinh schema **khác** model. Sáu nguyên nhân đã sửa (xem commit `8c145d4`). Nay khớp **723/723** (bảng + cột + kiểu + nullable + khoá ngoại). |
| Đồng bộ model snapshot | `20260723081500_AddUnitNormalizationReviews` viết tay, không có `.Designer.cs`, nên snapshot chưa bao giờ được cập nhật → `has-pending-model-changes` luôn đỏ. Thêm `SyncUnitNormalizationReviewsSnapshot` với `Up()/Down()` **rỗng**. |
| Hiện migration pending | `MigrationHealthCheck` vào `/health/ready`, trả **Degraded chứ không Unhealthy** (thiếu migration không làm API mất khả năng phục vụ). |
| Dọn | Xoá `20260708130000_RestorePurchaseRequestReceiptStatuses.cs` — 1/39 migration duy nhất vừa không có `.Designer.cs` vừa không có `[Migration]` inline nên **EF chưa từng thấy nó**. Deprecate `Upgrade_From_Phase1_To_V10.sql`. |

Database chính đã chạy `dotnet ef database update`: **38 → 40 migration**, sau khi diễn tập trên bản sao đầy đủ với dữ liệu thật (0 lỗi, 0 dòng dữ liệu thay đổi, phân bố `purchaserequests.status` giữ nguyên 6/2/1/1).

### Ba cái bẫy phải nhớ khi đụng vào migration

1. **Migration viết tay phải kèm `.Designer.cs` hoặc `[Migration]` inline.** Thiếu cả hai thì EF không thấy nó — file trông như đang chờ apply nhưng thực chất là code chết.
2. **KHÔNG chạy `dotnet ef migrations remove` khi migration cuối thiếu `.Designer.cs`.** EF không có snapshot để lùi về và sẽ reset snapshot gần như rỗng; lệnh `add` kế tiếp sinh ra migration tạo lại **toàn bộ database**. Đã xảy ra trong phiên này, khôi phục bằng `git checkout`.
3. **Trước khi thêm ID vào danh sách "baseline đã có sẵn"** (trong `Init_EF_History_For_Old_DB.sql` hoặc fixture test), phải đối chiếu **từng** `AddColumn`/`CreateTable` của migration đó với baseline. Khai sai làm migration bị bỏ qua và database cài mới thiếu cột — đã xảy ra với `20260702061320_AddImportAuditFields` (5 cột) và `20260702121000_AddProductionPlanMetadata` (1 cột).

## Phần còn hở, không được mô tả là đã hoàn tất

Còn hở sau đợt P1 ngày 26/07/2026:

- **P1.2b — phân loại `InvalidOperationException`**: vẫn map 400 kèm log `Warning "Unclassified exception"`. Phải quét theo log đó, đổi từng chỗ sang `BusinessRuleException`/`ResourceConflictException` rồi mới để `InvalidOperationException` rơi về 500. Có `// TODO P1.2b` tại arm tương ứng trong `ExceptionMiddleware`.
- **P1.5b — bọc `CreateExecutionStrategy` cho 26 `BeginTransactionAsync` ở 15 file**, rồi mới bật lại `EnableRetryOnFailure`. Ưu tiên `UnitOfWork.BeginTransactionAsync` (wrapper dùng chung cho 7 service) và `CoordinationService` (6 chỗ). Chừng nào chưa xong thì **không được bật retry**.
- **P1.9 nhóm 2 — 15 call-site còn nuốt lỗi thành empty state**: `AdminDataPage.tsx` (11 chỗ: dòng 255, 256, 277, 346, 350, 360, 366, 370, 374, 390, 393), `ApprovalPage.tsx` (56, 57, 73), `ApprovalRulesPage.tsx` (68). Lint rule đang để mức `warning` ở vùng này; đề xuất gộp vào P2.6 khi tách `AdminDataPage`.
- **`SupplementalMaterialRequestService.FulfillAsync`** gọi `RemoveStockWithCheckAsync` mà chưa xác nhận có transaction bao ngoài — `ExecuteUpdateAsync` ghi thẳng xuống DB nên nếu thiếu thì trừ kho commit độc lập với phần còn lại.
- **Luồng BOM import chưa có đường lỗi thân thiện**: file xlsx hỏng cho ra `InvalidDataException` → rơi vào nhánh mặc định → **HTTP 500**. Đường `FILE_READ_ERROR` hiện chỉ tồn tại ở luồng thực đơn tuần.
- ~~Vercel Root Directory~~ **ĐÃ XÁC MINH 26/07/2026**: Root Directory là `./` (gốc repo) nên root `vercel.json` là file authoritative, `frontend/vercel.json` đã xóa là đúng. Hệ quả cần biết: rewrite SPA khai trong `frontend/vercel.json` **chưa từng có hiệu lực** — deep-link trước nay sống nhờ preset Vite mặc định, giờ mới được khai báo tường minh ở root cùng bộ security header. Lần deploy tới lên `main`/`dev` phải kiểm lại deep-link và header bằng `curl -I`.
- **CodeQL sẽ fail nếu repo private mà chưa bật GitHub Advanced Security** (bước upload SARIF).
- ~~Chưa có evidence browser cho P1.9~~ **ĐÃ CHẠY 26/07/2026 trên lane 1**: ma trận 6 ca × 6 mục tiêu = **36/36 PASS**, evidence ở `.artifacts/p19-error-matrix/` (36 screenshot + `p19-matrix-results.json`). Chi tiết ở mục dưới. Hiệu năng điều hướng cũng **đã đo lại** trên production preview — xem mục "Hiệu năng điều hướng sau P1.9": long task 0/9 trang, CLS warm 0, không thoái hóa; bundle entry tăng `95.5 → 96.66 kB` gzip (+1,2%).
- **4 component thu mua là dead code**, không được mount ở đâu: `PurchaseDemandSection`, `PurchaseOrderSection`, `PurchaseSupplierSection`, `PurchaseHandoffSection` (và `SupplierLineItem`). Đã sửa cho đúng nhưng chưa xóa — chờ quyết định.

- Commit import BOM đã có preview/disable theo lỗi nhưng chưa có confirm dialog riêng tóm tắt tier, customer, effective date và số dòng.
- Activate/deactivate nhân viên vẫn gọi mutation trực tiếp; còn thiếu confirm nêu rõ user và tác động permission/đăng nhập.
- Audit khi sửa contract/menu schedule effective range cần thêm coverage.
- Stock adjustment/data-quality remediation phải tiếp tục giữ preview, reason và approval phù hợp với tác động ledger/master history.
- Audit/Nhân viên còn cold long task lần lượt khoảng `51 ms` và `60 ms` ở lần đo headed mới nhất; cần đo lại trên production build và nhiều mẫu trước khi quyết định refactor page lớn.
- Khối thay đổi tích lũy của các phiên trước đã được commit checkpoint `110e3c0` (26/07) cùng fix price-variance sau khi backend 595/595 + frontend unit 299/299 pass; chưa push. Còn untracked chủ đích: `tools/perf/` (kit đo hiệu năng) và `TestResults/`.
- Đợt sửa hiệu năng thứ hai 26/07 (chưa commit, backend 595/595 pass lại): `GenericRepository.GetPagedAsync` đã có OrderBy ổn định theo khóa chính; `ApprovalInboxService` hết N+1 (nạp lô + SLA batch — submit-time giờ lấy sớm nhất thay vì dòng đầu không xác định); `BuildPurchasePlanRowsAsync` bỏ 6 nhánh Include, dùng projection + subquery `PendingReceiptQty`; `ApprovalRoutingService` thêm `GetActiveRulesAsync` + `MatchRule` tĩnh. Smoke warm sau sửa không thoái hóa (danh sách 7–22 ms, price-variance 76 ms). Số đo inbox/purchase-plan trên DB hiện tại không đổi vì inbox gần trống — cải thiện là về scaling số truy vấn theo số chứng từ chờ.
- Điểm nóng hiệu năng còn mở duy nhất theo RUNBOOK `tools/perf/`: `DishService.GetSampleImportStatus` đếm 7–10 bảng tuần tự.

Còn hở ở tầng database sau đợt 27/07/2026:

- **Hai ID trong `__EFMigrationsHistory` của database chính không còn file migration**: `20260626043000_SeedTemporaryBomData` và `20260705121500_AddCompletedMealQuantityPlanStatuses`. EF bỏ qua dòng thừa nên không vỡ, nhưng **repo không tái lập được lịch sử của database chính**. Chưa quyết xử lý.
- **Ba ID trong `Init_EF_History_For_Old_DB.sql` cũng không còn file** (`AddCustomerContracts`, `AddMenuVersions`, `UpdateMenuScheduleStatusForVersioning`) — đã hợp nhất vào `20260630031911`. Vô hại, chưa dọn.
- **Hai test `Migration_upgrade_*` vẫn chưa bật được trong CI**: chúng đòi một lane đã seed sẵn ở trạng thái **trước** migration, CI chưa dựng được fixture đó. Chạy cục bộ cũng đỏ vì lane local đã migrate. Chỉ 2 test `Migration_fresh_*` đang chạy trong CI.
- **Gate so schema cố ý KHÔNG so hai thứ**, và đây là giới hạn đã biết chứ không phải sót: `DEFAULT` (baseline có chủ đích đặt default SQL mà model EF không khai) và **tên index** (MySQL tự đặt tên index khoá ngoại theo thứ tự tạo → `customerId`, `customerId1`, `unitId3`…, hai đường luôn khác tên dù phủ cùng cột). Một thay đổi chỉ động vào default hoặc tên index sẽ lọt gate.
- **`stocktakes.activeWarehouseKey` bị loại khỏi gate**: cột `GENERATED ... VIRTUAL` do `20260726120000_AddStocktakeActiveWarehouseUnique` tạo để làm unique index có điều kiện; model cố ý không map. Thêm cột generated tương tự sau này phải nhớ cập nhật danh sách loại trừ trong `verify.yml`.
- **`Upgrade_From_Phase1_To_V10.sql` đã deprecate nhưng biết là sai**: khối `customerimportmappings` dùng thiết kế cũ. Không vá vì không còn database Phase 1 nào để kiểm chứng bản vá. Nếu có database Phase 1 xuất hiện thì phải vá và test trên chính nó.
- **Artifact khôi phục đang giữ ở `D:\MySQL-recovery-20260726\`** (binlog copy, dump trước/sau, `ipc_rehearsal`, `ipcmanagement_pitr2`). Chưa quyết thời điểm dọn — giữ tới khi chắc chắn không cần đối chiếu lại.
- **Backup vẫn là thao tác tay.** Sự cố 26/07 khôi phục được nhờ binlog còn nguyên và có snapshot cũ, không nhờ quy trình backup nào. Rủi ro số 1 của bản audit **chưa được đóng** — mới chỉ chặn được một đường gây ra nó.

## Bàn giao cho phiên mới — đợt refactor UI = f(data, state)

Ngày 26/07/2026 Kỳ giao làm lại kiến trúc dữ liệu/trạng thái. **Bản thiết kế đầy đủ ở
`docs/ARCHITECTURE-REDESIGN-2026-07-26.md`** (commit `72e3129`) — 11 phần, tổng hợp 17 mũi khảo sát
song song + 3 lăng kính phản biện, mọi khẳng định có `file:dòng`. **Đọc file đó, đừng khảo sát lại.**

Trạng thái ngày 27/07/2026: nhánh `feature/production-plan` đang ahead
`origin/feature/production-plan`, **chưa push**.
Quality gates: BE **626 pass / 0 fail / 1 skip** · FE **327/327** · build 0 warning ·
schema migration == model 723/723 · `has-pending-model-changes` exit 0 · ma trận P1.9 36/36 trên
browser thật · long task 0/9 trang · CLS warm 0.

**Phạm vi Kỳ đã chốt:** `1b` (sửa sai nghiệp vụ + dựng hợp đồng, không di chuyển file hàng loạt) +
`2a` (được breaking change nội bộ nếu test xanh và UI không đổi hành vi) + `3b` (chia lane subagent).

**Một quyết định còn treo, cần hỏi Kỳ trước khi làm:**
- **A.** Phạm vi tái cấu trúc backend — `A1` VSA-lite (~160 file move, **0 file Migrations bị chạm**, ~45h)
  hay `A2` tối thiểu (~20 file, ~20h). Khuyến nghị `A1`.
- **B đã chốt và thực hiện:** Kỳ chọn B1, xóa code chết có kiểm chứng; các commit `c657918`,
  `9ef1b8e`, `e2071e7` đã xóa code chết và giữ lại 5 test đang phủ code sống.

**G0 — ĐÃ XONG 27/07/2026.** Cả 13 bug đúng-sai nghiệp vụ ở Phần B của bản thiết kế đã xử lý, gồm
`AdminDataPage.tsx` (API chết mà tile vẫn báo "Ổn định/Đạt/Trong SLA/Đủ tồn"), `GuidHelper.cs`
(id sai định dạng = **không lọc gì cả**, trả toàn bộ kho — 29 điểm fail-open), và **B13**
(`.github/workflows/verify.yml` — migration viết tay chưa từng chạy trong CI). Bốn commit:

```
58a3e68 chore(db,health): don migration chet, deprecate script Phase 1, bao migration pending
8c145d4 fix(db,ci): dong bo baseline voi model EF, siet gate B13 thanh so schema tu dong
3841447 fix(db,ci): chan IPCmanagement.sql pha database chinh, bat replay migration trong CI
3e205b4 fix: xu ly cac lo hong G0 (B1-B12) tren backend va frontend
```

Ghi chú về B13: mô tả gốc trong bản thiết kế ("21/36 migration viết tay chưa từng được thực thi trong
CI") đúng về **hậu quả** nhưng sai về **cơ chế**. Thực tế bộ test replay đã có sẵn trong repo, chỉ bị khoá
sau `IPC_RUN_MYSQL_MIGRATION_TESTS` mà biến đó chưa bao giờ được set trong `.github/`. Ngoài ra chuỗi
migration **không tự dựng được database từ trắng** — migration đầu tiên tham chiếu `warehouses` mà không
migration nào tạo bảng đó; chuỗi vốn thiết kế để chạy đè lên baseline `IPCmanagement.sql`. Chi tiết ở mục
"Sự cố mất dữ liệu và củng cố tầng database" bên trên.

**A vẫn còn treo** — chưa cần chốt để hoàn tất điểm dừng an toàn sau bước 5.

### Bước 4 — hậu tố `Async` (đã hoàn tất ngày 27/07/2026)

- Commit `00432c7 refactor(be): add Async suffix to controller actions`.
- Cả **175/175** controller action trả `Task`/`ValueTask` hiện có hậu tố `Async`; không đổi route URL.
- Cập nhật các điểm tham chiếu nguy cơ bằng tên action (`nameof`, `CreatedAtAction`, reflection và test gọi trực tiếp),
  rồi quét lại không còn tên cũ; compiler sau đó bắt thêm 3 lời gọi nội bộ trong `AuthController`.
- Thêm `backend/.editorconfig` để giữ quy ước hậu tố async cho method `async`, prefix `I` cho interface và `_camelCase`
  cho private/protected field. Build + backend tests xanh: **626 pass / 0 fail / 1 skip**.
- `gitnexus analyze` đã chạy lại, index up-to-date. `detect_changes --scope all` báo critical ở cấp diff tổng hợp
  (31 file / 228 symbol / 250 flow) vì đây là đổi tên hàng loạt; impact từng target đều **LOW**, không có HIGH/CRITICAL.

### Bước 5 — contract sinh từ Swagger + chuẩn hóa request model (đã hoàn tất ngày 27/07/2026)

- E1 ở commit `795d22e feat(contract): generate OpenAPI type baseline`: đăng ký Swagger dùng chung, thêm
  Swashbuckle CLI `7.3.1`, sinh `openapi.json` + `schema.ts`, thêm `gen:api`/`check:api-contract` và CI drift gate.
- E2 semantic-rename **68** request model backend và toàn bộ reference trong service/controller/validator/tests:
  `XxxRequestDto -> XxxRequest`, các input `XxxDto -> XxxRequest`. Con số thiết kế lịch sử là 69 nhưng source/spec
  hiện tại chỉ có 68 type request trong transitive closure; không tạo type giả để khớp số cũ.
- GitNexus impact trước sửa: **5 CRITICAL, 7 HIGH, 20 MEDIUM, 31 LOW, 5 UNKNOWN**; Kỳ đã cho phép tiếp tục cả
  CRITICAL. Rename preview cho thấy auth DTO có thể chạm `frontend/src/types/api.ts`, nên phần apply thật dùng Roslyn
  giới hạn trong `backend/IPCManagement.slnx`; **không file FE viết tay nào bị sửa**.
- Contract sau regenerate giữ **173 operation / 284 schema**, không còn request schema mang tên cũ và sinh lại
  deterministic. Giới hạn baseline vẫn còn: **66 operation chưa khai success-response schema**; đây là nợ typed
  response riêng, không che trong batch rename.
- Quality gates E2: Release build **0 warning / 0 error**; BE **626 pass / 1 skip**; FE unit **327/327**;
  lint **0 error / 9 warning baseline**; dependency-cruiser sạch; production build xanh; `git diff --check` sạch.
- Không chạy seed/reset database, không push. Bước 5 là điểm dừng an toàn đầy đủ trước khi quyết định Bước 6.

### Bước 6 — gỡ chu trình feature `projects↔workflow` và `chef↔workflow` (đã hoàn tất ngày 27/07/2026)

- Di chuyển nguyên trạng `dishCatalogApi.ts` + test từ `features/projects` xuống `src/api`, và
  `chefServiceDate.ts` + 2 test lịch nghiệp vụ từ `features/chef` xuống `src/lib`; giữ nguyên mọi export,
  endpoint, RTK Query cache tag và logic ngày Bangkok.
- Di chuyển `operationalPagePerformanceContracts.test.ts` từ `features/workflow/pages` lên `src/app` vì đây là
  contract tích hợp đa-feature; chỉ cập nhật đường dẫn `?raw`, giữ nguyên toàn bộ assertion hành vi/performance.
- Dependency graph sau sửa: `workflow -> projects/chef` từ **12 cạnh xuống 0**; 19 cạnh chiều
  `projects/chef -> workflow` được giữ lại để không lấn sang Bước 7. Baseline dependency-cruiser co từ
  **140 xuống 115** known violations, không có vi phạm mới.
- Impact trước sửa: `dishCatalogApi.ts` **HIGH** (18 direct / 66 total), `chefServiceDate.ts` **MEDIUM**
  (6 direct / 30 total); Kỳ đã cho phép tiếp tục cả HIGH/CRITICAL. TypeScript file-rename preview và compiler
  được dùng để cập nhật import; hai chuỗi `vi.mock` không nằm trong semantic edit được sửa tường minh.
- Quality gates: targeted **29/29**; full FE **327/327**; lint **0 error / 9 warning baseline**;
  dependency-cruiser sạch; production build xanh; BE **626 pass / 1 skip**, Release build **0 warning / 0 error**;
  contract drift gate xanh; `git diff --check` sạch. Không chạy seed/reset database, không push.

### Bước 7 — giải thể God-feature `workflow` (đã hoàn tất ngày 27/07/2026)

- `features/workflow` từ **34 file thực tế xuống 0**; số 45 file trong bản thiết kế là snapshot trước các đợt xóa
  code chết. Không còn import/reference tới đường dẫn `features/workflow`.
- Commit nền `b0a093f` chuyển `workflowApi` xuống `src/api`, route/workflow config + action eligibility xuống
  `src/lib`, types xuống `src/types`, bỏ barrel `workflow/index.ts`. `routeConfig` cũng xuống `src/lib` để core
  shared không import ngược tầng routes.
- Bốn lát nghiệp vụ: `1a45fd1` purchasing, `b6c8b75` warehouse, `7f77594` approvals, `b185b12` admin.
  `AdminDataPage` nằm ở `src/app/pages` vì composition auth + coordination + admin; `ApprovalRulesPage` thuộc
  `features/admin`. Test tích hợp purchasing + warehouse cũng chuyển lên `src/app`.
- Ba contract `?raw` được giữ và cập nhật cùng các lát liên quan; phần assertion ngoài import path không đổi.
  Endpoint, RTK Query cache key/tag, route URL và DOM không đổi. Baseline dependency-cruiser tiếp tục co
  **115 -> 61 -> 60 -> 54**, không thêm violation mới.
- Impact lớn nhất trước sửa: barrel `workflow/index.ts` **CRITICAL** (35 direct / 98 total), `workflowApi.ts`
  **HIGH** (18 / 73), `workflowConfig.ts` **HIGH** (18 / 103), `routeConfig.ts` **HIGH** (28 / 89);
  Kỳ đã cho phép tiếp tục cả HIGH/CRITICAL.
- Full quality gates: FE **327/327**, lint **0 error / 9 warning baseline**, dependency-cruiser sạch,
  production build xanh; BE **626 pass / 1 skip**, Release build **0 warning / 0 error**; contract drift gate
  và `git diff --check` xanh. Không chạy seed/reset database, không push.

### Bước 8 — migrate frontend sang OpenAPI types (đã hoàn tất ngày 27/07/2026)

- Sáu commit nguyên tử: `616e841` sửa metadata nullable/required của contract; `7957264` auth;
  `17a81a8` admin; `bfc2856` dish catalog; `ae5490d` coordination; `9d7ae0d` workflow/reporting.
- Năm API module mục tiêu không còn khai lại wire DTO/request/response bằng tay. Chúng derive từ
  `components`/`paths` trong `src/shared/api/contracts/schema.ts`; query PascalCase của Swagger được
  remap bằng `Uncapitalize`, còn view/domain model và mapper FE vẫn giữ nguyên hình dạng phục vụ UI.
- Bổ sung success-response metadata cho các controller inventory, supplemental request, warehouse và
  workflow report để generator nhìn thấy đúng DTO. Contract hiện có **173 operation / 396 schema**;
  chỉ còn bốn success response không có JSON schema: ba DELETE dish/ingredient và CSV audit export.
- Hai hook legacy vẫn được giữ để không thay public surface: update supplier trên purchase-request line và
  `POST /purchase-orders/{purchaseOrderId}/receive`. Backend/OpenAPI hiện không có hai route này; type adapter
  của chúng được derive từ contract gần nhất, không giả là operation sinh tự động và chưa xóa trong Bước 8.
- Contract regenerate deterministic: SHA-256 trước/sau không đổi cho cả `openapi.json` và `schema.ts`;
  không có `as any`. Targeted workflow/purchasing/warehouse/reporting **113/113** và full FE **327/327**.
- Full quality gates: lint **0 error / 9 warning baseline**, dependency-cruiser sạch với **54 known violation**,
  production build xanh; BE **626 pass / 1 skip**, Release build **0 warning / 0 error**; `git diff --check` xanh.
- GitNexus staged audit của lát cuối: **14 file / 118 symbol / 73 execution flow, CRITICAL** do `workflowApi`
  là hub và contract sinh thay đổi rộng; toàn bộ blast radius đã được phép và phủ bằng full gates. Sau commit đã
  re-index thành công: **9.445 node / 26.543 edge / 300 flow**. Không reset/seed database, không push.

### Bước 9 — thu hẹp RTK Query cache invalidation (đã hoàn tất ngày 27/07/2026)

- Commit `11042f4 perf(fe-cache): scope workflow invalidation tags`. Tạo `workflowCacheTags.ts` làm nguồn chung
  cho 22 cache ID theo domain và các tập dependency của dashboard KPI/audit; không thêm tag type mới, không đổi
  endpoint name, query argument, request/response, RTK Query cache key hoặc DOM.
- Baseline trước sửa: **35** query `providesTags: ['WorkflowReports']`, **31** mutation invalidation trơn trong
  `workflowApi`/coordination/dish catalog và **85** literal `WorkflowReports`. Sau sửa: **0 provides trơn / 0
  invalidation trơn**; còn 10 literal là khai báo tag type hoặc tag có ID động theo week/target/line.
- Test `workflowApi.cacheInvalidation.test.ts` dựng 10 query đang subscribe. Cùng mutation remediation data-quality
  trước sửa làm **10/10** query refetch; sau sửa chỉ **2/10** (`data-quality`, `audit`) và store có đúng **2 query
  pending**, đạt tiêu chí không quá 3 panel `isFetching`.
- Query dẫn xuất khai cả tag domain riêng và tag nguồn thật: purchase plan theo demand/current stock/PO/quotation,
  stock ledger theo movement/current stock, usage theo issue/return, KPI theo demand/purchase/inventory/data-quality,
  audit theo toàn bộ domain workflow. Cache không refetch toàn hệ thống nhưng vẫn bị invalidated khi nguồn thay đổi.
- Bundle entry gần như giữ nguyên: **307,16 kB / 96,67 kB gzip -> 307,22 kB / 96,69 kB gzip**. Module tag dùng
  chung là 1,43 kB / 0,51 kB gzip; không phát sinh dependency violation mới.
- Full quality gates: FE **328/328**, lint **0 error / 9 warning baseline**, dependency-cruiser sạch với **54 known
  violation**, production build xanh; BE **626 pass / 1 skip**, Release build **0 warning / 0 error**; contract
  regenerate deterministic và `git diff --check` xanh.
- GitNexus staged audit: **6 file / 11 symbol / 9 execution flow, HIGH** do cache tag là quan hệ động ngoài call
  graph; blast radius đã được phủ bằng test fan-out và full regression. Sau commit đã re-index up-to-date. Không
  reset/seed database, không push.

### Bước 10 — A1 VSA-lite, giữ cây FE (hoàn tất ngày 27/07/2026)

- Giữ nguyên cây FE hiện tại theo quyết định A1; không đổi `components/lib/types/api` sang `shared`. `ReportsPage.tsx` giảm **1.295 → 799 dòng** (`38627a8`); `AdminDataPage.tsx` giảm **2.305 → 74 dòng** với page model 747 dòng và 7 panel đều dưới 440 dòng (`dbb99a3`).
- Backend giữ một project: 138 file vào 10 vertical slice `Features/{Admin,Approvals,Auth,Catalog,Coordination,Inventory,Planning,Purchasing,Reports,SampleData}` và 2 contract dùng chung vào `Shared/Contracts`; `Data`, entities, resources và migrations giữ nguyên (`d56eb86`). Gate convention xác nhận 0 namespace/path mismatch, 0 legacy namespace reference, 0 migration diff.
- Hai stylesheet khổng lồ 6.607 dòng được tách thành 13 file, mỗi file không quá 636 dòng; xóa 197 selector/101 rule của 39 class không còn dùng. CSS production giảm **195.850 → 182.745 byte**, gzip **32,70 → 30,65 kB** (`b23551e`).
- Fix phát hiện trong gate: Warehouse chịu được response supplemental page thiếu `items` và có contract test (`55241f4`); 8 Playwright spec import `ROUTES` từ vị trí hiện hành `src/lib/routeConfig` (`e65effa`). Không update snapshot cũ.
- Full gate sau thay đổi: backend **629 pass / 1 skip**, frontend **329/329**, lint **0 error / 4 warning baseline**, dependency-cruiser không có vi phạm mới, FE production build xanh, Release contract regenerate deterministic, `git diff --check` sạch. Browser desktop runtime thật và DB gate xem mục trên; mobile cố ý chưa test.

### Nền `QueryView` của Bước 11 (hoàn tất ngày 27/07/2026)

- Commit `d2a5d62 feat(fe-state): add typed query view contract` thêm `frontend/src/lib/queryView.ts` với
  discriminated union `QueryView<T>` và adapter thuần `toQueryView`.
- Contract phân loại `uninitialized`, `loading`, `forbidden`, `error`, `ready`; nhánh `ready` giữ data cũ khi
  refreshing và mang truncation evidence. Empty được dẫn xuất sau khi đã vào `ready`, không phải default của lỗi/skip.
- `queryView.test.ts` phủ đủ tám ca: uninitialized, loading, ready-empty, ready-success, refreshing, partial,
  forbidden và error — **8/8 pass**.
- ESLint có guardrail kiểu strangler: query đã gọi `toQueryView(query, ...)` bị cấm tiếp tục dùng
  `query.data ?? []`. Probe cố ý vi phạm đã bị rule chặn; code cũ chưa opt-in không làm tăng warning baseline.
- Full FE gates: **337/337** unit tests, lint **0 error / 4 warning baseline**, dependency-cruiser không có vi
  phạm mới và vẫn ignore 54 known violations, production build xanh. Không đổi UI/API/cache/DOM, không chạm
  backend hay database nên chưa chạy browser/DB gate ở bước nền này.
- Hai pilot Material Demand và Warehouse thuộc Bước 12 đã hoàn tất; chỉ test website
  `1365×900`, `1280×900`, `768×1024`, mobile ngoài scope.

**Workflow thống nhất:** Phần F của `docs/ARCHITECTURE-AUDIT-2026-07-26.md` là nguồn duy nhất,
hợp nhất `f(data, state)` với P0–P3 theo Bước 11→18; không còn roadmap song song. Bước 11
tổng thể đã hoàn tất: `QueryView` `d2a5d62`, backend architecture baseline `d877d83`, growth
reporter `c549bd2` và contract build cô lập `6a5259b`. Gate hiện tại: BE **631 pass / 1 skip**,
FE **341/341**, lint **0 error / 4 warning baseline**, dependency không có vi phạm mới, contract
deterministic, EF migration snapshot sạch và production build xanh.

Bước 12 có hai pilot đã commit: Material Demand `71656bc` và Warehouse `87ad944`.
Gate browser headed đã xanh trên `1365×900`, `1280×900`, `768×1024` với ANV tuần 20/07:
API 2xx, 0 request fail, 0 console/page error, warm revisit 0 request/0 long task/CLS 0, 0 page overflow.
Evidence tại `.artifacts/shipyard-live/query-view-pilot-performance.json` và sáu ảnh
`query-view-{material-demand,warehouse-movement}-*.png`; targeted state/component contract **21/21**.
Bước tiếp theo là Bước 13, gỡ bốn backend dependency cycle theo từng commit nguyên tử.

### Bước 13 — backend boundary (đang thực hiện)

- Commit `97bb33f refactor(be-boundary): remove purchasing reports cycle` gỡ cycle đầu tiên:
  `Purchasing→Reports` **3 → 0** reference; architecture baseline bỏ hẳn ceiling cạnh này.
- `WorkflowReportQueryDto` và `WorkflowReportPageQueryDto` là transport contract thực sự dùng chung,
  đã chuyển nguyên shape/default/clamp sang `Shared/Contracts`; `PurchasePlanReportDto` về feature
  Purchasing. Contract Swagger/TypeScript regenerate deterministic, không drift.
- `PurchaseRequestWorkflowService.HasPriceException` dùng `PurchasePricePolicy` thuộc Purchasing thay
  `WorkflowReportCalculator`; purchase-plan/candidate/workbench targeted **12/12**.
- Full gate sau lát: BE **631 pass / 1 skip**, FE **341/341**, lint **0 error / 4 warning baseline**,
  dependency FE không tăng, production build xanh, EF migration snapshot sạch.
- Còn ba cycle: `Approvals→Coordination` 1, `Coordination→SampleData` 2,
  `Purchasing→Planning` 1; sau đó bỏ direct DbContext khỏi hai controller theo Gate 13.

## Quy trình tiếp tục ở phiên mới

1. Đọc `AGENTS.md`, tài liệu này và `.artifacts/shipyard-live/E2E-AUDIT-2026-07-25.md` trước khi hỏi lại người dùng.
2. Chạy `git status --short --branch`; xác nhận vẫn ở `feature/production-plan`. Không reset, checkout hoặc commit thay đổi chưa rõ ownership.
3. Chạy `node .gitnexus/run.cjs status`. Khi sửa symbol, chạy upstream impact và báo risk/callers; trước commit phải chạy `detect-changes`.
4. Kiểm tra port `8090`, `3001`, `8001` và trạng thái Shipyard lane. Không khởi tạo database mới nếu lane hiện tại còn evidence cần bảo toàn.
4b. **Trước khi chạy bất kỳ file `.sql` nào vào MySQL**: `grep -n '^USE\|DROP TABLE\|DROP DATABASE'` file đó trước. `backend/database/IPCmanagement.sql` nay có chốt an toàn nhưng các file khác thì chưa. Muốn biết database có tụt hậu migration không thì gọi `/health/ready` — check `migrations` sẽ báo Degraded kèm danh sách ID còn thiếu.
5. Mở UI bằng browser headed; đăng nhập demo `admin` với mật khẩu lấy từ biến môi trường `K6_PASSWORD`
   (mật khẩu đã xoay, không thử `admin/admin`). Không chỉ gọi API rồi kết luận FE pass.
6. Khi tiếp tục E2E, dùng tuần ANV 25k làm baseline, kiểm tra toàn bộ tab và đối chiếu FE/BE/DB. Nếu thay đổi dữ liệu test, ghi lại document lineage và correction/audit.
7. Sau sửa: chạy targeted test, full frontend unit, lint, production build; chạy backend regression khi contract/service thay đổi; chụp lại evidence và cập nhật coverage nếu đã chạy lại coverage.
8. Cập nhật tài liệu này và E2E audit sau mỗi thay đổi đáng kể; ghi rõ phần đã xác minh và phần chỉ là giả định.

## Evidence cần đọc

- `.artifacts/shipyard-live/E2E-AUDIT-2026-07-25.md`
- `.artifacts/shipyard-live/purchasing-tabs.png`
- `.artifacts/shipyard-live/chef-summary-above-plan.png`
- `.artifacts/shipyard-live/report-price-tabs.png`
- `.artifacts/shipyard-live/admin-data-tabs.png`
- `.artifacts/shipyard-live/warehouse-final-supplemental-status.png`
- `.artifacts/shipyard-live/live-visual-performance.json`
- `.artifacts/shipyard-live/sidebar-navigation-performance-2026-07-25.json`
- `.artifacts/shipyard-live/coverage-be-20260725/report/index.html`
- `frontend/coverage/index.html`

## Tài liệu nền liên quan

- `docs/MVP_WEB_FLOW.md`: thứ tự thao tác web và hành vi khi bị block.
- `docs/TESTING.md`: test suite, coverage và Shipyard E2E.
- `docs/DEVELOPMENT.md`: command, lane mapping và quy tắc phát triển.
- `docs/ARCHITECTURE.md`: boundary FE/BE/DB và data flow.
- `docs/CONFIGURATION.md`: cấu hình local/lane và biến môi trường.
