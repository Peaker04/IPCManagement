<!-- generated-by: gsd-doc-writer -->
# Triển khai

## Deployment targets

- **Frontend trên Vercel:** root `vercel.json` là file cấu hình duy nhất — chọn framework Vite, chạy `npm run build:fe`, lấy artifact ở `frontend/dist`, khai rewrite SPA và security header (nosniff, `X-Frame-Options`, Referrer-Policy, HSTS, CSP). `frontend/vercel.json` **đã bị xóa ở P1.6** vì Vercel chỉ đọc file nằm tại Root Directory; rewrite SPA khai trong đó chưa từng có hiệu lực, deep-link sống được là nhờ preset Vite mặc định.
- **Backend ASP.NET Core:** repository có project `backend/src/IPCManagement.Api/IPCManagement.Api.csproj`, root `Dockerfile` multi-stage cho .NET 9 và các file cấu hình mẫu `backend/src/IPCManagement.Api/appsettings.Demo.example.json`, `backend/src/IPCManagement.Api/appsettings.Lan.example.json`, `backend/src/IPCManagement.Api/appsettings.Production.example.json`. Chưa có GitHub Actions deployment workflow hoặc provider-specific backend manifest; image/deployment backend vẫn cần được phát hành riêng trên host .NET/MySQL phù hợp.

<!-- VERIFY: Tên project/team/domain Vercel và host backend production phải được xác nhận trong tài khoản triển khai thực tế. -->

## .NET servicing baseline

Backend remains `net9.0`. The servicing lane uses SDK `9.0.313` via root `global.json`, Microsoft ASP.NET/EF packages `9.0.20`, IdentityModel JWT `8.19.2`, Pomelo `9.0.0` and CI `dotnet-ef 9.0.20`. Rollback is the prior build artifact/package graph; no schema rollback is involved because this servicing change creates no model or migration change. .NET 10 LTS remains a separate compatibility/runtime lane and must not be combined with business/schema changes.

## Build pipeline

`.github/workflows/verify.yml` là quality gate, không phải deployment workflow. Pipeline chạy một lần cho pull request vào `main`, chạy lại trên commit đã merge/push trực tiếp vào `main`, và hỗ trợ `workflow_dispatch` khi cần chạy thủ công. Không chạy đồng thời cả sự kiện `push` và `pull_request` cho cùng commit feature branch.

CI dùng SDK đúng theo root `global.json`, Node 22 và root `package-lock.json`. Thứ tự gate là architecture advisory → backend build/contract/migration/MySQL → frontend lint/dependency/build/route-budget advisory/unit test. Integration MySQL bị loại khỏi lượt backend chung và chạy đúng một lần ở bước riêng; route budget chạy trước Vitest để regression bundle được báo sớm. Architecture line-count và route budget là heuristic diagnostics (`continue-on-error`) vì lịch sử cho thấy chúng làm chặn release bởi baseline/count drift dù behavior suite xanh; build, generated contract, migration/schema, backend/frontend tests, lint và dependency rules vẫn fail-closed. Test result backend được upload ở bước `if: always()` cuối pipeline. Hook `.husky/pre-push` chạy production build và đúng frontend unit suite của CI trước khi gửi commit lên remote; hook không thay thế backend/MySQL CI.

Quy trình xử lý CI đỏ:

1. Mở **step đầu tiên thất bại** và phân loại `product regression`, `generated artifact drift`, `migration/schema drift`, `architecture baseline`, hoặc `budget regression`; không sửa bằng rerun mù.
2. Chạy lại đúng command hiển thị trong workflow ở local với Node/.NET từ `package.json`, `frontend/package.json` và `global.json`.
3. Nếu gate advisory là baseline/budget, sửa nguyên nhân hoặc cập nhật baseline trong cùng thay đổi với bằng chứng; không tăng ngưỡng chỉ để xóa warning. Advisory không thay thế performance review khi thay đổi route lớn.
4. Chỉ dùng **Re-run failed jobs** cho lỗi hạ tầng runner/network đã có bằng chứng. Test hoặc gate deterministic đỏ phải được sửa trước khi rerun.
5. `CodeQL` là workflow độc lập cho `main` và lịch tuần. Repository chưa có workflow deploy backend; Vercel frontend và backend host vẫn là các lane phát hành riêng.

Root Directory của project trên Vercel là `./` (gốc repository) — **đã xác minh trực tiếp trong Vercel → Settings → Build & Development ngày 26/07/2026**, kèm tuỳ chọn "Include files outside the root directory in the Build Step" đang bật. Đây là căn cứ để chỉ giữ root `vercel.json`: Vercel chỉ đọc file cấu hình nằm tại Root Directory, nên `frontend/vercel.json` trước đây không bao giờ được áp dụng.

## Environment setup

Production backend cần `ConnectionStrings:DefaultConnection`, `JwtSettings:*`, `Cors:AllowedOrigins` và `AllowedHosts`; xem [CONFIGURATION.md](CONFIGURATION.md) để biết shape và validation. Runtime hiện deploy direct-host và không tin forwarded headers. Nếu provider sau này thêm reverse proxy/TLS termination, deployment phải bổ sung trusted-proxy allowlist, forwarded-header integration tests và HTTPS/cookie verification trước promotion. Các giá trị secret/domain phải đặt trong secret manager hoặc environment của host.

<!-- VERIFY: Cách inject secret, database host, region, DNS và frontend/backend origin phải được xác nhận theo provider production thực tế. -->

Frontend cần build với `VITE_API_BASE_URL` khi API không cùng origin. Không bật `VITE_ENABLE_MOCK_LOGIN` trong production build.

## Kích hoạt kho vận hành — checkpoint được ủy quyền riêng

Migration `20260824161853_EnforceSingleOperationalWarehouse` chỉ bổ sung `IsOperationalActive` (mặc định `FALSE`), cột sinh nullable `OperationalSingletonKey` và unique index. Chạy migration không chọn hay kích hoạt kho. Executor tự động phải dừng trước mọi lệnh áp dụng migration hoặc thay đổi dữ liệu; chỉ operator có ủy quyền riêng, sau khi xác nhận đúng database/lane và backup, mới được tiếp tục.

Trước khi kích hoạt, operator phải lưu pre-state bất biến gồm database đích, migration lineage, toàn bộ `warehouseId`/`warehouseCode`/`IsOperationalActive`, số hàng và checksum theo từng bảng có FK kho, tồn hiện tại, lot, snapshot và stock movement. Production thông thường không cần cấu hình `OperationalWarehouse:WarehouseId`: resolver dùng đúng một hàng `IsOperationalActive = TRUE` và fail closed khi zero/multiple. Nếu deployment chủ động pin ID, xác nhận đó là đúng một ID 16 byte đã tồn tại và trùng hàng active; không chọn theo tên, mã, thứ tự hoặc `First` và không tạo/merge/reassign warehouse. ID tùy chọn dùng chuỗi GUID theo `GuidHelper`/API của ứng dụng (`new Guid(bytes).ToString()`), không dùng trực tiếp `BIN_TO_UUID(binary_column)` nếu hai biểu diễn byte-order khác nhau.

Trong một transaction do operator chủ động mở: khóa các hàng `warehouses` liên quan để tránh race; xác nhận không có hàng active và configured ID tồn tại đúng một lần; chỉ đặt `IsOperationalActive = TRUE` cho chính configured ID. Không sửa hàng khác. Sau update nhưng trước commit, yêu cầu đồng thời: đúng một hàng active, ID active byte-exact bằng configured ID, `OperationalSingletonKey = 1` cho hàng đó, mọi hàng inactive có discriminator `NULL`, và các số lượng/checksum ID/FK/tồn/history bằng pre-state. Bất kỳ mismatch hoặc unique-index error nào đều phải `ROLLBACK`; không auto-repair flag, không thử ID khác và không consolidation.

Chỉ commit sau khi operator xác nhận post-check. Sau commit, khởi động backend ở chế độ observation-only: startup resolver chỉ quan sát exact-one/config-match và phải fail closed khi zero/multiple/missing/mismatch; startup không được kích hoạt, retire hoặc sửa hàng. Rollback nghiệp vụ của activation là một transaction được ủy quyền riêng đặt chính configured row về `FALSE`, rồi xác nhận zero active và pre-state identity/history vẫn nguyên vẹn. Việc rollback schema/deploy phải được đánh giá tương thích riêng và không được sửa migration lịch sử.

## Rollback

1. Dừng promotion của deployment đang lỗi và giữ lại build/artifact trước đó.
2. Redeploy commit/build trước đó trên frontend provider.
3. Với backend, deploy lại artifact/image trước đó; không tự ý rollback database migration nếu chưa kiểm tra tương thích schema.
4. Kiểm tra Swagger/health endpoint, đăng nhập và một luồng nghiệp vụ chính sau rollback.

<!-- VERIFY: Quy trình rollback chính thức, retention artifact và lệnh platform-specific cần được xác nhận với đội vận hành. -->

## Operational service, health and recovery targets

- Service window: `05:00–22:00 Asia/Ho_Chi_Minh` daily.
- Internal monthly qualification SLO: 99.5% successful eligible requests inside that window; no customer/legal SLA is implied.
- Watchdog target: probe `/health/live` and `/health/ready` at least once per minute; alert after two consecutive ready failures. Primary acknowledgement target is 5 minutes, backup escalation 10 minutes.
- `/health/live` stays 200 while the process can answer. `/health/ready` explicitly maps Healthy/Degraded to 200 and Unhealthy to 503. DB unavailable and pending migration are Unhealthy; Degraded outbox remains 200 + alert until a tested critical threshold is configured.
- Encrypted backup target: at least every 4 hours, 14-day operational retention, RPO ≤4 hours and RTO ≤30 minutes. Restore rehearsal is quarterly and after material DB/recovery changes.
- These are selected targets, not production evidence. Alert delivery, outage behavior, independent off-host retention and full encrypted restore remain `NEEDS_EVIDENCE` until authorized staging/provider drills produce receipts.

## Monitoring

Backend ghi log Serilog ra console và file rolling JSON Lines `logs/ipc-.jsonl`, giữ tối đa 30 file theo cấu hình trong `Program.cs`. Chưa thấy tích hợp Sentry, Datadog, New Relic hoặc OpenTelemetry trong dependency/config hiện tại.

<!-- VERIFY: Dashboard, alert, log aggregation và uptime monitor production chưa được xác định từ repository. -->
