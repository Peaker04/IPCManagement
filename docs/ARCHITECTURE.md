<!-- generated-by: gsd-doc-writer -->
# Kiến trúc hệ thống

Tổng quan nghiệp vụ và bốn vai trò vận hành nằm tại [DOMAIN.md](DOMAIN.md). Contract phân biệt dữ liệu theo ngày, tuần, snapshot, chứng từ và audit event được duy trì tại [DATA-GRAIN-MATRIX.md](DATA-GRAIN-MATRIX.md). Mọi bảng nguyên liệu và phép aggregate mới phải tuân theo ma trận này. Chuỗi kiểm chứng và nguyên tắc phân xử lỗi giữa UI, FE, API và Database nằm tại [UI-UX-FE-BE-DATABASE-STANDARDIZATION.md](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md).

## Tổng quan

IPC Management là monorepo cho hệ thống quản lý bếp ăn công nghiệp. Hệ thống dùng một backend ASP.NET Core 9 dạng modular monolith, frontend React/Vite/TypeScript và MySQL thông qua Entity Framework Core với Pomelo. Backend nhận request HTTP từ frontend, áp dụng middleware xác thực/ủy quyền/rate limit, điều phối qua controller và service, rồi đọc ghi dữ liệu qua repository/Unit of Work và `IpcManagementContext`.

## Các thành phần chính

```text
Browser
  -> React routes + feature pages
  -> Redux Toolkit store / RTK Query (`frontend/src/api/apiSlice.ts`)
  -> ASP.NET Core middleware pipeline (`backend/src/IPCManagement.Api/Program.cs`)
  -> Feature controller (`backend/src/IPCManagement.Api/Features/*/Controllers`)
  -> Feature service (`backend/src/IPCManagement.Api/Features/*/Services`)
  -> Repositories + Unit of Work (`backend/src/IPCManagement.Api/Data`)
  -> EF Core `IpcManagementContext`
  -> MySQL
```

## Luồng dữ liệu

1. `frontend/src/main.tsx` khởi tạo React và Redux store; `frontend/src/App.tsx` gắn router và toast provider.
2. `frontend/src/routes/AppRouter.tsx` phân biệt route công khai `/login` với các route cần đăng nhập. `ProtectedRoute` kiểm tra session, còn `RoleGuard` kiểm tra permission trước khi render màn hình.
3. Toàn frontend dùng đúng một `frontend/src/api/apiSlice.ts`. Bảy feature owner cùng `workflowDocumentsApi` inject endpoint vào slice này; `frontend/src/api/workflowApi.ts` chỉ là compatibility barrel đăng ký/re-export public contract. Base query gắn Bearer token, xử lý refresh token và dùng `/api` hoặc `VITE_API_BASE_URL` tùy môi trường.
4. `Program.cs` chạy correlation ID, exception middleware, Swagger ở Development, CORS, authentication, rate limiting, authorization và controller mapping.
5. Controller xác thực model và policy, gọi service nghiệp vụ. Service dùng repository/Unit of Work và `IpcManagementContext` để thao tác các entity, migration và audit/workflow.
6. Response JSON được trả về frontend để cập nhật RTK Query cache và giao diện feature tương ứng.

## Các lớp và abstraction quan trọng

| Abstraction | Vị trí | Vai trò |
|---|---|---|
| `Program` | `backend/src/IPCManagement.Api/Program.cs` | Cấu hình host, middleware, JWT, CORS, Swagger và rate limit. |
| `AddBackendServices` | `backend/src/IPCManagement.Api/DependencyInjection.cs` | Đăng ký DbContext, repository, service và security dependency. |
| `IpcManagementContext` | `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs` | EF Core DbContext/registration root cho MySQL; 53 mapping nằm trong 11 file feature-owned `Features/*/Persistence` qua `IEntityTypeConfiguration<T>`. |
| `DishCatalogCache` | `backend/src/IPCManagement.Api/Caching/DishCatalogCache.cs` | Root-owned cache contract dùng chéo Catalog và SampleData; giữ hai key catalog active/all và xóa cả hai sau các mutation liên quan. |
| `IEfTransactionRunner` | `backend/src/IPCManagement.Api/Data/Transactions/` | Chủ sở hữu duy nhất của manual transaction; chạy qua EF execution strategy, clear tracking trước retry/commit verification và yêu cầu verifier ổn định để tránh duplicate side effect. |
| Coordination use-case services | `backend/src/IPCManagement.Api/Features/Coordination/Services/` | Tách customer contract, portion rule, menu schedule, meal quantity plan và order lifecycle thành các shell/policy riêng. |
| `MaterialDemandService` | `backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs` | Tạo nhu cầu nguyên liệu từ kế hoạch sản xuất/BOM. |
| Purchasing use-case services | `backend/src/IPCManagement.Api/Features/Purchasing/Services/` | Workbench, generate-from-demand, supplier decision và submit có port/shell/policy riêng; controller không qua workflow facade. |
| Reports use-case services | `backend/src/IPCManagement.Api/Features/Reports/Services/` | Tách price, demand, purchasing, inventory, audit/data-quality, KPI và aggregate cache theo use case. |
| `JwtTokenService` | `backend/src/IPCManagement.Api/Security/JwtTokenService.cs` | Tạo và xác thực access/refresh token. |
| `AuthService` / `RefreshTokenRepository` | `backend/src/IPCManagement.Api/Features/Auth/Services/AuthService.cs`, `backend/src/IPCManagement.Api/Data/Repositories/RefreshTokenRepository.cs` | Login/rotation chạy trong `IEfTransactionRunner`; thay session cũ cùng device, dọn token đóng và giữ tối đa 10 refresh session active/user. |
| `apiSlice` | `frontend/src/api/apiSlice.ts` | Base query, auth header, refresh session, exact-mutation single-flight và namespace RTK Query cache duy nhất. |
| `workflowApi` compatibility barrel | `frontend/src/api/workflowApi.ts` | Đăng ký/re-export đúng 75 workflow endpoint và 75 public hook từ `workflowDocumentsApi` cùng bảy feature owner; không tạo slice, endpoint hoặc tag registry thứ hai. |
| `MainLayout` | `frontend/src/app/layout/MainLayout.tsx` | App-owned shell cho permission navigation, mobile nav và tuần tự idle preload route module. |
| `AppRouter` / `routeLoaders` / `RoleGuard` | `frontend/src/routes/AppRouter.tsx`, `frontend/src/routes/routeLoaders.ts`, `frontend/src/routes/RoleGuard.tsx` | Routing, route-level lazy loading, cache module đã resolve và giới hạn truy cập theo permission. |

Pomelo bật `EnableRetryOnFailure`; production source chỉ còn một `BeginTransactionAsync(` nằm trong
`EfTransactionRunner`. `IUnitOfWork` chỉ còn trách nhiệm `SaveChangesAsync`, không còn mở transaction.
Convention test khóa cả hai điều kiện này để manual transaction mới không thể lách execution strategy.
Auth cold path được warm read-only trước khi host nhận traffic; không tạo user/session/token giả và readiness
vẫn là nguồn phán quyết nếu database không sẵn sàng.

Request ownership của frontend nằm ở hai lớp. RTK Query gộp subscriber có cùng endpoint/cache key và
`routeDataPreloaders` dùng `ifOlderThan` để pointer/focus/touch không phát lại cùng GET. Với mutation,
`apiSlice` fingerprint method + URL + params + headers + body + access-token generation và chia sẻ đúng
một promise khi request giống hệt còn in-flight; payload khác hoặc lần gọi tuần tự sau khi request kết thúc
vẫn độc lập. Refresh 401 so token đã dùng cho request với token hiện hành: response muộn của token cũ chỉ
retry bằng token mới, không khởi tạo vòng refresh thứ hai. Login, logout và action nhiều bước còn có
synchronous in-flight guard tại interaction owner để tránh xử lý response/UI side effect hai lần.

Sau khi shell đăng nhập ổn định, `MainLayout` preload tuần tự module của các route sidebar mà người dùng có quyền trong các idle slot. Scheduler chỉ warm code, không bulk-fetch dữ liệu; data vẫn được intent-prefetch khi hover, focus hoặc touch. Bulk preload bị bỏ qua khi trình duyệt bật Data Saver hoặc báo mạng 2G. `routeLoaders` giữ component đã resolve để lần render đầu sau preload không quay lại Suspense fallback; nếu người dùng click trước khi preload xong thì fallback có kích thước ổn định vẫn là đường lui.

Trong các workbench nhiều tab, query RTK Query được gate theo panel cần dữ liệu thay vì chạy toàn bộ ở page parent. Weekly Menu split Demand, Production Plan, Purchase Summary, Cost và Dish Materials thành chunk riêng; sau khi route ổn định, các chunk này được preload tuần tự trong idle slot mà không preload API. Weekly, Chef và Warehouse dùng selected view riêng với deferred rendered view: tab strip phản hồi ngay, còn panel cũ được giữ trong boundary cục bộ cho tới frame mới. Shell/sidebar/header không remount; trạng thái pending là overlay tuyệt đối nên không chiếm layout, và transition tôn trọng `prefers-reduced-motion`.

`frontend/src/lib/queryView.ts` là hợp đồng opt-in cho kiến trúc hàm thuần từ data + state sang UI: adapter thuần chuyển RTK
Query snapshot thành `uninitialized`, `loading`, `forbidden`, `error` hoặc `ready`; `ready` giữ riêng
`isRefreshing` và bằng chứng truncation. Empty chỉ được dẫn xuất từ dữ liệu authoritative trong `ready`.
Lint chặn query đã đi qua adapter nhưng vẫn đọc trực tiếp `query.data ?? []`. Hợp đồng đã có test nền;
Material Demand và Warehouse là hai pilot đầu tiên, nên các feature chưa pilot vẫn giữ state handling hiện có.

Frontend giữ cây module hiện tại thay vì đổi tên hàng loạt sang `shared/`. Hai composition
lớn đã được tách theo page model/panel: `frontend/src/features/reports/pages/ReportsPage.tsx` dùng compatibility facade
`useReportsPageModel` trên năm view-model owner; `frontend/src/app/pages/AdminDataPage.tsx` là shell dùng compatibility facade
`useAdminDataPageModel` trên bảy panel-model owner. Các owner hook được gọi vô điều kiện theo thứ tự query cũ để giữ React hook order, cache timing,
URL/permission contract và flat page-model API. CSS global được nạp theo thứ tự tường minh
từ `frontend/src/main.tsx`: `frontend/src/styles/index.css` giữ token/base, `frontend/src/styles/components/*` chứa shell/table/document/
operation/domain/responsive, còn `frontend/src/styles/ui-redesign.css` + `frontend/src/styles/redesign/*` giữ lớp Fiori/demand/
dashboard/responsive. Việc tách file không đổi selector order hay DOM contract.

## Phạm vi API

Các controller/service/DTO/validator được nhóm theo VSA-lite trong 10 slice
`backend/src/IPCManagement.Api/Features/{Admin,Approvals,Auth,Catalog,Coordination,Inventory,Planning,Purchasing,Reports,SampleData}`.
Route dùng prefix `api/`; `MaterialDemandController` công bố action generate cho luồng tạo demand,
còn frontend gọi API qua RTK Query. Contract dùng chung nằm ở `Shared/Contracts`; `Data`, entity,
resource và migration được giữ ngoài feature slice để không làm nhiễu EF history.

## Cấu trúc thư mục

```text
IPCManagement/
├── backend/
│   ├── src/IPCManagement.Api/
│   │   ├── Caching/           cache key/invalidation dùng chéo feature
│   │   ├── Features/          10 vertical slice; controller/service/contract/validator
│   │   ├── Shared/Contracts/  contract dùng chéo slice
│   │   ├── Data/              DbContext, repository, Unit of Work, transaction runner
│   │   ├── Helpers/           mapping, response, validation hỗ trợ
│   │   ├── Middlewares/       exception, correlation, production guard
│   │   ├── Migrations/        EF Core migrations
│   │   ├── Models/Entities/   entity EF giữ ngoài feature slice
│   │   ├── Security/          JWT và current-user context
│   │   └── Resources/         resource dùng chung
│   ├── tests/                 xUnit backend tests
│   └── database/              SQL schema/cleanup/migration hỗ trợ
├── frontend/
│   ├── src/app/               Redux store, app layout và composition page đa-feature
│   ├── src/api/               RTK Query base API + compatibility/types/tag/document modules
│   ├── src/features/          module nghiệp vụ: admin, approvals, chef, coordination, projects,
│   │                          purchasing, reports và warehouse
│   ├── src/components/        component dùng chung/layout/UI
│   ├── src/routes/             route, guard, preload
│   ├── src/lib/                formatter, pagination, status và utility
│   ├── src/styles/             base CSS + component/redesign slices theo thứ tự import
│   └── tests/                 Playwright smoke/UI/performance/visual tests
├── docs/                      tài liệu kỹ thuật và MVP flow
├── .docs/                     tài liệu tham chiếu nghiệp vụ/demo
└── scripts/                   script vận hành/quality gate hiện có
```

Frontend không còn `frontend/src/features/workflow`: core dùng chung nằm ở `frontend/src/api/workflowApi.ts`,
`frontend/src/lib/workflowConfig.ts`, `frontend/src/lib/actionEligibility.ts` và `frontend/src/types/workflow.ts`; page được sở hữu
bởi feature nghiệp vụ tương ứng. Endpoint implementation nằm trong dashboard, reports, purchasing,
warehouse, chef, approvals và admin owner; `workflowDocumentsApi` là owner trung lập cho document overview.
Cache giữ một `workflowCacheTags` registry 22 tag. `AdminDataPage` ở tầng `src/app/pages` vì nó composition
dữ liệu của admin, auth và coordination thay vì thuộc riêng một feature. Cross-feature Projects chỉ dùng
coordination transport/read projection và action contract ở tầng thấp hơn, không import ruột feature Coordination.

Dependency-cruiser áp dụng R1–R6 trên 342 module. Baseline 54 violation đã giảm về file `[]`; strict run
không dùng baseline cũng trả 0 violation. Ngoại lệ duy nhất là compatibility barrel chỉ được import chính xác
các endpoint owner đã liệt kê và phải được review lại ở milestone v1.3.

## Guardrail kiến trúc và workflow closeout

Phase 18 giữ nguyên identity của ba xUnit partial class nhưng chia responsibility theo workflow và fixture:
`WorkflowGenerationTests` có 11 partial definition, `PurchaseHistoryReconciliationTests` có 4 và
`SupplierDecisionWorkflowTests` có 4. Route smoke Playwright được chia thành ba spec cùng năm helper domain
dưới `frontend/tests/support/route-smoke`; discovery cuối vẫn là 17/17 scenario.

`scripts/check-architecture-growth.mjs` và `scripts/architecture-growth-baseline.json` khóa growth theo
baseline đơn điệu. Controller cảnh báo trên 250 dòng hoặc 12 action và buộc plan split trên 400 dòng hoặc
20 action; service cảnh báo trên 600 dòng và buộc plan split trên 1.000 dòng; frontend viết tay cảnh báo
trên 600 dòng; test file trên 1.500 dòng là lỗi. Strict gate còn fail khi có production debt mới/tăng,
test debt, metric/severity xấu đi hoặc baseline không co sau khi source đã giảm. Baseline hiện có đúng
10 finding production; `MaterialDemandService` đã giảm từ 1.470 xuống 1.446 dòng và ceiling cũng giảm theo.

Lượt E2E cuối phát hiện hai lỗi thực mà test tĩnh trước đó chưa chạm tới. `InventoryIssuesController.CreateAsync`
trả lại `Location` hợp lệ cho response create. `MaterialDemandService.GenerateAsync` dùng
`MaterialStockPool` để quy đổi và tiêu thụ cùng một tồn kho dùng chung theo đơn vị BOM, tránh phân bổ lặp
cùng lượng tồn cho nhiều demand line. API route, OpenAPI/generated TypeScript, public hook, cache key/tag
và UI behavior không đổi.
