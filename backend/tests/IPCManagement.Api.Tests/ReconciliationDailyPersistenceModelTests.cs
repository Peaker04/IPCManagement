using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Migrations;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationDailyPersistenceModelTests
{
    private static IModel Model()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql("Server=localhost;Database=mrx_daily_model;User=root;Password=unused", ServerVersion.Parse("8.0.36-mysql"))
            .Options;
        using var context = new IpcManagementContext(options);
        return context.GetService<IDesignTimeModel>().Model;
    }

    [Fact]
    public void Daily_frozen_line_has_exact_weekly_owner_and_unique_service_date()
    {
        var model = Model();
        var daily = model.FindEntityType(typeof(ReconciliationBatchDailyLine))!;

        Assert.Equal("reconciliationbatchdailylines", daily.GetTableName());
        Assert.Equal(18, daily.FindProperty(nameof(ReconciliationBatchDailyLine.RequiredQuantity))!.GetPrecision());
        Assert.Equal(6, daily.FindProperty(nameof(ReconciliationBatchDailyLine.RequiredQuantity))!.GetScale());
        Assert.True(daily.FindProperty(nameof(ReconciliationBatchDailyLine.Version))!.IsConcurrencyToken);
        Assert.Contains(daily.GetIndexes(), index => index.IsUnique && index.Properties.Select(property => property.Name).SequenceEqual([
            nameof(ReconciliationBatchDailyLine.BatchLineId), nameof(ReconciliationBatchDailyLine.ServiceDate)]));

        var weeklyForeignKey = Assert.Single(daily.GetForeignKeys(), foreignKey =>
            foreignKey.PrincipalEntityType.ClrType == typeof(ReconciliationBatchLine));
        Assert.Equal(DeleteBehavior.Restrict, weeklyForeignKey.DeleteBehavior);
        Assert.Equal(
            [nameof(ReconciliationBatchDailyLine.BatchLineId), nameof(ReconciliationBatchDailyLine.BatchId), nameof(ReconciliationBatchDailyLine.IngredientId), nameof(ReconciliationBatchDailyLine.CanonicalUnitId)],
            weeklyForeignKey.Properties.Select(property => property.Name));
    }

    [Fact]
    public void Contributor_and_issue_line_daily_links_are_nullable_for_legacy_rows_but_restrict_deletion()
    {
        var model = Model();
        var contributor = model.FindEntityType(typeof(ReconciliationBatchContributor))!;
        var contributorLink = contributor.FindProperty(nameof(ReconciliationBatchContributor.DailyLineId))!;
        Assert.True(contributorLink.IsNullable);
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(contributor.GetForeignKeys(), foreignKey =>
            foreignKey.PrincipalEntityType.ClrType == typeof(ReconciliationBatchDailyLine)).DeleteBehavior);

        var issueLine = model.FindEntityType(typeof(InventoryIssueLine))!;
        Assert.True(issueLine.FindProperty(nameof(InventoryIssueLine.ReconciliationBatchDailyLineId))!.IsNullable);
        Assert.True(issueLine.FindProperty(nameof(InventoryIssueLine.ReconciliationServiceDate))!.IsNullable);
        var dailyIssueForeignKey = Assert.Single(issueLine.GetForeignKeys(), foreignKey =>
            foreignKey.PrincipalEntityType.ClrType == typeof(ReconciliationBatchDailyLine));
        Assert.Equal(DeleteBehavior.Restrict, dailyIssueForeignKey.DeleteBehavior);
        Assert.Equal(
            [nameof(InventoryIssueLine.ReconciliationBatchDailyLineId), nameof(InventoryIssueLine.ReconciliationBatchLineId), nameof(InventoryIssueLine.IngredientId), nameof(InventoryIssueLine.UnitId), nameof(InventoryIssueLine.ReconciliationServiceDate)],
            dailyIssueForeignKey.Properties.Select(property => property.Name));
    }

    [Fact]
    public void Frozen_kitchen_facts_are_nullable_for_legacy_rows_and_migration_is_additive()
    {
        var contributor = Model().FindEntityType(typeof(ReconciliationBatchContributor))!;
        Assert.True(contributor.FindProperty(nameof(ReconciliationBatchContributor.DishId))!.IsNullable);
        Assert.True(contributor.FindProperty(nameof(ReconciliationBatchContributor.FrozenShiftName))!.IsNullable);
        Assert.True(contributor.FindProperty(nameof(ReconciliationBatchContributor.FrozenServings))!.IsNullable);
        Assert.Equal(18, contributor.FindProperty(nameof(ReconciliationBatchContributor.FrozenBomQuantityPerServing))!.GetPrecision());
        Assert.Equal(6, contributor.FindProperty(nameof(ReconciliationBatchContributor.FrozenBomQuantityPerServing))!.GetScale());

        var operations = new InspectableKitchenFactsMigration().BuildUp();
        Assert.Equal(7, operations.OfType<AddColumnOperation>().Count(column => column.Table == "reconciliationbatchcontributors"));
        Assert.DoesNotContain(operations, operation => operation is InsertDataOperation or UpdateDataOperation or DeleteDataOperation or DropTableOperation);
    }

    [Fact]
    public void Daily_disposition_has_one_restricted_owner_and_additive_migration()
    {
        var model = Model();
        var disposition = model.FindEntityType(typeof(ReconciliationDailyDisposition))!;
        Assert.True(disposition.FindProperty(nameof(ReconciliationDailyDisposition.Version))!.IsConcurrencyToken);
        Assert.Contains(disposition.GetIndexes(), index => index.IsUnique
            && index.Properties.Single().Name == nameof(ReconciliationDailyDisposition.DailyLineId));
        Assert.Equal(DeleteBehavior.Restrict, Assert.Single(disposition.GetForeignKeys(), foreignKey =>
            foreignKey.PrincipalEntityType.ClrType == typeof(ReconciliationBatchDailyLine)).DeleteBehavior);

        var operations = new InspectableDailyDispositionMigration().BuildUp();
        Assert.Contains(operations.OfType<CreateTableOperation>(), operation => operation.Name == "reconciliationdailydispositions");
        Assert.DoesNotContain(operations, operation => operation is InsertDataOperation or UpdateDataOperation or DeleteDataOperation or DropTableOperation);
    }

    [Fact]
    public async Task Tuesday_issue_lineage_does_not_consume_or_change_monday_status()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"mrx-daily-{Guid.NewGuid()}")
            .Options;
        await using var context = new IpcManagementContext(options);
        var batchId = GuidHelper.NewId();
        var batchLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var mondayId = GuidHelper.NewId();
        var tuesdayId = GuidHelper.NewId();
        var batch = new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "IN_PROGRESS", Version = 1, CreatedBy = GuidHelper.NewId(), CreatedAt = DateTime.UtcNow
        };
        var weekly = new ReconciliationBatchLine
        {
            BatchLineId = batchLineId, BatchId = batchId, IngredientId = ingredientId, CanonicalUnitId = unitId,
            RequiredQuantity = 10m, FrozenTolerance = 0.000001m, ToleranceSourceKind = "SYSTEM_DEFAULT",
            ToleranceSourceVersion = "1", Version = 1, Batch = batch
        };
        var monday = new ReconciliationBatchDailyLine
        {
            DailyLineId = mondayId, BatchLineId = batchLineId, BatchId = batchId, IngredientId = ingredientId,
            CanonicalUnitId = unitId, ServiceDate = new DateOnly(2026, 9, 14), RequiredQuantity = 4m, Version = 1, BatchLine = weekly
        };
        var tuesday = new ReconciliationBatchDailyLine
        {
            DailyLineId = tuesdayId, BatchLineId = batchLineId, BatchId = batchId, IngredientId = ingredientId,
            CanonicalUnitId = unitId, ServiceDate = new DateOnly(2026, 9, 15), RequiredQuantity = 6m, Version = 1, BatchLine = weekly
        };
        var issue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(), IssueCode = "MRX-TUE", IssueDate = tuesday.ServiceDate,
            WarehouseId = GuidHelper.NewId(), ReconciliationBatchId = batchId, IssuedBy = GuidHelper.NewId(), CreatedAt = DateTime.UtcNow
        };
        var issueLine = new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(), IssueId = issue.IssueId, Issue = issue, IngredientId = ingredientId,
            UnitId = unitId, ReconciliationBatchLineId = batchLineId, ReconciliationBatchDailyLineId = tuesdayId,
            ReconciliationServiceDate = tuesday.ServiceDate, RequestedQty = 6m, IssuedQty = 6m, ReconciliationBatchDailyLine = tuesday
        };
        batch.Lines.Add(weekly);
        weekly.DailyLines.Add(monday);
        weekly.DailyLines.Add(tuesday);
        issue.Inventoryissuelines.Add(issueLine);
        context.AddRange(batch, issue);
        await context.SaveChangesAsync();

        var persistedIssueLines = await context.Inventoryissuelines
            .Where(line => line.ReconciliationBatchDailyLineId != null)
            .ToListAsync();
        var issuedByDay = persistedIssueLines
            .GroupBy(line => line.ReconciliationBatchDailyLineId!)
            .ToDictionary(group => Convert.ToHexString(group.Key), group => group.Sum(line => line.IssuedQty));

        var mondayIssued = issuedByDay.TryGetValue(Convert.ToHexString(mondayId), out var mondayQuantity) ? mondayQuantity : (decimal?)null;
        var tuesdayIssued = issuedByDay.TryGetValue(Convert.ToHexString(tuesdayId), out var tuesdayQuantity) ? tuesdayQuantity : (decimal?)null;
        Assert.Equal("UNTOUCHED", ReconciliationDailyIssuePolicy.ResolveLineStatus(
            monday.RequiredQuantity, mondayIssued, false).QuantityStatus);
        Assert.Equal("EXACT", ReconciliationDailyIssuePolicy.ResolveLineStatus(
            tuesday.RequiredQuantity, tuesdayIssued, false).QuantityStatus);
    }

    [Fact]
    public async Task Daily_warehouse_projection_keeps_day_statuses_separate_and_weekly_status_filter_independent()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"mrx-daily-projection-{Guid.NewGuid()}")
            .Options;
        await using var context = new DailyProjectionTestContext(options);
        var monday = new DateOnly(2026, 9, 14);
        var actor = GuidHelper.NewId();
        var batchId = GuidHelper.NewId();
        var weeklyLineId = GuidHelper.NewId();
        var mondayLineId = GuidHelper.NewId();
        var tuesdayLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var menuVersion = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(), CustomerId = GuidHelper.NewId(), WeekStartDate = monday,
            VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var ingredient = new Ingredient
        {
            IngredientId = ingredientId, IngredientCode = "RICE", IngredientName = "Gạo", UnitId = unitId,
            WarehouseId = GuidHelper.NewId(), Unit = unit, IsActive = true
        };
        var batch = new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = menuVersion.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "IN_PROGRESS", Version = 4, CreatedBy = actor, CreatedAt = DateTime.UtcNow
        };
        var weekly = new ReconciliationBatchLine
        {
            BatchLineId = weeklyLineId, BatchId = batchId, Batch = batch, IngredientId = ingredientId, Ingredient = ingredient,
            CanonicalUnitId = unitId, CanonicalUnit = unit, RequiredQuantity = 10m, FrozenTolerance = 0.000001m,
            ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1
        };
        weekly.DailyLines.Add(new ReconciliationBatchDailyLine
        {
            DailyLineId = mondayLineId, BatchLineId = weeklyLineId, BatchId = batchId, IngredientId = ingredientId,
            CanonicalUnitId = unitId, ServiceDate = monday, RequiredQuantity = 4m, Version = 1, BatchLine = weekly
        });
        weekly.DailyLines.Add(new ReconciliationBatchDailyLine
        {
            DailyLineId = tuesdayLineId, BatchLineId = weeklyLineId, BatchId = batchId, IngredientId = ingredientId,
            CanonicalUnitId = unitId, ServiceDate = monday.AddDays(1), RequiredQuantity = 6m, Version = 1, BatchLine = weekly
        });
        batch.Lines.Add(weekly);
        var issueLineId = GuidHelper.NewId();
        var issue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(), IssueCode = "ISS-TUE", IssueDate = monday.AddDays(1), WarehouseId = GuidHelper.NewId(),
            ReconciliationBatchId = batchId, IssuedBy = actor, CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = issueLineId, IngredientId = ingredientId, UnitId = unitId,
                    ReconciliationBatchLineId = weeklyLineId, ReconciliationBatchDailyLineId = tuesdayLineId,
                    ReconciliationServiceDate = monday.AddDays(1), RequestedQty = 6m, IssuedQty = 7m
                }
            ]
        };
        context.AddRange(menuVersion, unit, ingredient, batch, issue);
        await context.SaveChangesAsync();
        Assert.Equal(2, await context.Reconciliationbatchdailylines.CountAsync());
        var persistedWeeklyId = Convert.ToHexString((await context.Reconciliationbatchlines.SingleAsync()).BatchLineId);
        Assert.All(await context.Reconciliationbatchdailylines.ToListAsync(), daily =>
            Assert.Equal(persistedWeeklyId, Convert.ToHexString(daily.BatchLineId)));
        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), new SystemOperationRequestContext());

        var projection = await service.GetWarehouseDailyAsync(GuidHelper.ToGuidString(batchId));

        Assert.NotNull(projection);
        Assert.Equal("IN_PROGRESS", projection.WeeklyStatus);
        Assert.Equal(7, projection.Dates.Count);
        var mondayProjection = projection.Dates.Single(day => day.ServiceDate == monday);
        var tuesdayProjection = projection.Dates.Single(day => day.ServiceDate == monday.AddDays(1));
        Assert.Equal("UNTOUCHED", mondayProjection.Status);
        Assert.Equal("OVERAGE_REQUIRES_RESOLUTION", tuesdayProjection.Status);
        Assert.Equal(4m, mondayProjection.RequiredQuantity);
        Assert.Equal(0m, mondayProjection.IssuedQuantity);
        Assert.Equal(7m, tuesdayProjection.IssuedQuantity);
        Assert.All(projection.Dates.Skip(2), day => Assert.Equal("NO_REQUIREMENT", day.Status));

        var dispositionContext = new SystemOperationRequestContext { OperationKey = "reconciliation.daily-lines.disposition", ExpectedModeVersion = 1 };
        var dispositionService = new ReconciliationActualService(context, new ImmediateTransactionRunner(), dispositionContext);
        await dispositionService.SetDailyDispositionAsync(
            GuidHelper.ToGuidString(tuesdayLineId), new SetReconciliationDispositionRequest("ACCEPTED_VARIANCE", "Đã xác nhận phần xuất vượt của Thứ 3", null),
            GuidHelper.ToGuidString(actor));
        var resolvedProjection = await service.GetWarehouseDailyAsync(GuidHelper.ToGuidString(batchId));
        var resolvedTuesday = resolvedProjection!.Dates.Single(day => day.ServiceDate == monday.AddDays(1));
        Assert.Equal("COMPLETE", resolvedTuesday.Status);
        Assert.True(Assert.Single(resolvedTuesday.Lines).HasValidDisposition);
        Assert.Equal("UNTOUCHED", resolvedProjection.Dates.Single(day => day.ServiceDate == monday).Status);
        Assert.Equal("IN_PROGRESS", resolvedProjection.WeeklyStatus);

        var completionContext = new SystemOperationRequestContext { OperationKey = "reconciliation.complete", ExpectedModeVersion = 1 };
        var completion = new ReconciliationCompletionService(context, service, new ImmediateTransactionRunner(), completionContext);
        var completionError = await Assert.ThrowsAsync<InvalidOperationException>(() => completion.CompleteAsync(
            GuidHelper.ToGuidString(batchId), new CompleteReconciliationBatchRequest(4), GuidHelper.ToGuidString(actor)));
        Assert.Contains("ngày chưa xuất đủ", completionError.Message);

        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = GuidHelper.NewId(), IssueCode = "ISS-MON", IssueDate = monday, WarehouseId = issue.WarehouseId,
            ReconciliationBatchId = batchId, IssuedBy = actor, CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = GuidHelper.NewId(), IngredientId = ingredientId, UnitId = unitId,
                    ReconciliationBatchLineId = weeklyLineId, ReconciliationBatchDailyLineId = mondayLineId,
                    ReconciliationServiceDate = monday, RequestedQty = 4m, IssuedQty = 4m
                }
            ]
        });
        await context.SaveChangesAsync();
        var completed = await completion.CompleteAsync(
            GuidHelper.ToGuidString(batchId), new CompleteReconciliationBatchRequest(4), GuidHelper.ToGuidString(actor));
        Assert.Equal("COMPLETED", completed.Status);

        var confirmedReturn = new InventoryReturn
        {
            ReturnId = GuidHelper.NewId(), ReturnCode = "RET-TUE", ReturnDate = monday.AddDays(1), ReturnType = "RETURN",
            WarehouseId = issue.WarehouseId, IssueId = issue.IssueId, CreatedBy = actor, CreatedAt = DateTime.UtcNow,
            ReceivedBy = actor, ReceivedAt = DateTime.UtcNow,
            Inventoryreturnlines =
            [
                new InventoryReturnLine
                {
                    ReturnLineId = GuidHelper.NewId(), SourceIssueLineId = issueLineId, IngredientId = ingredientId,
                    UnitId = unitId, Quantity = 2m
                }
            ]
        };
        context.Inventoryreturns.Add(confirmedReturn);
        await context.SaveChangesAsync();

        var afterReturn = await service.GetWarehouseDailyAsync(GuidHelper.ToGuidString(batchId));
        var returnedTuesday = afterReturn!.Dates.Single(day => day.ServiceDate == monday.AddDays(1));
        Assert.Equal("PARTIAL", returnedTuesday.Status);
        Assert.Equal(5m, returnedTuesday.IssuedQuantity);
        Assert.Equal(2m, returnedTuesday.ReturnedQuantity);
        Assert.Equal("IN_PROGRESS", afterReturn.WeeklyStatus);
    }

    [Fact]
    public void Migration_is_additive_and_does_not_rewrite_existing_business_rows()
    {
        var operations = new InspectableMigration().BuildUp();
        var dailyTable = Assert.Single(operations.OfType<CreateTableOperation>(), operation =>
            operation.Name == "reconciliationbatchdailylines");

        Assert.Contains(dailyTable.Columns, column => column.Name == "ServiceDate" && !column.IsNullable);
        Assert.Contains(dailyTable.Columns, column => column.Name == "RequiredQuantity" && !column.IsNullable);
        Assert.Contains(operations.OfType<AddColumnOperation>(), column =>
            column.Table == "reconciliationbatchcontributors" && column.Name == "DailyLineId" && column.IsNullable);
        Assert.Contains(operations.OfType<AddColumnOperation>(), column =>
            column.Table == "inventoryissuelines" && column.Name == "reconciliationBatchDailyLineId" && column.IsNullable);
        Assert.Contains(operations.OfType<AddColumnOperation>(), column =>
            column.Table == "inventoryissuelines" && column.Name == "reconciliationServiceDate" && column.IsNullable);
        Assert.DoesNotContain(operations, operation =>
            operation is InsertDataOperation or UpdateDataOperation or DeleteDataOperation or DropTableOperation);
    }

    private sealed class DailyProjectionTestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<ReconciliationBatchLine>().Property(line => line.BatchLineId).ValueGeneratedNever();
            modelBuilder.Entity<ReconciliationBatchDailyLine>().Property(line => line.DailyLineId).ValueGeneratedNever();
        }
    }

    private sealed class InspectableKitchenFactsMigration : AddReconciliationFrozenKitchenCookingFacts
    {
        public IReadOnlyList<MigrationOperation> BuildUp()
        {
            var builder = new MigrationBuilder("Pomelo.EntityFrameworkCore.MySql");
            Up(builder);
            return builder.Operations;
        }
    }

    private sealed class InspectableDailyDispositionMigration : AddReconciliationDailyDispositions
    {
        public IReadOnlyList<MigrationOperation> BuildUp()
        {
            var builder = new MigrationBuilder("Pomelo.EntityFrameworkCore.MySql");
            Up(builder);
            return builder.Operations;
        }
    }

    private sealed class InspectableMigration : AddReconciliationDailyFrozenLineage
    {
        public IReadOnlyList<MigrationOperation> BuildUp()
        {
            var builder = new MigrationBuilder("Pomelo.EntityFrameworkCore.MySql");
            Up(builder);
            return builder.Operations;
        }
    }
}
