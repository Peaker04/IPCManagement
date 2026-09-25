<!-- generated-by: gsd-doc-writer -->
# Kiểm thử

## Framework và setup

Backend dùng xUnit `2.9.2`, FluentAssertions, NSubstitute, `Microsoft.AspNetCore.Mvc.Testing`, EF Core InMemory/SQLite và test project ở `backend/tests/`. Frontend dùng Vitest `4.1.10`, Testing Library, jsdom và Playwright `1.60.0` cho browser/E2E tests.

Sau khi chạy `npm ci` và `dotnet restore`, có thể chạy test theo workspace tương ứng. Frontend unit test dùng setup `frontend/src/test/setup.ts`; Playwright dùng cấu hình `frontend/playwright.config.ts` và Chromium.

## Chạy tests

Gate tĩnh từ project root:

```bash
npm run check:architecture-growth
npm run check:api-contract
npm run test:frontend-unit-launcher
npm run verify
```

`npm run test:frontend-unit-launcher` khóa argv của canonical frontend Vitest launcher: invocation mặc định không chèn separator thừa và forwarded arguments chỉ có đúng một npm separator. Gate nhỏ này chạy riêng trong CI trước broad frontend unit suite.

`FeatureDependencyConventionTests` khóa dependency DAG backend và ceiling cho bốn cạnh legacy;
ceiling chỉ được giảm, không được tăng. Growth gate chạy strict theo
`scripts/architecture-growth-baseline.json`: test file trên 1.500 dòng, production debt mới,
metric/severity tăng hoặc baseline không co lại sau cải thiện đều làm gate thất bại. Baseline là inventory chính
xác của debt hiện hành, không phải waiver: Wave 6 reconciliation khóa 9 findings hiện có (2 `PLAN_REQUIRED`,
7 `WARNING`) và mọi tăng trưởng tiếp theo vẫn fail. CI còn so baseline với commit gốc của push/PR để hiển thị
expansion ngay trong change đưa debt vào. Contract gate build vào
`.artifacts/contract-build/api`, nên có thể chạy trong khi lane API Release vẫn listen mà không dừng
process hoặc khóa DLL của lane.

Phase 42 có hai lane rõ ràng trong cùng test class:

- `Category!=EvidenceOwned`: 50 contract tests hermetic, chạy trong clean CI và không cần ignored local artifacts.
- `Category=EvidenceOwned`: 15 cases dùng archive/approval receipts dưới `.artifacts/shipyard-live/phase-04.2-execution`; chỉ chạy ở evidence-bearing Windows lane/aggregate runner.

Không exclude toàn bộ `Phase42AggregateVerificationTests` khỏi CI. Case dùng local evidence phải gắn trait
`EvidenceOwned`; case source/config thuần phải giữ hermetic để clean checkout thực thi được.

Toàn bộ .NET build/test output mặc định được gom bởi root `Directory.Build.props` vào `.artifacts/dotnet`. Gate cô lập phải dùng `--artifacts-path .artifacts/dotnet/<run-id>` hoặc `ArtifactsPath` tuyệt đối từ repo root; không dùng `BaseOutputPath` tương đối dưới `backend/`. Với `dotnet ef`, luôn truyền `--msbuildprojectextensionspath` trỏ tới `obj/<project-name>` bên dưới artifacts path tương ứng; nếu không EF có thể báo thiếu target `GetEFProjectMetadata`. Source-scanning tests không được suy ra repository chỉ từ ancestry của `AppContext.BaseDirectory`, vì centralized output không còn nằm dưới `backend/`; dùng working directory và hỗ trợ cả repository-root/backend-root layout. Phase 42 focused contract và solution build còn kiểm tra output mới không chứa recursive `backend/tests`, `.tmp-*`, `.artifactslk*` hoặc `bin-phase*`.

`npm run test:ignore-policy` khóa ranh giới source/generated/secrets cho `.gitignore` và `.dockerignore`, đồng thời fail nếu tracked-but-ignored debt xuất hiện ngoài năm owner legacy hoặc vượt ceiling hiện hành. CI chạy gate này ngay sau `npm ci`; giảm debt phải hạ ceiling, không được nâng để grandfather file mới. GSD state ngoài workstream standardization vẫn local-by-default; raw screenshot/trace/build evidence luôn ignored.

`npm run test:phase05-fixture-determinism` chạy production `Phase05WeeklyMenuFixtureTool` hai lần trong OS temp, yêu cầu ANV/DAV byte-identical giữa hai lượt, khác nhau giữa hai khách hàng, và giữ ba sheet `25k/30k/34k`, tuần sáu ngày cùng menu hai ca. Production workbook builder và fixture population owner đặt cùng fixed ZIP timestamp cho mọi entry; thay đổi nội dung fixture phải cập nhật builder/test/evidence hash trong cùng reviewed batch, không reseal thủ công.

`PersistenceReliabilityConventionTests` khóa production source chỉ còn một
`BeginTransactionAsync(` trong `EfTransactionRunner` và MySQL luôn bật `EnableRetryOnFailure`.
`EfTransactionRunnerTests` dùng SQLite retry strategy để chứng minh retry bắt đầu với tracking sạch
và không nhân đôi database side effect.

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

CI loại các validator gắn với campaign/evidence lịch sử khỏi unit gate mặc định: `phase35GeometryDenominator`, `pcActionCompletenessDisposition`, `uiOwnershipInstrumentationContract` và hidden-state baseline trong `uiStatePurityContract`. Chúng đọc artifact/ledger hoặc opaque tuple của Phase 20/26/35, nên source hợp lệ ở campaign sau không được làm CI sản phẩm đỏ. Khi audit lại đúng campaign, chạy focused test trong workspace sở hữu artifact và regenerate/review ledger; không sửa hash, số dòng hay tuple thủ công chỉ để lấy PASS. Các behavior, accessibility, permission, query-boundary và source-inventory contract hiện hành vẫn chạy trong CI. Root `npm run verify` dùng backend filter `Category!=EvidenceOwned`, build frontend trước unit tests để emitted-asset contracts có `dist`, và launcher mặc định `CI=true`; `test:ui-completeness` là campaign gate riêng, không phải clean product gate.

Frontend Playwright từ `frontend/`:

```bash
npm run test:smoke
npm run test:controls
npm run test:ui-measurements
npm run test:performance
npm run test:visual
```

`test:ui-measurements` là gate UI chuẩn cho agent: fixture read-only mở các route IPCManagement với
năm viewport desktop canon, đo DOM và ghi `frontend/test-results/ui-audit-*.json`. Dùng report JSON để
phán quyết; screenshot (nếu một browser run có lưu) chỉ dành cho reviewer, không phải oracle PASS/FAIL.
`test:ui-audit` chỉ còn là alias tương thích của lệnh này.

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

Khi cần đối chiếu terminal state của lifecycle đầy đủ trên sandbox `ipc_e2e_template`, dùng database tool chỉ đọc sau browser gate:

```powershell
dotnet run --project backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj --no-build -- lifecycle-evidence --settings backend/src/IPCManagement.Api/appsettings.json --database ipc_e2e_template
```

Lệnh chỉ chấp nhận database evidence được allow-list và kiểm đếm phiếu xuất đã bếp ký, line nguồn, phiếu trả đã kho nhận và yêu cầu cấp bổ sung đã cấp đủ; không reset, seed hay mutate lane.

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
- Frontend unit/component test đặt cạnh module với hậu tố test TypeScript/TSX; dùng Testing Library cho component và Vitest cho model/utility.
- Adapter query-state phải có table-driven test cho đủ uninitialized, loading, ready-empty, ready-success, refreshing, partial/truncation, forbidden và error. `src/lib/queryView.test.ts` là contract test nền; mỗi feature pilot phải bổ sung component/browser assertion cho presentation tương ứng.
- Cross-module contract mới đặt trong `frontend/tests/contracts/`; các contract còn ở root `frontend/tests` là grandfathered debt và không được tăng.
- Campaign/evidence validator đặt trong `frontend/tests/evidence/`; default CI loại cả directory này, operator chạy focused trong workspace sở hữu artifact.
- Browser scenarios mới đặt trong `frontend/tests/browser/` với hậu tố spec TypeScript. Các Playwright spec/snapshot root hiện tại giữ nguyên tạm thời vì Phase 27/28 fixtures pin exact path; chỉ move trong một lineage migration riêng.
- Shared browser/cross-module helper đặt trong `frontend/tests/support/`, fixture trong `frontend/tests/fixtures/`.
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
`.artifacts/shipyard-live/current-runtime-desktop-2026-07-27/`; yêu cầu cốt lõi là sub-tab
Biến động giá chỉ gọi đúng endpoint aggregate đang active và tab Quản trị dữ liệu
không dựng dialog BOM khi đóng.

Regression contract `src/app/operationalPagePerformanceContracts.test.ts` còn khóa query gating cho Weekly Menu, Chef và Warehouse, controlled idle preload của các panel Weekly, cùng panel shell chống layout jump. Browser-use live phải kiểm tra selected tab cập nhật ngay trong khi panel cũ còn hiện với `aria-busy`, không có API của tab ẩn, vòng chuyển lại dùng cache, CLS dưới `0.02` và reduced motion làm transition về `0s`. Evidence gần nhất: `.artifacts/shipyard-live/tab-performance-controlled-lazy-2026-07-25.json`.

### Browser-use headed và chụp evidence (snapshot desktop 27/07/2026)

Từ project root, sau khi xác nhận các port `3001`, `8001`, `8090` đang listen và
`/health/ready` xanh cho cả database/migration, chạy helper của snapshot này:

```powershell
$env:K6_PASSWORD = '<credential hien tai; khong commit>'
node .artifacts/shipyard-live/current-runtime-desktop-audit.mjs
Remove-Item Env:K6_PASSWORD
```

`agent-browser` không có trong PATH ở lần kiểm tra 27/07 nên helper Playwright là fallback.
Helper dùng Google Chrome headed, truy cập trực tiếp FE/API lane thật và không route/mock request.
Credential phải lấy từ environment hoặc Shipyard local config đã xoay; không thử `admin/admin`.

Phạm vi của snapshot này chỉ là website desktop: `1365×900` và `1440×900`.
Mobile chưa nằm trong gate của lượt 27/07. Helper đi 10 route, reset resource/performance probe trước mỗi
navigation và lưu:

- `current-runtime-desktop-audit.json`
- 20 screenshot theo `{viewport}-{route}.png`
- `warehouse-desktop-cls-probe.json` cùng screenshot cold/warm khi cần xác minh CLS outlier

Performance probe thu API response, request failure, console/page error, long task, CLS, DOM/table rows
và horizontal overflow. `elapsedMs` có chứa khoảng chờ ổn định nên không dùng trực tiếp
làm navigation latency budget.

`frontend/playwright.config.ts` bật `VITE_ENABLE_MOCK_LOGIN=true`; các spec visual/snapshot dưới
`frontend/tests` hữu ích cho contract cục bộ nhưng không được thay thế gate runtime thật. Không tự
update snapshot cũ để làm Bước 10 xanh.

Nếu muốn điều khiển Chrome đã mở sẵn, Chrome đó phải expose remote-debugging và test phải kết nối bằng CDP. Persistent helper hiện tại mở context riêng; không được mô tả nó là attach vào tab Chrome bình thường của người dùng.

`tests/browser/navigation-performance.spec.ts` còn kiểm tra hai hợp đồng lazy-load của sidebar: toàn bộ route module được warm sau idle preload và scheduler phải tắt khi `navigator.connection.saveData` bật. Khi route đã warm, lần click đầu không được mount route-level Suspense fallback. Kết quả Chromium real-stack mới nhất cho tất cả trang sidebar nằm trong `.artifacts/shipyard-live/sidebar-navigation-performance-2026-07-25.json`.

### Gate duplicate request

Các regression tại `src/api/apiSlice.requestDeduplication.test.ts`,
`src/routes/routeDataPreloaders.test.ts`, `src/app/session/logoutSession.test.ts`,
`src/features/auth/pages/LoginPage.feedback.test.tsx` và
`src/features/coordination/components/order-table.request-deduplication.test.tsx` khóa:

- subscriber cùng endpoint/cache key chỉ phát một GET;
- exact mutation concurrent chỉ phát một network request, trong khi payload khác và lần gọi tuần tự vẫn độc lập;
- 401 đến muộn từ access token cũ không tạo refresh lần hai;
- login/logout/action và ô số suất thực tế không double-submit hoặc ghi theo từng keystroke;
- pointer/focus/touch prefetch dùng chung cache owner.

Browser gate current-source chạy Google Chrome headed đủ năm viewport:

```powershell
Set-Location frontend
npx playwright test tests/browser/request-deduplication.spec.ts --headed
```

Spec dùng read-only API stub, lưu method + normalized URL, screenshot cuối và console/page error trong
`.artifacts/shipyard-live/request-deduplication-20260803/`. Nó fail nếu một request key lặp trong cùng
bootstrap + intent-prefetch + navigation window; đây không thay thế mutation E2E nối backend/database.

### Ma trận viewport hiện hành

Ma trận duy nhất được khai trong `MEMORY.md`. Các evidence lịch sử giữ nguyên viewport
thực tế của run và không được sửa ngược để giả thành coverage hiện hành.

### Gate Phase 17 — Frontend ownership (29/07/2026)

- Mục tiêu của gate là khóa ownership của API slice, public hook/cache contract, dependency boundary và warm-navigation behavior.
- Kết quả lịch sử nằm trong `HISTORY.md`; artifact và SHA nằm trong `docs/EVIDENCE-INDEX.md`.

### Gate Phase 18 — Guardrails và weekly E2E (29/07/2026)

- Mục tiêu của gate làm rõ architecture-growth, weekly import, lifecycle thiếu → mua → nhập → cấp → Bếp xác nhận, reload render và rollback guard.
- Kết quả lịch sử nằm trong `HISTORY.md`; artifact và SHA nằm trong `docs/EVIDENCE-INDEX.md`. Dùng `scripts/Assert-Phase18Evidence.ps1` để kiểm tra artifact read-only.

### Gate grain ngày/tuần và lifecycle (30/07/2026)

- Contract cần kiểm tra nằm trong `docs/DATA-GRAIN-MATRIX.md`. Test phải phân biệt nhu cầu theo
  `serviceDate + customerId + priceTierAmount + ingredientId + unitId`, tổng BOM tuần, current-stock
  snapshot, document source-line và stock movement audit event.
- Bộ số gate hiện hành và lệnh chạy lại chỉ nằm trong `MEMORY.md`; artifact và SHA chỉ nằm trong `docs/EVIDENCE-INDEX.md`.
- Fixture `Bột nở` là regression oracle cho việc phân biệt dòng khác ngày, aggregate BOM source-line, current-stock snapshot và movement audit; không deduplicate theo tên.
- Không rerun sanitizer/seed/import chỉ để chạy gate này. Nếu cần E2E mới, boot source-backed,
  xác minh `/health/ready` đọc đúng `ipc_lane1`, sau đó đối chiếu FE → API → DB → FE reload.

### Gate NFR auth và accessibility/dialog

- `AuthServiceTests` khóa refresh rotation tại public service seam: tài khoản inactive bị từ chối không tạo
  successor, trạng thái user/token được kiểm lại trong transaction và successor giữ `DeviceInfo`. Test unit này
  không thay relational two-connection proof cho concurrent reuse; claim đó giữ `NEEDS_EVIDENCE` nếu chưa có
  disposable database authority.
- `frontend/tests/uiAuditAxe.test.ts` là negative-control gate cho contrast: serious/critical axe findings không
  được bỏ chỉ vì placeholder thuộc allowlist màu hoặc text/placeholder khác màu. Browser axe vẫn là oracle render;
  source-string guards không thay thế.
- `ApprovalDecisionDialog.test.tsx` khóa shared Dialog focus trap, pending veto, rejection validation và dirty
  discard confirmation trong cùng blocking layer. Protected approval mutation vẫn cần UI → API → DB → reload
  evidence trên business item được cấp quyền; component tests không tự chứng nhận lifecycle.
- `RateLimitRejectionWriterTests` khóa response `429` và chỉ phát `Retry-After` khi native limiter lease cung cấp
  delay; không tự chế thời gian retry. Backend hiện direct-host nên forwarded-header behavior không nằm trong
  runtime contract; khi thêm reverse proxy phải có trusted/untrusted proxy integration tests riêng.
- `SessionTimeoutModal.test.tsx` và `LoginPage.feedback.test.tsx` khóa reauthentication continuity: giữ
  pathname/query/hash của route nội bộ, từ chối URL external/protocol-relative/không có slash và login-loop,
  rồi để `ProtectedRoute`/`ModeGuard`/`RoleGuard` xử lý quyền hiện hành sau login.
- `authHelpers.test.ts` khóa access token và user metadata trong tab-scoped `sessionStorage`, đồng thời xóa auth
  metadata legacy khỏi `localStorage`; refresh cookie vẫn không lộ cho JavaScript. `IdleSessionGuard.test.tsx`
  dùng fake timers khóa 60 phút idle, cảnh báo 2 phút, trusted-activity reset, continue-session và logout đúng một lần.
  Focused source evidence không thay host/browser privacy verification.
- `AuthServiceTests` khóa configurable active-session cap mặc định 3 và successor kế thừa exact family expiry;
  repeated rotation vì vậy không sliding quá 24 giờ mặc định. `AdminEmployeeServiceTests` dùng nhiều session,
  already-revoked và other-user controls để khóa cả Update/UpdateStatus chỉ revoke đúng session của user bị khóa.
  Login/refresh/deactivate source cùng lấy MySQL user-row lock, nhưng concurrent login-cap và deactivate interleavings
  vẫn NEEDS_EVIDENCE tới khi có relational two-connection gate.
- `formatters.test.ts` và `calendarDateBoundary.test.ts` khóa `Asia/Ho_Chi_Minh`, UTC→ICT qua biên ngày/năm và
  date-only/service-date không bị lệch theo timezone máy. VND/quantity/date convergence vẫn thuộc shared formatter.
- Auth log-minimization source không còn routine username, User-Agent/device hoặc token/hash-prefix templates.
  `AuthServiceTests` và `AuthControllerTests` dùng synthetic username/password/User-Agent markers để khóa không lộ
  qua routine log rendering; host access/rotation/30-day retention tiếp tục `NEEDS_EVIDENCE`.

### Gate D06 browser support

- `browserSupportPolicy.test.ts` khóa full denominator 672 cells: Windows 10/11 × Chrome/Edge × current/previous × ba desktop viewport × normal/reduced motion × 100/200% × bảy critical workflows. OS/version band nằm trong evidence identity; NVDA là subset riêng.
- `tests/config/browser-support.config.ts` tạo bốn browser/motion projects không có versioned device descriptor hoặc `webServer`, giữ native installed-browser UA và không tự start server. Runner nhận operator-supplied URL/source ref/run ID/OS/version band; các metadata này chưa phải runtime identity verification. `browser-support-evidence.spec.ts` chỉ preflight login/reflow/overflow/native-UA trên ba viewport. Root-font-size 200% chỉ là text-reflow proxy, không phải real browser-zoom/NVDA evidence.
- Browser current/previous version receipts, workflow actions, keyboard/focus, real zoom, NVDA, console/network và protected mutations vẫn `NEEDS_EVIDENCE`; preflight PASS không được nâng thành browser-support PASS.

### Gate NFR performance, health và recovery

- `PerformanceQualificationContractTests` khóa đúng phạm vi read-only probe: 10 RPS/15 phút, burst 30 RPS/60 giây, zero dropped iterations, required run ID và run-unique output. Probe dùng một identity/chỉ GET nên không chứng nhận 50 users, 20 active workers, 80/20 writes, import, p99 class budgets hoặc business invariants; full D04 qualification còn OPEN.
- `HealthResponseWriterTests` khóa JSON machine-readable và `HealthEndpointOptions` lock live/ready tag partitions cùng ready 200/200/503. Đây là source options contract; real HTTP probe/outage/alert delivery vẫn cần authorized runtime drill.
- `RestoreOracle.ps1` tách data-integrity equality khỏi GTID/binlog provenance. CHECKSUM TABLE chỉ lưu checksum value nên source/target database khác tên không false-fail; missing provenance hoặc malformed checksum fail closed. `RecoveryScriptContractTests` chạy synthetic PowerShell controls; không thay encrypted off-host restore/RPO/RTO evidence.

### Gate D09 .NET 9 servicing

- Root `global.json` selects minimum SDK `9.0.313` within the 9.0.3xx `latestPatch` band; the recorded local run observed 9.0.313, while CI installs floating supported `9.0.x`. Microsoft ASP.NET/EF production and test packages plus CI `dotnet-ef` are coherent at `9.0.20`. `System.IdentityModel.Tokens.Jwt 8.19.2` is the required direct dependency for JwtBearer 9.0.20; unrelated packages remain unchanged.
- Restore PASS; isolated API build PASS with 0 warnings/errors; focused auth/authorization/config/health/transaction/repository/admin/rate-limit aggregate 49/49 PASS under the observed local SDK 9.0.313. `dotnet-ef 9.0.20 migrations has-pending-model-changes` reports no model change. NuGet vulnerable scan reports none from configured sources.
- Broad non-MySQL test attempt executed 1,226 tests and returned 15 failures in inherited fixture/lineage owners (SQLite schema missing `IsOperationalActive`, stale migration count 76 vs 77, MRX expected exception ordering, Roslyn source-generator partial implementation); it is not a D09 full-suite PASS and those failures were not edited in this servicing lane.
- OpenAPI generation completed successfully, but generated contract bytes differ from the already dirty working-copy contract files; originals were restored exactly. Therefore API contract parity is `NEEDS_RECONCILIATION`, not PASS, until the owning API-contract lane disposes those inherited changes.

## CI integration

Workflow `.github/workflows/verify.yml` chạy trên cả `push` và `pull_request`. Job `verify` dùng MySQL `8.0`, .NET `9.0.x` và Node `22`, sau đó chạy `npm ci`, backend build/test, kiểm tra EF migration snapshot, tạo và smoke-test MySQL schema, frontend lint và frontend build. Workflow hiện là quality gate; không có workflow deploy riêng trong `.github/workflows/`.
