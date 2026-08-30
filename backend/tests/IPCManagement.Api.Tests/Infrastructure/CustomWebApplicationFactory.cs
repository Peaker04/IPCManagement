using System.Security.Claims;
using System.Text.Encodings.Web;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IPCManagement.Api.Tests.Infrastructure;

public sealed class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<IpcManagementContext>>();
            services.RemoveAll<IpcManagementContext>();

            var connectionString = Environment.GetEnvironmentVariable("IPC_TEST_CONNECTION_STRING")
                ?? throw new InvalidOperationException(
                    "Set IPC_TEST_CONNECTION_STRING to an isolated test database (preferably a MySQL Testcontainers instance).");

            services.AddDbContext<IpcManagementContext>(options =>
                options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));
        });
    }

    public static async Task<ApprovalOwnerTestHost> CreateApprovalOwnerHostAsync(
        ApprovalAdmissionBarrier? admissionBarrier = null)
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Production"
        });
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton(connection);
        builder.Services.AddDbContext<IpcManagementContext>((services, options) =>
            options.UseSqlite(services.GetRequiredService<SqliteConnection>()));
        builder.Services.AddScoped<SystemOperationRequestContext>();
        builder.Services.AddScoped<SystemOperationModeGuard>();
        builder.Services.AddScoped<SystemOperationModeFilter>();
        builder.Services.AddScoped<SystemOperationModeService>();
        builder.Services.AddScoped<IEfTransactionRunner>(services =>
        {
            IEfTransactionRunner production = new EfTransactionRunner(
                services.GetRequiredService<IpcManagementContext>(),
                services.GetRequiredService<SystemOperationRequestContext>(),
                services.GetRequiredService<SystemOperationModeGuard>());
            return admissionBarrier is null
                ? production
                : new ApprovalBarrierTransactionRunner(production, admissionBarrier);
        });
        builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
        builder.Services.AddScoped<IApprovalRoutingService, ApprovalRoutingService>();
        builder.Services.AddScoped<IApprovalWorkflowService, ApprovalWorkflowService>();
        builder.Services.AddScoped<IApprovalInboxService, ApprovalInboxService>();
        builder.Services.AddScoped<IApprovalTargetHandler, MaterialDemandApprovalHandler>();
        builder.Services
            .AddAuthentication(ApprovalOwnerTestAuthHandler.Scheme)
            .AddScheme<AuthenticationSchemeOptions, ApprovalOwnerTestAuthHandler>(
                ApprovalOwnerTestAuthHandler.Scheme, _ => { });
        builder.Services.AddAuthorization();
        builder.Services.AddControllers(options => options.Filters.AddService<SystemOperationModeFilter>())
            .AddApplicationPart(typeof(Program).Assembly);

        var app = builder.Build();
        app.UseExceptionMiddleware();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();

        await InitializeApprovalOwnerSchemaAsync(connection);
        await app.StartAsync();
        return new ApprovalOwnerTestHost(app, connection);
    }

    private static async Task InitializeApprovalOwnerSchemaAsync(SqliteConnection connection)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE users (
                userId BLOB PRIMARY KEY, fullName TEXT NOT NULL, username TEXT NOT NULL,
                passwordHash TEXT NOT NULL, roleId BLOB NOT NULL, isActive INTEGER NOT NULL,
                createdAt TEXT NOT NULL);
            CREATE TABLE systemoperationmodes (
                id INTEGER PRIMARY KEY, mode TEXT NOT NULL, version INTEGER NOT NULL,
                updatedBy BLOB NOT NULL, updatedAt TEXT NOT NULL, reason TEXT NULL);
            CREATE TABLE reconciliationbatches (
                batchId BLOB PRIMARY KEY, status TEXT NOT NULL);
            CREATE TABLE auditlogs (
                auditId BLOB PRIMARY KEY, changedAt TEXT NOT NULL, changedBy BLOB NOT NULL,
                businessArea TEXT NOT NULL, entityName TEXT NOT NULL, entityId BLOB NULL,
                fieldName TEXT NULL, oldValue TEXT NULL, newValue TEXT NULL, reason TEXT NULL,
                correlationId TEXT NULL);
            CREATE TABLE materialrequests (
                requestId BLOB PRIMARY KEY, requestCode TEXT NOT NULL, planId BLOB NOT NULL,
                requestDate TEXT NOT NULL, requestScope TEXT NOT NULL, status TEXT NOT NULL,
                createdBy BLOB NOT NULL, approvedBy BLOB NULL, approvedAt TEXT NULL);
            CREATE TABLE approvalhistories (
                approvalHistoryId BLOB PRIMARY KEY, targetType TEXT NOT NULL, targetId BLOB NOT NULL,
                decision TEXT NOT NULL, oldStatus TEXT NULL, newStatus TEXT NULL, reason TEXT NULL,
                actionBy BLOB NOT NULL, actionAt TEXT NOT NULL);
            CREATE TABLE approvalrules (
                ruleId BLOB PRIMARY KEY, ruleName TEXT NOT NULL, documentType TEXT NOT NULL,
                minAmount TEXT NULL, maxAmount TEXT NULL, slaHours INTEGER NULL,
                isActive INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL);
            CREATE TABLE approvalassignments (
                assignmentId BLOB PRIMARY KEY, ruleId BLOB NOT NULL, sequence INTEGER NOT NULL,
                approverRole TEXT NULL, approverUserId BLOB NULL, isRequired INTEGER NOT NULL DEFAULT 1);
            """;
        await command.ExecuteNonQueryAsync();
    }

    private sealed class ApprovalBarrierTransactionRunner(
        IEfTransactionRunner inner,
        ApprovalAdmissionBarrier barrier) : IEfTransactionRunner
    {
        public Task ExecuteAsync(
            Func<CancellationToken, Task> operation,
            Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted,
            CancellationToken cancellationToken = default)
            => inner.ExecuteAsync(operation, verifySucceeded, isolationLevel, cancellationToken);

        public Task<TResult> ExecuteAsync<TResult>(
            Func<CancellationToken, Task<TResult>> operation,
            Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted,
            CancellationToken cancellationToken = default)
            => inner.ExecuteAsync(operation, verifySucceeded, isolationLevel, cancellationToken);

        public async Task<TResult> ExecuteProtectedAsync<TResult>(
            string operationKey,
            long expectedModeVersion,
            Func<CancellationToken, Task<TResult>> operation,
            Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted,
            CancellationToken cancellationToken = default)
        {
            if (string.Equals(operationKey, "approvals.executeasync", StringComparison.Ordinal))
            {
                await barrier.WaitAsync(cancellationToken);
            }
            return await inner.ExecuteProtectedAsync(
                operationKey, expectedModeVersion, operation, verifySucceeded, isolationLevel, cancellationToken);
        }
    }

    private sealed class ApprovalOwnerTestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        public new const string Scheme = "ApprovalOwnerTest";
        public const string ActorHeader = "X-Test-Actor";
        public const string RoleHeader = "X-Test-Role";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue(ActorHeader, out var actor) ||
                !Request.Headers.TryGetValue(RoleHeader, out var role) ||
                string.IsNullOrWhiteSpace(actor) || string.IsNullOrWhiteSpace(role))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, actor.ToString()), new Claim(ClaimTypes.Role, role.ToString())],
                Scheme);
            return Task.FromResult(AuthenticateResult.Success(
                new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme)));
        }
    }
}

public sealed class ApprovalAdmissionBarrier
{
    private readonly TaskCompletionSource _admitted = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private readonly TaskCompletionSource _release = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public Task Admitted => _admitted.Task;
    public void Release() => _release.TrySetResult();

    internal async Task WaitAsync(CancellationToken cancellationToken)
    {
        _admitted.TrySetResult();
        await _release.Task.WaitAsync(cancellationToken);
    }
}

public sealed class ApprovalOwnerTestHost(WebApplication app, SqliteConnection connection) : IAsyncDisposable
{
    public IServiceProvider Services => app.Services;
    public SqliteConnection Connection => connection;

    public HttpClient CreateClient(string actorId, string role = "Manager")
    {
        var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add("X-Test-Actor", actorId);
        client.DefaultRequestHeaders.Add("X-Test-Role", role);
        return client;
    }

    public async ValueTask DisposeAsync()
    {
        await app.DisposeAsync();
        await connection.DisposeAsync();
    }
}
