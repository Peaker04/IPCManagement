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

public sealed partial class ReconciliationServiceTests
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

    [Fact]
    public async Task Disposition_is_rejected_until_batch_is_in_progress()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        fixture.Batch.Status = "READY";
        context.RemoveRange(context.ChangeTracker.Entries<ReconciliationDisposition>().Select(entry => entry.Entity));
        await context.SaveChangesAsync();
        var service = new ReconciliationActualService(context, new ImmediateTransactionRunner(), ProtectedContext());

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.SetDispositionAsync(
            GuidHelper.ToGuidString(fixture.Line.BatchLineId), new("ACCEPTED_VARIANCE", "Không được xét sớm", null), GuidHelper.ToGuidString(fixture.Actor)));

        Assert.Contains("đang đối chiếu", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(context.Reconciliationdispositions);
    }

    [Fact]
    public async Task Disposition_is_rejected_when_line_has_no_current_trigger()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        context.ChangeTracker.Entries<ReconciliationActual>().Single(entry => entry.Entity.Side == "PURCHASED").Entity.Quantity = 10m;
        context.ChangeTracker.Entries<InventoryIssueLine>().Single().Entity.IssuedQty = 10m;
        context.RemoveRange(context.ChangeTracker.Entries<ReconciliationDisposition>().Select(entry => entry.Entity));
        await context.SaveChangesAsync();
        var runner = new ImmediateTransactionRunner();
        var batches = new ReconciliationBatchService(context, runner, ProtectedContext());
        var line = Assert.Single((await batches.GetAsync(GuidHelper.ToGuidString(fixture.Batch.BatchId)))!.Lines);
        Assert.Empty(line.Triggers);
        var service = new ReconciliationActualService(context, runner, ProtectedContext());

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.SetDispositionAsync(
            GuidHelper.ToGuidString(fixture.Line.BatchLineId), new("ACCEPTED_VARIANCE", "Không có chênh lệch", null), GuidHelper.ToGuidString(fixture.Actor)));

        Assert.Contains("chênh lệch", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Empty(context.Reconciliationdispositions);
    }

    [Fact]
    public async Task Disposition_rejects_legacy_purchased_variance_when_ledger_issued_is_exact()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        context.ChangeTracker.Entries<InventoryIssueLine>().Single().Entity.IssuedQty = 10m;
        context.RemoveRange(context.ChangeTracker.Entries<ReconciliationDisposition>().Select(entry => entry.Entity));
        await context.SaveChangesAsync();
        var service = new ReconciliationActualService(context, new ImmediateTransactionRunner(), ProtectedContext());

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.SetDispositionAsync(
            GuidHelper.ToGuidString(fixture.Line.BatchLineId), new("ACCEPTED_VARIANCE", "Legacy không có authority", null), GuidHelper.ToGuidString(fixture.Actor)));

        Assert.Empty(context.Reconciliationdispositions);
    }

    [Theory]
    [InlineData("ACCEPTED_VARIANCE")]
    [InlineData("CORRECTION_REQUIRED")]
    [InlineData("FOLLOW_UP_REQUIRED")]
    public async Task Every_allowed_disposition_category_round_trips_through_report_contract(string category)
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        context.ChangeTracker.Entries<InventoryIssueLine>().Single().Entity.IssuedQty = 8m;
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
    public async Task Completion_rejects_missing_linked_issue_even_with_legacy_actual_and_disposition()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        context.RemoveRange(context.ChangeTracker.Entries<InventoryIssueLine>().Select(entry => entry.Entity));
        await context.SaveChangesAsync();
        var runner = new ImmediateTransactionRunner();
        var batches = new ReconciliationBatchService(context, runner, ProtectedContext());
        var completion = new ReconciliationCompletionService(context, batches, runner, ProtectedContext());

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => completion.CompleteAsync(
            GuidHelper.ToGuidString(fixture.Batch.BatchId), new(1), GuidHelper.ToGuidString(fixture.Actor)));

        Assert.Contains("số lượng xuất kho liên kết", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("IN_PROGRESS", fixture.Batch.Status);
    }

    [Fact]
    public async Task Completion_rejects_batch_with_unresolved_source_delta_before_finalizing()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        context.Reconciliationsourcerevisions.Add(new ReconciliationSourceRevision
        {
            SourceRevisionId = GuidHelper.NewId(), MenuAmendmentId = GuidHelper.NewId(), BatchId = fixture.Batch.BatchId,
            PreviousMenuVersionId = fixture.Batch.MenuVersionId, AppliedMenuVersionId = GuidHelper.NewId(), RevisionNumber = 1,
            Status = "APPLIED", Reason = "Tăng số suất", AppliedBy = fixture.Actor, AppliedAt = DateTime.UtcNow
        });
        context.Reconciliationsourcedeltas.Add(new ReconciliationSourceDelta
        {
            SourceDeltaId = GuidHelper.NewId(), SourceRevisionId = context.Reconciliationsourcerevisions.Local.Single().SourceRevisionId,
            BatchId = fixture.Batch.BatchId, DailyLineId = GuidHelper.NewId(), IngredientId = fixture.Line.IngredientId,
            CanonicalUnitId = fixture.Line.CanonicalUnitId, PreviousRequiredQuantity = 10m, NewRequiredQuantity = 12m,
            DeltaQuantity = 2m, WorkKind = "SUPPLEMENTAL_ISSUE", Status = "PENDING", Version = 1, CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        var runner = new ImmediateTransactionRunner();
        var completion = new ReconciliationCompletionService(context, new ReconciliationBatchService(context, runner, ProtectedContext()), runner, ProtectedContext());

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => completion.CompleteAsync(
            GuidHelper.ToGuidString(fixture.Batch.BatchId), new(1), GuidHelper.ToGuidString(fixture.Actor)));

        Assert.Contains("thay đổi nguồn", error.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("IN_PROGRESS", fixture.Batch.Status);
    }

    [Fact]
    public async Task Issued_batch_revision_persists_positive_delta_invalidates_only_affected_disposition_and_replays_idempotently()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        var daily = new ReconciliationBatchDailyLine
        {
            DailyLineId = GuidHelper.NewId(), BatchLineId = fixture.Line.BatchLineId, BatchId = fixture.Batch.BatchId,
            IngredientId = fixture.Line.IngredientId, CanonicalUnitId = fixture.Line.CanonicalUnitId,
            ServiceDate = new DateOnly(2026, 8, 25), RequiredQuantity = 10m, Version = 1, BatchLine = fixture.Line
        };
        fixture.Line.DailyLines.Add(daily);
        context.ChangeTracker.Entries<InventoryIssueLine>().Single().Entity.ReconciliationBatchDailyLineId = daily.DailyLineId;
        context.Reconciliationdailydispositions.Add(new ReconciliationDailyDisposition
        {
            DispositionId = GuidHelper.NewId(), DailyLineId = daily.DailyLineId, DailyLine = daily,
            Category = "ACCEPTED_VARIANCE", Reason = "Quyết định cũ", Version = 1,
            DisposedBy = fixture.Actor, DisposedAt = DateTime.UtcNow
        });
        context.Reconciliationtolerances.Add(new ReconciliationTolerance
        {
            ToleranceId = GuidHelper.NewId(), ScopeKind = "SYSTEM_DEFAULT", Value = 0.5m, Version = 1,
            CreatedBy = fixture.Actor, CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        var amendmentId = GuidHelper.ToGuidString(GuidHelper.NewId());
        var appliedVersionId = GuidHelper.ToGuidString(GuidHelper.NewId());
        var service = new ReconciliationSourceRevisionService(context);
        var requirements = new[] { new ReconciliationRevisionMaterialFact(daily.ServiceDate, GuidHelper.ToGuidString(daily.IngredientId), GuidHelper.ToGuidString(daily.CanonicalUnitId), 12m) };

        var revision = await service.StageIssuedBatchAsync(
            GuidHelper.ToGuidString(fixture.Batch.BatchId), amendmentId, GuidHelper.ToGuidString(fixture.Batch.MenuVersionId),
            appliedVersionId, requirements, GuidHelper.ToGuidString(fixture.Actor), "Tăng số suất");
        var replay = await service.StageIssuedBatchAsync(
            GuidHelper.ToGuidString(fixture.Batch.BatchId), amendmentId, GuidHelper.ToGuidString(fixture.Batch.MenuVersionId),
            appliedVersionId, requirements, GuidHelper.ToGuidString(fixture.Actor), "Tăng số suất");

        Assert.Equal(revision.SourceRevisionId, replay.SourceRevisionId);
        Assert.Single(await context.Reconciliationsourcerevisions.ToListAsync());
        var delta = Assert.Single(await context.Reconciliationsourcedeltas.ToListAsync());
        Assert.Equal(2m, delta.DeltaQuantity);
        Assert.Equal("SUPPLEMENTAL_ISSUE", delta.WorkKind);
        Assert.Equal("PENDING", delta.Status);
        var disposition = await context.Reconciliationdailydispositions.SingleAsync();
        Assert.NotNull(disposition.InvalidatedAt);
        Assert.Equal(fixture.Actor, disposition.InvalidatedBy);
        Assert.Equal(10m, daily.RequiredQuantity);
        var queue = await service.GetPendingPageAsync(new ReconciliationSourceDeltaPageQuery { BatchId = GuidHelper.ToGuidString(fixture.Batch.BatchId) });
        var queued = Assert.Single(queue.Items);
        Assert.Equal(GuidHelper.ToGuidString(daily.DailyLineId), queued.DailyLineId);
        Assert.Equal("SUPPLEMENTAL_ISSUE", queued.WorkKind);
    }

    [Fact]
    public async Task Unissued_batch_revision_replaces_current_projection_without_pending_warehouse_work()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        fixture.Batch.Status = "DRAFT";
        context.RemoveRange(context.ChangeTracker.Entries<InventoryIssueLine>().Select(entry => entry.Entity));
        context.RemoveRange(context.ChangeTracker.Entries<InventoryIssue>().Select(entry => entry.Entity));
        var daily = new ReconciliationBatchDailyLine
        {
            DailyLineId = GuidHelper.NewId(), BatchLineId = fixture.Line.BatchLineId, BatchId = fixture.Batch.BatchId,
            IngredientId = fixture.Line.IngredientId, CanonicalUnitId = fixture.Line.CanonicalUnitId,
            ServiceDate = new DateOnly(2026, 8, 25), RequiredQuantity = 10m, Version = 1, BatchLine = fixture.Line
        };
        fixture.Line.DailyLines.Add(daily);
        context.Reconciliationtolerances.Add(new ReconciliationTolerance
        {
            ToleranceId = GuidHelper.NewId(), ScopeKind = "SYSTEM_DEFAULT", Value = 0.5m, Version = 1,
            CreatedBy = fixture.Actor, CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        var appliedVersionId = GuidHelper.ToGuidString(GuidHelper.NewId());
        var service = new ReconciliationSourceRevisionService(context);

        var revision = await service.StageBatchAsync(
            GuidHelper.ToGuidString(fixture.Batch.BatchId), GuidHelper.ToGuidString(GuidHelper.NewId()),
            GuidHelper.ToGuidString(fixture.Batch.MenuVersionId), appliedVersionId,
            [new(daily.ServiceDate, GuidHelper.ToGuidString(daily.IngredientId), GuidHelper.ToGuidString(daily.CanonicalUnitId), 12m,
                [new(GuidHelper.ToGuidString(GuidHelper.NewId()), GuidHelper.ToGuidString(GuidHelper.NewId()),
                    GuidHelper.ToGuidString(GuidHelper.NewId()), GuidHelper.ToGuidString(GuidHelper.NewId()),
                    "MORNING", "DISH", "Món", 12, 1m, 0m, 12m)])],
            GuidHelper.ToGuidString(fixture.Actor), "Tăng số suất");

        Assert.Equal("APPLIED", revision.Status);
        var delta = Assert.Single(await context.Reconciliationsourcedeltas.ToListAsync());
        Assert.Equal("RESOLVED", delta.Status);
        Assert.NotNull(delta.ResolvedAt);
        Assert.Equal(12m, daily.RequiredQuantity);
        Assert.Equal(12m, fixture.Line.RequiredQuantity);
        Assert.Equal(ReconciliationBatchService.RequiredId(appliedVersionId), fixture.Batch.MenuVersionId);
    }

    [Fact]
    public async Task Issued_batch_new_ingredient_creates_hidden_zero_placeholder_and_pending_delta()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        var daily = new ReconciliationBatchDailyLine
        {
            DailyLineId = GuidHelper.NewId(), BatchLineId = fixture.Line.BatchLineId, BatchId = fixture.Batch.BatchId,
            IngredientId = fixture.Line.IngredientId, CanonicalUnitId = fixture.Line.CanonicalUnitId,
            ServiceDate = new DateOnly(2026, 8, 25), RequiredQuantity = 10m, Version = 1, BatchLine = fixture.Line
        };
        fixture.Line.DailyLines.Add(daily);
        context.ChangeTracker.Entries<InventoryIssueLine>().Single().Entity.ReconciliationBatchDailyLineId = daily.DailyLineId;
        context.Reconciliationtolerances.Add(new ReconciliationTolerance
        {
            ToleranceId = GuidHelper.NewId(), ScopeKind = "SYSTEM_DEFAULT", Value = 0.5m, Version = 1,
            CreatedBy = fixture.Actor, CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        var newIngredientId = GuidHelper.ToGuidString(GuidHelper.NewId());
        var service = new ReconciliationSourceRevisionService(context);

        await service.StageBatchAsync(
            GuidHelper.ToGuidString(fixture.Batch.BatchId), GuidHelper.ToGuidString(GuidHelper.NewId()),
            GuidHelper.ToGuidString(fixture.Batch.MenuVersionId), GuidHelper.ToGuidString(GuidHelper.NewId()),
            [
                new(daily.ServiceDate, GuidHelper.ToGuidString(daily.IngredientId), GuidHelper.ToGuidString(daily.CanonicalUnitId), 10m),
                new(daily.ServiceDate, newIngredientId, GuidHelper.ToGuidString(daily.CanonicalUnitId), 3m)
            ], GuidHelper.ToGuidString(fixture.Actor), "Đổi món");

        var delta = Assert.Single(await context.Reconciliationsourcedeltas.ToListAsync());
        Assert.Equal("PENDING", delta.Status);
        Assert.Equal(3m, delta.NewRequiredQuantity);
        var placeholder = await context.Reconciliationbatchdailylines.SingleAsync(item => item.IngredientId == ReconciliationBatchService.RequiredId(newIngredientId));
        Assert.Equal(0m, placeholder.RequiredQuantity);
    }

    [Fact]
    public async Task AggregateAndCompletion_Should_IgnoreDefaultAndLegacyCollisionQuantities()
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, purchasedVersion: 1, issuedVersion: 1);
        context.ChangeTracker.Entries<InventoryIssueLine>().Single().Entity.IssuedQty = 10m;
        context.RemoveRange(context.ChangeTracker.Entries<ReconciliationDisposition>().Select(entry => entry.Entity));
        context.Inventoryissues.AddRange(
            CollisionIssue("ISS-DEFAULT-COLLISION", GuidHelper.NewId(), null, GuidHelper.NewId(), null, 101m),
            CollisionIssue("ISS-LEGACY-COLLISION", null, null, null, null, 303m));
        await context.SaveChangesAsync();
        var requestContext = ProtectedContext();
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);

        var projected = await batches.GetAsync(GuidHelper.ToGuidString(fixture.Batch.BatchId));

        var projectedLine = Assert.Single(projected!.Lines);
        Assert.Equal(10m, projectedLine.IssuedQuantity);
        Assert.Equal("MATCHED", projectedLine.Status);
        Assert.Empty(projectedLine.Triggers);
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
        var menuVersionId = GuidHelper.NewId();
        var importBatchId = GuidHelper.NewId();
        var scheduleId = GuidHelper.NewId();
        var planLineId = GuidHelper.NewId();
        var bomId = GuidHelper.NewId();
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = menuVersionId, QuantityImportBatchId = importBatchId, Status = "READY", Version = 2,
            CreatedBy = actorId, CreatedAt = DateTime.UtcNow,
            Lines = [new ReconciliationBatchLine { BatchLineId = lineId, IngredientId = GuidHelper.NewId(), CanonicalUnitId = GuidHelper.NewId(), RequiredQuantity = 2, FrozenTolerance = 0.1m, ToleranceSourceKind = "TEST", ToleranceSourceVersion = "1", Version = 1,
                Contributors = [new ReconciliationBatchContributor { ContributorId = GuidHelper.NewId(), MenuScheduleId = scheduleId, MealQuantityPlanLineId = planLineId, DishBomId = bomId, SourceQuantity = 2 }] }]
        });
        context.Auditlogs.AddRange(
            new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow.AddMinutes(-1), ChangedBy = actorId, BusinessArea = "Reconciliation", EntityName = nameof(QuantityImportBatch), EntityId = importBatchId, FieldName = "Commit", NewValue = "fingerprint", Reason = "Cam kết nguồn" },
            new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId, BusinessArea = "MenuVersion", EntityName = nameof(MenuSchedule), EntityId = importBatchId, FieldName = "Status", NewValue = "identity collision" });
        await context.SaveChangesAsync();

        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), ProtectedContext());
        var change = Assert.Single(await service.ListSourceChangesAsync(GuidHelper.ToGuidString(batchId)));

        Assert.Equal(nameof(QuantityImportBatch), change.EntityName);
        Assert.Equal("Commit", change.FieldName);
    }

    [Fact]
    public async Task List_batches_projects_business_week_instead_of_creation_date()
    {
        await using var context = CreateContext();
        var menuVersionId = GuidHelper.NewId();
        var customerId = GuidHelper.NewId();
        context.Menuversions.Add(new MenuVersion { MenuVersionId = menuVersionId, CustomerId = customerId, WeekStartDate = new DateOnly(2026, 9, 21), VersionNo = 1, Status = "PUBLISHED", CreatedAt = new DateTime(2026, 9, 13), UpdatedAt = new DateTime(2026, 9, 13) });
        context.Reconciliationbatches.Add(new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = menuVersionId, QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 1, CreatedBy = GuidHelper.NewId(), CreatedAt = new DateTime(2026, 9, 13) });
        await context.SaveChangesAsync();

        var batch = Assert.Single(await new ReconciliationBatchService(context, new ImmediateTransactionRunner(), ProtectedContext()).ListAsync());

        Assert.Equal(new DateOnly(2026, 9, 21), batch.WeekStartDate);
        Assert.Equal(new DateOnly(2026, 9, 26), batch.WeekEndDate);
    }

    [Fact]
    public async Task Page_summaries_filter_customer_week_status_and_order_deterministically_without_loading_lines()
    {
        await using var context = CreateContext();
        var customerId = GuidHelper.NewId();
        var otherCustomerId = GuidHelper.NewId();
        var week = new DateOnly(2026, 10, 19);
        var firstVersion = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = customerId, WeekStartDate = week, VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        var secondVersion = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = customerId, WeekStartDate = week, VersionNo = 2, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        var otherVersion = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = otherCustomerId, WeekStartDate = week, VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        context.Menuversions.AddRange(firstVersion, secondVersion, otherVersion);
        var older = new ReconciliationBatch { BatchId = GuidHelper.ParseGuidString("00000000-0000-0000-0000-000000000001")!, MenuVersionId = firstVersion.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 2, CreatedBy = GuidHelper.NewId(), CreatedAt = new DateTime(2026, 10, 18, 9, 0, 0, DateTimeKind.Utc) };
        var newer = new ReconciliationBatch { BatchId = GuidHelper.ParseGuidString("00000000-0000-0000-0000-000000000002")!, MenuVersionId = secondVersion.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 3, CreatedBy = GuidHelper.NewId(), CreatedAt = new DateTime(2026, 10, 18, 9, 0, 0, DateTimeKind.Utc) };
        context.Reconciliationbatches.AddRange(older, newer,
            new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = otherVersion.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 1, CreatedBy = GuidHelper.NewId(), CreatedAt = DateTime.UtcNow },
            new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = firstVersion.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(), Status = "COMPLETED", Version = 4, CreatedBy = GuidHelper.NewId(), CreatedAt = DateTime.UtcNow });
        await context.SaveChangesAsync();
        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), ProtectedContext());

        var firstPage = await service.GetPageAsync(new ReconciliationBatchPageQuery
        {
            CustomerId = GuidHelper.ToGuidString(customerId), WeekStartDate = week, Status = "READY", PageNumber = 1, PageSize = 1
        });
        var secondPage = await service.GetPageAsync(new ReconciliationBatchPageQuery
        {
            CustomerId = GuidHelper.ToGuidString(customerId), WeekStartDate = week, Status = "READY", PageNumber = 2, PageSize = 1
        });

        Assert.Equal(2, firstPage.TotalCount);
        Assert.Equal(GuidHelper.ToGuidString(older.BatchId), Assert.Single(firstPage.Items).BatchId);
        Assert.Equal(GuidHelper.ToGuidString(newer.BatchId), Assert.Single(secondPage.Items).BatchId);
        Assert.All(firstPage.Items.Concat(secondPage.Items), item =>
        {
            Assert.Equal(GuidHelper.ToGuidString(customerId), item.CustomerId);
            Assert.Equal(week, item.WeekStartDate);
            Assert.Equal("READY", item.Status);
        });
        Assert.Empty(context.ChangeTracker.Entries<ReconciliationBatchLine>());
    }

    [Theory]
    [InlineData(5, 5)]
    [InlineData(6, 5)]
    [InlineData(6, 4)]
    public async Task Daily_review_drives_exact_disposition_reload_and_all_date_completion(decimal firstIssued, decimal secondIssued)
    {
        await using var context = CreateContext();
        var fixture = SeedInProgressLine(context, 1, 1);
        var first = Daily(new DateOnly(2026, 8, 25));
        var second = Daily(new DateOnly(2026, 8, 26));
        context.Reconciliationbatchdailylines.AddRange(first, second);
        var originalIssueLine = context.ChangeTracker.Entries<InventoryIssueLine>().Single().Entity;
        originalIssueLine.ReconciliationBatchDailyLineId = first.DailyLineId;
        originalIssueLine.RequestedQty = 5m;
        originalIssueLine.IssuedQty = firstIssued;
        var secondIssue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(), IssueCode = "ISS-SECOND-DATE", IssueDate = second.ServiceDate,
            WarehouseId = originalIssueLine.Issue.WarehouseId, ReconciliationBatchId = fixture.Batch.BatchId,
            IssuedBy = fixture.Actor, CreatedAt = DateTime.UtcNow
        };
        secondIssue.Inventoryissuelines.Add(new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(), Issue = secondIssue, IssueId = secondIssue.IssueId,
            IngredientId = fixture.Line.IngredientId, UnitId = fixture.Line.CanonicalUnitId,
            ReconciliationBatchLineId = fixture.Line.BatchLineId, ReconciliationBatchDailyLineId = second.DailyLineId,
            RequestedQty = 5m, IssuedQty = secondIssued
        });
        context.Inventoryissues.Add(secondIssue);
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = fixture.Actor,
            BusinessArea = "Inventory", EntityName = nameof(InventoryIssueLine), EntityId = first.DailyLineId,
            FieldName = nameof(InventoryIssueLine.IssuedQty), Reason = "First date issue reason"
        });
        await context.SaveChangesAsync();
        var runner = new ImmediateTransactionRunner();
        var batches = new ReconciliationBatchService(context, runner, ProtectedContext());
        var actuals = new ReconciliationActualService(context, runner, ProtectedContext());
        var completion = new ReconciliationCompletionService(context, batches, runner, ProtectedContext());
        var batchId = GuidHelper.ToGuidString(fixture.Batch.BatchId);
        var actor = GuidHelper.ToGuidString(fixture.Actor);
        var detail = (await batches.GetAsync(batchId))!;
        var review = Assert.IsType<ReconciliationDailyReviewDto>(detail.DailyReview);
        Assert.Equal(2, review.Lines.Count);
        var selected = Assert.Single(review.Lines, line => line.ServiceDate == first.ServiceDate);
        Assert.Equal(GuidHelper.ToGuidString(first.DailyLineId), selected.DailyLineId);
        Assert.Equal(5m, selected.RequiredQuantity);
        Assert.Equal(firstIssued, selected.IssuedQuantity);
        Assert.Equal("First date issue reason", Assert.Single(selected.IssueNotes!));
        Assert.Null(Assert.Single(review.Lines, line => line.ServiceDate == second.ServiceDate).IssueNotes);
        Assert.Null(selected.Disposition); // Weekly legacy conclusion cannot satisfy a daily line.
        if (firstIssued == 5 && secondIssued == 5)
        {
            var controller = new IPCManagement.Api.Features.Reconciliation.Controllers.ReconciliationBatchesController(
                batches, completion, null!, new StubCurrentUser("Warehouse"));
            var response = Assert.IsType<Microsoft.AspNetCore.Mvc.OkObjectResult>(await controller.Get(batchId, default));
            var operational = Assert.IsType<ApiResponse<ReconciliationBatchDto>>(response.Value).Data!;
            Assert.Null(operational.DailyReview);
            Assert.Empty(operational.Lines);
        }
        await Assert.ThrowsAsync<KeyNotFoundException>(() => actuals.SetDailyDispositionAsync(
            GuidHelper.ToGuidString(fixture.Line.BatchLineId), new("ACCEPTED_VARIANCE", "Wrong identity", null), actor));
        Assert.Empty(await context.Reconciliationdailydispositions.ToListAsync());
        if (firstIssued > 5)
        {
            Assert.Equal("NEEDS_REVIEW", selected.Status);
            await Assert.ThrowsAsync<InvalidOperationException>(() => completion.CompleteAsync(batchId, new(1), actor));
            await actuals.SetDailyDispositionAsync(selected.DailyLineId!, new("ACCEPTED_VARIANCE", "Daily decision", null), actor);
            await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => actuals.SetDailyDispositionAsync(
                selected.DailyLineId!, new("ACCEPTED_VARIANCE", "Stale writer", null), actor));
            context.ChangeTracker.Clear();
            var reloaded = (await batches.GetAsync(batchId))!.DailyReview!;
            Assert.Equal(1, Assert.Single(reloaded.Lines, line => line.DailyLineId == selected.DailyLineId).Disposition!.Version);
            Assert.Equal("Daily decision", Assert.Single(reloaded.Lines, line => line.DailyLineId == selected.DailyLineId).Disposition!.Reason);
            Assert.Null(Assert.Single(reloaded.Lines, line => line.DailyLineId != selected.DailyLineId).Disposition);
            await actuals.SetDailyDispositionAsync(selected.DailyLineId!, new("ACCEPTED_VARIANCE", "Corrected daily reason", 1), actor);
            context.ChangeTracker.Clear();
            var corrected = Assert.Single((await batches.GetAsync(batchId))!.DailyReview!.Lines, line => line.DailyLineId == selected.DailyLineId);
            Assert.Equal(2, corrected.Disposition!.Version);
            Assert.Equal("Corrected daily reason", corrected.Disposition.Reason);
            Assert.Single(await context.Reconciliationdailydispositions.ToListAsync());
        }
        else
        {
            Assert.Equal("MATCHED", selected.Status);
            await Assert.ThrowsAsync<InvalidOperationException>(() => actuals.SetDailyDispositionAsync(
                selected.DailyLineId!, new("ACCEPTED_VARIANCE", "No discrepancy", null), actor));
        }
        if (secondIssued < 5)
        {
            await Assert.ThrowsAsync<InvalidOperationException>(() => actuals.SetDailyDispositionAsync(
                GuidHelper.ToGuidString(second.DailyLineId), new("ACCEPTED_VARIANCE", "Cannot waive shortage", null), actor));
            await Assert.ThrowsAsync<InvalidOperationException>(() => completion.CompleteAsync(batchId, new(1), actor));
            Assert.NotEqual("WEEK_COMPLETE", (await batches.GetAsync(batchId))!.DailyReview!.WeeklyStatus);
        }
        else
        {
            Assert.Equal("WEEK_COMPLETE", (await batches.GetAsync(batchId))!.DailyReview!.WeeklyStatus);
            await completion.CompleteAsync(batchId, new(1), actor);
            context.ChangeTracker.Clear();
            Assert.Equal("COMPLETED", (await batches.GetAsync(batchId))!.Status);
        }

        ReconciliationBatchDailyLine Daily(DateOnly date) => new()
        {
            DailyLineId = GuidHelper.NewId(), BatchId = fixture.Batch.BatchId, BatchLineId = fixture.Line.BatchLineId,
            BatchLine = fixture.Line, IngredientId = fixture.Line.IngredientId, CanonicalUnitId = fixture.Line.CanonicalUnitId,
            ServiceDate = date, RequiredQuantity = 5m, Version = 1
        };
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
            RequestedQty = 10m, IssuedQty = 8m, ReconciliationBatchLineId = line.BatchLineId
        };
        issue.Inventoryissuelines.Add(issueLine);
        context.AddRange(unit, ingredient, batch, line, issue, issueLine,
            new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, Side = "PURCHASED", Quantity = 12m, Version = purchasedVersion, EnteredBy = actor, EnteredAt = DateTime.UtcNow },
            new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, Side = "ISSUED", Quantity = 10m, Version = issuedVersion, EnteredBy = actor, EnteredAt = DateTime.UtcNow },
            new ReconciliationDisposition { DispositionId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, Category = "ACCEPTED_VARIANCE", Reason = "Kết luận cũ", Version = 1, DisposedBy = actor, DisposedAt = DateTime.UtcNow });
        return new(batch, line, actor);
    }

    private sealed record Fixture(ReconciliationBatch Batch, ReconciliationBatchLine Line, byte[] Actor);

    private sealed class StubCurrentUser(string role = "Coordinator") : IPCManagement.Api.Security.ICurrentUserService
    {
        public string? GetUserId(System.Security.Claims.ClaimsPrincipal user) => Guid.Empty.ToString();
        public IReadOnlyList<string> GetRoleNames(System.Security.Claims.ClaimsPrincipal user) => [role];
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
                typeof(ReconciliationBatch), typeof(ReconciliationBatchLine), typeof(ReconciliationBatchDailyLine), typeof(ReconciliationBatchContributor), typeof(ReconciliationSourceRevision), typeof(ReconciliationSourceDelta), typeof(ReconciliationTolerance), typeof(ReconciliationDailyDisposition), typeof(ReconciliationActual), typeof(ReconciliationActualRevision),
                typeof(ReconciliationDisposition), typeof(BomAdjustment), typeof(Ingredient), typeof(Unit), typeof(InventoryIssue), typeof(InventoryIssueLine),
                typeof(InventoryReturn), typeof(InventoryReturnLine), typeof(AuditLog), typeof(Dish), typeof(DishBom)
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

            modelBuilder.Entity<Dish>().HasKey(x => x.DishId);
            modelBuilder.Entity<DishBom>().HasKey(x => x.BomId);
            modelBuilder.Entity<DishBom>().HasOne(x => x.Dish).WithMany(x => x.Dishboms).HasForeignKey(x => x.DishId);
            modelBuilder.Entity<DishBom>().HasOne(x => x.Ingredient).WithMany(x => x.Dishboms).HasForeignKey(x => x.IngredientId);
            modelBuilder.Entity<DishBom>().HasOne(x => x.Unit).WithMany(x => x.Dishboms).HasForeignKey(x => x.UnitId);
            modelBuilder.Entity<BomAdjustment>().HasKey(x => x.BomAdjustmentId);
            modelBuilder.Entity<BomAdjustment>().Ignore(x => x.Bom);
            modelBuilder.Entity<BomAdjustment>().Ignore(x => x.AdjustedByNavigation);
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
            modelBuilder.Entity<ReconciliationBatchDailyLine>().HasKey(x => x.DailyLineId);
            modelBuilder.Entity<ReconciliationBatchDailyLine>().HasOne(x => x.BatchLine).WithMany(x => x.DailyLines).HasForeignKey(x => x.BatchLineId);
            modelBuilder.Entity<ReconciliationBatchContributor>().HasOne(x => x.DailyLine).WithMany(x => x.Contributors).HasForeignKey(x => x.DailyLineId);
            modelBuilder.Entity<ReconciliationTolerance>().HasKey(x => x.ToleranceId);
            modelBuilder.Entity<ReconciliationSourceRevision>().HasKey(x => x.SourceRevisionId);
            modelBuilder.Entity<ReconciliationSourceRevision>().Ignore(x => x.Batch);
            modelBuilder.Entity<ReconciliationSourceRevision>().Ignore(x => x.Deltas);
            modelBuilder.Entity<ReconciliationSourceDelta>().HasKey(x => x.SourceDeltaId);
            modelBuilder.Entity<ReconciliationSourceDelta>().Ignore(x => x.SourceRevision);
            modelBuilder.Entity<ReconciliationSourceDelta>().Ignore(x => x.DailyLine);
            modelBuilder.Entity<ReconciliationDailyDisposition>().HasKey(x => x.DispositionId);
            modelBuilder.Entity<ReconciliationDailyDisposition>().HasOne(x => x.DailyLine).WithOne(x => x.Disposition).HasForeignKey<ReconciliationDailyDisposition>(x => x.DailyLineId);
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
