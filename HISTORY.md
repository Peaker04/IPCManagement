<!-- migrated-from: docs/CURRENT-STATE.md -->
# Lịch sử triển khai và sự cố

File này là nhật ký append-only. Chỉ đọc khi điều tra một thay đổi, phase, sự cố hoặc
evidence cũ; không dùng bất kỳ trạng thái hay quality-gate lịch sử nào ở đây để ghi đè
`MEMORY.md`. Phần bên dưới được nhập nguyên vẹn một lần từ handoff cũ; từ sau mốc tách này
chỉ được append, không viết lại số cũ.

## Snapshot handoff cũ trước khi phân tầng

Phần trạng thái hiện hành và checklist tiếp tục đã được cắt sang `MEMORY.md`; không lặp lại ở đây.

## Dọn lịch sử và CI ngày 29/07/2026

- Branch đang làm việc là `feature/workflow-b17-b18`, tách trực tiếp từ `main` tại `6c9931a` để tiếp tục Phase 17 rồi Phase 18. Lịch sử nền có 85 commit milestone liên tục với ngày author/committer chính xác, ranh giới Phase 8–16 rõ ràng, cộng một commit sửa CI ngày 29/07.
- Remote `main` đã được thay bằng lịch sử curated qua `--force-with-lease`; tip cũ `968b2ed` vẫn được giữ tại `backup/main-before-history-curation-20260729-000323`. Backup của `feature/production-plan`, local `main` cũ, Git bundle và manifest phục dựng cũng vẫn được giữ.
- Lỗi CI boundary xuất phát từ việc test dùng `DateTime.Today` của runner UTC trong khi validator dùng `ServiceCalendar.Today()` theo giờ Việt Nam. Test đã dùng chung service calendar và pass khi ép `TZ=UTC`.
- Lỗi integration refresh-token trong run backup feature `e67f0e0` là contract test cũ. Lịch sử hiện tại xác minh refresh token không xuất hiện trong response body và được phát hành bằng cookie HttpOnly.
- Full local gate xanh: Application 49/49, API 667 pass/1 skip, frontend 416/416, lint, dependency check và production build. GitHub Verify và CodeQL cũng đã xanh trên lịch sử replacement; các commit mới vẫn phải chạy lại hai gate này.

## Phạm vi người dùng đã chốt

- Chạy E2E trên Shipyard bằng template ANV mặc định mức giá `25k`, bao quát cả tuần thay vì chỉ ngày 20. Ngày 20 từng có dữ liệu nghiệp vụ sai và được phép sửa lại để tiếp tục kiểm thử.
- Không kết luận pass từ backend test đơn lẻ. Mỗi bước quan trọng phải đối chiếu đồng thời: control/trạng thái FE → request/response BE → transition trong DB → trạng thái render lại trên FE.
- Ma trận kiểm thử áp dụng cho toàn bộ trang và tab: happy path → negative → boundary → permission → regression → integration/third-party failure.
- Happy path dùng workbook ANV mặc định; negative/worst-case phải tạo bản sao rồi chỉnh dữ liệu có chủ đích, không sửa đè file template gốc. Mỗi case phải ghi rõ dữ liệu đã thay đổi và cleanup/correction tương ứng.
- Khi luồng hiện tại thiếu nghiệp vụ, được bổ sung feature để E2E đúng hơn, ví dụ thiếu nguyên liệu → yêu cầu bổ sung → kho xử lý → chuyển thu mua → chọn giá/NCC → duyệt → PO → nhập kho → cấp tiếp → bếp xác nhận; nguyên liệu dư phải đi qua trả kho/hao hụt.
- Thay đổi UI phải giữ cấu trúc SAP Fiori: work object tách bằng tab, trạng thái/action rõ ràng, không ẩn lỗi dependency thành empty state, layout ổn định khi refetch và có evidence Chrome/Playwright.
- Button/action và dữ liệu hiển thị phải được đối chiếu với permission, eligibility và terminal state do server trả về. Action không hợp lệ phải ẩn hoặc disable kèm lý do; không được chỉ ẩn trên FE trong khi BE vẫn cho phép mutation sai.
- Không tự gộp nguyên liệu theo tên. Chứng từ chi tiết giữ document/line grain; báo cáo aggregate theo ID, unit và phạm vi nghiệp vụ.
- Ma trận UI/visual bắt buộc cho các browser gate mới là `1920×1080`, `1440×900`,
  `1366×768`, `1365×900` và `1280×900`. `768×1024` đã bị loại khỏi ma trận từ 29/07/2026;
  tablet/mobile nằm ngoài phạm vi mặc định cho tới khi Kỳ yêu cầu lại.
- Không dùng mock API, mock login, snapshot/baseline visual cũ hoặc tự update snapshot để kết luận UI hiện tại pass. Phải boot đúng working tree/source hiện tại, xác minh database qua runtime health và chạy Chrome headed trực tiếp vào URL thật.

## Snapshot môi trường Shipyard ngày 30/07/2026

| Thành phần | Giá trị đã kiểm tra ngày 30/07/2026 |
|---|---|
| Git branch | `feature/workflow-b17-b18` (checkout chính; lane checkout cũ vẫn có thể ở `feature/production-plan`) |
| Shipyard UI | `http://localhost:8090` — **không listen** |
| Frontend lane 1 | `http://localhost:3001` — **không listen** |
| API lane 1 | `http://localhost:8001` — **không listen** |
| Runtime audit tạm | FE `3010`, API `8010` — **đã teardown, không listen** |
| MySQL | Port `3306` đang listen; không coi việc port mở là bằng chứng `ipc_lane1` Healthy |
| Database evidence | `ipc_lane1`, lineage/evidence gần nhất được giữ nguyên; phiên cập nhật docs này không query hoặc mutate DB |
| Tài khoản demo | username `admin`; mật khẩu phải lấy từ credential đã xoay, không dùng giá trị mặc định |
| Template happy path | `C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx` |

Evidence runtime gần nhất trước phiên này từng xác nhận ba port `8090`, `3001`, `8001` và
`/health/ready` xanh. Tuy nhiên kiểm tra ngày 30/07/2026 cho thấy **cả ba port đều không listen**;
không được dùng trạng thái runtime cũ để kết luận E2E. Hai lát SampleData dưới đây chỉ chạy test host/
quality gate, không boot Shipyard và không đọc/ghi `ipc_lane1`.

Ngày 27/07, `ipc_lane1` cũ được xác nhận chỉ có 38 migration và cũ hơn database chính đã khôi phục. Theo lệnh của Kỳ, đã backup cả hai DB vào `D:\Backups\ipc-lane-sync-20260727`, ghi migration no-op `20260726203853_RenameEntitiesToPascalCase` vào database chính, rồi restore `ipcmanagement` sang `ipc_lane1`. Gate sau restore: **61/61 bảng, 53.416/53.416 dòng, 0 row-count mismatch, 0 checksum mismatch, 41/41 migration**. Từ mốc này, lane là bản sao của database chính sau khôi phục; lineage E2E cũ của lane không còn là baseline hiện hành, nhưng vẫn có trong file backup lane trước đồng bộ.

Checkout `shipyard-lanes/lane1` vẫn ở commit cũ `e025d13` và có nhiều thay đổi chưa commit; không reset hoặc ghi đè nó. Lần boot gần nhất của stack dùng source-backed từ checkout chính sau các commit Bước 10,
nhưng runtime hiện đã dừng nên phải boot lại và đối chiếu commit/source trước lần browser test kế tiếp.

Re-audit hiệu năng ngày 2026-07-26 đã chuyển sang đúng database ứng dụng `ipcmanagement` (read-only). P0 ledger
đã được sửa để aggregate ở MySQL, bảo toàn khóa current-only/movement-only, chọn movement mới nhất ổn định và
dùng chung cho data-quality cleanup. Cache snapshot data-quality có khóa chống tính trùng; page/KPI dùng cùng
snapshot scan 500 và phát `IsTruncated` khi vượt giới hạn. Không đồng bộ dữ liệu E2E từ lane vào database chính.

## Production Render/Vercel đã đồng bộ với local ngày 28/07/2026

- Production frontend `ipc-managament-frontend-demo.vercel.app` từng nhận HTTP 500 từ
  `GET /api/workflow-reports/receipt-price-variance/page`; `/health/ready` báo `Degraded` với 19 migration
  source-only. Database lúc preflight có 20/39 migration, 48 bảng, 0 stock movement và chưa có dữ liệu
  nghiệp vụ.
- Trước mutation schema đã tạo backup đã kiểm tra SHA-256 ở
  `C:\Users\Administrator\ipc-prod-backups\IPC-20260728-203345.zip` và mirror
  `D:\Backups\ipc-prod\IPC-20260728-203345.zip`. Trước full data sync tiếp tục tạo checkpoint hậu-migration
  `IPC-20260728-205452.zip` ở cả hai vị trí.
- Ba migration có object tương đương sẵn trong schema (`AddProductionPlanUpdatedAt`,
  `AddSupplierQuotations`, `AddPurchaseOrders`) được audit column/index/FK rồi mới bổ sung history. Các
  migration còn lại chạy bằng EF theo thứ tự source.
- Lần chạy đầu dừng ở `CorrectPresetBomTechnicalUnits` vì temporary table dùng collation mặc định
  `utf8mb4_0900_ai_ci` nhưng join với cột `utf8mb4_unicode_ci`. MySQL đã commit 7 unit tham chiếu trước
  điểm lỗi nhưng chưa ghi history cho migration. Hai migration có temporary key tương tự đã được sửa bằng
  collation tường minh; rerun idempotent hoàn tất an toàn.
- Sau khi người dùng làm rõ cần cả dữ liệu nghiệp vụ, database local `ipcmanagement` được backup thành
  `C:\Users\Administrator\ipc-local-sync-backups\ipcmanagement-20260728-205559.zip` và mirror
  `D:\Backups\ipc-local-sync\ipcmanagement-20260728-205559.zip`; manifest/SHA-256 đã kiểm tra trước restore.
  Dump có 61 `DROP TABLE`, không có `USE` hoặc `DROP DATABASE`.
- Restore Windows→Linux tạo đồng thời `__efmigrationshistory` và `__EFMigrationsHistory` do khác biệt
  case-sensitive. Dữ liệu hai history được merge về đúng bảng uppercase EF sử dụng, bảng lowercase dư bị
  xóa; hai `ProductVersion` được đồng bộ đúng local. Trạng thái cuối: **61/61 bảng, 53.404/53.404 dòng,
  0 missing table, 0 row-count mismatch, 0 checksum mismatch**. Lineage có 39 source migration và 2
  database-only canonical hợp lệ, 0 unexplained/source-only/stale manifest/error.
- Production hiện có cùng dữ liệu local, gồm 773 nguyên liệu, 358 món, 1.957 dòng BOM, 216 menu, 64 nhà
  cung cấp, 43 đơn vị, 7 user và 17.256 stock movement. Vì bảng user cũng được đồng bộ, `admin/admin`
  không còn hợp lệ; browser/E2E phải dùng mật khẩu đã xoay trong `K6_PASSWORD`.
- Runtime verification: `/health/live` và `/health/ready` đều `Healthy`; migration/database check đều
  `Healthy`. Chrome headed đăng nhập bằng credential local, report API trả **200** với 17.194 dòng giá và
  UI render dữ liệu thật; không có page error/API error. Evidence mới:
  `.artifacts/shipyard-live/production-reports-after-local-sync.png` và
  `.artifacts/shipyard-live/production-report-debug.json`. CSP chặn Google Fonts vẫn còn nhưng không liên
  quan tới report/database.
- Gate source sau incident: API **667 pass / 1 skip**, Application **47/47**, FE **416/416**; Debug/Release
  build 0 warning, lint/dependency/production build, OpenAPI/TypeScript deterministic, EF pending-model,
  `git diff --check` và secret scan đều xanh. GitNexus incident diff: 3 file/7 symbol/0 flow, **LOW**.
- Connection string production không được ghi vào repository. User-scope environment variable
  `IPC_PROD_CONNECTION_STRING` dùng trong incident đã được xóa sau gates/commit; lần truy cập production
  sau phải cấu hình lại qua secret manager hoặc environment, không đưa giá trị vào command/docs.
- Kiểm tra BOM sau đồng bộ dùng đúng workbook
  `C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx` (SHA-256
  `a7e734cefbd409e7220c4ff19b3e1b7fddd4e33d202a3f24e63309d60d4d5a01`) và **chỉ gọi preview**, không
  import lại hay mutate database. Preview tuần `2026-07-27` của ANV có 114/114 dòng dùng món đã tồn tại,
  0 món mới, validation hợp lệ, 0 error/0 warning. Menu đã commit trước đó có 114 source row → 90 display
  row; cả **90/90 món có BOM**, 0 matched-without-BOM và 0 unmatched. Catalog production có 194 món active,
  1.957 BOM line; 32 món toàn cục chưa có BOM nhưng không món nào nằm trong 90 dòng menu này.
- Ảnh browser headed hiện render `BOM & định mức: 90/90 món`. Con số `0/90` trước đó là cache cũ sau direct
  restore: `DishCatalogService` giữ memory cache 30 phút, RTK Query giữ cache 5 phút, còn restore trực tiếp
  bypass `DishCatalogCache.Clear`. Ctrl+F5 hoặc logout/login lấy lại catalog đúng; runbook restore production
  vẫn còn việc vận hành là restart/clear application cache sau restore. Evidence:
  `.artifacts/shipyard-live/production-weekly-menu-bom-debug.png` và
  `.artifacts/shipyard-live/production-bom-debug.json`.

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
- Quản trị dữ liệu: query được giới hạn theo active tab; dialog BOM chỉ mount khi mở; bộ lọc nặng dùng deferred value; chuyển tab dùng transition. Gate headed mới nhất của Bước 13 có **30/30** capture trên ba viewport cho 7 tab Admin, BOM warm, Approval Rules và dialog; 55 API 2xx, warm 0 request, 0 console/page/request error, 0 long task, `CLS 0` và 0 page overflow. Evidence authoritative là `.artifacts/shipyard-live/query-view-admin-performance.json`; file `query-view-admin-error.*` có timestamp cũ hơn là attempt trước final run, không phải kết quả cuối.
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

## Browser runtime và quy ước evidence tại thời điểm audit

- Evidence cũ ngày 25–26/07 chỉ là lịch sử, không được dùng để kết luận Bước 10 hiện tại pass. `frontend/playwright.config.ts` vẫn bật `VITE_ENABLE_MOCK_LOGIN=true`, nên các visual snapshot spec cũ không phải gate runtime cho lượt này.
- Kể từ 29/07/2026, mọi helper browser gate mới phải cấu hình đủ năm viewport `1920×1080`,
  `1440×900`, `1366×768`, `1365×900`, `1280×900`; không còn `768×1024`.
- Lượt helper ngày 27/07 `.artifacts/shipyard-live/current-runtime-desktop-audit.mjs` chỉ chạy
  `1365×900` và `1440×900`; đây là evidence lịch sử, không phải ma trận hiện hành. Helper ghi screenshot,
  API response, console/page error, request failure, CLS và long task.
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

## Quality gates tại thời điểm audit

| Phạm vi | Tests | Line | Branch | Function/method |
|---|---:|---:|---:|---:|
| Backend | **716 pass / 0 fail / 1 skip** (28/07) — Gate 16 gồm Api.Tests 667 pass/1 skip và Application.Tests 49/49 | 69.4% | 53.8% | 75.5% method |
| Frontend | **416/416 pass trên 74 file** (28/07) | 39.68% | 29.21% | 32.00% function |

Số coverage phần trăm là của lần chạy coverage 25/07; các lần sau chỉ chạy lại test suite, chưa chạy lại coverage.

Gate tầng database bổ sung từ 27/07 (xem mục sự cố bên dưới):

- `dotnet ef migrations has-pending-model-changes`: exit 0.
- Schema dựng từ migration == schema dựng từ model: **723/723** dòng khớp.
- 2 test replay migration trên MySQL thật: pass.
- Cài `IPCmanagement.sql` vào database rỗng: 47 bảng / 102 FK, exit 0. Chạy lại trên database không rỗng: dừng ở ERROR 1062, không mất bảng nào.

- Backend build Release: 0 warning.
- Frontend lint: pass, 0 error / 0 warning.
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
| 1.2b Phân loại `InvalidOperationException` | **Đã đóng ở Bước 16** | Business failure đã dùng domain/application exception có HTTP mapping; system/import failure không còn bị che thành 400 nghiệp vụ. |
| 1.3 CI thật | Xong | CI chạy FE unit test; `IPC_TEST_CONNECTION_STRING` trỏ service container; **đảo thứ tự step** vì schema đang được dựng SAU khi test chạy; `RequiresMySqlFact` (thiếu biến ở local → Skipped có lý do, trong CI → chạy thật, không skip); step đếm integration test đã chạy, **exit 1 nếu = 0**; xóa `UnitTest1.cs`; concurrency, cache NuGet/npm, dependabot, CodeQL |
| 1.4 Gỡ `.gitignore` | Xong | `docs/` + `scripts/` vào git (8 + 3 file). `tools/perf/` hóa ra **đã track sẵn** — audit lỗi thời. Xóa 2 npm script trỏ `Invoke-Iter1QualityGate.ps1` (không tồn tại) |
| 1.5 Transaction + toàn vẹn | Xong | 9 transaction (6 mới) ở 5 service; unique constraint `uxStocktakeActiveWarehouse` qua cột sinh (MySQL không có partial index); 8 chỗ chuyển sang `ResourceConflictException` (409) |
| 1.5b Bọc execution strategy | **Đã đóng ở Bước 16** | Manual transaction tập trung vào `EfTransactionRunner`; source còn đúng một opener, retry/idempotency test xanh và MySQL đã bật `EnableRetryOnFailure`. |
| 1.6 Security headers | Xong | API: HSTS ngoài Development, nosniff, `X-Frame-Options: DENY`, CSP. Vercel: header đặt ở **root `vercel.json`**, đã xóa `frontend/vercel.json` |
| 1.7 Forwarded headers, cookie, rate limit | Xong | `UseForwardedHeaders` là middleware đầu tiên; cookie `Secure` qua `CookiePolicyOptions`; `api-general` thành **global limiter** (opt-out). `ApiPermitLimit=100000` của k6 nguyên vẹn |
| 1.8 Upload + parser XLSX | Xong | `[RequestSizeLimit(10 MB)]` cho **5** endpoint upload (audit đếm 4, sót stub `weekly-menu/import`); chặn merged-cell bomb, zip bomb 2 lớp, XXE, tràn số nguyên tên cột |
| 1.9 Lỗi hiện lên FE | Xong nhóm 1 | 20/20 call-site màn ra quyết định; custom lint rule `ipc/no-swallowed-query-error`; `EmptyStateProps` là discriminated union nên `variant="error"` thiếu `onRetry` là lỗi biên dịch |

Quality gates ngày 26/07 sau P1: backend **626 pass / 0 fail / 1 skip** (baseline 595), frontend **324/324** (baseline 316), `tsc --noEmit` 0 lỗi, `eslint` 0 error + 15 warning có chủ đích, build backend **0 warning 0 error**, FE production build pass. `detect-changes` báo 51 file / 114 symbol / risk critical — đó là **phạm vi tích lũy của cả 6 lane**, mọi flow bị chạm đều có test phủ và đều xanh.

Điều chỉnh so với plan audit, đều do phân tích impact chứ không làm máy móc:

1. **`EnableRetryOnFailure` đã bị gỡ ở đợt P1.** Audit (1.5) yêu cầu bật, nhưng codebase khi đó có **26 chỗ `BeginTransactionAsync` ở 15 file và 0 chỗ bọc `CreateExecutionStrategy`** — `UnitOfWork.BeginTransactionAsync` là wrapper dùng chung cho 7 service, riêng `CoordinationService` có 6 chỗ. Bật retry mà bọc thiếu là vỡ runtime hàng loạt luồng, trong khi unit test mock `IUnitOfWork` nên vẫn xanh (pass giả). Bước 16 sau đó đã tập trung mọi manual transaction vào runner và bật lại retry an toàn tại `59add79`.
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

## Backlog tại thời điểm audit

Còn hở sau đợt P1 ngày 26/07/2026:

- ~~**P1.2b — phân loại `InvalidOperationException`**~~ **ĐÃ ĐÓNG Ở BƯỚC 16** bằng domain/application exception và middleware mapping rõ.
- ~~**P1.5b — bọc execution strategy trước khi bật retry**~~ **ĐÃ ĐÓNG Ở BƯỚC 16**: source chỉ còn một `BeginTransactionAsync(` trong `EfTransactionRunner`, `IUnitOfWork` không còn mở transaction và convention/retry regression khóa lại trạng thái này.
- **P1.9 nhóm 2 đã đóng trong Bước 13**: Approvals `c0cf976` và Admin
  `0e0279f` đã chuyển các query owner cũ của `ApprovalPage`, `ApprovalRulesPage` và
  `useAdminDataPageModel` sang `QueryView`; lint hiện sạch, error/skip/403 không còn bị coi là empty.
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

**Workflow thống nhất:** Phần F của `docs/ARCHITECTURE-AUDIT-2026-07-26.md` là nguồn điều
khiển duy nhất. Phần C chỉ là sổ finding lịch sử; nhãn P0–P3 cũ không còn được dùng như
một workflow song song. Thứ tự thực thi duy nhất là:
`11 state contract → 12 pilot → 13 state rollout → 14 VSA boundary → 15 functional core →
16 persistence → 17 FE ownership → 18 guardrail/docs`.

Bước 11 đã hoàn tất bằng `QueryView` `d2a5d62`. Backend architecture baseline `d877d83`,
growth reporter `c549bd2` và contract build cô lập `6a5259b` là guardrail được làm sớm cho
Bước 14/18, không có nghĩa hai bước đó đã hoàn tất. Gate đã xác minh gần nhất: BE
**631 pass / 1 skip**, FE **341/341**, lint **0 error / 4 warning baseline**, dependency không có vi phạm
mới, contract deterministic, EF migration snapshot sạch và production build xanh.

### Bước 12 — pilot Material Demand và Warehouse (hoàn tất ngày 27/07/2026)

Bước 12 có hai pilot đã commit: Material Demand `71656bc` và Warehouse `87ad944`.
Gate browser headed đã xanh trên `1365×900`, `1280×900`, `768×1024` với ANV tuần 20/07:
API 2xx, 0 request fail, 0 console/page error, warm revisit 0 request/0 long task/CLS 0, 0 page overflow.
Evidence tại `.artifacts/shipyard-live/query-view-pilot-performance.json` và sáu ảnh
`query-view-{material-demand,warehouse-movement}-*.png`; targeted state/component contract **21/21**.
### Bước 13 — rollout state (hoàn tất ngày 28/07/2026)

- Thứ tự vẫn là Purchasing → Approvals → Reports → Admin → Chef → Coordination.
- **Purchasing đã hoàn tất** tại `86a2347 refactor(fe-state): classify purchasing query views`.
  Cả 8 query-owning boundary đã qua `QueryView`: workbench tuần; ba query supplemental/purchase/order;
  ba query ingredient/supplier/quotation; supplier evidence. Không đổi endpoint, args, skip, cache key/tag,
  URL hay mutation behavior.
- State contract: uninitialized không thành empty; query-level 403 không retry; lỗi khác có retry;
  refreshing giữ stale rows; supplemental pageSize 100 không có pager hiển thị shown/total khi truncated.
- Targeted Purchasing **28/28**; full FE **354/354**; BE **634 pass / 1 skip**; lint **0 error / 4 warning
  baseline**; dependency không tăng; production build, OpenAPI deterministic và EF migration gate xanh.
- Runtime source-backed ở FE `3001`, API `8001`, DB `ipc_lane1` Healthy. Browser headed
  `1365×900`, `1280×900`, `768×1024`: 9/9 workflow/quotation/warm capture, API 2xx,
  warm switch 0 request, 0 console/page/request error, 0 long task, CLS 0, 0 page overflow.
  Evidence: `.artifacts/shipyard-live/query-view-purchasing-performance.json` và chín screenshot
  `query-view-purchasing-{workflow,quotations,quotations-warm}-*.png`. File
  `query-view-purchasing-error.*` là attempt selector-wait thất bại trước final run, không phải kết quả cuối.
- GitNexus staged audit: 9 file/14 symbol/5 flow, **MEDIUM**, đúng scope Purchasing.
- **Approvals đã hoàn tất** tại `c0cf976 refactor(fe-state): classify approval query views`.
  Bốn query owner (approval inbox, workflow documents, purchase-request page và approval history có
  `skip`) đều qua `QueryView`; không đổi endpoint, args, cache key/tag, URL hay mutation behavior.
  Forbidden không retry, lỗi khác có retry, refreshing giữ stale rows và history chưa chọn
  purchase request giữ uninitialized instruction.
- Ba presentation-state panel được tách sang `ApprovalQueryPanels.tsx` nhưng query ownership vẫn
  ở `ApprovalPage.tsx`; page giảm **625 → 491 dòng**, không vượt growth warning 600.
- Targeted Approvals **22/22**; full FE **362/362**; BE **634 pass / 1 skip**; lint 0 error/1 warning
  baseline còn lại ở `ApprovalRulesPage` thuộc Admin; dependency không có vi phạm mới,
  production build xanh, OpenAPI deterministic và EF migration snapshot sạch.
- Browser headed `1365×900`, `1280×900`, `768×1024`: **12/12** queue/role/history/warm capture,
  API và history action 200, warm revisit 0 request, 0 console/page/request error, 0 long task,
  CLS 0, 0 page overflow. Evidence: `.artifacts/shipyard-live/query-view-approvals-performance.json`
  và mười hai screenshot `query-view-approvals-{queue,role,history,history-warm}-*.png`.
- GitNexus staged audit: 3 file/5 symbol/1 flow, **MEDIUM**, đúng scope Approvals.
- **Reports đã hoàn tất** tại `e4d24bb refactor(fe-state): classify report query views`.
  Mười hai query owner (bốn price subview và tám report view còn lại) đều qua
  `QueryView`; giữ nguyên endpoint, args, skip, cache key/tag, URL và export behavior.
  Uninitialized/loading/forbidden/error không còn render false-empty; forbidden không retry,
  lỗi khác có retry, refreshing giữ stale table. Metric của query chưa authoritative hiển thị `—`.
- Price presentation tách sang `ReportsPricePanel.tsx`, active state qua `ReportQueryBoundary.tsx`,
  CSV helper sang `reportCsv.ts` với BOM/escaping test. `ReportsPage.tsx` **800 → 515 dòng**,
  price panel 352 và page model 594 dòng; không file Reports nào vượt growth warning 600.
- Targeted Reports/contracts **25/25**; full FE **368/368**; BE **634 pass / 1 skip**; lint
  0 error/1 warning baseline còn lại ở `ApprovalRulesPage` thuộc Admin; dependency không có
  vi phạm mới, production build xanh, OpenAPI deterministic và EF migration snapshot sạch.
- Browser headed `1365×900`, `1280×900`, `768×1024`: **39/39** capture cho 12 query view
  và warm revisit; action API 200, warm price 0 request, 0 non-2xx/request fail/console/page error/
  long task, CLS 0, 0 page overflow. Evidence: `.artifacts/shipyard-live/query-view-reports-performance.json`
  và ba mươi chín screenshot `query-view-reports-*.png`.
- GitNexus staged audit: 9 file/16 symbol/3 flow, **MEDIUM**, đúng scope Reports.
- **Admin đã hoàn tất** tại `0e0279f refactor(fe-state): classify admin query views`.
  Mười bốn query owner của `AdminDataPage` và hai query của `ApprovalRulesPage`
  đều qua `QueryView`; group boundary chặn false-empty, 403 không retry, refreshing giữ data,
  employee selector hiển thị truncation khi vượt 200. Hai `skip` sai đã sửa: current stock
  chạy cho Inventory + Statistics, customer contracts chạy cho Contracts + BOM.
- Targeted Admin/state **26/26**; full FE **386/386**; BE **634 pass / 1 skip**; lint sạch,
  dependency không tăng, production build, OpenAPI deterministic và EF migration gate xanh.
  `useAdminDataPageModel` còn 785 dòng và tiếp tục được track cho split ở Bước 17.
- Browser headed ba viewport: **30/30** capture, 55 API response đều 2xx, warm BOM 0 request,
  0 non-2xx/request fail/console/page error/long task, CLS 0, 0 page overflow. Evidence:
  `.artifacts/shipyard-live/query-view-admin-performance.json` và `query-view-admin-*.png`.
- GitNexus staged audit: 13 file/45 symbol/11 flow, **HIGH**, đúng blast radius Admin đã phủ gate.
- **Chef đã hoàn tất** tại `894012d refactor(fe-state): classify chef query views`.
  Sáu query owner đều qua `QueryView`; production giữ fallback có nhãn, documents block
  false-empty, forbidden không retry, context query skip hiển thị `—`, journal/returns có
  truncation evidence. Refreshing overlay nằm ngoài flow; browser gate đã bắt và sửa
  regression CLS ~0,15 của bản alert stack ban đầu.
- Targeted Chef/state **45/45**; full FE **400/400**; BE **634 pass / 1 skip**; lint sạch,
  dependency không tăng, production build, OpenAPI deterministic và EF migration gate xanh.
- Browser headed ba viewport: **12/12** production/day-change/documents/warm capture, 31 API 2xx,
  warm 0 request, 0 non-2xx/request fail/console/page error/long task, CLS 0, 0 page overflow.
  Evidence: `.artifacts/shipyard-live/query-view-chef-performance.json` và `query-view-chef-*.png`.
  File `query-view-chef-error.*` có timestamp cũ hơn là probe CLS trước fix, không phải final run.
- GitNexus staged audit: 9 file/24 symbol/4 flow, **MEDIUM**, đúng scope Chef.
- **Coordination đã hoàn tất** tại `fe5a438 refactor(fe-state): classify coordination query views`.
  Mười một query owner đã qua `QueryView`: workbench điều phối (2), lazy dialog món (1),
  shell Weekly Menu (6), lịch sử import (1) và kế hoạch sản xuất (1). Shared boundary nằm ở
  `components/common`; dependency gate không tăng 54 baseline violation.
- Uninitialized/loading/ready/refreshing/forbidden/error được phân loại tường minh; retryable error
  giữ cached data, forbidden không retry và không lộ cache. Metric chưa authoritative hiển thị `—`;
  refreshing overlay nằm ngoài document flow. Endpoint, args, cache key/tag, URL và mutation giữ nguyên.
- Targeted Coordination/state **26/26**; full FE **416/416**; BE **634 pass / 1 skip**;
  lint sạch, production build, OpenAPI deterministic và EF pending-model gate xanh.
- Browser headed ba viewport: **21/21** capture, 118 API 2xx, 0 business mutation, warm scope/
  production 0 request, 0 non-2xx/request fail/console/page error/long task, CLS 0, 0 page overflow.
  Evidence: `.artifacts/shipyard-live/query-view-coordination-performance.json` và
  `query-view-coordination-*.png`. Runtime dùng FE `3001`, API `8001`, Shipyard `8090`, DB
  `ipc_lane1` Healthy. `query-view-coordination-error.*` là lỗi locator cũ trước final run.
- Database hiện không có order row ở 14 tổ hợp thứ/ngày + ca, nên browser xác minh ready-empty thật
  và không seed dữ liệu để ép mở dialog món; lazy query dialog được phủ bằng unit/ownership contract.
- GitNexus staged audit: 12 file/31 symbol/0 flow, **LOW**, đúng scope Coordination.
- **Gate 13 đã đóng.** Bước active tiếp theo là **Bước 15 — Reports** vì Bước 14 đã hoàn tất sớm.

### Bước 14 — VSA backend boundary (hoàn tất sớm do numbering cũ)

- Commit `97bb33f refactor(be-boundary): remove purchasing reports cycle` gỡ cycle đầu tiên:
  `Purchasing→Reports` **3 → 0** reference; architecture baseline bỏ hẳn ceiling cạnh này.
- `WorkflowReportQueryDto` và `WorkflowReportPageQueryDto` là transport contract thực sự dùng chung,
  đã chuyển nguyên shape/default/clamp sang `Shared/Contracts`; `PurchasePlanReportDto` về feature
  Purchasing. Contract Swagger/TypeScript regenerate deterministic, không drift.
- `PurchaseRequestWorkflowService.HasPriceException` dùng `PurchasePricePolicy` thuộc Purchasing thay
  `WorkflowReportCalculator`; purchase-plan/candidate/workbench targeted **12/12**.
- Commit `766fac7 refactor(be-boundary): move material demand port to planning` gỡ cycle thứ hai:
  `Purchasing→Planning` **1 → 0**. Interface `IMaterialDemandService` về feature có implementation/controller;
  field/constructor dependency không bao giờ được dùng trong `CoordinationService` đã xóa thay vì
  whitelist cạnh `Coordination→Planning` giả.
- Targeted cycle thứ hai: architecture **2/2**, MaterialDemand/Coordination/controller **98/98**.
- Commit `baff911 refactor(be-boundary): move adjustment approval to coordination` gỡ cycle thứ ba:
  `Approvals→Coordination` **1 → 0**; adapter duyệt `QuantityAdjustment` về feature sở hữu state
  transition và tiếp tục implement port Approvals. Targeted approval/coordination **43/43**.
- Commit `91badde refactor(be-boundary): move weekly menu imports to sample data` gỡ cycle cuối:
  `Coordination→SampleData` **2 → 0**. Bốn legacy cycle đã về 0 và ceiling tương ứng đã xóa.
- Full gate sau lát: BE **631 pass / 1 skip**, FE **341/341**, lint **0 error / 4 warning baseline**,
  dependency FE không tăng, production build xanh, EF migration snapshot sạch.
- Commit `45d2072 refactor(be-boundary): move controller queries into feature services` đưa query
  của `PurchaseRequestsController` và `ApprovalHistoryController` vào query service thuộc feature;
  DTO approval history về `Approvals/Contracts`, DI đăng ký đủ hai service.
- Architecture gate xác nhận 0 feature controller còn reference `IpcManagementContext`; targeted
  architecture **3/3**, characterization filter/paging/detail/history **2/2**.
- Full gate: BE **634 pass / 1 skip**, FE **341/341**, lint **0 error / 4 warning baseline**,
  dependency FE không tăng, production build xanh, OpenAPI regenerate deterministic và EF migration
  snapshot sạch. GitNexus staged audit: 10 file/52 symbol/3 flow, **MEDIUM**, đúng scope.
- Bước 14 đã đóng sớm; Gate 13 nay đã xanh nên tiếp tục Bước 15, bắt đầu từ Reports.

### Bước 15 — Tách use case và functional core (đã hoàn tất)

- Reports đã tách theo mười hai lát commit nguyên tử: price variance `92b7bf3`, demand
  `354b920`, purchasing `ffdab86`, stock snapshot `92c64dd`, inventory operations `7db54c5`,
  current stock/stock movement `f998066`, audit/CSV `b3b6276`, stock ledger `79095fc`,
  data-quality query `bd350f2`, data-quality command `d4fade1`, KPI `01defd9` và aggregate cache
  `363c898`.
- `WorkflowReportService` và `IWorkflowReportService` đã xóa. Controller còn điều phối các port
  use-case; CSV, EF query, cleanup transaction, KPI policy và cache/single-flight không còn nằm
  trong controller/facade chung.
- Các service Reports mới không vượt ngưỡng 600 dòng. Functional core có test không DB:
  `PriceVarianceReportPolicy`, `PurchasingReportPolicy`, `AuditCsvExporter`, `DataQualityPolicy`
  và `OperationalKpiPolicy`.
- Cache aggregate được đăng ký singleton nhưng không giữ scoped service/DbContext; giữ duration
  15 giây, key KPI cũ, data-quality version invalidation xuyên controller instance và single-flight
  cho concurrent cold request.
- Gate Reports cuối: BE **648 pass / 1 skip**, FE **416/416**, backend build 0 warning,
  lint sạch, dependency-cruiser không có violation mới (vẫn ignore 54 baseline), production build xanh,
  OpenAPI canonical **152 path / 396 schema** và generated TypeScript không đổi, EF không có
  model change chưa migration. Không reset/seed database và không push.
- Coordination hoàn tất Order Lifecycle tại `370004c`: `OrderPlanService` 337 dòng,
  `OrderAdjustmentService` 202 dòng, `OrderSignoffService` 179 dòng và pure
  `OrderLifecyclePolicy`. Lock/unlock, adjustment/forecast, signoff theo scope và export giữ
  nguyên route/response/Swagger.
- Commit `187fe63` tách controller theo responsibility. `CoordinationOrdersController` còn
  231 dòng/10 action; customer contract, portion rule, menu schedule và meal quantity plan có
  controller riêng. `CoordinationService`, `ICoordinationService` và
  `CoordinationController` đã xóa; production scan 0 reference. Gate Coordination cuối:
  BE **677 pass / 1 skip**, FE **416/416**, OpenAPI **152 path / 396 schema**, build/lint/
  dependency/EF xanh.
- Purchasing hoàn tất bốn lát: Workbench `5226d06`, generate-from-demand `b954d2d`,
  supplier evidence/decision + price exception `6e835c3`, submit/validation và retire facade
  `f429482`. Controller gọi trực tiếp bốn port use-case; `PurchaseRequestWorkflowService`
  và `IPurchaseRequestWorkflowService` đã xóa khỏi production.
- Các shell mới đều dưới ngưỡng 600 dòng: `PurchaseWorkbenchService` 274,
  `PurchaseRequestGenerationService` 260, `PurchaseSupplierDecisionService` 496 và
  `PurchaseRequestSubmissionService` 197; `PurchaseWorkflowController` 184 dòng/5 action.
  Functional core gồm Workbench/Generation/SupplierDecision/Submission policy và mapper dùng
  chung; test compatibility facade chỉ tồn tại trong project test.
- Gate Purchasing cuối: targeted **201/201**; full BE **702 pass / 1 skip**
  (655 API + 47 Application), FE **416/416**, backend build 0 warning, lint/dependency/
  production build xanh, OpenAPI/TypeScript deterministic và EF pending-model sạch. Không
  reset/seed database, không push và không chạy browser vì UI/API/cache/DOM không đổi.
- Catalog đã có năm checkpoint nguyên tử: core `b3cdbad`, diagnostics/validation `ae80e24`,
  pure BOM policy `321c7a9`, template `7475207` và import/parser `f083fb0`.
- `DishService` giảm **1.796 → 542 dòng**. Service mới: catalog core 143 dòng,
  diagnostics 316, template 135, import 330 và parser 462; pure `DishBomPolicy` có test không DB.
  Preview/commit import giữ nguyên DTO/message/transaction và xóa đúng hai cache key sau commit.
- Gate Catalog checkpoint: API **675 pass / 1 skip**, Application **47/47**, FE **416/416**,
  lint sạch, dependency không tăng (54 known violation vẫn ignore), production/Release build xanh,
  OpenAPI/TypeScript deterministic và EF pending-model sạch. Không chạm database và không chạy
  browser vì API contract, UI, route và cache behavior không đổi.
- Catalog hoàn tất thêm manual BOM `d81f6b0` và controller/facade retirement `5d07df9`.
  `DishBomService` còn 426 dòng; bốn controller nhỏ đều dưới growth warning. Production scan
  không còn `DishService`/`IDishService`; 17 route, policy, response metadata và upload limit giữ nguyên.
- Gate Catalog cuối: API **671 pass / 1 skip**, Application **47/47**, FE **416/416**,
  Release build 0 warning, lint/dependency/production build xanh và EF sạch. OpenAPI còn
  **152 path / 396 schema**, generator deterministic; generated TypeScript không đổi.
- SampleData thực hiện theo thứ tự preset BOM → weekly parser/policy → query/template/mapping →
  preview/commit → history/rollback → bulk edit → controller/facade. Không gọi endpoint import và
  không seed/reset `ipc_lane1` trong quá trình refactor.
- `486c9f8` tách port preset BOM khỏi weekly menu; `815a3c0` tách pure
  `PresetBomImportPolicy` cho weighted merge, scientific notation và fallback weight/servings.
- `8a9f709` tách imperative shell thật thành `SampleBomImportService` **554 dòng** và đăng ký
  trực tiếp cho `ISampleBomImportService`; facade không còn implement port preset. Dry-run, stable ID,
  unit kho hiện hữu, ba tier 25k/30k/34k và hành vi destructive `ReplaceBomCatalog` được khóa bằng test.
- `266378a` tách weekly parser/validation khỏi partial thành internal models và bốn module thuần:
  parser **276**, layout **311**, syntax **127**, validation **186 dòng**. Test parser/validation gọi
  functional core trực tiếp thay vì reflection; preview/commit tiếp tục giữ DTO và transaction cũ.
- Tổng `SampleDataImportService` partial giảm **3.868 → 2.409 dòng**. Quality gate sau lát mới nhất:
  API **674 pass / 1 skip**, Application **47/47**, FE **416/416**, build backend 0 warning,
  lint/dependency/production build xanh, OpenAPI/TypeScript deterministic và EF pending-model sạch.
  GitNexus staged audit preset là **HIGH** (35 symbol/9 flow); parser là **CRITICAL**
  (103 symbol/17 flow), đúng các flow preview/commit đã được phủ regression.
- SampleData đã hoàn tất query/template/mapping, preview/commit, history/rollback và bulk edit.
  Sáu port use-case mới được controller gọi trực tiếp: `IWeeklyMenuQueryService`,
  `IWeeklyMenuTemplateService`, `ICustomerImportMappingService`, `IWeeklyMenuImportService`,
  `IWeeklyMenuImportHistoryService` và `IWeeklyMenuBulkEditService`.
- `SampleDataImportService` partial **2.409 dòng** và `ISampleDataImportService` đã xóa; production scan
  không còn reference. Imperative shell lớn nhất là `WeeklyMenuImportPersistence` **521 dòng**;
  query 172, template 53, mapping 66, preview/commit 183, history/rollback 167, bulk edit 122,
  result builder 191 và shared resolver/projection 251 dòng. Không service mới nào vượt ngưỡng 600.
- Controller giữ nguyên 11 route, response metadata, upload limit, message và transaction boundary;
  OpenAPI vẫn **152 path / 396 schema**, TypeScript generate deterministic và không drift. Thử tách
  controller vật lý đã bị loại vì chỉ làm đổi thứ tự path generated dù semantic route không đổi.
- Gate cuối SampleData: targeted **55/55**; API **663 pass / 1 skip**, Application **47/47**,
  FE **416/416**, Debug/Release build 0 warning, lint/dependency/production build xanh và EF
  pending-model sạch. Mười một test reflection chỉ phủ private helper legacy đã xóa cùng facade nên
  được retire; các test parser/validation và behavior preview/commit/re-import còn lại vẫn chạy trực tiếp.
- GitNexus pre-edit đánh dấu `XlsxWorkbookReader` **CRITICAL** (35 direct/54 total) dù thay đổi tại đó
  chỉ là comment stale, không đổi executable reader. Staged audit cuối là **MEDIUM**: 21 file,
  48 symbol, 2 flow; hai flow chỉ map tới hunk comment trong `OpenWorkbook` và đều đã qua full regression.
- Không gọi endpoint import, không reset/seed/import hoặc truy cập database, không chạy browser vì
  API contract, route, UI và DOM không đổi. **Bước 15 đã hoàn tất; Bước 16 sau đó cũng đã đóng.**

### GSD routing đã đồng bộ với workflow kiến trúc

- Session “Kiểm tra tiến độ đọc tài liệu” ngày 27/07 là nơi người dùng yêu cầu gộp hai danh sách
  `f(data,state)` và P0–P3 thành một workflow duy nhất; commit `15d8592` tạo workflow đó, sau đó
  `0fb96be` và `5869295` làm rõ/chốt Phần F là nguồn thực thi duy nhất.
- `.planning/ROADMAP.md` v1.1 có lịch sử từ 20–23/07 và không được tạo trong session nói trên.
  Nó cùng Phase 08–09 đã được chuyển vào `.planning/archive/v1.1-legacy/` để chỉ giữ provenance.
- GSD active hiện là milestone `v1.2`, **6/8 bước hoàn tất**; sáu plan đã định nghĩa đều có summary
  (**6/6, 100% defined-plan progress**). **Phase/Step 17 — Frontend ownership** là bước active tiếp theo
  và chưa có executable plan; Step 18 vẫn pending.

### Bước 16 — persistence, transaction và restore guardrails (hoàn tất)

- Step 16 đã hoàn tất đủ **5/5 task**. Task 1 chuyển đủ **53 mapping**
  vào 11 file feature-owned `IEntityTypeConfiguration<T>` và đóng tại `7e94eb3`; context chỉ còn assembly
  registration. Task 2 thêm `IEfTransactionRunner`, phân loại domain/application exception, canonicalize
  migration lineage và diễn tập restore disposable clone, đóng tại `b37606b`. Task 3 đưa runner vào
  Coordination, Purchasing, Inventory, SampleData, Catalog, Reports, Approvals và Admin, đóng tại
  `f3e7bcd`; mọi operation mutable load entity bên trong runner và có database verifier để tránh nhân đôi
  side effect khi retry/commit verification.
- Task 4 đóng tại `59add79`: xóa `IUnitOfWork.BeginTransactionAsync`/`UnitOfWork.BeginTransactionAsync`,
  bật `EnableRetryOnFailure` và thêm convention test khóa đúng một transaction opener trong runner.
  Focused convention **2/2**, retry runner **2/2**. Task 5 full gate: API **667 pass/1 skip**,
  Application **49/49**, FE **416/416**, Debug/Release **0 warning/0 error**, lint sạch, dependency không
  có violation mới, production build, contract determinism và EF pending-model đều xanh. ARCH-16A–E đã đóng.
- Restore rehearsal/hash mirror đã pass, nhưng C:/D: chưa chứng minh là hai thiết bị/site vật lý;
  off-site NAS/cloud/external media vẫn là gap vận hành. Direct restore runbook đã thêm restart/clear
  application cache để tránh trạng thái catalog/BOM cũ sau restore.
- Công việc production xen ngang đã tạo commit `7e79106` để hai data migration dùng collation tường minh;
  full source gate sau incident xanh và được giữ nguyên khi đóng Bước 16.

## Goal audit Shipyard/import — 2026-07-29

- Đã đối chiếu read-only `ipcmanagement` với `ipc_lane1` trước cleanup: 61/61 bảng, 594/594 cột, 288/288 index, 130/130 FK, 41/41 migration và checksum nghiệp vụ khớp; drift duy nhất là 34 `refreshtokens` phiên cục bộ. Đã tạo backup SHA-256 mirror tại `D:\Backups\ipc-goal-20260729` và `C:\Users\Administrator\ipc-goal-20260729`.
- Đã dừng writer rồi cleanup riêng trên `ipc_lane1`; menu/quantity/material/purchase/order/inventory transaction chain về 0, giữ master/BOM/currentstock, dynamic FK orphan audit = 0, `/health/ready` vẫn Healthy. Không reset từ `ipc_e2e_template` vì template stale (56 bảng/32 migration).
- Shipyard dashboard đã được mở headed ở `http://127.0.0.1:8090`: trang và `/api/lanes`, `/api/proof/1` trả 200, không console/page/request error và không overflow. Card lane 1 ghi đúng source-backed `api=:8001 fe=:3001 db=ipc_lane1`; stage/heartbeat của harness vẫn stale (`down`/`DEAD`) vì app được boot trực tiếp từ checkout chính, không qua `lane-up.sh`. Evidence: `.artifacts/shipyard-live/goal-runtime-20260729/shipyard-dashboard/`.
- Import fixture thật đã pass preview + commit cho hai khách trong cùng tuần `2026-07-20`:
  - ANV tier 25k: 92 source rows, 12 schedule, đúng một tier 25000.
  - DAV tier 34k: 92 source rows, 12 schedule, đúng một tier 34000.
  - Không duplicate customer/date/shift, không mixed tier/customer-week. Preview lặp lại 25k/30k/34k xác nhận 25k dùng sheet `ANV 25k`; 30k/34k fallback về sheet có dữ liệu và phát đúng một cảnh báo shared-menu. Evidence: `tier-preview-matrix-repeat.json`, `import-e2e-summary.json`, `import-isolation.json`.
- Import ban đầu làm 27 món catalog dùng chung bị ghi đè `dishGroup/dishType` theo slot cuối. Lane đã được repair transaction từ base: 27/27 dòng khôi phục và checksum `dishes` hai DB cùng `20734622`. `EnsureImportedMenuDish`/`EnsureDish` đã sửa để món tồn tại giữ classification global; test regression pass.
- FE Coordination đã có ngày phục vụ thật và mọi GET/lock/signoff/unlock/export truyền `serviceDate`; countdown 08:30 tính theo ngày được chọn. Chrome headed với clock shim đã chọn ngày lịch sử `2026-07-21`, lock FULLDAY và signoff cả Ca sáng/Ca chiều từ control thật; request body đúng ngày, mỗi ca 2 plan `COMPLETED`, reload FE vẫn render terminal state. Backend đồng thời đã sửa query ca để MORNING không trả plan AFTERNOON.
- Lifecycle dữ liệu tuần import đã kết thúc có audit: trước correction, DB phát hiện version/schedule của ANV/DAV còn `DRAFT` dù 4 plan/khách đã `COMPLETED`. Endpoint version đã chuyển 24 schedule và 2 menu version `DRAFT → ACTIVE` với reason audit. Trạng thái cuối trực tiếp trong DB: ANV `ACTIVE/25k/12 schedule/4 COMPLETED plan`; DAV `ACTIVE/34k/12 schedule/4 COMPLETED plan`. Chrome headed chọn lần lượt hai khách và tuần `2026-07-20`, render đúng tier, badge `Đang dùng`, 86/86 dòng món có BOM, không overflow/lỗi. Evidence: `menu-lifecycle-finalization.json`, `headed-weekly-customer-lifecycle-audit.json` và hai ảnh `*-active.png`.
- UI/UX đã sửa theo compact SAP Fiori hiện có: form import responsive 1→2→5 cột; tab compact `nowrap`, bỏ min-width dư và có scrollbar mảnh; bỏ global table `height:auto`; tablet 768 dùng navigation gọn; hoàn chỉnh tabpanel ARIA cho Reports/Purchasing/Chef; thêm search cho warehouse supplemental/return, Coordination order, import queue và import history. Search import browser test lọc lịch sử 2→1 dòng với `DAV`.
- Audit toàn dự án cuối: 30 route/viewport capture, 96 tab interaction, 0 `aria-controls` thiếu, 0 tab wrap/clipping, 0 page overflow, 0 console/page error, 0 API >=400. Hai request `ERR_ABORTED` là query bị hủy khi chuyển route. CLS cao nhất `0.006945` ở Purchasing 1280; Chef 768 giảm từ `0.0764` xuống `0.000758`, không long task. Evidence authoritative: `.artifacts/shipyard-live/goal-runtime-20260729/all-tabs/headed-all-tabs-audit.json`.
- Quality gate cuối trước khi tách commit: backend Application 49/49, API 669 pass/1 skip; frontend 419/419, lint, dependency-cruiser và production build xanh; `git diff --check` không có whitespace error. Diff đã được commit cục bộ thành các lát reviewable trên `feature/workflow-b17-b18`; chưa push.
- GitNexus staged audit trước từng commit: backend **CRITICAL** (10 file/48 symbol/26 flow), historical Coordination **MEDIUM** (12 file/26 symbol/1 flow), UI/search/accessibility **CRITICAL** (14 file/18 symbol/16 flow). Impact upstream trước từng symbol sửa trong phiên triển khai là LOW; component dùng chung `ViewSwitcher` từng báo CRITICAL nên không bị chỉnh trực tiếp.
- Blocker workbook còn nguyên do runtime artifact không cung cấp `load_workspace_dependencies`/`@oai/artifact-tool`. Theo spreadsheet skill không được fallback sang openpyxl, XML hand-edit, Excel COM hoặc tự cài package. Vì vậy chưa thể tự author một workbook export mới có đồng thời món đủ BOM, existing/new dish thiếu BOM, merge ô dài và một sheet được fill cho từng tier 25/30/34k. Parser/unit đã có coverage merged-cell và unknown-dish; preview matrix tier đã chạy, nhưng không được gọi đó là workbook-authoring E2E.
- Cell-level manifest cho lượt authoring kế tiếp đã sẵn sàng tại `.artifacts/shipyard-live/goal-runtime-20260729/workbook-case-manifest.json`: tuần `2026-07-27..2026-08-01`, 6 biến thể ANV/DAV × 25/30/34k, mỗi file chỉ fill đúng sheet tier tương ứng, 93 row dự kiến. Case gồm `BẦU NẤU TÔM` đủ BOM cả ba tier, `BÍ NGÒI XÀO CHAY` là món catalog thiếu BOM, hai món test mới thiếu BOM và merge dọc `G23:G26`; merge sẵn `D30:D33` được bảo toàn. Commit pair cuối vẫn là ANV 25k + DAV 34k cùng tuần.
- Hai P0 đã được triển khai trong `5a15c46`: backend chặn lock/signoff khi menu chưa ACTIVE và chặn re-import khi có quantity plan irreversible. Phần còn hở: invariant một tier/customer/week cần enforce ở BE + DB thay vì chỉ UI; preview cần diagnostics BOM theo customer+tier+effective date; commit nên dùng preview token/checksum và batch hai khách cần atomic hoặc có recovery rõ ràng. P1: gắn provenance cho dish tạo bởi import và hoàn thiện search server-side cho các report/admin table paged lớn.
- Lifecycle phiên: parity → backup → cleanup → preview/commit hai khách → repair catalog → quantity plan → historical lock/signoff → publish version/schedule → DB/API/browser reconciliation → toàn-route UI audit → quality gates → docs/GitNexus → shutdown đúng các process do phiên tạo. Không reset lane, không chép dữ liệu test ngược về base và không ghi credential vào evidence.
- Sau teardown, FE `3001`, API `8001`, Shipyard `8090` đều không còn listen; MySQL `3306` vẫn chạy để giữ nguyên `ipc_lane1` và toàn bộ evidence/lineage.

## Routing sau khi phân tầng

Checklist hiện hành nằm trong `MEMORY.md`; artifact và hash nằm trong `docs/EVIDENCE-INDEX.md`;
bài học bất biến nằm trong `LESSONS.md`.

## Undo request P0 Điều phối — 2026-07-29

- Người dùng xác nhận request chặn quick-complete và bắt buộc quay sang Điều phối đơn làm sai lệch nghiệp vụ, nên đã yêu cầu hoàn tác toàn bộ phần phát sinh từ request đó.
- Đã inverse-patch đúng ownership, không reset/restore worktree: frontend khôi phục nút Hoàn tất Ca sáng/Ca chiều, completeQuickServing, complete=true và bước tự hoàn tất trước khi tạo nhu cầu; backend khôi phục quick completion như trước nhưng vẫn giữ guard có trước request là menu schedule/version phải được phát hành.
- Năm file frontend cùng test phát sinh từ request đã biến mất hoàn toàn khỏi git status; backend chỉ còn các thay đổi lifecycle/search/import có trước request. Targeted gate sau undo: backend 1/1, frontend 6/6; backend Release build 0 warning và frontend production build pass.
- ipc_lane1 đã được phục hồi bằng compensating transaction có precondition downstream bằng 0: 8/8 plan ANV/DAV ngày 20–21/07 trở lại COMPLETED; ConfirmedAt/By, CompletedAt/By, confirmationTime, confirmedServings, finalServings và line timestamp khớp evidence trước request. Không xóa audit: giữ 16 correction row và thêm 16 compensating undo row.
- Evidence DB: .artifacts/shipyard-live/goal-runtime-20260729/quick-serving-lifecycle-undo.json.
- Chrome thật headed, chỉ desktop 1365x900 và 1280x900: tab Nhu cầu có đúng 2 control hoàn tất, không còn link hướng dẫn thay thế, không overflow, 0 console/page/API error. Evidence: .artifacts/shipyard-live/goal-runtime-20260729/undo-browser/headed-desktop-undo-verification.json và hai screenshot cùng thư mục.
- Runtime source-backed sau undo từng có `/health/ready` Healthy trên API 8001 và FE 3001 boot từ source hiện tại; sau teardown ba port 3001/8001/8090 đều đã tắt. Các thay đổi đã commit cục bộ, chưa push.

## Tách branch và checkpoint commit B17–B18 — 2026-07-29

- Tạo `feature/workflow-b17-b18` trực tiếp từ `main` tại `6c9931a`; không stash/reset và không đụng dữ liệu/evidence của `ipc_lane1`.
- `5a15c46 fix(workflow): harden menu lifecycle boundaries` — backend lifecycle/import/report cùng regression tests.
- `bf66dd7 fix(coordination): honor selected service date` — ngày phục vụ thật cho query/action/countdown và search bảng Điều phối.
- `5d32a55 feat(ui): improve operational search and accessibility` — search, tabpanel ARIA và responsive styling cho các màn hình vận hành.
- Các commit trên là checkpoint cho diff E2E đã xác minh, chưa phải triển khai Phase 17. Bước tiếp theo vẫn là discuss/plan Phase 17, giữ một `apiSlice`, ổn định public hook/cache behavior và chỉ chuyển Phase 18 sau khi Gate 17 xanh.
- Không push; không chạy lại browser/backend/frontend gate trong thao tác tách branch vì code không đổi so với evidence/gate đã ghi ở trên. Mỗi commit đã qua `git diff --cached --check`, commit hooks và GitNexus staged `detect-changes`.

## Phase 17 Plan 04 — Tách workflow API theo owner — 2026-07-29

- Hoàn tất bốn commit nguyên tử trên `feature/workflow-b17-b18`: `7700140` tách reports/dashboard/documents,
  `6e35d5f` tách purchasing/warehouse, `57b89dc` tách chef/approvals/admin và `b2adb6f` thu gọn
  `workflowApi.ts` thành compatibility barrel.
- Runtime frontend chỉ còn đúng một production `createApi(` và một `reducerPath: 'api'`;
  `workflowApi === apiSlice`. Public contract giữ nguyên đúng 75 endpoint key và 75 generated hook;
  request args, transform, cache tag/invalidation và wire behavior không đổi.
- Endpoint implementation hiện thuộc bảy feature owner cùng neutral `workflowDocumentsApi`; shared DTO/query
  contract nằm ở `workflowApiTypes.ts`. Admin workflow được tách khỏi employee `adminApi` để không đăng ký
  thêm năm endpoint ngoài contract 75-key; `adminApi.ts` vẫn re-export approval-rule hooks cho consumer cũ.
- Dependency-cruiser dùng allowlist chính xác bảy owner module cho compatibility barrel, owner là Frontend
  Architecture và review ở milestone v1.3. Baseline vẫn 16 ignored violation, không tăng.
- Quality gate cuối: frontend **79 file / 428/428 test**, ESLint, dependency-cruiser, production build và
  `check:api-contract` đều xanh; generated contract chạy lặp có SHA-256 giống nhau. OpenAPI/schema chỉ đồng bộ
  query property `SearchKeyword` đã tồn tại ở backend.
- GitNexus final staged audit là **HIGH**, 8 changed symbol và 8 process Dashboard/Warehouse qua
  `useWorkflowOverview`/`buildRoleInbox`/`buildWorkflowLanes`; toàn bộ đã được xử lý bằng full test/build.
  Cypher xác nhận 38 exact barrel importer ở confidence 1.0; rename dry-run thấy 44 file/103 reference và
  không apply edit. Bảng disposition đầy đủ ở `.planning/phases/17-frontend-ownership/17-GITNEXUS-CALLSITES.md`,
  Deferred rỗng.
- Plan này không truy cập, reset, seed, import hoặc mutate database; không chạy browser vì API route, UI/DOM
  và hành vi người dùng không đổi. Bước tiếp theo là Plan 17-05; chưa push.

## Phase 17 Gate 17 và closeout — 2026-07-29

### Đã xác minh

- Tám plan 17-01..17-08 đã hoàn tất trên `feature/workflow-b17-b18`. Ownership cuối: một
  `apiSlice`; `workflowApi.ts` là compatibility barrel; endpoint implementation thuộc bảy feature owner
  cùng neutral `workflowDocumentsApi`; `MainLayout` thuộc `app/layout`; Projects chỉ dùng Coordination
  transport/read projection/action contract; Admin và Reports giữ facade công khai trên panel/view owner.
- Public/cache/wire contract không drift: đúng **1** production `createApi`, **75** endpoint key,
  **75** public generated hook và **22** cache ID. OpenAPI/generated TypeScript deterministic; route,
  request args/response transform, public hook, serialization, provides/invalidates và UI behavior giữ nguyên.
- Dependency baseline 54 violation đã về file `[]`. Strict dependency-cruiser pass với **0 violation**
  trên **342 module / 1.169 dependency**; không còn cycle/reverse import ngoài compatibility allowlist hẹp.
- Regression full gate trên HEAD `1ca2bbb`: Application **49/49**; API **680 pass + 1 intentional skip**;
  frontend **80 file / 433/433**; backend/frontend build, ESLint, dependency-cruiser,
  `npm run check:api-contract`, secret scan và `git diff --check` đều xanh.
- Hai regression full-gate phát hiện từ checkpoint nền được đóng trong commit `1ca2bbb`:
  `DishCatalogCache` chuyển về root `Caching/` để loại `SampleData → Catalog`, giữ nguyên key/invalidation;
  minimal integration schema có bảng `menuversions`. Focused regression: Application 49/49,
  Coordination 43/43, Catalog/SampleData 27/27.
- GitNexus branch index `feature/workflow-b17-b18` ở đúng `1ca2bbb`, PDG enabled:
  56.621 node, 103.081 edge, 482 cluster, 300 flow. CRITICAL review đã chạy explain/PDG/trace;
  Cypher xác minh 6/6 cache caller dùng path mới, old path 0, `SampleData → Catalog` import 0 và
  26/26 caller schema helper đã xử lý. Checklist đầy đủ:
  `.planning/phases/17-frontend-ownership/17-GITNEXUS-CALLSITES.md`; Deferred rỗng.

### Evidence browser authoritative

- File: `.artifacts/shipyard-live/phase-17-frontend-ownership-20260729/phase17-headed-audit.json`.
- SHA-256: `b5cb0ab87821bd32f173ffb1e87364bcdc9b694d1ab0e18f228927a80930aa13`.
- Run `2026-07-29T07:18:20.187Z` → `07:22:00.466Z`, production preview và Google Chrome headed:
  30 app-route capture, 3 Shipyard capture, 96 tab interaction (Admin 21, Reports 27, route khác 48),
  48 warm revisit, 64 API response đều 2xx, warm request mới 0, 82 screenshot.
- Console/page/request failure, horizontal overflow, CLS và long task đều 0. Runtime log chỉ có GET
  cùng `POST /api/auth/login`; không gọi business-write endpoint. Các file `phase17-headed-audit-error.*`
  là attempt cũ, không phải evidence authoritative.

### Còn hở và checklist tiếp tục

- Goal-backward GSD verifier đã pass 7/7 must-have, không gap/human follow-up/override/Deferred.
  Closeout đã qua staged `detect_changes` LOW (13 documentation section, 0 affected process),
  commit cục bộ, PDG re-index đúng clean HEAD và final detect 0 change/0 process.
- Sau closeout, Phase 18 vẫn pending. Gap off-site backup là concern vận hành đã có từ Phase 16,
  không mở rộng vào Phase 17.
- Runtime do Gate 17 tạo đã teardown: FE 3001, API 8001 và Shipyard 8090 down; MySQL 3306 giữ nguyên.
  Không push/reset/seed/import database và không mutate preserved lane trong Plan 17-08.
- Final PDG index có 56.627 node, 103.087 edge, 482 cluster và 300 flow. Cypher trên index mới:
  6/6 cache caller, old cache path 0, `SampleData → Catalog` import 0, 26 schema-helper caller và
  old `workflowApi` implementation call 0. CRITICAL explain/PDG cùng 6 trace đều đã xử lý; worktree sạch.

## Phase 18 — Guardrails, weekly E2E và workflow closeout — 2026-07-29

### Đã xác minh

- Plans 18-01..18-07 đã hoàn tất qua các commit `3a787a5`, `8fc7463`, `86ac57d`, `4bee50d`,
  `e4ce7fc`, `c9554ee`, `e12de8a`, `a536d3a`, `87e92fe`. Ba backend monolith giữ nguyên
  partial-class identity sau khi chia workflow/fixture; route-smoke discovery và focused Chromium giữ 17/17.
- Growth comparator pass 6/6; strict baseline có đúng 10 finding production, không test debt/new debt/
  worsening/stale improvement. `MaterialDemandService` giảm 1.470 → 1.446 dòng và baseline giảm theo.
- Full gate cuối: Application 49/49; API 682 pass + 1 intentional skip; frontend 80 file/433 test;
  ESLint, dependency-cruiser 0 violation trên 342 module/1.169 dependency, backend/frontend build,
  OpenAPI/generated TypeScript determinism, EF pending-model và migration 5/5 đều xanh. Digest lịch sử
  được chuyển sang `docs/EVIDENCE-INDEX.md`.
- Plan 18-07 chỉ mutate `ipc_lane1`; không reset/seed/restore và không import lần hai. Workbook
  authoritative và digest chỉ khai trong front matter của `MEMORY.md`, tuần `2026-07-27`.
  Sanitizer xóa menu/import transaction chain theo dependency order, giữ protected master/reference/BOM;
  migration vẫn 41 và dynamic FK orphan audit bằng 0.
- Backup rollback checkpoint ở `D:\Backups\ipc-phase18-20260729\ipc_lane1-20260729-173035.zip`
  và mirror `C:\Users\Administrator\ipc-phase18-20260729\ipc_lane1-20260729-173035.zip` có cùng
  digest và protected fingerprint được chuyển sang `docs/EVIDENCE-INDEX.md`; lineage guard pass.
- DB evidence cuối: 1 menu version, 12 schedule, 12 meal plan, 6 material request, 7 purchase
  request/order, 13 inventory issue và 1 supplemental request đã đi đủ route → supplier decision → submit
  → approve → PO → receipt → issue → kitchen confirmation → `FULFILLED`; orphan 0.

### Evidence

- Root: `.artifacts/shipyard-live/phase-18-guardrails-20260729`.
- `Assert-Phase18Evidence.ps1` pass: 15 screenshot, 112 successful API response, 0 console/page/request/API
  error, 0 whole-page horizontal overflow, 0 long-task failure; CLS tối đa xấp xỉ `0,04567`.
- Năm viewport authoritative: `1920×1080`, `1440×900`, `1366×768`, `1365×900`, `1280×900`;
  không có `768×1024`. Manual screenshot review và reload render đều ổn định.

### Còn hở, quality gates và checklist tiếp tục

- `ipc_lane1` đang giữ nguyên dữ liệu evidence tuần 2026-07-27. Không chạy lại sanitizer/import/reset/seed;
  kiểm tra artifact bằng `scripts/Assert-Phase18Evidence.ps1` nếu cần.
- Gap vận hành duy nhất vẫn là backup off-site vật lý thật sự. Hai mirror C:/D: chứng minh integrity và
  rollback checkpoint, không chứng minh hai thiết bị/site độc lập.
- Goal-backward Phase 18 verifier pass 8/8 must-have; milestone v1.2 audit pass 12/12 requirement,
  8/8 phase, 7/7 integration và 4/4 end-to-end flow. Nyquist validation 8/8 phase compliant;
  không có gap, affected process chưa xử lý hoặc Deferred item.
- Không push. Closeout cuối phải giữ docs secret scan, `git diff --check` và GitNexus staged
  `detect_changes` xanh trước commit cục bộ; sau commit re-index và final clean detect.

## Audit toàn dự án về grain nguyên liệu và lifecycle — 2026-07-30

### Đã xác minh

- Contract chung nằm ở `docs/DATA-GRAIN-MATRIX.md`. Grain nhu cầu chuẩn là
  `serviceDate + customerId + priceTierAmount + ingredientId + unitId`; chứng từ/audit giữ source-line ID,
  tồn hiện tại là snapshot theo kho và tên nguyên liệu không phải khóa deduplication.
- Màn nhiều ngày có cột ngày; màn tổng BOM không có cột ngày phải ghi rõ “tổng cả tuần”. Thu mua chọn một
  ngày trong tuần rồi mới thao tác source-line; Bếp gộp trình bày theo ingredient/unit trong ngày/ca nhưng
  mở lại được từng phiếu xuất; current stock, stock movement, issue/usage và BOM một khay được tách ngữ nghĩa.
- Lỗi double-count thật đã sửa ở aggregate tồn phân bổ: `CurrentStockQty` của các BOM/source-line là phần
  phân bổ riêng nên tổng ngày dùng `Sum`, không dùng `Max`. Tier và customer được giữ trong demand lineage.
- Lifecycle Kế hoạch tuần đọc aggregate độc lập với tab đang mở. Readiness và bước 4 hiện ghi đúng
  `161 dòng ngày–nguyên liệu`, `42 dòng thiếu cần Thu mua xử lý`; không còn “Chưa tính” hoặc “Tạo nhu cầu
  vật tư” khi backend đã có demand. Source-contract frontend khóa các nhãn/grain này.
- `Bột nở` trên `ipc_lane1` không phải duplicate:
  - 29/07 và 30/07 mỗi ngày có một dòng aggregate, mỗi dòng gồm 2 BOM source-line và tổng
    `2,7132 + 2,8101 = 5,5233 kg`.
  - Current stock có đúng 1 snapshot `0 kg` tại kho mẫu gia vị BOM.
  - Stock movement có 6 audit event hợp lệ: 4 receipt theo hai source quantity và 2 issue `5,5233 kg`;
    chuỗi before/after kết thúc ở 0, không bị cộng hai lần.
  - Checklist Bếp ngày/ca hiện một dòng Bột nở `5,5233 kg`, gắn đúng phiếu xuất và trạng thái đã nhận.
- Search server-side/FE áp dụng cho các bảng nhiều dữ liệu liên quan: demand/purchase/current stock/movement,
  warehouse, supplemental và source-line group. Search chạy trước paging/KPI ở backend.

### Evidence và quality gates

Gate này được promote thành gate hiện hành trong `MEMORY.md`; artifact authoritative và SHA-256
nằm trong `docs/EVIDENCE-INDEX.md`. Không lặp lại bộ số hiện hành trong nhật ký.

### Còn hở và checklist tiếp tục

- Không còn gap nghiệp vụ hoặc test trong phạm vi grain ngày/tuần và lifecycle. Workbook-authoring E2E bằng
  spreadsheet artifact tool vẫn là blocker môi trường đã ghi ở Goal audit trước đó; không liên quan đến kết
  luận Bột nở/double-count của dữ liệu hiện hành.
- Không reset/seed/import lại `ipc_lane1`; dữ liệu evidence và audit chain được giữ nguyên.
- Runtime kiểm chứng do phiên tạo đã teardown: `3010/8010` không còn listen. Tại lúc
  cập nhật docs ngày 30/07, runtime chuẩn `3001/8001`, Shipyard `8090` và API `8005` cũng
  không listen; chỉ MySQL `3306` còn listen.
- GitNexus PDG final: 58.157 node, 105.980 edge, 499 cluster, 300 flow. Final detect trên uncommitted diff:
  237 changed symbol / 71 affected / 92 file, CRITICAL; compare `main`: 1.010 / 110 / 270, CRITICAL.
  Các flow được xử lý bằng full BE/FE test, contract determinism, architecture gate và browser E2E ở trên;
  disposition symbol chính có Deferred rỗng trong báo cáo bàn giao.
## Đánh giá Agent Brief 30/07/2026

- Đã phản chứng hai mục stale: `SupplementalMaterialRequestService.FulfillAsync` đã bọc stock ledger, audit và workflow state trong transaction; năm tên component Thu mua mà brief gọi là dead code không còn definition/reference trong checkout hiện tại. Hai mục đã bị xóa khỏi memory hiện hành.
- Đã xác minh BOM workbook hỏng còn rơi vào HTTP generic, hai migration upgrade chưa chạy CI, hai migration ID mồ côi có thật trong `ipc_lane1`, diagnostics catalog đếm nhiều bảng tuần tự và invariant tier chưa được enforce đồng nhất ở DB.
- UI harness headed chỉ kiểm tra sự tồn tại của screenshot và counter runtime, không đọc lại ảnh; Playwright `ui-audit` tuy nhiên đã có một phần oracle hình học cho overflow, action, dialog và tab nên nhận định “chỉ có CLS + overflow” trong brief là quá rộng.
- Setup mattpocock đã chạy từ trước và không có collision với nhóm skill dự án tracked; config local đã đổi con trỏ `CURRENT-STATE.md`/`CONTEXT.md` stale sang `MEMORY.md` và `docs/DOMAIN.md`. Việc ghim upstream commit và quyền sở hữu process vẫn chờ quyết định.

## Chốt governance, migration lineage và backup 30/07/2026

- GSD được chốt là process owner duy nhất; hotfix vẫn dùng GSD. Handoff chỉ sinh
  draft tạm, các orchestrator mattpocock và router của chúng bị vô hiệu hóa.
- Hai migration upgrade test được đổi sang predecessor fixture tự dựng trên lane
  disposable và được thêm vào CI. Fresh-install và cả hai upgrade path đều pass.
- Hai migration ID mồ côi được khôi phục bằng no-op; lineage read-only trên
  `ipc_lane1` không còn database-only/source-only/stale manifest. Ba ID legacy hợp nhất giữ
  nguyên SQL và được ghi rõ trong ledger.
- Target backup off-site là object storage versioned/immutable có write-only credential, mã hóa
  dump + binlog, manifest tách trust boundary và hai SSD luân phiên off-premises. Chưa đóng
  rủi ro cho tới khi restore drill chỉ từ off-site pass.

## Duyệt PC đầu và hoàn tất PA-2B `WeeklyMenuLifecycle` — 30/07/2026

- Kỳ duyệt PC một-object đầu, giữ PD đóng và chọn cả hai refinement: thêm actor/downstream state vào
  companion registry và dựng browser fixture deterministic read-only. `DEC-07` vì vậy đã đóng và được
  thay bằng quyết định duyệt kết quả PC rerun.
- PA-2 gốc không bị sửa. PA-2B giữ đúng một object, 10 scenario cũ và thêm
  `active-shortage-terminal`; terminal import `getDemandActionPresentation('terminal')` và khóa
  `primaryAction = none`.
- Fixture chạy production `/weekly-menu` với response API intercept, không truy cập/mutate `ipc_lane1`,
  không gọi business mutation và không được coi là backend/DB E2E. Kết quả/gate hiện hành nằm trong
  `MEMORY.md`; artifact/hash nằm duy nhất trong `docs/EVIDENCE-INDEX.md`.
- PC rerun xác nhận hai context `THIẾU` direct-complete cho Manager/Coordinator và một context `MỒ CÔI`
  purchasing link cho Coordinator; không sửa permission string, policy, gate hay UI. PD và object thứ hai
  vẫn đóng chờ Kỳ duyệt kết quả mới.

## Sửa hiểu nhầm E2E và gỡ `WeeklyMenuLifecyclePanel` — 30/07/2026

- Kỳ làm rõ “E2E lifecycle” là chạy luồng nghiệp vụ thật, không phải thêm UI mô tả lifecycle, và yêu cầu
  gỡ luôn panel đã phát sinh. Commit `fbb489e` xóa component cùng caller duy nhất; không tạo selector/panel
  thay thế. `weeklyMenuLifecycleModel` và PA registry tiếp tục tồn tại như contract/test không được
  production import.
- Hai lệch PC cũ được sửa đúng phạm vi: completion dùng `coordination.order.lock`, Manager dev fixture nhận
  cùng canonical string, và `Mở thu mua` được gate bằng `purchase.read`. Không sửa backend policy và không
  chạm năm nhóm PA-4 còn lại.
- PA-2B rerun sau correction không còn lệch completion/purchasing. Hai context còn `THIẾU` chuyển thành
  DRAFT × Manager/Coordinator vì backend CoordinationAccess cho phép nhưng control Publish thật nằm trong
  Admin Data wildcard. Audit chỉ ghi nhận; chưa mở PD hoặc object thứ hai.
- Operational E2E dùng source hiện tại và Chrome headed trên `ipc_e2e_template` disposable, nối control FE
  qua API/DB/reload tới handoff Thu mua. `ipc_lane1` chỉ được dùng làm nguồn clone/read; sau capture,
  template được clone lại từ lane và runtime do phiên tạo được teardown. Hash artifact nằm duy nhất trong
  `docs/EVIDENCE-INDEX.md`; gate hiện hành nằm trong `MEMORY.md`.

## Chốt Option A cho WeeklyMenu DRAFT Publish — 2026-07-31

- Quick task `260731-15j` ghi nhận D-01 / `DEC-08` theo **Option A**: control `Publish` thật tiếp tục
  nằm tại Admin Data → Contract sau wildcard-admin route và vẫn **Admin-only**.
- Hai context đã đo `WeeklyMenuLifecycle × DRAFT × Manager` và
  `WeeklyMenuLifecycle × DRAFT × Coordinator` được chấp nhận là FE chặt hơn BE có chủ đích. Backend
  `CoordinationAccess` vẫn có thể cho hai role update version; frontend không mở route/control Publish
  cho hai role và không cần alignment FE/BE.
- `OPEN-11` và `DEC-08` đóng ngày `2026-07-31`. PD và object thứ hai tiếp tục đóng; quyết định này
  không cấp quyền Publish cho Manager hoặc Coordinator.
- Đây là closeout chỉ-tài-liệu. Không production code, backend policy, frontend route/control, test,
  evidence artifact, database hoặc runtime nào thay đổi; số đo và evidence pointer cũ được giữ nguyên
  tại `docs/P3-P4-PC-WEEKLY-MENU-AUDIT.md`.

## Đóng PA-4 — vocabulary frontend khớp backend — 31/07/2026

- Baseline checker đỏ đúng năm nhóm/tám callsite. Kỳ chọn xử lý PA-4 theo guard-generic: ba literal
  dev-login đổi dấu `:` sang canonical backend; hai literal synthetic trong guard tests cùng dùng
  `report.read` để giữ exact-match, role rejection và admin/full-access bypass mà không khai thêm ý nghĩa
  nghiệp vụ.
- Commit `8b87470` không sửa backend vocabulary/policy, guard implementation, route/menu/action gate hoặc
  rendered UI. Focused checker, focused guard/login tests và full root verify đều pass; test count không
  giảm và không fixture/test nào được miễn.
- `OPEN-10` và `DEC-03` đóng. Các quyết định Manager catalog-write, inventory-receipt approval và định
  dạng registry trước object thứ hai vẫn mở.
- Không chạy browser/runtime, không mutate database và không tạo evidence artifact mới cho thay đổi
  source/test vocabulary này.

## Duyệt DEC-06 và hiệu chỉnh GitNexus risk policy — 31/07/2026

- DEC-06 duyệt format-only cho object tương lai `CoordinationOrderScopeLifecycle`: grain mỗi hàng là
  `scenario × operation`, mọi hàng thêm `scope`, còn `entityState` và `projectionState` là hai field riêng.
  Không tạo CoordinationOrder registry, không implement object thứ hai và không thay đổi snapshot
  `WeeklyMenuLifecycle`/PA-2B đã audit.
- Evidence PA-4 cho thấy raw transitive import closure có thể leo thang sai nếu bị đồng nhất với directed
  production impact. Policy project-local nay giữ raw risk làm evidence nhưng phân loại effective risk theo
  production signature, control flow, data flow và affected process đã xác minh; mọi edge unresolved vẫn
  giữ raw risk.
- Policy mới khóa repo/branch explicit, symbol-first anchor với file fallback, semantics upstream/downstream,
  `includeTests`, pagination/partial handling, grouped disposition cho import-only closure, lightweight lane
  và selective PDG. Không dùng zero-taint làm bằng chứng an toàn.
- GSD tiếp tục là process owner duy nhất; GitNexus chỉ cung cấp analysis và `gitnexus-pr-review` discipline
  bên trong plan GSD. Closeout này chỉ sửa docs/governance, không chạy browser/runtime, không mutate database
  và không tạo production/test/evidence code.
- Root `AGENTS.md` được `.gitignore:95` loại khỏi version control; policy được áp dụng cho workspace hiện
  tại và không bị force-add. Năm file audit/state canonical là phần được commit.

## Hoàn tất Phase 19 — completeness registry expansion — 31/07/2026

- Phase 19 triển khai executable inventory cho 13 protected operational families. Sáu family có rows chiếu
  trực tiếp từ model/policy hiện có; bảy family không import được giữ dưới dạng debt source-linked với exact
  range/fragment drift guards.
- `CoordinationOrderScopeLifecycle` đã được materialize ở test boundary với 20 rows, grain
  `scenario × operation`, row-level `scope`, identity `object + scenarioId + operation` và hai field state
  độc lập `entityState`/`projectionState`. Production không import registry; WeeklyMenu registry/projection
  lịch sử không đổi.
- FE và BE cùng đọc `frontend/tests/operationalRegistryFamilyManifest.json`. Chín debt descriptors trên tám
  raw sources và 17 unique fragments được kiểm tra bằng bốn negative probes; verifier Phase 19 pass `6/6`.
- Các commit triển khai là `8b6e0db`, `62d8641`, `cfccba3`, `0144bbd`, `46950be`, `f74abac`, `1ecf0ff`,
  `2dd8a4a` và `7c849ce`. Gate ứng dụng/API/frontend, lint/build/dependency/architecture đều xanh; chi tiết
  số liệu hiện hành được giữ ở `MEMORY.md`.
- Phase 20 chuyển sang trạng thái ready-to-plan. Closeout chỉ cập nhật GSD/audit docs; không đổi policy,
  UI, production behavior, runtime, database hoặc evidence lane.

## Hiệu chỉnh GitNexus thành ba lane theo semantic risk — 31/07/2026

- Phase 19 cho thấy lightweight policy cũ vẫn bị diễn giải thành impact hai chiều, re-index và symbol report
  cho test-only helper dù final compare có 0 affected production process. Nguyên nhân là generated blanket
  rule, custom lane và câu nhắc context bên dưới chồng lấn nhau.
- Policy local nay có một classifier trước mọi graph call: **graph-free** cho docs/planning/rules, inert metadata
  và leaf assertions/snapshots trơ; **lightweight graph** cho shared harness/source checker và behavior-bearing
  permission/role/route/state/action/API/cache/serializer/schema literals; **full analysis** cho production,
  public/API, auth/policy, migration/data-integrity, refactor hoặc mixed diff.
- Graph-free chạy không GitNexus tool và ghi risk `N/A`; lightweight dùng source-aware closure, targeted tests
  và một final explicit-branch detect; full giữ impact hai chiều, pagination/includeTests, affected-process
  disposition, HIGH/CRITICAL review và PDG khi thực sự áp dụng.
- Generated `gitnexus:start/end` block vẫn byte-identical; `AGENTS.md` tiếp tục bị ignore và không force-add.
  GSD vẫn là process owner duy nhất. Thay đổi governance này không mở Phase 20 và không chạm source/test/UI,
  backend policy, runtime, database hoặc evidence.

## Hoàn tất Phase 20 — PC/PD action completeness — 31/07/2026

- Aggregate Chrome headed fixture đo sáu executable family, 34 scenario, 44 canonical row và năm desktop
  viewport; 535 measurement tách 265 `KHỚP`, 255 canonical unresolved và 15 `LỆCH VỊ TRÍ`; `THIẾU`,
  `MỒ CÔI` và `IM LẶNG` đều bằng 0. Evidence được giữ đúng nhãn `FE-fixture-read-only`, không được coi là
  backend/DB E2E.
- 300 screenshot path, 4.565 intercepted read, 255 intercepted mutation và 435 performance record được kiểm
  lại từ artifact; mọi request có status 200, không có browser issue hoặc overflow. Canonical operations có
  control đã được exercise với request/post-action evidence.
- Ledger 22 group expand đúng toàn bộ 255 unresolved identity, không đoán operation/actor/permission, giữ D-01
  intentional FE-stricter và checkpoint `DEFERRED` với zero production PD candidate. ORCL-04/05 đã complete.
- PA-4 bắt thêm literal `warehouse.manage` do fixture mới ở Plan 20-02. Commit `6032fea` thay duy nhất literal
  đó bằng backend-canonical `inventory.read`; focused PA-4, PC suites và full root verify đều pass, không sửa
  backend policy, route, UI gate/control hoặc production behavior.
- Root gate chốt Application 49/49, API 705 pass + 1 intentional skip, frontend 103 file/603 test, architecture,
  lint, dependency-cruiser và hai production build xanh. Không chạy lại browser, không mutate database/runtime;
  hash artifact chỉ khai tại `docs/EVIDENCE-INDEX.md`.

## Thu gọn roadmap về ánh xạ trực tiếp với addendum — 31/07/2026

- Kỳ yêu cầu loại cách chia semantic/control/conformance tự mở rộng. Phase 21–25 nay ánh xạ trực tiếp lần lượt
  tới `PE`, `P5`, `P6`, `P7` và `P8 + PF`; Phase 19–20 tiếp tục là lịch sử PA/PC-PD đã hoàn tất.
- Các quota/đòi hỏi không có nguồn trực tiếp như 10 finding, ba golden screen và chương trình DOM metadata bị
  gỡ khỏi active roadmap. Chi tiết thiếu từ bộ prompt cũ phải giữ unresolved hoặc chờ duyệt, không được tự điền.
- Requirement ID được giữ để không phá traceability, nhưng `CAN-01..06` cùng thuộc PE, `CONF-01..02` thuộc P5,
  `CONF-03..04` thuộc P6, `CONF-05..06` thuộc P7, còn state/quality/docs thuộc P8+PF.
- Đây là thay đổi planning/docs-only: không mở thư mục Phase 21–25, không sửa code/UI/policy/runtime/database và
  không thay evidence Phase 20.

## Phase 21 Plan 01 — PE date-only formatter — 31/07/2026

- Ba helper `formatIsoDate` trùng nhau trong Purchasing được hội tụ vào `formatDateOnly` tại shared formatter;
  output `DD/MM/YYYY` và fallback input không hợp lệ được giữ nguyên.
- Focused suite `29/29`, frontend `606/606`, root verify, lint, dependency-cruiser và hai production build đều
  xanh. Browser PC không chạy lại vì slice chỉ thay presentation date-only, không thay action/state/API surface.
- Đây chỉ là một PE slice; phase còn mở. Không thay backend policy, route, permission, database hoặc PC aggregate.

## Phase 21 Plan 02 — PE Admin BOM table boundary — 31/07/2026

- Admin BOM là production caller duy nhất còn dùng `DataTableShell`; đã chuyển wrapper hiện tại sang
  `TableViewport`, giữ nguyên table/row actions và để `PaginationBar` bên ngoài. Primitive legacy không bị xóa.
- Render contract `5/5`, frontend `607/607`, root verify, lint, dependency-cruiser và hai production build đều
  xanh. Browser PC không chạy lại vì không thay action/state/API surface; boundary đã có render-level evidence.
- Phase 21 vẫn mở; đây là PE slice thứ hai trong phiên này, không thay backend policy, route, permission,
  database hoặc PC aggregate.

## Hoàn tất Phase 21 — PE canon convergence — 02/08/2026

- Hoàn tất 15/15 plan và goal-backward verifier pass `27/27`. Mười tám concept PB đã được chiếu lại từ
  production source; date giảm 31→0, Button 8B 77→0, Form 9B 39/26/4→0, quantity 26→0 và currency 12→0.
- Hai gap verifier ban đầu đã đóng: `formatDateOnly` kiểm tra ISO/calendar trước khi đổi thứ tự và date AST
  gate bắt variable/property receiver cùng direct `Intl.DateTimeFormat`. Exact model/adapter exceptions tiếp
  tục được count-lock; production không import test registry.
- Root gate pass Application `49/49`, API `705 pass + 1 intentional skip`, frontend `117 files / 653 tests`,
  architecture `6/6`, strict đúng 10 finding, lint/dependency/build xanh. Hai Select portal test được đổi sang
  async query để loại race full-suite; production component không đổi vì việc này.
- GitNexus explicit branch báo raw CRITICAL với 237 symbol, 97 file và 28 process; tất cả 28 process đã được
  disposition, Deferred none. Deep review không còn finding production; hai compatibility decision được ghi rõ:
  Reports giữ request debounce 300 ms trước deferred value và timestamp cố định business timezone `Asia/Bangkok`.
- `OPEN-03` đóng: import commit/rollback và employee activate/deactivate đều có confirmation nêu scope/tác động.
  Không sửa backend policy/API/route/cache/lifecycle/database, không mutate runtime/database và không push.
- Phase 22 là P5 — Ma trận chuẩn. Không tạo phase mới ngoài chuỗi 22–25 ánh xạ trực tiếp addendum.

## Hoàn tất Phase 22 — P5 ma trận chuẩn — 02/08/2026

- Tạo `docs/UI-CONFORMANCE-MATRIX.md` với đúng 20 normative row: PB-01..PB-18 chiếu từ ballot đã duyệt và
  PF-01..PF-02 chiếu từ hai phép kiểm O3 trong addendum. Mỗi row có source, canon/context, measurement layer,
  điều kiện PASS nhị phân và chiều chưa có nguồn.
- Spacing, min-height, contrast ratio, pixel/golden tolerance, viewport/finding quota và mọi giá trị không có
  nguồn được giữ literal `UNRESOLVED`; candidate document không được dùng làm normative source.
- Checker pass 20 row, 18 PB source, 2 PF source, 0 candidate normative; `git diff --check` và secret/stub scan
  xanh. Verifier Phase 22 pass `4/4`; CONF-01/02 Complete. Lane `N/A — graph-free documentation diff`.
- Không sửa production/test/config/runtime/database, không chạy browser, không mở phase mới và không push.
  Phase 23 tiếp tục P6, chỉ chọn failure thật còn tồn tại sau PE.

## Hoàn tất Phase 23 — P6 zero-failure selection — 02/08/2026

- Audit đủ PB-01..PB-18 và PF-01..PF-02. Aggregate current-source gate pass `7/7`; 18 PB row đều có
  post-PE residual 0, hai PF row thuộc permanent gate Phase 25 và không có current violating case.
- Kết quả đóng băng: `selected_failures: 0`, `red_assertions_created: 0`; không tạo
  `frontend/tests/uiConformanceSelectedFailures.test.ts`, không biến `UNRESOLVED` thành oracle giả.
- Plan-checker qua ba vòng: bổ sung cấu trúc GSD và nhánh conditional RED cho trường hợp nonzero; bản cuối pass
  CONF-03/04. Verifier pass `4/4`; lane graph-free, không sửa production/runtime/database/browser.
- Phase 24/P7 chỉ được sửa failure đã đỏ ở P6. Vì selection set bằng 0, P7 phải là no-op có verification.

## Hoàn tất Phase 24 — P7 zero-fix no-op — 02/08/2026

- P6 đóng băng zero failure/zero RED nên P7 áp dụng zero production fix và zero green-after-fix assertion.
  Không có P5→RED chain nào cho phép thay đổi source.
- Aggregate UI canon + PC contracts pass `4 files / 50 tests`; CONF-05/06 Complete, verifier pass `4/4`.
- Không rerun headed browser, không relabel evidence và không start runtime/mutate `ipc_lane1` vì không có UI source
  change. Lane `N/A — graph-free docs-only no-op`.
- Phase 25 là block cuối P8+PF của addendum. Không tạo Phase 26 hoặc follow-up phase.

## Hoàn tất Phase 25 — P8 + PF permanent gate — 02/08/2026

- Ba same-kind pair được nối từ hai production callsite về shared projection owner và kiểm actions, status label,
  mandatory facts trên cùng logical fixture. Hidden-state scanner khóa exact baseline local/global/time/order/cache,
  ba synthetic negative probe và cấm production import test inventory.
- Root `test:ui-completeness` khóa operational registry, source canon, P5/P6 ledger và PF contract; root verify
  pass Application `49/49`, API `705 pass + 1 skip`, frontend `118 files / 662 tests`, architecture, lint,
  dependency-cruiser và hai production build. Test count tăng, không giảm.
- Chrome headed current-source hoàn tất đúng năm viewport trên guarded `ipc_lane1`, ghi screenshot, API sau action,
  console/page/request errors, CLS và long task; run final không có escaped mutation, browser issue hoặc overflow.
  Attempt locator timeout trước đó được giữ riêng và không dùng làm gate; hash chỉ khai trong evidence index.
- GitNexus lightweight compare từ `70a21ea` là LOW với zero affected production process. Goal-backward verifier
  pass `5/5`, Deferred none. `STATE-01..03`, `QUAL-01`, `DOC-01` Complete.
- `docs/UI-UX-ADDENDUM-CLOSEOUT.md` ánh xạ trực tiếp PA, PB, P3, P4, PC, PD, PE, P5, P6, P7, P8, PF.
  Milestone v1.3 và addendum đóng tại Phase 25; không tạo Phase 26, không push và không mutate dữ liệu lane.

## Hoàn tất Phase 26 — Floorplan Scope & Source Ownership — 02/08/2026

- Hoàn tất 5/5 plan qua bốn wave; verifier pass `5/5 must-haves` và đủ FLOOR-01..04,
  SOURCE-01..03. Registry khóa 50 canonical state, floorplan/capability/table contract và test-owned
  source manifest có exact-set/source-aware diagnostics.
- Production chỉ nhận opaque owner/floorplan/region instrumentation; route tuple được kế thừa qua context
  để không sinh mixed tuple. Không đổi business behavior, policy, API, cache, lifecycle hay route access.
- Headed source-ownership gate pass `6/6`, đủ 250 cell trên năm desktop viewport; root gate pass
  Application `49/49`, API `705 + 1 skip`, frontend `123 files / 724 tests`, lint/dependency/build xanh.
- GitNexus full-analysis cho instrumentation và lightweight cho checker đều đã reconcile, zero Deferred.
  `ipc_lane1` không bị mutate, Phase 27 không mở và không push.

## Hoàn tất quick 260802-ola + 260802-plv — Shipyard evidence-driven UI remediation — 02/08/2026

- Đồng bộ FE/BE/current-source rồi audit Chrome headed 50 canonical state × năm viewport trên dữ liệu thật,
  không mutate `ipc_lane1`. Baseline chứng minh tab/sidebar/cache đã nhanh và ổn định nên không sửa cơ chế này.
- Ảnh và table geometry xác nhận bốn lỗi presentation: Reports cấp width thiếu 3/10 cột, Audit thiếu 1/7 cột,
  Purchasing giữ khối empty 400/480 px và Admin stock in quantity/unit raw. Commit `c8667f2` sửa đúng bốn điểm.
- Warm rerun pass 250/250 screenshot, 966 API success, tab p95 156.5 ms/max 216 ms, sidebar p95 124.9 ms/
  max 138.9 ms, zero CLS, browser error, duplicate read và escaped mutation. UI completeness giữ 87/87;
  không có bằng chứng cho phép thêm nút FE.
- Frontend pass 124 file / 729 test, lint, dependency graph và production build. GitNexus final MEDIUM,
  một presentation process, HIGH-rigor review APPROVE, Deferred none. Phase 27 không mở và không push.

## Hoàn tất quick 260803-p7b — Chuẩn hóa contract và Dashboard query state — 03/08/2026

- Chấp nhận `docs/UI-UX-FE-BE-DATABASE-STANDARDIZATION.md` theo rollout tăng dần, nối từ architecture và
  frontend README; không tự đóng OPEN-02/05/06/07/08/09 hay tuyên bố toàn hệ thống đã chuẩn hóa xong.
- Dashboard đưa workflow overview và operational KPI qua `QueryView`/`QueryViewBoundary`: partial error chặn
  số 0/empty giả, retry theo owner, refresh giữ dữ liệu cũ; shared boundary ưu tiên lỗi actionable hơn loading.
- Root gate pass Application 49/49, API 705 + 1 intentional skip, UI completeness 87/87, frontend 126 file /
  736 test, lint, dependency graph 0 violation / 375 module / 1.348 dependency và hai production build.
- Commit `e0f3361`; không browser/runtime/database mutation, không gọi GitNexus và Phase 27 vẫn chưa mở.
