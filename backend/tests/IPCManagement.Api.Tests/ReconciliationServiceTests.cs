using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationServiceTests
{
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

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateDraftAsync(
            new(GuidHelper.ToGuidString(menuVersionId), GuidHelper.ToGuidString(importBatchId)),
            Guid.NewGuid().ToString()));

        Assert.Contains("chưa được cam kết hợp lệ", error.Message);
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

    private static Fixture SeedInProgressLine(IpcManagementContext context, long purchasedVersion, long issuedVersion)
    {
        var actor = GuidHelper.NewId();
        var batch = new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "IN_PROGRESS", Version = 1, CreatedBy = actor, CreatedAt = DateTime.UtcNow };
        var line = new ReconciliationBatchLine { BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, Batch = batch, IngredientId = GuidHelper.NewId(), CanonicalUnitId = GuidHelper.NewId(), RequiredQuantity = 10m, FrozenTolerance = 0.5m, ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1 };
        batch.Lines.Add(line);
        context.AddRange(batch, line,
            new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, Side = "PURCHASED", Quantity = 12m, Version = purchasedVersion, EnteredBy = actor, EnteredAt = DateTime.UtcNow },
            new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, Side = "ISSUED", Quantity = 10m, Version = issuedVersion, EnteredBy = actor, EnteredAt = DateTime.UtcNow },
            new ReconciliationDisposition { DispositionId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, Category = "ACCEPTED_VARIANCE", Reason = "Kết luận cũ", Version = 1, DisposedBy = actor, DisposedAt = DateTime.UtcNow });
        return new(batch, line, actor);
    }

    private sealed record Fixture(ReconciliationBatch Batch, ReconciliationBatchLine Line, byte[] Actor);

    private sealed class ReconciliationTestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            var included = new HashSet<Type>
            {
                typeof(MenuVersion), typeof(QuantityImportBatch), typeof(MealQuantityPlan), typeof(MenuSchedule), typeof(MealQuantityPlanLine),
                typeof(ReconciliationBatch), typeof(ReconciliationBatchLine), typeof(ReconciliationActual), typeof(ReconciliationActualRevision),
                typeof(ReconciliationDisposition), typeof(AuditLog)
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

            modelBuilder.Entity<ReconciliationBatch>().HasKey(x => x.BatchId);
            modelBuilder.Entity<ReconciliationBatchLine>().HasKey(x => x.BatchLineId);
            modelBuilder.Entity<ReconciliationBatchLine>().HasOne(x => x.Batch).WithMany(x => x.Lines).HasForeignKey(x => x.BatchId);
            modelBuilder.Entity<ReconciliationActual>().HasKey(x => x.ActualId);
            modelBuilder.Entity<ReconciliationActual>().HasOne(x => x.BatchLine).WithMany().HasForeignKey(x => x.BatchLineId);
            modelBuilder.Entity<ReconciliationActualRevision>().HasKey(x => x.RevisionId);
            modelBuilder.Entity<ReconciliationDisposition>().HasKey(x => x.DispositionId);
            modelBuilder.Entity<ReconciliationDisposition>().HasOne(x => x.BatchLine).WithMany().HasForeignKey(x => x.BatchLineId);
            modelBuilder.Entity<AuditLog>().HasKey(x => x.AuditId);
            modelBuilder.Entity<AuditLog>().Ignore(x => x.ChangedByNavigation);
        }
    }
}
