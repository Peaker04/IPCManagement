<!-- generated-by: gsd-doc-writer -->
# Kiểm thử

## Framework và setup

Backend dùng xUnit `2.9.2`, FluentAssertions, NSubstitute, `Microsoft.AspNetCore.Mvc.Testing`, EF Core InMemory/SQLite và test project ở `backend/tests/`. Frontend dùng Vitest `4.1.10`, Testing Library, jsdom và Playwright `1.60.0` cho browser/E2E tests.

Sau khi chạy `npm ci` và `dotnet restore`, có thể chạy test theo workspace tương ứng. Frontend unit test dùng setup `frontend/src/test/setup.ts`; Playwright dùng cấu hình `frontend/playwright.config.ts` và Chromium.

## Chạy tests

Backend từ root:

```bash
npm run test:be
npm run test:be:coverage
```

Frontend unit test từ `frontend/`:

```bash
npm run test:unit
npm run test:unit:watch
npm run test:coverage
```

Frontend Playwright từ `frontend/`:

```bash
npm run test:smoke
npm run test:controls
npm run test:ui-audit
npm run test:performance
npm run test:visual
```

Để cập nhật visual snapshots, chỉ dùng khi thay đổi giao diện đã được review:

```bash
npm run test:visual:update
```

### E2E trên Shipyard

Profile `shipyard/profiles/IPCManagement` chạy happy path toàn tuần trên lane đang hoạt động qua
Shipyard `bin/lane-e2e.sh <lane>`. Hook mặc định kiểm tra khách hàng `ANV`, tuần bắt đầu
`2026-07-20`, định mức `25000` và template
`C:\Users\Administrator\Pictures\weekly-menu-template-ANV-default.xlsx`. Có thể override
bằng `E2E_WEEK_START_DATE` (fallback tương thích: `E2E_SERVICE_DATE`), `E2E_CUSTOMER_CODE`, `E2E_PRICE_TIER_AMOUNT` và
`E2E_WEEKLY_MENU_TEMPLATE_PATH`.

Hook reset clone database template vào database của lane, chạy `sanitize-e2e` để xóa 30 bảng
transaction trong `ipc_lane1..ipc_lane9` (giữ master/reference và `currentstock` làm opening snapshot),
sau đó chạy migration. Hook `e2e.sh` gọi reset này trước mỗi E2E gate; vì vậy lịch ACTIVE hoặc chứng từ
terminal từ lượt trước không được phép làm nhiễm lượt mới. Guard của database tool từ chối database chính và `ipc_e2e_template`.
Không dùng `lane-reset.sh` khi cần giữ nguyên branch/thay đổi source của lane. Kết quả E2E được ghi vào
`<lane>/.artifacts/e2e/` và lane chỉ được đánh dấu `e2e-passed` khi hook hoàn tất thành công.

Audit hiệu năng và benchmark database chính phải dùng schema `ipcmanagement` ở chế độ read-only; không
chạy reset/seed E2E trên schema này. Ledger reconciliation hiện aggregate `stockmovements` ở database,
giữ hợp nhất khóa `currentstock` và movement, rồi cache snapshot data-quality theo version với giới hạn
scan 500 + một dòng sentinel để phát hiện `IsTruncated`. KPI và trang data-quality dùng chung snapshot;
đếm tuyệt đối và phân trang database thật là hạng mục tiếp theo, không được suy diễn từ danh sách bị cắt.

`scripts/Invoke-WeeklyHappyPathE2E.ps1` import và publish menu đúng một lần, đọc các ngày phục vụ
thực sự từ schedule API trong khoảng tuần, rồi gọi lifecycle ngày với `-SkipWeeklyMenuImport`.
Mỗi ngày tự tạo forecast qua API `meal-quantity-plans/quick-servings`, lock/sign-off, tạo và duyệt
demand/PR, nhận PO, gửi production plan, xuất kho, xác nhận bếp và kiểm tra reports. Cách chạy này
không import lại menu giữa tuần nên không làm stale/cancel chứng từ của ngày đã hoàn tất. Mỗi ngày có
summary riêng dưới thư mục `days/`; lượt tuần chỉ PASS khi số summary bằng số ngày có schedule.

Có thể chạy runner tuần trực tiếp từ root:

```bash
npm run e2e:weekly
```

Khi kiểm tra menu re-import, phân biệt lineage còn sửa được và chứng từ bất biến. Demand/PR
bị chính menu re-import đánh dấu `CANCELLED` có thể được mở lại về `DRAFT` để tính lại nếu
chưa có purchase order hoặc phiếu xuất kho. Khi đã có một trong hai chứng từ này, BE phải
trả `canRegenerate=false` cùng `regenerationBlockReason`; FE hiển thị lineage chỉ đọc và ẩn
action ghi dữ liệu. Ma trận kiểm thử theo thứ tự Happy path →
Negative → Boundary → Permission → Regression → Integration/third-party failure nằm trong
artifact E2E của từng lượt chạy.

`npm run e2e:exceptions` chạy HTTP contract real-stack cho dữ liệu thiếu/sai, permission,
boundary và terminal-state regression. Với Shipyard, truyền `-BaseUrl http://localhost:8001` cho
`scripts/Invoke-Iter1ExceptionPathE2E.ps1`. Lượt kiểm tra phải so sánh snapshot DB trước/sau để
negative case không được tạo transaction nửa vời. Browser failure-injection được báo riêng: mỗi
dependency 503 phải hiện alert semantic, có `Thử tải lại`, refetch thành công và bỏ trạng thái lỗi;
không được hiển thị lỗi tải dữ liệu như một empty state hợp lệ.

## Viết test mới

- Backend đặt test trong `backend/tests/IPCManagement.Api.Tests/` hoặc `backend/tests/IPCManagement.Application.Tests/`, dùng tên class kết thúc bằng `Tests.cs`.
- Frontend unit test đặt cạnh module với hậu tố test TypeScript/TSX; dùng Testing Library cho component và Vitest cho model/utility.
- Browser scenarios đặt trong `frontend/tests/` với hậu tố spec TypeScript; snapshot nằm trong thư mục snapshot tương ứng.
- Dùng `frontend/src/test/setup.ts` cho cleanup và matcher của Testing Library; không đưa side effect dùng chung vào từng test nếu có thể đặt ở setup.

## Coverage

| Phạm vi | Công cụ/cấu hình |
|---|---|
| Backend | Coverlet qua `backend/coverage.runsettings`; loại `**/Migrations/*.cs` khỏi report. |
| Frontend | V8 qua `frontend/vite.config.ts`; report ở `frontend/coverage`. |
| Threshold | Chưa thấy coverage threshold bắt buộc trong cấu hình hiện tại. |

Các lệnh tổng hợp là `npm run coverage:be`, `npm run coverage:fe` và `npm run verify:coverage`.

Snapshot kiểm chứng ngày 25/07/2026 sau weekly E2E ANV 25k và regression luồng cấp bổ sung:

| Phạm vi | Tests | Line | Branch | Function/method |
|---|---:|---:|---:|---:|
| Backend | 592 PASS | 69.4% | 53.8% | 75.5% method |
| Frontend | 299 PASS | 39.68% | 29.21% | 32.00% function |

Coverage trên là coverage của automated unit/integration suites. Playwright real-stack được báo cáo
riêng bằng navigation/page → action → API response → DB transition → rendered state và screenshot;
không cộng browser execution vào V8/Coverlet percentage.

Browser regression bắt buộc cho ký nhận bếp: mở trang và tick checkbox không được gọi mutation;
chỉ dialog xác nhận `Đã kiểm đếm và nhận` mới phát đúng một request. Với PO liên kết yêu cầu
bổ sung, FE khóa kho đích theo yêu cầu và BE từ chối receipt vào kho khác. Audit chạy thật, ma trận
approval/confirmation, duplicate grain và số đo performance được lưu trong
`.artifacts/shipyard-live/E2E-AUDIT-2026-07-25.md`.

Browser performance regression cho các workbench theo tab dùng probe `PerformanceObserver`
để ghi long task, CLS, DOM rows và endpoint phát sinh sau click. Evidence gần nhất nằm ở
`.artifacts/shipyard-live/live-visual-performance.json`; yêu cầu cốt lõi là sub-tab Biến động giá
chỉ gọi đúng endpoint aggregate đang active và tab Quản trị dữ liệu không dựng dialog BOM khi đóng.

Regression contract `src/features/workflow/pages/operationalPagePerformanceContracts.test.ts` còn khóa query gating cho Weekly Menu, Chef và Warehouse, controlled idle preload của các panel Weekly, cùng panel shell chống layout jump. Browser-use live phải kiểm tra selected tab cập nhật ngay trong khi panel cũ còn hiện với `aria-busy`, không có API của tab ẩn, vòng chuyển lại dùng cache, CLS dưới `0.02` và reduced motion làm transition về `0s`. Evidence gần nhất: `.artifacts/shipyard-live/tab-performance-controlled-lazy-2026-07-25.json`.

### Browser-use headed và chụp evidence

Từ project root, sau khi xác nhận các port `3001`, `8001`, `8090` đang listen:

```powershell
$env:PYTHONUTF8='1'
@'
ensure_real_tab()
goto_url('http://localhost:3001/weekly-menu')
wait_for_load()
print(page_info())
'@ | uvx browser-use
```

Không dùng hoặc tìm `agent-browser` cho repo này. Với audit tab, dùng `js()` để cài `PerformanceObserver`, xóa resource timing trước mỗi click và ghi selected tab/panel ID/`aria-busy` trước và sau khi ổn định.

Script dùng Chrome executable `C:/Program Files/Google/Chrome/Application/chrome.exe`, persistent profile `.artifacts/browser-use-visual-audit` và `headless: false`. Nó truy cập trực tiếp FE lane 1, đăng nhập demo, click các tab bằng accessible role/name rồi lưu:

- `purchasing-tabs.png`
- `chef-summary-above-plan.png`
- `report-price-tabs.png`
- `admin-data-tabs.png`
- `live-visual-performance.json`

Performance probe xóa resource timing trước từng click và thu API request, long task, CLS, DOM node và table row. `elapsedMs` có chứa khoảng chờ ổn định `450 ms`, vì vậy không dùng trực tiếp giá trị này làm navigation latency budget.

Nếu muốn điều khiển Chrome đã mở sẵn, Chrome đó phải expose remote-debugging và test phải kết nối bằng CDP. Persistent helper hiện tại mở context riêng; không được mô tả nó là attach vào tab Chrome bình thường của người dùng.

`tests/navigation-performance.spec.ts` còn kiểm tra hai hợp đồng lazy-load của sidebar: toàn bộ route module được warm sau idle preload và scheduler phải tắt khi `navigator.connection.saveData` bật. Khi route đã warm, lần click đầu không được mount route-level Suspense fallback. Kết quả Chromium real-stack mới nhất cho tất cả trang sidebar nằm trong `.artifacts/shipyard-live/sidebar-navigation-performance-2026-07-25.json`.

## CI integration

Workflow `.github/workflows/verify.yml` chạy trên cả `push` và `pull_request`. Job `verify` dùng MySQL `8.0`, .NET `9.0.x` và Node `20`, sau đó chạy `npm ci`, backend build/test, kiểm tra EF migration snapshot, tạo và smoke-test MySQL schema, frontend lint và frontend build. Workflow hiện là quality gate; không có workflow deploy riêng trong `.github/workflows/`.
