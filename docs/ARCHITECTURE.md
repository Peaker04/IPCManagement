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
  -> Controllers (`backend/src/IPCManagement.Api/Controllers`)
  -> Domain services (`backend/src/IPCManagement.Api/Services`)
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
| `IpcManagementContext` | `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs` | EF Core DbContext cho MySQL và các entity nghiệp vụ. |
| `CoordinationService` | `backend/src/IPCManagement.Api/Services/CoordinationService.cs` | Điều phối customer, menu, số suất và sign-off. |
| `MaterialDemandService` | `backend/src/IPCManagement.Api/Services/Workflow/MaterialDemandService.cs` | Tạo nhu cầu nguyên liệu từ kế hoạch sản xuất/BOM. |
| `PurchaseRequestWorkflowService` | `backend/src/IPCManagement.Api/Services/Workflow/PurchaseRequestWorkflowService.cs` | Chuyển demand thiếu hụt thành quy trình đề xuất mua. |
| `WorkflowReportService` | `backend/src/IPCManagement.Api/Services/Workflow/WorkflowReportService.cs` | Tổng hợp tồn kho, demand, mua hàng, biến động và audit. |
| `JwtTokenService` | `backend/src/IPCManagement.Api/Security/JwtTokenService.cs` | Tạo và xác thực access/refresh token. |
| `apiSlice` | `frontend/src/api/apiSlice.ts` | Base query, auth header, refresh session và RTK Query cache. |
| `AppRouter` / `routeLoaders` / `RoleGuard` | `frontend/src/routes/AppRouter.tsx`, `frontend/src/routes/routeLoaders.ts`, `frontend/src/routes/RoleGuard.tsx` | Routing, route-level lazy loading, cache module đã resolve và giới hạn truy cập theo permission. |

Sau khi shell đăng nhập ổn định, `MainLayout` preload tuần tự module của các route sidebar mà người dùng có quyền trong các idle slot. Scheduler chỉ warm code, không bulk-fetch dữ liệu; data vẫn được intent-prefetch khi hover, focus hoặc touch. Bulk preload bị bỏ qua khi trình duyệt bật Data Saver hoặc báo mạng 2G. `routeLoaders` giữ component đã resolve để lần render đầu sau preload không quay lại Suspense fallback; nếu người dùng click trước khi preload xong thì fallback có kích thước ổn định vẫn là đường lui.

Trong các workbench nhiều tab, query RTK Query được gate theo panel cần dữ liệu thay vì chạy toàn bộ ở page parent. Weekly Menu split Demand, Production Plan, Purchase Summary, Cost và Dish Materials thành chunk riêng; sau khi route ổn định, các chunk này được preload tuần tự trong idle slot mà không preload API. Weekly, Chef và Warehouse dùng selected view riêng với deferred rendered view: tab strip phản hồi ngay, còn panel cũ được giữ trong boundary cục bộ cho tới frame mới. Shell/sidebar/header không remount; trạng thái pending là overlay tuyệt đối nên không chiếm layout, và transition tôn trọng `prefers-reduced-motion`.

## Phạm vi API

Các controller được nhóm theo nghiệp vụ trong `backend/src/IPCManagement.Api/Controllers`: auth, coordination, menu/dish/catalog, material demand, production plan, approvals, purchasing, inventory/warehouse, sample data và workflow reports. Route dùng prefix `api/`; `MaterialDemandController` công bố action generate cho luồng tạo demand, còn frontend gọi API qua RTK Query.

## Cấu trúc thư mục

```text
IPCManagement/
├── backend/
│   ├── src/IPCManagement.Api/
│   │   ├── Controllers/       HTTP boundary và policy
│   │   ├── Data/              DbContext, repository, Unit of Work
│   │   ├── Helpers/           mapping, response, validation hỗ trợ
│   │   ├── Middlewares/       exception, correlation, production guard
│   │   ├── Migrations/        EF Core migrations
│   │   ├── Models/            entity, DTO, validator
│   │   ├── Security/          JWT và current-user context
│   │   └── Services/          nghiệp vụ và workflow
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
│   ├── src/styles/             CSS toàn cục
│   └── tests/                 Playwright smoke/UI/performance/visual tests
├── docs/                      tài liệu kỹ thuật và MVP flow
├── .docs/                     tài liệu tham chiếu nghiệp vụ/demo
└── scripts/                   script vận hành/quality gate hiện có
```

Frontend không còn `src/features/workflow`: core dùng chung nằm ở `src/api/workflowApi.ts`,
`src/lib/workflowConfig.ts`, `src/lib/actionEligibility.ts` và `src/types/workflow.ts`; page được sở hữu
bởi feature nghiệp vụ tương ứng. `AdminDataPage` ở tầng `src/app/pages` vì nó composition dữ liệu của
admin, auth và coordination thay vì thuộc riêng một feature.
