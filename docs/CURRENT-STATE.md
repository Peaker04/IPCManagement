<!-- generated-by: gsd-doc-writer -->
# Trạng thái làm việc hiện tại

Tài liệu này là handoff sống cho các phiên làm việc mới. Nó tóm tắt mục tiêu nghiệp vụ, trạng thái Shipyard, các quyết định đã chốt, evidence và phần còn hở sau chuỗi kiểm thử E2E ngày 25/07/2026. Code đang chạy, database lane và evidence mới nhất vẫn là nguồn sự thật cao hơn tài liệu này.

## Phạm vi người dùng đã chốt

- Chạy E2E trên Shipyard bằng template ANV mặc định mức giá `25k`, bao quát cả tuần thay vì chỉ ngày 20. Ngày 20 từng có dữ liệu nghiệp vụ sai và được phép sửa lại để tiếp tục kiểm thử.
- Không kết luận pass từ backend test đơn lẻ. Mỗi bước quan trọng phải đối chiếu đồng thời: control/trạng thái FE → request/response BE → transition trong DB → trạng thái render lại trên FE.
- Ma trận kiểm thử áp dụng cho toàn bộ trang và tab: happy path → negative → boundary → permission → regression → integration/third-party failure.
- Happy path dùng workbook ANV mặc định; negative/worst-case phải tạo bản sao rồi chỉnh dữ liệu có chủ đích, không sửa đè file template gốc. Mỗi case phải ghi rõ dữ liệu đã thay đổi và cleanup/correction tương ứng.
- Khi luồng hiện tại thiếu nghiệp vụ, được bổ sung feature để E2E đúng hơn, ví dụ thiếu nguyên liệu → yêu cầu bổ sung → kho xử lý → chuyển thu mua → chọn giá/NCC → duyệt → PO → nhập kho → cấp tiếp → bếp xác nhận; nguyên liệu dư phải đi qua trả kho/hao hụt.
- Thay đổi UI phải giữ cấu trúc SAP Fiori: work object tách bằng tab, trạng thái/action rõ ràng, không ẩn lỗi dependency thành empty state, layout ổn định khi refetch và có evidence Chrome/Playwright.
- Button/action và dữ liệu hiển thị phải được đối chiếu với permission, eligibility và terminal state do server trả về. Action không hợp lệ phải ẩn hoặc disable kèm lý do; không được chỉ ẩn trên FE trong khi BE vẫn cho phép mutation sai.
- Không tự gộp nguyên liệu theo tên. Chứng từ chi tiết giữ document/line grain; báo cáo aggregate theo ID, unit và phạm vi nghiệp vụ.

## Môi trường Shipyard hiện tại

| Thành phần | Giá trị đã kiểm tra ngày 25/07/2026 |
|---|---|
| Git branch | `feature/production-plan` |
| Shipyard UI | `http://localhost:8090` |
| Frontend lane 1 | `http://localhost:3001` |
| API lane 1 | `http://localhost:8001` |
| Database | `ipc_lane1` |
| Tài khoản demo | `admin / admin` |
| Template happy path | `C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx` |

Ba port `8090`, `3001`, `8001` đang listen tại thời điểm cập nhật. Không giả định trạng thái này còn đúng ở phiên sau; phải kiểm tra lại trước khi mở browser hoặc chạy test.

`ipc_lane1` hiện không phải database trống. Lane đang chứa dữ liệu và audit evidence của E2E bổ sung đã hoàn tất. Không chạy reset/seed hoặc sửa trực tiếp DB chỉ để làm test pass trước khi xác minh chứng từ cần bảo toàn và đọc `shipyard/profiles/IPCManagement/hooks/reset.sh`.

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

Kit đo nằm ở `tools/perf/` (untracked, giữ local): `k6/smoke.js|load.js|stress.js|lib.js` + `RUNBOOK.md` + `sql/`. Điều kiện đo: backend Release cổng `8001` (`dotnet run -c Release --no-launch-profile`, env Development), database chính `ipcmanagement` read-only, tài khoản `admin/admin`, k6 cài qua winget (`C:\Program Files\k6\k6.exe`).

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

## Cách browser-use đã dùng trong phiên này

- Dùng trực tiếp `uvx browser-use` từ project root; không dùng hoặc tìm `agent-browser`.
- `ensure_real_tab()`, `goto_url()`, `js()` và `cdp()` điều khiển Chrome hiện có trên lane `http://localhost:3001`; đăng nhập demo vẫn là `admin/admin` khi session chưa có.
- `PerformanceObserver` thu long task/layout shift; resource timing được reset trước từng click để tách endpoint của đúng tab. Probe còn lấy selected tab, panel ID, `aria-busy`, chiều cao trang và trạng thái giữ panel cũ.
- Reduced motion được kiểm bằng CDP `Emulation.setEmulatedMedia`; viewport mobile 390 px không tràn ngang và transition đo được `0s`.
- Evidence đã rút gọn, không chứa token hoặc dữ liệu cá nhân, nằm ở `.artifacts/shipyard-live/tab-performance-controlled-lazy-2026-07-25.json`.

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
| Backend | 595/595 pass (26/07, sau fix price-variance) | 69.4% | 53.8% | 75.5% method |
| Frontend | 299/299 pass (26/07) | 39.68% | 29.21% | 32.00% function |

Số coverage phần trăm là của lần chạy coverage 25/07; ngày 26/07 chỉ chạy lại test suite, chưa chạy lại coverage.

- Frontend lint: pass.
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

## Phần còn hở, không được mô tả là đã hoàn tất

Còn hở sau đợt P1 ngày 26/07/2026:

- **P1.2b — phân loại `InvalidOperationException`**: vẫn map 400 kèm log `Warning "Unclassified exception"`. Phải quét theo log đó, đổi từng chỗ sang `BusinessRuleException`/`ResourceConflictException` rồi mới để `InvalidOperationException` rơi về 500. Có `// TODO P1.2b` tại arm tương ứng trong `ExceptionMiddleware`.
- **P1.5b — bọc `CreateExecutionStrategy` cho 26 `BeginTransactionAsync` ở 15 file**, rồi mới bật lại `EnableRetryOnFailure`. Ưu tiên `UnitOfWork.BeginTransactionAsync` (wrapper dùng chung cho 7 service) và `CoordinationService` (6 chỗ). Chừng nào chưa xong thì **không được bật retry**.
- **P1.9 nhóm 2 — 15 call-site còn nuốt lỗi thành empty state**: `AdminDataPage.tsx` (11 chỗ: dòng 255, 256, 277, 346, 350, 360, 366, 370, 374, 390, 393), `ApprovalPage.tsx` (56, 57, 73), `ApprovalRulesPage.tsx` (68). Lint rule đang để mức `warning` ở vùng này; đề xuất gộp vào P2.6 khi tách `AdminDataPage`.
- **`SupplementalMaterialRequestService.FulfillAsync`** gọi `RemoveStockWithCheckAsync` mà chưa xác nhận có transaction bao ngoài — `ExecuteUpdateAsync` ghi thẳng xuống DB nên nếu thiếu thì trừ kho commit độc lập với phần còn lại.
- **Luồng BOM import chưa có đường lỗi thân thiện**: file xlsx hỏng cho ra `InvalidDataException` → rơi vào nhánh mặc định → **HTTP 500**. Đường `FILE_READ_ERROR` hiện chỉ tồn tại ở luồng thực đơn tuần.
- ~~Vercel Root Directory~~ **ĐÃ XÁC MINH 26/07/2026**: Root Directory là `./` (gốc repo) nên root `vercel.json` là file authoritative, `frontend/vercel.json` đã xóa là đúng. Hệ quả cần biết: rewrite SPA khai trong `frontend/vercel.json` **chưa từng có hiệu lực** — deep-link trước nay sống nhờ preset Vite mặc định, giờ mới được khai báo tường minh ở root cùng bộ security header. Lần deploy tới lên `main`/`dev` phải kiểm lại deep-link và header bằng `curl -I`.
- **CodeQL sẽ fail nếu repo private mà chưa bật GitHub Advanced Security** (bước upload SARIF).
- ~~Chưa có evidence browser cho P1.9~~ **ĐÃ CHẠY 26/07/2026 trên lane 1**: ma trận 6 ca × 6 mục tiêu = **36/36 PASS**, evidence ở `.artifacts/p19-error-matrix/` (36 screenshot + `p19-matrix-results.json`). Chi tiết ở mục dưới. Vẫn **chưa đo lại p95** sau P1.9; bundle entry tăng `95.5 → 96.65 kB` gzip (+1,15 kB), `WeeklyMenuPage` `83.50 → 84.39 kB`.
- **4 component thu mua là dead code**, không được mount ở đâu: `PurchaseDemandSection`, `PurchaseOrderSection`, `PurchaseSupplierSection`, `PurchaseHandoffSection` (và `SupplierLineItem`). Đã sửa cho đúng nhưng chưa xóa — chờ quyết định.

- Commit import BOM đã có preview/disable theo lỗi nhưng chưa có confirm dialog riêng tóm tắt tier, customer, effective date và số dòng.
- Activate/deactivate nhân viên vẫn gọi mutation trực tiếp; còn thiếu confirm nêu rõ user và tác động permission/đăng nhập.
- Audit khi sửa contract/menu schedule effective range cần thêm coverage.
- Stock adjustment/data-quality remediation phải tiếp tục giữ preview, reason và approval phù hợp với tác động ledger/master history.
- Audit/Nhân viên còn cold long task lần lượt khoảng `51 ms` và `60 ms` ở lần đo headed mới nhất; cần đo lại trên production build và nhiều mẫu trước khi quyết định refactor page lớn.
- Khối thay đổi tích lũy của các phiên trước đã được commit checkpoint `110e3c0` (26/07) cùng fix price-variance sau khi backend 595/595 + frontend unit 299/299 pass; chưa push. Còn untracked chủ đích: `tools/perf/` (kit đo hiệu năng) và `TestResults/`.
- Đợt sửa hiệu năng thứ hai 26/07 (chưa commit, backend 595/595 pass lại): `GenericRepository.GetPagedAsync` đã có OrderBy ổn định theo khóa chính; `ApprovalInboxService` hết N+1 (nạp lô + SLA batch — submit-time giờ lấy sớm nhất thay vì dòng đầu không xác định); `BuildPurchasePlanRowsAsync` bỏ 6 nhánh Include, dùng projection + subquery `PendingReceiptQty`; `ApprovalRoutingService` thêm `GetActiveRulesAsync` + `MatchRule` tĩnh. Smoke warm sau sửa không thoái hóa (danh sách 7–22 ms, price-variance 76 ms). Số đo inbox/purchase-plan trên DB hiện tại không đổi vì inbox gần trống — cải thiện là về scaling số truy vấn theo số chứng từ chờ.
- Điểm nóng hiệu năng còn mở duy nhất theo RUNBOOK `tools/perf/`: `DishService.GetSampleImportStatus` đếm 7–10 bảng tuần tự.

## Quy trình tiếp tục ở phiên mới

1. Đọc `AGENTS.md`, tài liệu này và `.artifacts/shipyard-live/E2E-AUDIT-2026-07-25.md` trước khi hỏi lại người dùng.
2. Chạy `git status --short --branch`; xác nhận vẫn ở `feature/production-plan`. Không reset, checkout hoặc commit thay đổi chưa rõ ownership.
3. Chạy `node .gitnexus/run.cjs status`. Khi sửa symbol, chạy upstream impact và báo risk/callers; trước commit phải chạy `detect-changes`.
4. Kiểm tra port `8090`, `3001`, `8001` và trạng thái Shipyard lane. Không khởi tạo database mới nếu lane hiện tại còn evidence cần bảo toàn.
5. Mở UI bằng browser headed; đăng nhập demo `admin/admin`. Không chỉ gọi API rồi kết luận FE pass.
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
