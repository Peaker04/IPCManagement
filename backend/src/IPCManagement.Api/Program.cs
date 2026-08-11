using System.Net;
using System.Text;
using System.Security.Claims;
using System.Threading.RateLimiting;
using FluentValidation;
using FluentValidation.AspNetCore;
using IPCManagement.Api.HealthChecks;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.OpenApi;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;

// ── Serilog bootstrap ───────────────────────────────────────────────────────
// Log ghi ra JSON (CompactJsonFormatter) để máy parse được; console giữ dạng người đọc khi Development.
var environmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
    ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
var isDevelopmentEnvironment = string.Equals(
    environmentName, Environments.Development, StringComparison.OrdinalIgnoreCase);

var loggerConfiguration = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    // Ghi file chạy nền để I/O đĩa không chặn request thread.
    .WriteTo.Async(sink => sink.File(
        formatter: new CompactJsonFormatter(),
        path: "logs/ipc-.jsonl",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30));

if (isDevelopmentEnvironment)
{
    loggerConfiguration.WriteTo.Console(outputTemplate:
        "[{Timestamp:HH:mm:ss} {Level:u3} cid:{CorrelationId}] {Message:lj}{NewLine}{Exception}");
}
else
{
    loggerConfiguration.WriteTo.Console(new CompactJsonFormatter());
}

Log.Logger = loggerConfiguration.CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// ── Forwarded headers ───────────────────────────────────────────────────────
// API chạy sau reverse proxy: không đọc X-Forwarded-For thì rate limiter phân partition theo IP
// của proxy, nghĩa là toàn hệ thống dùng chung một hạn mức.
var knownProxies = builder.Configuration.GetSection("ForwardedHeaders:KnownProxies").Get<string[]>()
    ?? Array.Empty<string>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

    // Mặc định ASP.NET Core chỉ tin proxy loopback; xóa allowlist để header từ proxy thật được đọc.
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();

    foreach (var proxy in knownProxies)
    {
        if (IPAddress.TryParse(proxy, out var proxyAddress))
        {
            options.KnownProxies.Add(proxyAddress);
        }
    }
});

if (knownProxies.Length == 0)
{
    Log.Warning("ForwardedHeaders:KnownProxies chưa cấu hình — API tin mọi X-Forwarded-For. "
        + "Chỉ an toàn khi API luôn nằm sau reverse proxy tin cậy.");
}

// ── Cookie policy ───────────────────────────────────────────────────────────
// Ngoài Development, cookie refresh-token bắt buộc có cờ Secure. Ép ở đây thay vì để controller
// tự quyết theo Request.IsHttps, vì sau proxy TLS-terminating thì IsHttps có thể là false.
builder.Services.Configure<CookiePolicyOptions>(options =>
{
    options.MinimumSameSitePolicy = SameSiteMode.Unspecified;   // giữ nguyên SameSite controller đặt
    options.Secure = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});

DeploymentConfigurationValidator.Validate(builder.Configuration, builder.Environment);

builder.Services.AddBackendServices(builder.Configuration);

builder.Services.AddOptions<JwtSettings>()
    .Bind(builder.Configuration.GetSection(JwtSettings.SectionName))
    .ValidateDataAnnotations()
    .Validate(settings => settings.SecretKey.Trim().Length >= 32,
        "JwtSettings:SecretKey must be at least 32 characters long.")
    .Validate(settings => settings.ExpiryMinutes > 0,
        "JwtSettings:ExpiryMinutes must be greater than 0.")
    .Validate(settings => settings.RefreshExpiryDays > 0,
        "JwtSettings:RefreshExpiryDays must be greater than 0.")
    .ValidateOnStart();

var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName)
    .Get<JwtSettings>()
    ?? throw new InvalidOperationException("JwtSettings is not configured.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidateAudience = true,
        ValidAudience = jwtSettings.Audience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnChallenge = context =>
        {
            context.HandleResponse();
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            return context.Response.WriteAsync(
                """{"success":false,"message":"Chưa đăng nhập hoặc token hết hạn."}""");
        },
        OnForbidden = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            return context.Response.WriteAsync(
                """{"success":false,"message":"Không có quyền thực hiện hành động này."}""");
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthorizationPolicies.AdminAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.AdminRoles));
    options.AddPolicy(AuthorizationPolicies.CatalogAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CatalogRoles));
    options.AddPolicy(AuthorizationPolicies.CatalogReadAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CatalogReadRoles));
    options.AddPolicy(AuthorizationPolicies.CoordinationAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CoordinationRoles));
    options.AddPolicy(AuthorizationPolicies.InventoryAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.InventoryRoles));
    options.AddPolicy(AuthorizationPolicies.InventoryReceiptReadAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.InventoryReceiptReadRoles));
    options.AddPolicy(AuthorizationPolicies.InventoryApproveAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.InventoryApproveRoles));
    options.AddPolicy(AuthorizationPolicies.InventoryIssueAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(
            AuthorizationPolicies.InventoryRoles.Concat(AuthorizationPolicies.ProductionRoles).ToArray()));
    options.AddPolicy(AuthorizationPolicies.ProductionAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.ProductionRoles));
    options.AddPolicy(AuthorizationPolicies.DemandGenerateAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CoordinationRoles));
    options.AddPolicy(AuthorizationPolicies.PurchaseAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.PurchaseRoles));
    options.AddPolicy(AuthorizationPolicies.PurchaseOrderReadAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.PurchaseOrderReadRoles));
    options.AddPolicy(AuthorizationPolicies.PurchaseGenerateAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.PurchaseRoles));
    options.AddPolicy(AuthorizationPolicies.WarehouseAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.WarehouseRoles));
    options.AddPolicy(AuthorizationPolicies.WarehouseCatalogAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.WarehouseCatalogRoles));
    options.AddPolicy(AuthorizationPolicies.WarehouseSelectorAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.WarehouseSelectorRoles));
    options.AddPolicy(AuthorizationPolicies.WarehousePurchaseReceive, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.WarehousePurchaseReceiveRoles));
});

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        // Trình duyệt chỉ đọc được header lạ khi nó nằm trong Access-Control-Expose-Headers;
        // thiếu dòng này thì FE không lấy được mã tra cứu lỗi để hiển thị cho người dùng.
        if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()
                .WithExposedHeaders(CorrelationIdMiddleware.HeaderName);
        }
        else
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()
                .WithExposedHeaders(CorrelationIdMiddleware.HeaderName);
        }
    });
});

builder.Services.AddApiContractServices();

// ── Health checks ───────────────────────────────────────────────────────────
// /health/live  : chỉ khẳng định process còn sống, KHÔNG chạm DB (liveness probe).
// /health/ready : mở kết nối MySQL thật (readiness probe + harness Shipyard).
// Timeout 5s để MySQL chết không làm probe treo theo retry của EnableRetryOnFailure.
builder.Services.AddHealthChecks()
    .AddCheck(
        "self",
        () => HealthCheckResult.Healthy("API process đang chạy."),
        tags: new[] { "live" })
    .AddCheck<DatabaseHealthCheck>(
        "database",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "ready" },
        timeout: TimeSpan.FromSeconds(5))
    // Schema cũ có thể thiếu bảng/cột mà model hiện hành luôn query. Chặn readiness để
    // traffic không lọt vào runtime không tương thích và biến thành chuỗi endpoint 500.
    .AddCheck<MigrationHealthCheck>(
        "migrations",
        failureStatus: HealthStatus.Unhealthy,
        tags: new[] { "ready" },
        timeout: TimeSpan.FromSeconds(5))
    .AddCheck<LifecycleOutboxHealthCheck>(
        "lifecycle-outbox",
        failureStatus: HealthStatus.Degraded,
        tags: new[] { "ready" },
        timeout: TimeSpan.FromSeconds(5));

builder.Services.AddMemoryCache();
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
});

// ── FluentValidation ────────────────────────────────────────────────────────
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

// ── Rate Limiting (được tích hợp sẵn trong ASP.NET Core 7+) ──────────────────────
// PermitLimit đọc từ config để có thể nới tạm khi đo tải (RUNBOOK tools/perf);
// không cấu hình thì giữ nguyên giá trị production là 100.
var apiPermitLimit = builder.Configuration.GetValue<int?>("RateLimiting:ApiPermitLimit") ?? 100;
builder.Services.AddRateLimiter(opts =>
{
    // Policy cho Auth: 5 lần / 1 phút theo IP (chống brute-force)
    opts.AddPolicy("auth-strict", context =>
        RateLimitPartition.GetFixedWindowLimiter(GetRateLimitPartitionKey(context), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        }));

    // Policy cho API nói chung: 100 lần / 1 phút theo user, fallback theo IP
    opts.AddPolicy("api-general", context =>
        RateLimitPartition.GetSlidingWindowLimiter(GetRateLimitPartitionKey(context), _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = apiPermitLimit,
            Window = TimeSpan.FromMinutes(1),
            SegmentsPerWindow = 6,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 10
        }));

    // api-general làm GLOBAL limiter: mọi endpoint bị giới hạn mặc định (opt-out thay vì opt-in).
    // Endpoint muốn thoát phải khai báo [DisableRateLimiting] — RateLimitingMiddleware bỏ qua
    // cả global limiter khi thấy metadata đó. Endpoint đã gắn policy riêng (vd. auth-strict)
    // vẫn giữ nguyên hạn mức chặt hơn vì phải qua cả hai limiter.
    opts.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetSlidingWindowLimiter(GetRateLimitPartitionKey(context), _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = apiPermitLimit,
            Window = TimeSpan.FromMinutes(1),
            SegmentsPerWindow = 6,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 10
        }));

    // Trả về JSON khi bị từ chối
    opts.OnRejected = async (context, _) =>
    {
        context.HttpContext.Response.StatusCode  = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            """{"success":false,"message":"Quá nhiều yêu cầu. Vui lòng thử lại sau."}""")
            .ConfigureAwait(false);
    };
});

static string GetRateLimitPartitionKey(HttpContext context)
{
    var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!string.IsNullOrWhiteSpace(userId))
    {
        return $"user:{userId}";
    }

    var remoteIp = context.Connection.RemoteIpAddress?.ToString();
    return string.IsNullOrWhiteSpace(remoteIp) ? "anonymous" : $"ip:{remoteIp}";
}

var app = builder.Build();

// PHẢI đứng đầu pipeline: mọi middleware phía sau (HttpsRedirection, rate limiter phân partition
// theo IP, log request) đều cần RemoteIpAddress/Scheme đã được sửa lại theo header của proxy.
app.UseForwardedHeaders();

// ── Security headers ────────────────────────────────────────────────────────
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";

    // API chỉ trả JSON nên khóa CSP chặt nhất; riêng Swagger UI (chỉ có ở Development)
    // cần script/style nội tuyến nên được miễn.
    if (!context.Request.Path.StartsWithSegments("/swagger")
        && !context.Request.Path.StartsWithSegments("/openapi"))
    {
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
    }

    await next();
});

app.UseCookiePolicy();

app.UseMiddleware<CorrelationIdMiddleware>();

// Access log cho mọi request (trước đây không có bất kỳ access log nào).
// Đặt ngoài ExceptionMiddleware để status code ghi nhận là status code cuối cùng trả về client.
app.UseSerilogRequestLogging();

app.UseExceptionMiddleware();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "IPC Management API v1");
        c.RoutePrefix = "swagger";
    });
    app.MapOpenApi();
}

app.UseMiddleware<SampleDataProductionGuardMiddleware>();

app.MapGet("/", () =>
{
    if (app.Environment.IsDevelopment())
    {
        return Results.Redirect("/swagger");
    }

    return Results.Ok(new
    {
        message = "IPC Management API is running."
    });
}).DisableRateLimiting();

// ── Health endpoints ────────────────────────────────────────────────────────
// Probe phải luôn trả lời được kể cả khi hạn mức đã cạn → DisableRateLimiting.
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("live"),
    ResponseWriter = WriteHealthCheckResponseAsync
}).DisableRateLimiting().AllowAnonymous();

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
    ResponseWriter = WriteHealthCheckResponseAsync
}).DisableRateLimiting().AllowAnonymous();

// Healthy/Degraded → 200, Unhealthy → 503 (mặc định của HealthCheckOptions.ResultStatusCodes).
static Task WriteHealthCheckResponseAsync(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";

    var payload = new
    {
        status = report.Status.ToString(),
        totalDurationMs = Math.Round(report.TotalDuration.TotalMilliseconds, 1),
        checks = report.Entries.Select(entry => new
        {
            name = entry.Key,
            status = entry.Value.Status.ToString(),
            description = entry.Value.Description,
            durationMs = Math.Round(entry.Value.Duration.TotalMilliseconds, 1)
        })
    };

    return context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(
        payload,
        new System.Text.Json.JsonSerializerOptions
        {
            PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
        }));
}

app.UseResponseCompression();
app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();

await WarmAuthPathAsync(app.Services);

app.Lifetime.ApplicationStarted.Register(() =>
{
    Log.Information("IPC Management API started in {Environment}", app.Environment.EnvironmentName);

    foreach (var url in app.Urls)
    {
        Log.Information("Listening on {Url}", url);

        if (app.Environment.IsDevelopment())
        {
            Log.Information("Swagger UI available at {SwaggerUrl}", $"{url.TrimEnd('/')}/swagger");
        }
    }
});

static async Task WarmAuthPathAsync(IServiceProvider services)
{
    var startedAt = System.Diagnostics.Stopwatch.StartNew();
    try
    {
        await using var scope = services.CreateAsyncScope();
        var userRepository = scope.ServiceProvider.GetRequiredService<
            IPCManagement.Api.Data.Repositories.IUserRepository>();
        var tokenService = scope.ServiceProvider.GetRequiredService<
            IPCManagement.Api.Features.Auth.Services.ITokenService>();

        // Compile the login query/provider path without reading a real account.
        await userRepository.FindByUsernameAsync($"__auth_warmup_{Guid.NewGuid():N}");

        // JIT token and response serialization paths without creating a session or DB row.
        var warmupUser = new IPCManagement.Api.Features.Auth.Contracts.UserInfoDto
        {
            UserId = Guid.Empty.ToString(),
            Username = "warmup",
            FullName = "warmup",
            RoleCode = "WARMUP",
            RoleName = "Warmup",
            IsActive = false
        };
        var warmupResponse = new IPCManagement.Api.Features.Auth.Contracts.LoginResponseDto
        {
            AccessToken = tokenService.GenerateAccessToken(
                warmupUser.UserId,
                warmupUser.Username,
                warmupUser.FullName,
                warmupUser.RoleName),
            User = warmupUser
        };
        _ = System.Text.Json.JsonSerializer.Serialize(
            ApiResponse<IPCManagement.Api.Features.Auth.Contracts.LoginResponseDto>
                .SuccessResult(warmupResponse));

        Log.Information("Auth cold path warmed in {ElapsedMs} ms", startedAt.Elapsed.TotalMilliseconds);
    }
    catch (Exception ex)
    {
        // Readiness remains authoritative. A transient DB outage must not hide the real health status.
        Log.Warning(ex, "Auth cold-path warmup failed; readiness will report database state");
    }
}

try
{
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "IPC Management API dừng bất thường");
    throw;
}
finally
{
    // Bắt buộc với WriteTo.Async: đẩy nốt log còn trong hàng đợi trước khi process thoát.
    Log.CloseAndFlush();
}

public partial class Program;
