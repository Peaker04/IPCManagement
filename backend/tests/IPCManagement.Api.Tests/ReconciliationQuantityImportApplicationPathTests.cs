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

        var manualReplay = Payload<ReconciliationBatchDto>(await controller.Create(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), first.ImportBatchId), default));
        Assert.Equal(first.ReconciliationBatchId, manualReplay.BatchId);
        Assert.Equal("DRAFT", manualReplay.Status);
        Assert.Single(fixture.Context.Reconciliationbatches);

        var readback = Payload<ReconciliationBatchDto>(await controller.Get(first.ReconciliationBatchId, default));
        Assert.Equal(first.ImportBatchId, readback.QuantityImportBatchId);
        Assert.NotEmpty(readback.Lines);
        Assert.All(readback.Lines, line => Assert.True(line.RequiredQuantity > 0));
        var contributors = await fixture.Context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync();
        Assert.NotEmpty(contributors);
        Assert.All(contributors, contributor => Assert.True(contributor.SourceQuantity > 0));

        var ready = Payload<ReconciliationBatchDto>(await controller.Ready(
            first.ReconciliationBatchId, new ReadyReconciliationBatchRequest(readback.Version), default));
        Assert.Equal("READY", ready.Status);
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
            var actorId = GuidHelper.NewId();
            var unit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram", BaseUnitCode = "KG", ConvertRateToBase = 1m };
            var ingredient = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-1", IngredientName = "Ingredient", UnitId = unit.UnitId, WarehouseId = GuidHelper.NewId(), ReferencePrice = 1m, IsActive = true, Unit = unit };
            var dish = new Dish { DishId = GuidHelper.NewId(), DishCode = "DISH-1", DishName = "Dish", IsActive = true };
            var menu = new Menu { MenuId = menuId, MenuCode = "MENU-1", MenuName = "Menu", IsActive = true };
            var menuItem = new MenuItem { MenuItemId = GuidHelper.NewId(), MenuId = menuId, Menu = menu, DishId = dish.DishId, Dish = dish, DisplayOrder = 1 };
            var bom = new DishBom { BomId = GuidHelper.NewId(), DishId = dish.DishId, Dish = dish, IngredientId = ingredient.IngredientId, Ingredient = ingredient, UnitId = unit.UnitId, Unit = unit, GrossQtyPerServing = 0.1m, PriceTierAmount = 25000m, BomStatus = "PUBLISHED", EffectiveFrom = new DateOnly(2026, 8, 1) };
            var tolerance = new ReconciliationTolerance { ToleranceId = GuidHelper.NewId(), ScopeKind = ReconciliationToleranceAuthority.SystemDefaultScope, Value = ReconciliationToleranceAuthority.SystemDefaultValue, Version = ReconciliationToleranceAuthority.SystemDefaultVersion, CreatedBy = actorId, CreatedAt = DateTime.UtcNow };
            var menuVersion = new MenuVersion { MenuVersionId = menuVersionId, CustomerId = customerId, WeekStartDate = new DateOnly(2026, 8, 24), VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            var schedule = new MenuSchedule { MenuScheduleId = scheduleId, CustomerId = customerId, MenuId = menuId, Menu = menu, MenuVersionId = menuVersionId, MenuVersion = menuVersion, MenuPrice = 25000m, ServiceDate = new DateOnly(2026, 8, 25), WeekStartDate = new DateOnly(2026, 8, 24), ShiftName = "MORNING", Status = "ACTIVE" };
            var plan = new MealQuantityPlan { QuantityPlanId = planId, PlanCode = "QTY-1", ServiceDate = schedule.ServiceDate, Status = "COMPLETED", CompletedAt = DateTime.UtcNow, RowVersion = DateTime.UtcNow };
            var line = new MealQuantityPlanLine { QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = planId, QuantityPlan = plan, MenuScheduleId = scheduleId, MenuSchedule = schedule, CustomerId = customerId, MenuId = menuId, Menu = menu, ShiftName = "MORNING", ForecastServings = 10, ConfirmedServings = 10, FinalServings = 10, UpdatedAt = DateTime.UtcNow };
            context.AddRange(unit, ingredient, dish, menu, menuItem, bom, tolerance, menuVersion, schedule, plan, line);
            await context.SaveChangesAsync();

            var requestContext = new SystemOperationRequestContext { OperationKey = "reconciliation.quantity-import.commit", ExpectedModeVersion = 1, Disposition = IPCManagement.Api.Features.SystemOperation.Services.OperationDisposition.Retained };
            var runner = new ImmediateTransactionRunner();
            var batchService = new ReconciliationBatchService(context, runner, requestContext);
            var cache = new MemoryCache(new MemoryCacheOptions());
            var importService = new ReconciliationQuantityImportService(context, runner, requestContext, cache, batchService);
            var completionService = new ReconciliationCompletionService(context, batchService, runner, requestContext);
            var services = new ServiceCollection();
            services.AddControllers().AddApplicationPart(typeof(ReconciliationBatchesController).Assembly).AddControllersAsServices();
            services.AddSingleton(batchService);
            services.AddSingleton(importService);
            services.AddSingleton(completionService);
            services.AddSingleton<ICurrentUserService>(new StubCurrentUser(GuidHelper.ToGuidString(actorId)));
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
            base.OnModelCreating(modelBuilder);
            modelBuilder.UseCollation("BINARY");
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var index in entity.GetIndexes())
                    index.SetDatabaseName($"{entity.GetTableName()}_{index.GetDatabaseName()}");
            }
            foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(entity => entity.GetProperties()))
            {
                if (property.GetColumnType()?.StartsWith("enum(", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetColumnType("TEXT");
                if (property.GetCollation()?.Contains("utf8mb4", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetCollation("BINARY");
                if (property.GetDefaultValueSql()?.Contains("CURRENT_TIMESTAMP(6)", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetDefaultValueSql("CURRENT_TIMESTAMP");
            }
        }
    }
}
