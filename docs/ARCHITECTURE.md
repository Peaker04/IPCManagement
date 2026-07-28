<!-- generated-by: gsd-doc-writer -->
# Kiến trúc hệ thống

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
3. Các feature inject endpoint vào `frontend/src/api/apiSlice.ts`. Base query gắn Bearer token, xử lý refresh token và dùng `/api` hoặc `VITE_API_BASE_URL` tùy môi trường.
4. `Program.cs` chạy correlation ID, exception middleware, Swagger ở Development, CORS, authentication, rate limiting, authorization và controller mapping.
5. Controller xác thực model và policy, gọi service nghiệp vụ. Service dùng repository/Unit of Work và `IpcManagementContext` để thao tác các entity, migration và audit/workflow.
6. Response JSON được trả về frontend để cập nhật RTK Query cache và giao diện feature tương ứng.

## Các lớp và abstraction quan trọng

| Abstraction | Vị trí | Vai trò |
|---|---|---|
| `Program` | `backend/src/IPCManagement.Api/Program.cs` | Cấu hình host, middleware, JWT, CORS, Swagger và rate limit. |
| `AddBackendServices` | `backend/src/IPCManagement.Api/DependencyInjection.cs` | Đăng ký DbContext, repository, service và security dependency. |
| `IpcManagementContext` | `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs` | EF Core DbContext/registration root cho MySQL; feature-owned mapping nằm trong `Features/*/Persistence`. Auth là lát đầu đã chuyển sang `IEntityTypeConfiguration<T>`. |
| Coordination use-case services | `backend/src/IPCManagement.Api/Features/Coordination/Services/` | Tách customer contract, portion rule, menu schedule, meal quantity plan và order lifecycle thành các shell/policy riêng. |
| `MaterialDemandService` | `backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs` | Tạo nhu cầu nguyên liệu từ kế hoạch sản xuất/BOM. |
| Purchasing use-case services | `backend/src/IPCManagement.Api/Features/Purchasing/Services/` | Workbench, generate-from-demand, supplier decision và submit có port/shell/policy riêng; controller không qua workflow facade. |
| Reports use-case services | `backend/src/IPCManagement.Api/Features/Reports/Services/` | Tách price, demand, purchasing, inventory, audit/data-quality, KPI và aggregate cache theo use case. |
| `JwtTokenService` | `backend/src/IPCManagement.Api/Security/JwtTokenService.cs` | Tạo và xác thực access/refresh token. |
| `apiSlice` | `frontend/src/api/apiSlice.ts` | Base query, auth header, refresh session và RTK Query cache. |
| `AppRouter` / `routeLoaders` / `RoleGuard` | `frontend/src/routes/AppRouter.tsx`, `frontend/src/routes/routeLoaders.ts`, `frontend/src/routes/RoleGuard.tsx` | Routing, route-level lazy loading, cache module đã resolve và giới hạn truy cập theo permission. |

Sau khi shell đăng nhập ổn định, `MainLayout` preload tuần tự module của các route sidebar mà người dùng có quyền trong các idle slot. Scheduler chỉ warm code, không bulk-fetch dữ liệu; data vẫn được intent-prefetch khi hover, focus hoặc touch. Bulk preload bị bỏ qua khi trình duyệt bật Data Saver hoặc báo mạng 2G. `routeLoaders` giữ component đã resolve để lần render đầu sau preload không quay lại Suspense fallback; nếu người dùng click trước khi preload xong thì fallback có kích thước ổn định vẫn là đường lui.

Trong các workbench nhiều tab, query RTK Query được gate theo panel cần dữ liệu thay vì chạy toàn bộ ở page parent. Weekly Menu split Demand, Production Plan, Purchase Summary, Cost và Dish Materials thành chunk riêng; sau khi route ổn định, các chunk này được preload tuần tự trong idle slot mà không preload API. Weekly, Chef và Warehouse dùng selected view riêng với deferred rendered view: tab strip phản hồi ngay, còn panel cũ được giữ trong boundary cục bộ cho tới frame mới. Shell/sidebar/header không remount; trạng thái pending là overlay tuyệt đối nên không chiếm layout, và transition tôn trọng `prefers-reduced-motion`.

`frontend/src/lib/queryView.ts` là hợp đồng opt-in cho kiến trúc `f(data, state)`: adapter thuần chuyển RTK
Query snapshot thành `uninitialized`, `loading`, `forbidden`, `error` hoặc `ready`; `ready` giữ riêng
`isRefreshing` và bằng chứng truncation. Empty chỉ được dẫn xuất từ dữ liệu authoritative trong `ready`.
Lint chặn query đã đi qua adapter nhưng vẫn đọc trực tiếp `query.data ?? []`. Hợp đồng đã có test nền;
Material Demand và Warehouse là hai pilot đầu tiên, nên các feature chưa pilot vẫn giữ state handling hiện có.

Frontend giữ cây module hiện tại thay vì đổi tên hàng loạt sang `shared/`. Hai composition
lớn đã được tách theo page model/panel: Reports page còn 799 dòng; Admin Data page chỉ
là shell 74 dòng với model và bảy panel riêng. CSS global được nạp theo thứ tự tường minh
từ `main.tsx`: `styles/index.css` giữ token/base, `styles/components/*` chứa shell/table/document/
operation/domain/responsive, còn `styles/ui-redesign.css` + `styles/redesign/*` giữ lớp Fiori/demand/
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
│   │   ├── Features/          10 vertical slice; controller/service/contract/validator
│   │   ├── Shared/Contracts/  contract dùng chéo slice
│   │   ├── Data/              DbContext, repository, Unit of Work
│   │   ├── Helpers/           mapping, response, validation hỗ trợ
│   │   ├── Middlewares/       exception, correlation, production guard
│   │   ├── Migrations/        EF Core migrations
│   │   ├── Models/Entities/   entity EF giữ ngoài feature slice
│   │   ├── Security/          JWT và current-user context
│   │   └── Resources/         resource dùng chung
│   ├── tests/                 xUnit backend tests
│   └── database/              SQL schema/cleanup/migration hỗ trợ
├── frontend/
│   ├── src/app/               Redux store, hooks và composition page đa-feature
│   ├── src/api/               RTK Query base API + workflow/dish endpoint modules dùng chung
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

Frontend không còn `src/features/workflow`: core dùng chung nằm ở `src/api/workflowApi.ts`,
`src/lib/workflowConfig.ts`, `src/lib/actionEligibility.ts` và `src/types/workflow.ts`; page được sở hữu
bởi feature nghiệp vụ tương ứng. `AdminDataPage` ở tầng `src/app/pages` vì nó composition dữ liệu của
admin, auth và coordination thay vì thuộc riêng một feature.
