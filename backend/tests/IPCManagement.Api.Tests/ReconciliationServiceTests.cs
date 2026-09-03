using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationServiceTests
{
    [Fact]
    public void Tolerance_resolution_uses_ingredient_then_unit_group_then_system_default()
    {
        var ingredientId = GuidHelper.NewId();
        var canonicalUnitId = GuidHelper.NewId();
        var defaultTolerance = Tolerance("SYSTEM_DEFAULT", null, 0.5m, 1);
        var unitTolerance = Tolerance("UNIT_GROUP", canonicalUnitId, 0.25m, 2);
        var ingredientTolerance = Tolerance("INGREDIENT", ingredientId, 0.1m, 3);

        Assert.Equal((0.1m, "INGREDIENT", "3"), ReconciliationBatchService.ResolveTolerance([defaultTolerance, unitTolerance, ingredientTolerance], ingredientId, canonicalUnitId));
        Assert.Equal((0.25m, "UNIT_GROUP", "2"), ReconciliationBatchService.ResolveTolerance([defaultTolerance, unitTolerance], ingredientId, canonicalUnitId));
        Assert.Equal((0.5m, "SYSTEM_DEFAULT", "1"), ReconciliationBatchService.ResolveTolerance([defaultTolerance], ingredientId, canonicalUnitId));
    }

    [Fact]
    public void Tolerance_resolution_fails_closed_without_applicable_authority()
    {
        Assert.Throws<ReconciliationToleranceAuthorityException>(() =>
            ReconciliationBatchService.ResolveTolerance([], GuidHelper.NewId(), GuidHelper.NewId()));
    }

    [Theory]
    [InlineData(0.4, 1)]
    [InlineData(0.5, 2)]
    public void Tolerance_resolution_rejects_drifted_system_default_even_when_override_exists(double value, long version)
    {
        var ingredientId = GuidHelper.NewId();
        var canonicalUnitId = GuidHelper.NewId();
        var driftedDefault = Tolerance("SYSTEM_DEFAULT", null, (decimal)value, version);
        var ingredientOverride = Tolerance("INGREDIENT", ingredientId, 0.1m, 4);

        Assert.Throws<ReconciliationToleranceAuthorityException>(() =>
            ReconciliationBatchService.ResolveTolerance([driftedDefault, ingredientOverride], ingredientId, canonicalUnitId));
    }

    [Theory]
    [InlineData("ACTIVE", true)]
    [InlineData("PUBLISHED", true)]
    [InlineData("DRAFT", false)]
    [InlineData("ARCHIVED", false)]
    public async Task Draft_source_listing_uses_canonical_published_compatible_status(string status, bool expected)
    {
        await using var context = CreateContext();
        SeedDraftSource(context, status, "CONFIRMED");
        await context.SaveChangesAsync();
        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), ProtectedContext());

        var sources = await service.ListDraftSourcesAsync();

        Assert.Equal(expected, sources.Count == 1);
    }

    [Theory]
    [InlineData("ACTIVE")]
    [InlineData("PUBLISHED")]
    public async Task Draft_sources_API_returns_published_compatible_sources(string status)
    {
        await using var context = CreateContext();
        SeedDraftSource(context, status, "CONFIRMED");
        await context.SaveChangesAsync();
        var runner = new ImmediateTransactionRunner();
        var requestContext = ProtectedContext();
        var service = new ReconciliationBatchService(context, runner, requestContext);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var quantityImports = new ReconciliationQuantityImportService(context, runner, requestContext, cache, service);
        var completion = new ReconciliationCompletionService(context, service, runner, requestContext);
        var controller = new IPCManagement.Api.Features.Reconciliation.Controllers.ReconciliationBatchesController(
            service, completion, quantityImports, new StubCurrentUser());

        var response = await controller.DraftSources(default);

        var ok = Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(response);
        var payload = Assert.IsType<ApiResponse<IReadOnlyList<ReconciliationDraftSourceDto>>>(ok.Value);
        Assert.Single(payload.Data!);
    }

    [Fact]
    public async Task CreateDraft_rejects_direct_request_for_unpublished_exact_source_pair()
    {
        await using var context = CreateContext();
        var menuVersionId = GuidHelper.NewId();
        var importBatchId = GuidHelper.NewId();
        var planId = GuidHelper.NewId();
        var scheduleId = GuidHelper.NewId();
        var customerId = GuidHelper.NewId();
        var menuId = GuidHelper.NewId();
        var menuVersion = new MenuVersion { MenuVersionId = menuVersionId, CustomerId = customerId, WeekStartDate = new DateOnly(2026, 8, 24), VersionNo = 2, Status = "DRAFT", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        var import = new QuantityImportBatch { ImportBatchId = importBatchId, BatchCode = "DIRECT-DRAFT", SourceType = "TEST", Status = "COMPLETED", ImportedAt = DateTime.UtcNow };
        var plan = new MealQuantityPlan { QuantityPlanId = planId, ImportBatchId = importBatchId, ImportBatch = import, PlanCode = "PLAN", ServiceDate = new DateOnly(2026, 8, 25), Status = "CONFIRMED" };
        var schedule = new MenuSchedule { MenuScheduleId = scheduleId, CustomerId = customerId, MenuId = menuId, MenuVersionId = menuVersionId, MenuVersion = menuVersion, ServiceDate = new DateOnly(2026, 8, 25), WeekStartDate = new DateOnly(2026, 8, 24), ShiftName = "MORNING", Status = "ACTIVE" };
        context.AddRange(menuVersion, import, plan, schedule, new MealQuantityPlanLine { QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = planId, QuantityPlan = plan, MenuScheduleId = scheduleId, MenuSchedule = schedule, CustomerId = customerId, MenuId = menuId, ShiftName = "MORNING", FinalServings = 10, UpdatedAt = DateTime.UtcNow });
        await context.SaveChangesAsync();
        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), ProtectedContext());

        var error = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateDraftAsync(
            new(GuidHelper.ToGuidString(menuVersionId), GuidHelper.ToGuidString(importBatchId)),
            Guid.NewGuid().ToString()));

        Assert.Contains("chưa được cam kết hợp lệ", error.Message);
        Assert.Empty(context.Reconciliationbatches);
    }

    [Theory]
    [InlineData("mixed-menu")]
    [InlineData("noncanonical-status")]
    public async Task CreateDraft_rejects_when_any_linked_source_is_outside_the_exact_committed_authority(string defect)
    {
        await using var context = CreateContext();
        SeedDraftSource(context, "PUBLISHED", "CONFIRMED");
        var import = context.Quantityimportbatches.Local.Single();
        var plan = context.Mealquantityplans.Local.Single();
        plan.Status = defect == "noncanonical-status" ? "CONFIRMED" : "COMPLETED";
        if (defect == "mixed-menu")
        {
            var otherVersion = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = GuidHelper.NewId(), WeekStartDate = new DateOnly(2026, 8, 24), VersionNo = 2, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            var otherSchedule = new MenuSchedule { MenuScheduleId = GuidHelper.NewId(), CustomerId = GuidHelper.NewId(), MenuId = GuidHelper.NewId(), MenuVersionId = otherVersion.MenuVersionId, MenuVersion = otherVersion, ServiceDate = new DateOnly(2026, 8, 26), WeekStartDate = new DateOnly(2026, 8, 24), ShiftName = "MORNING", Status = "ACTIVE" };
            context.AddRange(otherVersion, otherSchedule, new MealQuantityPlanLine { QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = plan.QuantityPlanId, QuantityPlan = plan, MenuScheduleId = otherSchedule.MenuScheduleId, MenuSchedule = otherSchedule, CustomerId = otherSchedule.CustomerId, MenuId = otherSchedule.MenuId, ShiftName = "MORNING", FinalServings = 5, UpdatedAt = DateTime.UtcNow });
        }
        await context.SaveChangesAsync();
        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), ProtectedContext());

        var error = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateDraftAsync(
            new(GuidHelper.ToGuidString(import.MenuVersionId!), GuidHelper.ToGuidString(import.ImportBatchId)),
            Guid.NewGuid().ToString()));

        Assert.Contains("chưa được cam kết hợp lệ", error.Message);
        Assert.Empty(await service.ListDraftSourcesAsync());
        Assert.Empty(context.Reconciliationbatches);
    }

    [Fact]
    public async Task Actual_correction_invalidates_audited_disposition_and_requires_fresh_disposition_before_completion()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        await context.SaveChangesAsync();
        var runner = new ImmediateTransactionRunner();
        var actuals = new ReconciliationActualService(context, runner, ProtectedContext());
        var batches = new ReconciliationBatchService(context, runner, ProtectedContext());
        var completion = new ReconciliationCompletionService(context, batches, runner, ProtectedContext());

        await actuals.UpsertAsync(GuidHelper.ToGuidString(fixture.Line.BatchLineId), "PURCHASED", new(13m, 1, false, "Hóa đơn điều chỉnh"), GuidHelper.ToGuidString(fixture.Actor));

        Assert.Empty(context.Reconciliationdispositions);
        var invalidation = Assert.Single(context.Auditlogs.Where(x => x.EntityName == "ReconciliationDisposition"));
        Assert.Equal("INVALIDATED", invalidation.NewValue);
        await Assert.ThrowsAsync<InvalidOperationException>(() => completion.CompleteAsync(GuidHelper.ToGuidString(fixture.Batch.BatchId), new(1), GuidHelper.ToGuidString(fixture.Actor)));

        await actuals.SetDispositionAsync(GuidHelper.ToGuidString(fixture.Line.BatchLineId), new("ACCEPTED_VARIANCE", "Đã xét số liệu mới", null), GuidHelper.ToGuidString(fixture.Actor));
        Assert.Single(context.Reconciliationdispositions);
        var completed = await completion.CompleteAsync(GuidHelper.ToGuidString(fixture.Batch.BatchId), new(1), GuidHelper.ToGuidString(fixture.Actor));
        Assert.Equal("COMPLETED", completed.Status);
    }

    [Theory]
    [InlineData("ACCEPTED_VARIANCE")]
    [InlineData("CORRECTION_REQUIRED")]
    [InlineData("FOLLOW_UP_REQUIRED")]
    public async Task Every_allowed_disposition_category_round_trips_through_report_contract(string category)
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        context.RemoveRange(context.ChangeTracker.Entries<ReconciliationDisposition>().Select(entry => entry.Entity));
        await context.SaveChangesAsync();
        var runner = new ImmediateTransactionRunner();
        var actuals = new ReconciliationActualService(context, runner, ProtectedContext());
        var batches = new ReconciliationBatchService(context, runner, ProtectedContext());

        await actuals.SetDispositionAsync(GuidHelper.ToGuidString(fixture.Line.BatchLineId), new(category.ToLowerInvariant(), "Lý do hợp lệ", null), GuidHelper.ToGuidString(fixture.Actor));
        var report = await batches.GetAsync(GuidHelper.ToGuidString(fixture.Batch.BatchId));

        Assert.Equal(category, Assert.Single(report!.Lines).Disposition!.Category);
    }

    [Fact]
    public async Task Unknown_disposition_category_is_rejected_without_persistence()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        context.RemoveRange(context.ChangeTracker.Entries<ReconciliationDisposition>().Select(entry => entry.Entity));
        await context.SaveChangesAsync();
        var service = new ReconciliationActualService(context, new ImmediateTransactionRunner(), ProtectedContext());

        var error = await Assert.ThrowsAsync<ArgumentException>(() => service.SetDispositionAsync(
            GuidHelper.ToGuidString(fixture.Line.BatchLineId), new("CLIENT_AUTHORED", "Không được phép", null), GuidHelper.ToGuidString(fixture.Actor)));

        Assert.Equal("Hướng xử lý không hợp lệ.", error.Message);
        Assert.Empty(context.Reconciliationdispositions);
    }

    [Fact]
    public async Task Independent_relational_actual_writers_produce_one_winner_and_one_conflict()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"ipc-reconciliation-{Guid.NewGuid():N}.db");
        try
        {
            var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite($"Data Source={databasePath};Default Timeout=10").Options;
            byte[] lineBytes;
            byte[] actorBytes;
            await using (var seed = new ReconciliationTestContext(options))
            {
                await seed.Database.EnsureCreatedAsync();
                var fixture = SeedInProgressLine(seed, purchasedVersion: 3, issuedVersion: 2);
                lineBytes = fixture.Line.BatchLineId;
                actorBytes = fixture.Actor;
                await seed.SaveChangesAsync();
            }

            await using var firstContext = new ReconciliationTestContext(options);
            await using var secondContext = new ReconciliationTestContext(options);
            await firstContext.Reconciliationactuals.SingleAsync(x => x.BatchLineId == lineBytes && x.Side == "PURCHASED");
            await secondContext.Reconciliationactuals.SingleAsync(x => x.BatchLineId == lineBytes && x.Side == "PURCHASED");
            var gate = new Barrier(2);
            var first = new ReconciliationActualService(firstContext, new BarrierTransactionRunner(gate), ProtectedContext());
            var second = new ReconciliationActualService(secondContext, new BarrierTransactionRunner(gate), ProtectedContext());
            var lineId = GuidHelper.ToGuidString(lineBytes);
            var actorId = GuidHelper.ToGuidString(actorBytes);

            var results = await Task.WhenAll(Capture(() => first.UpsertAsync(lineId, "PURCHASED", new(14m, 3, false, "Người ghi thứ nhất"), actorId)), Capture(() => second.UpsertAsync(lineId, "PURCHASED", new(15m, 3, false, "Người ghi thứ hai"), actorId)));

            Assert.Single(results, error => error is null);
            Assert.Single(results, error => error is DbUpdateConcurrencyException);
        }
        finally { SqliteConnection.ClearAllPools(); File.Delete(databasePath); }
    }

    [Fact]
    public async Task Independent_relational_disposition_writers_produce_one_winner_and_one_conflict()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"ipc-disposition-{Guid.NewGuid():N}.db");
        try
        {
            var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite($"Data Source={databasePath};Default Timeout=10").Options;
            byte[] lineBytes;
            byte[] actorBytes;
            await using (var seed = new ReconciliationTestContext(options))
            {
                await seed.Database.EnsureCreatedAsync();
                var fixture = SeedInProgressLine(seed, purchasedVersion: 1, issuedVersion: 1);
                lineBytes = fixture.Line.BatchLineId;
                actorBytes = fixture.Actor;
                await seed.SaveChangesAsync();
            }

            await using var firstContext = new ReconciliationTestContext(options);
            await using var secondContext = new ReconciliationTestContext(options);
            await firstContext.Reconciliationdispositions.SingleAsync(x => x.BatchLineId == lineBytes);
            await secondContext.Reconciliationdispositions.SingleAsync(x => x.BatchLineId == lineBytes);
            var gate = new Barrier(2);
            var first = new ReconciliationActualService(firstContext, new BarrierTransactionRunner(gate), ProtectedContext());
            var second = new ReconciliationActualService(secondContext, new BarrierTransactionRunner(gate), ProtectedContext());
            var lineId = GuidHelper.ToGuidString(lineBytes);
            var actorId = GuidHelper.ToGuidString(actorBytes);

            var results = await Task.WhenAll(Capture(() => first.SetDispositionAsync(lineId, new("CORRECTION_REQUIRED", "Kết luận thứ nhất", 1), actorId)), Capture(() => second.SetDispositionAsync(lineId, new("FOLLOW_UP_REQUIRED", "Kết luận thứ hai", 1), actorId)));

            Assert.Single(results, error => error is null);
            Assert.Single(results, error => error is DbUpdateConcurrencyException);
        }
        finally { SqliteConnection.ClearAllPools(); File.Delete(databasePath); }
    }

    [Fact]
    public async Task AggregateAndCompletion_Should_IgnoreDefaultAndLegacyCollisionQuantities()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        context.Inventoryissues.AddRange(
            CollisionIssue("ISS-DEFAULT-COLLISION", GuidHelper.NewId(), null, GuidHelper.NewId(), null, 101m),
            CollisionIssue("ISS-LEGACY-COLLISION", null, null, null, null, 303m));
        await context.SaveChangesAsync();
        var requestContext = ProtectedContext();
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);

        var projected = await batches.GetAsync(GuidHelper.ToGuidString(fixture.Batch.BatchId));

        var projectedLine = Assert.Single(projected!.Lines);
        Assert.Equal(10m, projectedLine.IssuedQuantity);
        var completed = await new ReconciliationCompletionService(context, batches, new ImmediateTransactionRunner(), requestContext)
            .CompleteAsync(GuidHelper.ToGuidString(fixture.Batch.BatchId), new(1), GuidHelper.ToGuidString(fixture.Actor));
        Assert.Equal("COMPLETED", completed.Status);
        Assert.Equal(10m, Assert.Single(completed.Lines).IssuedQuantity);

        InventoryIssue CollisionIssue(
            string code,
            byte[]? materialRequestId,
            byte[]? reconciliationBatchId,
            byte[]? materialRequestLineId,
            byte[]? reconciliationBatchLineId,
            decimal quantity)
        {
            var issue = new InventoryIssue
            {
                IssueId = GuidHelper.NewId(), IssueCode = code, IssueDate = new DateOnly(2026, 8, 25),
                WarehouseId = GuidHelper.NewId(), MaterialRequestId = materialRequestId,
                ReconciliationBatchId = reconciliationBatchId, IssuedBy = fixture.Actor, CreatedAt = DateTime.UtcNow
            };
            issue.Inventoryissuelines.Add(new InventoryIssueLine
            {
                IssueLineId = GuidHelper.NewId(), IssueId = issue.IssueId, Issue = issue,
                IngredientId = fixture.Line.IngredientId, UnitId = fixture.Line.CanonicalUnitId,
                RequestedQty = quantity, IssuedQty = quantity,
                MaterialRequestLineId = materialRequestLineId,
                ReconciliationBatchLineId = reconciliationBatchLineId
            });
            return issue;
        }
    }

    [Fact]
    public async Task Stale_actual_and_disposition_writers_lose_at_the_service_boundary()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 3, issuedVersion: 2);
        await context.SaveChangesAsync();
        var service = new ReconciliationActualService(context, new ImmediateTransactionRunner(), ProtectedContext());
        var lineId = GuidHelper.ToGuidString(fixture.Line.BatchLineId);
        var actorId = GuidHelper.ToGuidString(fixture.Actor);

        await service.UpsertAsync(lineId, "PURCHASED", new(14m, 3, false, "Người thắng"), actorId);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => service.UpsertAsync(lineId, "PURCHASED", new(15m, 3, false, "Người thua"), actorId));
        await service.SetDispositionAsync(lineId, new("ACCEPTED_VARIANCE", "Kết luận mới", null), actorId);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => service.SetDispositionAsync(lineId, new("ACCEPTED_VARIANCE", "Kết luận cũ", null), actorId));
    }

    [Fact]
    public async Task Source_changes_are_scoped_to_frozen_batch_contributors()
    {
        await using var context = CreateContext();
        var actorId = GuidHelper.NewId();
        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var scheduleId = GuidHelper.NewId();
        var planId = GuidHelper.NewId();
        var planLineId = GuidHelper.NewId();
        var bomId = GuidHelper.NewId();
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 2,
            CreatedBy = actorId, CreatedAt = DateTime.UtcNow,
            Lines = [new ReconciliationBatchLine { BatchLineId = lineId, IngredientId = GuidHelper.NewId(), CanonicalUnitId = GuidHelper.NewId(), RequiredQuantity = 2, FrozenTolerance = 0.1m, ToleranceSourceKind = "TEST", ToleranceSourceVersion = "1", Version = 1,
                Contributors = [new ReconciliationBatchContributor { ContributorId = GuidHelper.NewId(), MenuScheduleId = scheduleId, MealQuantityPlanLineId = planLineId, DishBomId = bomId, SourceQuantity = 2 }] }]
        });
        context.Mealquantityplanlines.Add(new MealQuantityPlanLine { QuantityPlanLineId = planLineId, QuantityPlanId = planId, MenuScheduleId = scheduleId, CustomerId = GuidHelper.NewId(), MenuId = GuidHelper.NewId(), ShiftName = "MORNING", FinalServings = 20, UpdatedAt = DateTime.UtcNow });
        context.Auditlogs.AddRange(
            new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId, BusinessArea = "Coordination", EntityName = nameof(MealQuantityPlan), EntityId = planId, FieldName = "QuickCompleteServings", OldValue = "10", NewValue = "20", Reason = "Sửa số suất" },
            new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId, BusinessArea = "Other", EntityName = "Unrelated", EntityId = GuidHelper.NewId(), FieldName = "Value", NewValue = "ignored" });
        await context.SaveChangesAsync();

        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), ProtectedContext());
        var changes = await service.ListSourceChangesAsync(GuidHelper.ToGuidString(batchId));

        var change = Assert.Single(changes);
        Assert.Equal("QuickCompleteServings", change.FieldName);
        Assert.Equal("10", change.OldValue);
        Assert.Equal("20", change.NewValue);
        Assert.Equal(GuidHelper.ToGuidString(actorId), change.Actor);
    }

    private static async Task<Exception?> Capture(Func<Task> operation)
    {
        try { await operation(); return null; }
        catch (Exception error) { return error; }
    }

    private static IpcManagementContext CreateContext()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        var context = new ReconciliationTestContext(options);
        context.Database.EnsureCreated();
        context.Database.ExecuteSqlRaw("PRAGMA foreign_keys = OFF;");
        return context;
    }

    private static SystemOperationRequestContext ProtectedContext() => new()
    {
        OperationKey = "reconciliation.test",
        ExpectedModeVersion = 1
    };

    private static ReconciliationTolerance Tolerance(string scopeKind, byte[]? scopeId, decimal value, long version) => new()
    {
        ToleranceId = GuidHelper.NewId(), ScopeKind = scopeKind, ScopeId = scopeId, Value = value, Version = version,
        CreatedBy = GuidHelper.NewId(), CreatedAt = DateTime.UtcNow
    };

    private static void SeedDraftSource(IpcManagementContext context, string menuVersionStatus, string importStatus)
    {
        var menuVersionId = GuidHelper.NewId();
        var importBatchId = GuidHelper.NewId();
        var planId = GuidHelper.NewId();
        var scheduleId = GuidHelper.NewId();
        var customerId = GuidHelper.NewId();
        var menuId = GuidHelper.NewId();
        var menuVersion = new MenuVersion { MenuVersionId = menuVersionId, CustomerId = customerId, WeekStartDate = new DateOnly(2026, 8, 24), VersionNo = 1, Status = menuVersionStatus, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        var import = new QuantityImportBatch { ImportBatchId = importBatchId, BatchCode = $"BATCH-{menuVersionStatus}", SourceType = "API", Status = importStatus, ImportedAt = DateTime.UtcNow, MenuVersionId = menuVersionId, ContentFingerprint = new string('A', 64), FingerprintFormatVersion = 2, SourceLabel = "Test" };
        var plan = new MealQuantityPlan { QuantityPlanId = planId, ImportBatchId = importBatchId, ImportBatch = import, PlanCode = "PLAN", ServiceDate = new DateOnly(2026, 8, 25), Status = "COMPLETED" };
        var schedule = new MenuSchedule { MenuScheduleId = scheduleId, CustomerId = customerId, MenuId = menuId, MenuVersionId = menuVersionId, MenuVersion = menuVersion, ServiceDate = new DateOnly(2026, 8, 25), WeekStartDate = new DateOnly(2026, 8, 24), ShiftName = "MORNING", Status = "ACTIVE" };
        context.AddRange(menuVersion, import, plan, schedule, new MealQuantityPlanLine { QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = planId, QuantityPlan = plan, MenuScheduleId = scheduleId, MenuSchedule = schedule, CustomerId = customerId, MenuId = menuId, ShiftName = "MORNING", FinalServings = 10, UpdatedAt = DateTime.UtcNow });
    }

    private static Fixture SeedInProgressLine(IpcManagementContext context, long purchasedVersion, long issuedVersion)
    {
        var actor = GuidHelper.NewId();
        var batch = new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "IN_PROGRESS", Version = 1, CreatedBy = actor, CreatedAt = DateTime.UtcNow };
        var unit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var ingredient = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-RECON", IngredientName = "Nguyên liệu", UnitId = unit.UnitId, Unit = unit, WarehouseId = GuidHelper.NewId(), IsActive = true };
        var line = new ReconciliationBatchLine { BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, Batch = batch, IngredientId = ingredient.IngredientId, Ingredient = ingredient, CanonicalUnitId = unit.UnitId, CanonicalUnit = unit, RequiredQuantity = 10m, FrozenTolerance = 0.5m, ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1 };
        batch.Lines.Add(line);
        var issue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(), IssueCode = "ISS-RECONCILIATION", IssueDate = new DateOnly(2026, 8, 25),
            WarehouseId = GuidHelper.NewId(), ReconciliationBatchId = batch.BatchId, IssuedBy = actor, CreatedAt = DateTime.UtcNow
        };
        var issueLine = new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(), IssueId = issue.IssueId, Issue = issue,
            IngredientId = line.IngredientId, UnitId = line.CanonicalUnitId,
            RequestedQty = 10m, IssuedQty = 10m, ReconciliationBatchLineId = line.BatchLineId
        };
        issue.Inventoryissuelines.Add(issueLine);
        context.AddRange(unit, ingredient, batch, line, issue, issueLine,
            new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, Side = "PURCHASED", Quantity = 12m, Version = purchasedVersion, EnteredBy = actor, EnteredAt = DateTime.UtcNow },
            new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, Side = "ISSUED", Quantity = 10m, Version = issuedVersion, EnteredBy = actor, EnteredAt = DateTime.UtcNow },
            new ReconciliationDisposition { DispositionId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, Category = "ACCEPTED_VARIANCE", Reason = "Kết luận cũ", Version = 1, DisposedBy = actor, DisposedAt = DateTime.UtcNow });
        return new(batch, line, actor);
    }

    private sealed record Fixture(ReconciliationBatch Batch, ReconciliationBatchLine Line, byte[] Actor);

    private sealed class StubCurrentUser : IPCManagement.Api.Security.ICurrentUserService
    {
        public string? GetUserId(System.Security.Claims.ClaimsPrincipal user) => Guid.Empty.ToString();
        public IReadOnlyList<string> GetRoleNames(System.Security.Claims.ClaimsPrincipal user) => ["COORDINATION"];
        public string? GetWarehouseId(System.Security.Claims.ClaimsPrincipal user) => null;
    }

    private sealed class BarrierTransactionRunner(Barrier barrier) : IEfTransactionRunner
    {
        private async Task<TResult> Run<TResult>(Func<CancellationToken, Task<TResult>> operation, CancellationToken token)
        {
            await Task.Run(() => barrier.SignalAndWait(token), token);
            return await operation(token);
        }

        public async Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => await Run(async token => { await operation(token); return true; }, cancellationToken);
        public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => Run(operation, cancellationToken);
        public Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion, Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => Run(operation, cancellationToken);
    }

    private sealed class ReconciliationTestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            var included = new HashSet<Type>
            {
                typeof(MenuVersion), typeof(QuantityImportBatch), typeof(MealQuantityPlan), typeof(MenuSchedule), typeof(MealQuantityPlanLine),
                typeof(ReconciliationBatch), typeof(ReconciliationBatchLine), typeof(ReconciliationBatchContributor), typeof(ReconciliationActual), typeof(ReconciliationActualRevision),
                typeof(ReconciliationDisposition), typeof(Ingredient), typeof(Unit), typeof(InventoryIssue), typeof(InventoryIssueLine),
                typeof(InventoryReturn), typeof(InventoryReturnLine), typeof(AuditLog)
            };
            foreach (var entityType in typeof(AuditLog).Assembly.GetTypes().Where(type => type.Namespace == typeof(AuditLog).Namespace && type.IsClass && !included.Contains(type)))
                modelBuilder.Ignore(entityType);

            modelBuilder.Entity<MenuVersion>().HasKey(x => x.MenuVersionId);
            modelBuilder.Entity<MenuVersion>().Ignore(x => x.Customer);
            modelBuilder.Entity<QuantityImportBatch>().HasKey(x => x.ImportBatchId);
            modelBuilder.Entity<QuantityImportBatch>().Ignore(x => x.ImportedByNavigation);
            modelBuilder.Entity<MealQuantityPlan>().HasKey(x => x.QuantityPlanId);
            modelBuilder.Entity<MealQuantityPlan>().Ignore(x => x.ConfirmedByNavigation);
            modelBuilder.Entity<MealQuantityPlan>().Ignore(x => x.CompletedByNavigation);
            modelBuilder.Entity<MenuSchedule>().HasKey(x => x.MenuScheduleId);
            modelBuilder.Entity<MenuSchedule>().Ignore(x => x.Customer);
            modelBuilder.Entity<MenuSchedule>().Ignore(x => x.CustomerWeekMenuTier);
            modelBuilder.Entity<MenuSchedule>().Ignore(x => x.Menu);
            modelBuilder.Entity<MealQuantityPlanLine>().HasKey(x => x.QuantityPlanLineId);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(x => x.Customer);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(x => x.Menu);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(x => x.Productionplanlines);
            modelBuilder.Entity<MealQuantityPlanLine>().Ignore(x => x.Quantityadjustments);
            modelBuilder.Entity<MealQuantityPlan>().HasOne(x => x.ImportBatch).WithMany(x => x.Mealquantityplans).HasForeignKey(x => x.ImportBatchId);
            modelBuilder.Entity<MenuSchedule>().HasOne(x => x.MenuVersion).WithMany(x => x.Menuschedules).HasForeignKey(x => x.MenuVersionId);
            modelBuilder.Entity<MealQuantityPlanLine>().HasOne(x => x.QuantityPlan).WithMany(x => x.Mealquantityplanlines).HasForeignKey(x => x.QuantityPlanId);
            modelBuilder.Entity<MealQuantityPlanLine>().HasOne(x => x.MenuSchedule).WithMany(x => x.Mealquantityplanlines).HasForeignKey(x => x.MenuScheduleId);

            modelBuilder.Entity<Ingredient>().HasKey(x => x.IngredientId);
            modelBuilder.Entity<Ingredient>().Ignore(x => x.Warehouse);
            modelBuilder.Entity<Ingredient>().Ignore(x => x.Inventoryissuelines);
            modelBuilder.Entity<Ingredient>().Ignore(x => x.Inventoryreceiptlines);
            modelBuilder.Entity<Ingredient>().Ignore(x => x.Inventoryreturnlines);
            modelBuilder.Entity<Ingredient>().Ignore(x => x.Currentstocks);
            modelBuilder.Entity<Ingredient>().Ignore(x => x.Stockmovements);
            modelBuilder.Entity<Ingredient>().HasOne(x => x.Unit).WithMany(x => x.Ingredients).HasForeignKey(x => x.UnitId);
            modelBuilder.Entity<Unit>().HasKey(x => x.UnitId);
            modelBuilder.Entity<Unit>().Ignore(x => x.Inventoryissuelines);
            modelBuilder.Entity<Unit>().Ignore(x => x.Inventoryreceiptlines);
            modelBuilder.Entity<Unit>().Ignore(x => x.Inventoryreturnlines);
            modelBuilder.Entity<Unit>().Ignore(x => x.Currentstocks);
            modelBuilder.Entity<Unit>().Ignore(x => x.Stockmovements);
            modelBuilder.Entity<ReconciliationBatch>().HasKey(x => x.BatchId);
            modelBuilder.Entity<ReconciliationBatchLine>().HasKey(x => x.BatchLineId);
            modelBuilder.Entity<ReconciliationBatchLine>().HasOne(x => x.Batch).WithMany(x => x.Lines).HasForeignKey(x => x.BatchId);
            modelBuilder.Entity<ReconciliationBatchLine>().HasOne(x => x.Ingredient).WithMany().HasForeignKey(x => x.IngredientId);
            modelBuilder.Entity<ReconciliationBatchLine>().HasOne(x => x.CanonicalUnit).WithMany().HasForeignKey(x => x.CanonicalUnitId);
            modelBuilder.Entity<ReconciliationBatchContributor>().HasKey(x => x.ContributorId);
            modelBuilder.Entity<ReconciliationBatchContributor>().HasOne(x => x.BatchLine).WithMany(x => x.Contributors).HasForeignKey(x => x.BatchLineId);
            modelBuilder.Entity<ReconciliationActual>().HasKey(x => x.ActualId);
            modelBuilder.Entity<ReconciliationActual>().Property(x => x.Version).IsConcurrencyToken();
            modelBuilder.Entity<ReconciliationActual>().HasOne(x => x.BatchLine).WithMany().HasForeignKey(x => x.BatchLineId);
            modelBuilder.Entity<ReconciliationActualRevision>().HasKey(x => x.RevisionId);
            modelBuilder.Entity<ReconciliationDisposition>().HasKey(x => x.DispositionId);
            modelBuilder.Entity<ReconciliationDisposition>().Property(x => x.Version).IsConcurrencyToken();
            modelBuilder.Entity<ReconciliationDisposition>().HasOne(x => x.BatchLine).WithMany().HasForeignKey(x => x.BatchLineId);
            modelBuilder.Entity<InventoryIssue>().HasKey(x => x.IssueId);
            modelBuilder.Entity<InventoryIssue>().Ignore(x => x.Warehouse);
            modelBuilder.Entity<InventoryIssue>().Ignore(x => x.IssuedByNavigation);
            modelBuilder.Entity<InventoryIssue>().Ignore(x => x.ReceivedByNavigation);
            modelBuilder.Entity<InventoryIssue>().Ignore(x => x.MaterialRequest);
            modelBuilder.Entity<InventoryIssue>().Ignore(x => x.ReconciliationBatch);
            modelBuilder.Entity<InventoryIssueLine>().HasKey(x => x.IssueLineId);
            modelBuilder.Entity<InventoryIssueLine>().Ignore(x => x.Ingredient);
            modelBuilder.Entity<InventoryIssueLine>().Ignore(x => x.Unit);
            modelBuilder.Entity<InventoryIssueLine>().Ignore(x => x.MaterialRequestLine);
            modelBuilder.Entity<InventoryIssueLine>().Ignore(x => x.ReconciliationBatchLine);
            modelBuilder.Entity<InventoryIssueLine>().HasOne(x => x.Issue).WithMany(x => x.Inventoryissuelines).HasForeignKey(x => x.IssueId);
            modelBuilder.Entity<InventoryReturn>().HasKey(x => x.ReturnId);
            modelBuilder.Entity<InventoryReturn>().Ignore(x => x.Warehouse);
            modelBuilder.Entity<InventoryReturn>().Ignore(x => x.CreatedByNavigation);
            modelBuilder.Entity<InventoryReturn>().Ignore(x => x.ReceivedByNavigation);
            modelBuilder.Entity<InventoryReturn>().Ignore(x => x.Issue);
            modelBuilder.Entity<InventoryReturnLine>().HasKey(x => x.ReturnLineId);
            modelBuilder.Entity<InventoryReturnLine>().Ignore(x => x.Ingredient);
            modelBuilder.Entity<InventoryReturnLine>().Ignore(x => x.Unit);
            modelBuilder.Entity<InventoryReturnLine>().Ignore(x => x.SourceIssueLine);
            modelBuilder.Entity<InventoryReturnLine>().HasOne(x => x.Return).WithMany(x => x.Inventoryreturnlines).HasForeignKey(x => x.ReturnId);
            modelBuilder.Entity<AuditLog>().HasKey(x => x.AuditId);
            modelBuilder.Entity<AuditLog>().Ignore(x => x.ChangedByNavigation);
        }
    }
}
