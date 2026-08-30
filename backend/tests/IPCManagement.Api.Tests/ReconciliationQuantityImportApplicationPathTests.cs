using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Caching;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Features.Inventory.Services;
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
using NSubstitute;

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
    public async Task Ready_projection_is_frozen_after_authorized_master_edits_and_new_source_version_uses_new_authority()
    {
        await using var fixture = await Fixture.CreateAsync();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Frozen authority source"), default));
        var committed = Payload<QuantityImportCommitDto>(await fixture.Controller.CommitQuantityImport(
            new(preview.Token, preview.ContentFingerprint, "Frozen authority source"), default));
        var draft = Payload<ReconciliationBatchDto>(await fixture.Controller.Get(committed.ReconciliationBatchId, default));
        var ready = Payload<ReconciliationBatchDto>(await fixture.Controller.Ready(
            draft.BatchId, new ReadyReconciliationBatchRequest(draft.Version), default));
        Assert.Equal("READY", ready.Status);
        var frozen = await fixture.PersistedIdentityProjectionAsync(committed.ReconciliationBatchId);

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        await new IngredientService(new IngredientRepository(fixture.Context), warehouseResolver).UpdateAsync(
            GuidHelper.ToGuidString(fixture.IngredientId), new UpdateIngredientRequest { IngredientName = "Ingredient edited", ReferencePrice = 999m });
        var cache = new MemoryCache(new MemoryCacheOptions());
        await new DishCatalogService(new DishRepository(fixture.Context), fixture.Context, cache).UpdateAsync(
            GuidHelper.ToGuidString(fixture.DishId), new UpdateDishRequest { DishName = "Dish edited" });
        await new DishBomService(fixture.Context, cache).UpdateBomLineAsync(
            GuidHelper.ToGuidString(fixture.DishId), GuidHelper.ToGuidString(fixture.BomId),
            new UpdateDishBomLineRequest { GrossQtyPerServing = 0.2m, EffectiveFrom = new DateOnly(2026, 8, 26), Reason = "Phase 30 frozen snapshot proof" },
            GuidHelper.ToGuidString(fixture.ActorId));

        Assert.Equal(frozen, await fixture.PersistedIdentityProjectionAsync(committed.ReconciliationBatchId));

        var newVersionId = await fixture.CreateNextMenuSourceVersionAsync();
        var nextPreview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(newVersionId), "New authority source"), default));
        var nextCommit = Payload<QuantityImportCommitDto>(await fixture.Controller.CommitQuantityImport(
            new(nextPreview.Token, nextPreview.ContentFingerprint, "New authority source"), default));
        var next = Payload<ReconciliationBatchDto>(await fixture.Controller.Get(nextCommit.ReconciliationBatchId, default));

        Assert.NotEqual(committed.ImportBatchId, nextCommit.ImportBatchId);
        Assert.NotEqual(committed.ReconciliationBatchId, nextCommit.ReconciliationBatchId);
        Assert.Equal(2m, Assert.Single(next.Lines).RequiredQuantity);
        Assert.Equal(1m, Assert.Single(ready.Lines).RequiredQuantity);
    }

    [Fact]
    public async Task Manual_materialization_of_valid_committed_import_matches_auto_projection_and_ready_semantics()
    {
        await using var autoFixture = await Fixture.CreateAsync();
        await using var manualFixture = await Fixture.CreateAsync();

        var autoPreview = Payload<QuantityImportPreviewDto>(await autoFixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(autoFixture.MenuVersionId), "Nguồn tương đương"), default));
        var autoCommit = Payload<QuantityImportCommitDto>(await autoFixture.Controller.CommitQuantityImport(
            new(autoPreview.Token, autoPreview.ContentFingerprint, "Nguồn tương đương"), default));
        var autoDraft = Payload<ReconciliationBatchDto>(await autoFixture.Controller.Get(autoCommit.ReconciliationBatchId, default));

        var manualImportId = await manualFixture.CreateCommittedImportWithoutBatchAsync("Nguồn tương đương");
        var manualDraft = Payload<ReconciliationBatchDto>(await manualFixture.Controller.Create(
            new(GuidHelper.ToGuidString(manualFixture.MenuVersionId), GuidHelper.ToGuidString(manualImportId)), default));

        Assert.Equal(Projection(autoDraft), Projection(manualDraft));
        Assert.Equal(await autoFixture.PersistedProjectionAsync(), await manualFixture.PersistedProjectionAsync());
        Assert.Equal("DRAFT", manualDraft.Status);
        Assert.Single(manualFixture.Context.Reconciliationbatches);
        Assert.NotEmpty(manualFixture.Context.Reconciliationbatchcontributors);

        var autoReady = Payload<ReconciliationBatchDto>(await autoFixture.Controller.Ready(
            autoDraft.BatchId, new ReadyReconciliationBatchRequest(autoDraft.Version), default));
        var manualReady = Payload<ReconciliationBatchDto>(await manualFixture.Controller.Ready(
            manualDraft.BatchId, new ReadyReconciliationBatchRequest(manualDraft.Version), default));
        Assert.Equal("READY", autoReady.Status);
        Assert.Equal(autoReady.Status, manualReady.Status);
    }

    private static IReadOnlyList<string> Projection(ReconciliationBatchDto batch) => batch.Lines
        .Select(line => $"{line.RequiredQuantity:F6}|{line.FrozenTolerance:F6}")
        .OrderBy(value => value, StringComparer.Ordinal)
        .ToList();

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
        public byte[] ActorId { get; }
        public byte[] IngredientId { get; }
        public byte[] DishId { get; }
        public byte[] BomId { get; }
        public byte[] WarehouseId { get; }

        private Fixture(SqliteConnection connection, ServiceProvider serviceProvider, ImportTestContext context, ReconciliationBatchesController controller, byte[] menuVersionId, byte[] actorId, byte[] ingredientId, byte[] dishId, byte[] bomId, byte[] warehouseId)
        {
            this.connection = connection;
            this.serviceProvider = serviceProvider;
            Context = context;
            Controller = controller;
            MenuVersionId = menuVersionId;
            ActorId = actorId;
            IngredientId = ingredientId;
            DishId = dishId;
            BomId = bomId;
            WarehouseId = warehouseId;
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
            var warehouseId = GuidHelper.NewId();
            var ingredient = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-1", IngredientName = "Ingredient", UnitId = unit.UnitId, WarehouseId = warehouseId, ReferencePrice = 1m, IsActive = true, Unit = unit };
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
            return new Fixture(connection, serviceProvider, context, controller, menuVersionId, actorId, ingredient.IngredientId, dish.DishId, bom.BomId, warehouseId);
        }

        public async Task<IReadOnlyList<string>> PersistedIdentityProjectionAsync(string batchId)
        {
            var parsed = GuidHelper.ParseGuidString(batchId)!;
            var batch = await Context.Reconciliationbatches.AsNoTracking().SingleAsync(item => item.BatchId == parsed);
            var lines = await Context.Reconciliationbatchlines.AsNoTracking()
                .Where(line => line.BatchId == parsed)
                .OrderBy(line => line.BatchLineId)
                .Select(line => new
                {
                    line.BatchLineId, line.BatchId, line.IngredientId, line.CanonicalUnitId, line.RequiredQuantity,
                    line.FrozenTolerance, line.ToleranceSourceKind, line.ToleranceSourceVersion, line.Version
                }).ToListAsync();
            var contributors = await Context.Reconciliationbatchcontributors.AsNoTracking()
                .Where(item => lines.Select(line => line.BatchLineId).Contains(item.BatchLineId))
                .OrderBy(item => item.ContributorId)
                .Select(item => new { item.ContributorId, item.BatchLineId, item.MenuScheduleId, item.MealQuantityPlanLineId, item.DishBomId, item.SourceQuantity })
                .ToListAsync();
            return
            [
                $"B|{GuidHelper.ToGuidString(batch.BatchId)}|{GuidHelper.ToGuidString(batch.MenuVersionId)}|{GuidHelper.ToGuidString(batch.QuantityImportBatchId)}|{batch.Status}|{batch.Version}|{batch.CreatedAt:O}|{Convert.ToHexString(batch.CreatedBy)}",
                .. lines.Select(line => $"L|{Convert.ToHexString(line.BatchLineId)}|{Convert.ToHexString(line.BatchId)}|{Convert.ToHexString(line.IngredientId)}|{Convert.ToHexString(line.CanonicalUnitId)}|{line.RequiredQuantity:F6}|{line.FrozenTolerance:F6}|{line.ToleranceSourceKind}|{line.ToleranceSourceVersion}|{line.Version}"),
                .. contributors.Select(item => $"C|{Convert.ToHexString(item.ContributorId)}|{Convert.ToHexString(item.BatchLineId)}|{Convert.ToHexString(item.MenuScheduleId)}|{Convert.ToHexString(item.MealQuantityPlanLineId)}|{Convert.ToHexString(item.DishBomId)}|{item.SourceQuantity:F6}")
            ];
        }

        public async Task<byte[]> CreateNextMenuSourceVersionAsync()
        {
            var existingVersion = await Context.Menuversions.AsNoTracking().SingleAsync(item => item.MenuVersionId == MenuVersionId);
            var existingSchedule = await Context.Menuschedules.AsNoTracking().SingleAsync(item => item.MenuVersionId == MenuVersionId);
            var existingLine = await Context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.MenuScheduleId == existingSchedule.MenuScheduleId);
            var versionId = GuidHelper.NewId();
            var scheduleId = GuidHelper.NewId();
            var planId = GuidHelper.NewId();
            var serviceDate = existingSchedule.ServiceDate.AddDays(7);
            var version = new MenuVersion
            {
                MenuVersionId = versionId, CustomerId = existingVersion.CustomerId, WeekStartDate = existingVersion.WeekStartDate.AddDays(7),
                VersionNo = existingVersion.VersionNo + 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            var schedule = new MenuSchedule
            {
                MenuScheduleId = scheduleId, CustomerId = existingSchedule.CustomerId, MenuId = existingSchedule.MenuId,
                MenuVersionId = versionId, MenuVersion = version, MenuPrice = existingSchedule.MenuPrice, ServiceDate = serviceDate,
                WeekStartDate = existingSchedule.WeekStartDate.AddDays(7), ShiftName = existingSchedule.ShiftName, Status = "ACTIVE"
            };
            var plan = new MealQuantityPlan
            {
                QuantityPlanId = planId, PlanCode = "QTY-2", ServiceDate = serviceDate, Status = "COMPLETED",
                CompletedAt = DateTime.UtcNow, RowVersion = DateTime.UtcNow
            };
            var line = new MealQuantityPlanLine
            {
                QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = planId, QuantityPlan = plan,
                MenuScheduleId = scheduleId, MenuSchedule = schedule, CustomerId = existingLine.CustomerId, MenuId = existingLine.MenuId,
                ShiftName = existingLine.ShiftName, ForecastServings = 10, ConfirmedServings = 10, FinalServings = 10, UpdatedAt = DateTime.UtcNow
            };
            Context.AddRange(version, schedule, plan, line);
            await Context.SaveChangesAsync();
            return versionId;
        }

        public async Task<IReadOnlyList<string>> PersistedProjectionAsync()
        {
            var lines = await Context.Reconciliationbatchlines.AsNoTracking()
                .Include(line => line.Contributors)
                .ToListAsync();
            return lines.Select(line =>
                    $"{line.RequiredQuantity:F6}|{line.FrozenTolerance:F6}|{line.ToleranceSourceKind}|{line.ToleranceSourceVersion}|{string.Join(',', line.Contributors.Select(contributor => contributor.SourceQuantity).OrderBy(quantity => quantity).Select(quantity => quantity.ToString("F6")))}")
                .OrderBy(value => value, StringComparer.Ordinal)
                .ToList();
        }

        public async Task<byte[]> CreateCommittedImportWithoutBatchAsync(string sourceLabel)
        {
            var preview = Payload<QuantityImportPreviewDto>(await Controller.PreviewQuantityImport(
                new(GuidHelper.ToGuidString(MenuVersionId), sourceLabel), default));
            var importId = GuidHelper.NewId();
            var now = DateTime.UtcNow;
            Context.Quantityimportbatches.Add(new QuantityImportBatch
            {
                ImportBatchId = importId, BatchCode = $"MANUAL-{preview.ContentFingerprint[..8]}",
                SourceType = "API", SourceCompanyName = sourceLabel, SourceLabel = sourceLabel,
                MenuVersionId = MenuVersionId, ContentFingerprint = preview.ContentFingerprint,
                FingerprintFormatVersion = preview.FingerprintFormatVersion, ImportedBy = ActorId,
                ImportedAt = now, Status = "CONFIRMED"
            });
            foreach (var plan in Context.Mealquantityplans) plan.ImportBatchId = importId;
            Context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = ActorId,
                BusinessArea = "Reconciliation", EntityName = nameof(QuantityImportBatch), EntityId = importId,
                FieldName = "Commit", NewValue = preview.ContentFingerprint, Reason = "Fixture committed import authority"
            });
            await Context.SaveChangesAsync();
            Assert.Empty(Context.Reconciliationbatches);
            return importId;
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
