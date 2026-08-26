using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationQuantityImportApplicationPathTests
{
    [Fact]
    public async Task AspNetCore_service_provider_activates_controller_and_reaches_quantity_preview_endpoint()
    {
        await using var fixture = await Fixture.CreateAsync();

        var result = await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "DI activation regression"), default);

        Assert.IsType<QuantityImportPreviewDto>(Payload<QuantityImportPreviewDto>(result));
    }

    [Fact]
    public async Task Preview_then_commit_creates_one_confirmed_import_and_one_draft_batch_idempotently()
    {
        await using var fixture = await Fixture.CreateAsync();
        var controller = fixture.Controller;

        var previewResult = await controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn số suất chuẩn"), default);
        var preview = Payload<QuantityImportPreviewDto>(previewResult);

        Assert.NotEmpty(preview.Token);
        Assert.Equal(64, preview.ContentFingerprint.Length);
        Assert.Single(preview.Plans);
        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.All(fixture.Context.Mealquantityplans, plan => Assert.Null(plan.ImportBatchId));

        var request = new CommitQuantityImportRequest(preview.Token, preview.ContentFingerprint, "Nguồn số suất chuẩn");
        var first = Payload<QuantityImportCommitDto>(await controller.CommitQuantityImport(request, default));
        var replay = Payload<QuantityImportCommitDto>(await controller.CommitQuantityImport(request, default));

        Assert.Equal(first.ImportBatchId, replay.ImportBatchId);
        Assert.Equal(first.ReconciliationBatchId, replay.ReconciliationBatchId);
        Assert.True(replay.IdempotentReplay);
        var import = Assert.Single(fixture.Context.Quantityimportbatches);
        Assert.Equal("CONFIRMED", import.Status);
        Assert.Equal(preview.ContentFingerprint, import.ContentFingerprint);
        Assert.Equal(fixture.MenuVersionId, import.MenuVersionId);
        Assert.Single(fixture.Context.Reconciliationbatches);
        Assert.Equal("DRAFT", fixture.Context.Reconciliationbatches.Single().Status);
        Assert.All(fixture.Context.Mealquantityplans, plan => Assert.Equal(import.ImportBatchId, plan.ImportBatchId));
        Assert.Single(fixture.Context.Auditlogs.Where(audit => audit.EntityName == nameof(QuantityImportBatch)));

        var readback = Payload<ReconciliationBatchDto>(await controller.Get(first.ReconciliationBatchId, default));
        Assert.Equal(first.ImportBatchId, readback.QuantityImportBatchId);
    }

    [Fact]
    public async Task Commit_rejects_stale_source_without_persisting_authority()
    {
        await using var fixture = await Fixture.CreateAsync();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));
        fixture.Context.Mealquantityplanlines.Single().FinalServings++;
        await fixture.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => fixture.Controller.CommitQuantityImport(
            new(preview.Token, preview.ContentFingerprint, "Nguồn chuẩn"), default));

        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.Empty(fixture.Context.Reconciliationbatches);
        Assert.All(fixture.Context.Mealquantityplans, plan => Assert.Null(plan.ImportBatchId));
    }

    [Fact]
    public async Task Commit_rejects_plan_code_mutation_as_stale_preview_content()
    {
        await using var fixture = await Fixture.CreateAsync();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));
        fixture.Context.Mealquantityplans.Single().PlanCode = "QTY-CHANGED";
        await fixture.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => fixture.Controller.CommitQuantityImport(
            new(preview.Token, preview.ContentFingerprint, "Nguồn chuẩn"), default));

        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.Empty(fixture.Context.Reconciliationbatches);
    }

    [Fact]
    public async Task Commit_rejects_token_fingerprint_mismatch_without_persisting_authority()
    {
        await using var fixture = await Fixture.CreateAsync();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));

        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Controller.CommitQuantityImport(
            new(preview.Token, new string('0', 64), "Nguồn chuẩn"), default));

        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.Empty(fixture.Context.Reconciliationbatches);
    }

    [Fact]
    public async Task Preview_rejects_incomplete_or_unpublished_sources()
    {
        await using var fixture = await Fixture.CreateAsync();
        fixture.Context.Mealquantityplans.Single().Status = "FORECASTED";
        await fixture.Context.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));

        fixture.Context.Mealquantityplans.Single().Status = "COMPLETED";
        fixture.Context.Menuversions.Single().Status = "DRAFT";
        await fixture.Context.SaveChangesAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));
    }

    private static T Payload<T>(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<ApiResponse<T>>(ok.Value).Data!;
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        private readonly ServiceProvider serviceProvider;
        public ImportTestContext Context { get; }
        public ReconciliationBatchesController Controller { get; }
        public byte[] MenuVersionId { get; }

        private Fixture(SqliteConnection connection, ServiceProvider serviceProvider, ImportTestContext context, ReconciliationBatchesController controller, byte[] menuVersionId)
        {
            this.connection = connection;
            this.serviceProvider = serviceProvider;
            Context = context;
            Controller = controller;
            MenuVersionId = menuVersionId;
        }

        public static async Task<Fixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
            var context = new ImportTestContext(options);
            await context.Database.EnsureCreatedAsync();
            await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
            var menuVersionId = GuidHelper.NewId();
            var customerId = GuidHelper.NewId();
            var menuId = GuidHelper.NewId();
            var scheduleId = GuidHelper.NewId();
            var planId = GuidHelper.NewId();
            var menuVersion = new MenuVersion { MenuVersionId = menuVersionId, CustomerId = customerId, WeekStartDate = new DateOnly(2026, 8, 24), VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            var schedule = new MenuSchedule { MenuScheduleId = scheduleId, CustomerId = customerId, MenuId = menuId, MenuVersionId = menuVersionId, MenuVersion = menuVersion, ServiceDate = new DateOnly(2026, 8, 25), WeekStartDate = new DateOnly(2026, 8, 24), ShiftName = "MORNING", Status = "ACTIVE" };
            var plan = new MealQuantityPlan { QuantityPlanId = planId, PlanCode = "QTY-1", ServiceDate = schedule.ServiceDate, Status = "COMPLETED", CompletedAt = DateTime.UtcNow, RowVersion = DateTime.UtcNow };
            var line = new MealQuantityPlanLine { QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = planId, QuantityPlan = plan, MenuScheduleId = scheduleId, MenuSchedule = schedule, CustomerId = customerId, MenuId = menuId, ShiftName = "MORNING", ForecastServings = 10, ConfirmedServings = 10, FinalServings = 10, UpdatedAt = DateTime.UtcNow };
            context.AddRange(menuVersion, schedule, plan, line);
            await context.SaveChangesAsync();

            var requestContext = new SystemOperationRequestContext { OperationKey = "reconciliation.quantity-import.commit", ExpectedModeVersion = 1, Disposition = IPCManagement.Api.Features.SystemOperation.Services.OperationDisposition.Retained };
            var runner = new ImmediateTransactionRunner();
            var batchService = new ReconciliationBatchService(context, runner, requestContext);
            var cache = new MemoryCache(new MemoryCacheOptions());
            var importService = new ReconciliationQuantityImportService(context, runner, requestContext, cache);
            var completionService = new ReconciliationCompletionService(context, batchService, runner, requestContext);
            var services = new ServiceCollection();
            services.AddControllers().AddApplicationPart(typeof(ReconciliationBatchesController).Assembly).AddControllersAsServices();
            services.AddSingleton(batchService);
            services.AddSingleton(importService);
            services.AddSingleton(completionService);
            services.AddSingleton<ICurrentUserService>(new StubCurrentUser(Guid.NewGuid().ToString()));
            var serviceProvider = services.BuildServiceProvider();
            var controller = serviceProvider.GetRequiredService<ReconciliationBatchesController>();
            return new Fixture(connection, serviceProvider, context, controller, menuVersionId);
        }

        public async ValueTask DisposeAsync()
        {
            await serviceProvider.DisposeAsync();
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }
    }

    private sealed class StubCurrentUser(string id) : IPCManagement.Api.Security.ICurrentUserService
    {
        public string? GetUserId(System.Security.Claims.ClaimsPrincipal user) => id;
        public IReadOnlyList<string> GetRoleNames(System.Security.Claims.ClaimsPrincipal user) => ["COORDINATION"];
        public string? GetWarehouseId(System.Security.Claims.ClaimsPrincipal user) => null;
    }

    private sealed class ImmediateTransactionRunner : IEfTransactionRunner
    {
        public async Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => await operation(cancellationToken);
        public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => operation(cancellationToken);
        public Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion, Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => operation(cancellationToken);
    }

    private sealed class ImportTestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            var included = new HashSet<Type> { typeof(MenuVersion), typeof(MenuSchedule), typeof(MealQuantityPlan), typeof(MealQuantityPlanLine), typeof(QuantityImportBatch), typeof(ReconciliationBatch), typeof(ReconciliationBatchLine), typeof(ReconciliationActual), typeof(ReconciliationDisposition), typeof(AuditLog) };
            foreach (var type in typeof(AuditLog).Assembly.GetTypes().Where(type => type.Namespace == typeof(AuditLog).Namespace && type.IsClass && !included.Contains(type))) modelBuilder.Ignore(type);
            modelBuilder.Entity<MenuVersion>().HasKey(x => x.MenuVersionId); modelBuilder.Entity<MenuVersion>().Ignore(x => x.Customer);
            modelBuilder.Entity<MenuSchedule>().HasKey(x => x.MenuScheduleId); modelBuilder.Entity<MenuSchedule>().Ignore(x => x.Customer); modelBuilder.Entity<MenuSchedule>().Ignore(x => x.CustomerWeekMenuTier); modelBuilder.Entity<MenuSchedule>().Ignore(x => x.Menu);
            modelBuilder.Entity<MealQuantityPlan>().HasKey(x => x.QuantityPlanId); modelBuilder.Entity<MealQuantityPlan>().Ignore(x => x.ConfirmedByNavigation); modelBuilder.Entity<MealQuantityPlan>().Ignore(x => x.CompletedByNavigation);
            modelBuilder.Entity<MealQuantityPlanLine>().HasKey(x => x.QuantityPlanLineId); modelBuilder.Entity<MealQuantityPlanLine>().Ignore(x => x.Customer); modelBuilder.Entity<MealQuantityPlanLine>().Ignore(x => x.Menu); modelBuilder.Entity<MealQuantityPlanLine>().Ignore(x => x.Productionplanlines); modelBuilder.Entity<MealQuantityPlanLine>().Ignore(x => x.Quantityadjustments);
            modelBuilder.Entity<QuantityImportBatch>().HasKey(x => x.ImportBatchId); modelBuilder.Entity<QuantityImportBatch>().Ignore(x => x.ImportedByNavigation); modelBuilder.Entity<QuantityImportBatch>().HasIndex(x => x.ContentFingerprint).IsUnique();
            modelBuilder.Entity<ReconciliationBatch>().HasKey(x => x.BatchId); modelBuilder.Entity<ReconciliationBatch>().HasIndex(x => new { x.MenuVersionId, x.QuantityImportBatchId }).IsUnique();
            modelBuilder.Entity<ReconciliationBatchLine>().HasKey(x => x.BatchLineId);
            modelBuilder.Entity<ReconciliationActual>().HasKey(x => x.ActualId); modelBuilder.Entity<ReconciliationActual>().HasOne(x => x.BatchLine).WithMany().HasForeignKey(x => x.BatchLineId);
            modelBuilder.Entity<ReconciliationDisposition>().HasKey(x => x.DispositionId); modelBuilder.Entity<ReconciliationDisposition>().HasOne(x => x.BatchLine).WithMany().HasForeignKey(x => x.BatchLineId);
            modelBuilder.Entity<AuditLog>().HasKey(x => x.AuditId); modelBuilder.Entity<AuditLog>().Ignore(x => x.ChangedByNavigation);
        }
    }
}
