using System.Text;
using System.Threading.RateLimiting;
using FluentValidation;
using FluentValidation.AspNetCore;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Events;

// ── Serilog bootstrap ───────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.Hosting.Lifetime", LogEventLevel.Information)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate:
        "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File(
        path: "logs/ipc-.log",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

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
    options.AddPolicy(AuthorizationPolicies.CatalogAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CatalogRoles));
    options.AddPolicy(AuthorizationPolicies.CoordinationAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CoordinationRoles));
    options.AddPolicy(AuthorizationPolicies.InventoryAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.InventoryRoles));
    options.AddPolicy(AuthorizationPolicies.ProductionAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.ProductionRoles));
    options.AddPolicy(AuthorizationPolicies.PurchaseAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.PurchaseRoles));
    options.AddPolicy(AuthorizationPolicies.WarehouseAccess, policy =>
        policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.WarehouseRoles));
});

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        }
        else
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
        }
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddMemoryCache();
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
});

// ── FluentValidation ────────────────────────────────────────────────────────
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "IPC Management API",
        Version = "v1",
        Description = "Hệ thống quản lý bếp ăn công nghiệp (IPC Management System)"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Nhập JWT token: Bearer {token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// ── Rate Limiting (được tích hợp sẵn trong ASP.NET Core 7+) ──────────────────────
builder.Services.AddRateLimiter(opts =>
{
    // Policy cho Auth: 5 lần / 1 phút theo IP (chống brute-force)
    opts.AddFixedWindowLimiter("auth-strict", o =>
    {
        o.PermitLimit         = 5;
        o.Window              = TimeSpan.FromMinutes(1);
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit          = 0;          // không xếp hàng
    });

    // Policy cho API nói chung: 100 lần / 1 phút theo IP
    opts.AddSlidingWindowLimiter("api-general", o =>
    {
        o.PermitLimit         = 100;
        o.Window              = TimeSpan.FromMinutes(1);
        o.SegmentsPerWindow   = 6;
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit          = 10;
    });

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

var app = builder.Build();

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
});

app.UseRateLimiter();
app.UseResponseCompression();
app.UseHttpsRedirection();
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

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

app.Run();

public partial class Program;
