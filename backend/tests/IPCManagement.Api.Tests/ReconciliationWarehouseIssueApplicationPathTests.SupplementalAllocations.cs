using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed partial class ReconciliationWarehouseIssueApplicationPathTests
{
    [Fact]
    public async Task Retained_client_top_up_completes_daily_baseline_after_allocated_initial_shortage()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
        await connection.OpenAsync();
        await using var db = new RelationalIssueContext(new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var fixture = await CreateReconciliationIssueFixtureAsync(db);
        var service = AllocationIssueService(db, fixture);
        fixture.Request.Lines[0].IssuedQty = 1.5m;
        await service.CreateAsync(fixture.Request, fixture.ActorId);
        fixture.Request.CommandId = Guid.NewGuid().ToString();
        fixture.Request.IsSupplemental = true;
        fixture.Request.ExpectedVersion = 4;
        fixture.Request.Lines[0].RequestedQty = 0.5m;
        fixture.Request.Lines[0].IssuedQty = 0.5m;
        fixture.Request.Lines[0].VarianceReason = "Bù phần thiếu từ client cũ";
        fixture.Request.Lines[0].Allocations = null;
        await service.CreateAsync(fixture.Request, fixture.ActorId);
        var runner = new EfTransactionRunner(db, fixture.RequestContext, new SystemOperationModeGuard(db));
        var batches = new ReconciliationBatchService(db, runner, fixture.RequestContext);
        var daily = await batches.GetWarehouseDailyAsync(fixture.Request.ReconciliationBatchId!);
        Assert.Equal("WEEK_COMPLETE", daily!.WeeklyStatus);
        var day = daily.Dates.Single(x => x.ServiceDate == fixture.Request.IssueDate);
        Assert.Equal("EXACT", Assert.Single(day.Lines).QuantityStatus);
        Assert.Equal(0m, Assert.Single(day.Lines).RemainingQuantity);
        Assert.Equal(1, await db.Reconciliationissueallocations.CountAsync());
    }

    [Fact]
    public async Task Reconciliation_issue_requires_warehouse_handoff_even_with_current_batch_version()
    {
        await using var context = CreateContext();
        var fixture = await CreateReconciliationIssueFixtureAsync(context);
        var batch = Assert.Single(context.Reconciliationbatches.Local);
        batch.Status = "READY";
        batch.Version = fixture.Request.ExpectedVersion = 2;
        await context.SaveChangesAsync();
        var before = CaptureEffects(context);

        var error = await Assert.ThrowsAsync<ResourceConflictException>(() => fixture.Service.CreateAsync(fixture.Request, fixture.ActorId));

        Assert.Contains("Chuyển sang Kho", error.Message);
        Assert.Equal(before, CaptureEffects(context));
    }

    [Fact]
    public async Task Daily_status_does_not_claim_complete_when_unplanned_issue_offsets_baseline_shortage()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
        await connection.OpenAsync();
        await using var db = new RelationalIssueContext(new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var fixture = await CreateReconciliationIssueFixtureAsync(db);
        var service = AllocationIssueService(db, fixture);
        fixture.Request.Lines[0].IssuedQty = 1.5m;
        await service.CreateAsync(fixture.Request, fixture.ActorId);
        await SeedApprovedExtraAsync(db, fixture);
        fixture.Request.CommandId = Guid.NewGuid().ToString(); fixture.Request.IsSupplemental = true; fixture.Request.ExpectedVersion = 4;
        fixture.Request.Lines[0].RequestedQty = 1.5m; fixture.Request.Lines[0].IssuedQty = 1.5m;
        fixture.Request.Lines[0].VarianceReason = "Cấp ngoài nhu cầu";
        fixture.Request.Lines[0].Allocations = [new() { Purpose = "UNPLANNED_EXTRA", Quantity = 1.5m }];
        await service.CreateAsync(fixture.Request, fixture.ActorId);
        var runner = new EfTransactionRunner(db, fixture.RequestContext, new SystemOperationModeGuard(db));
        var batches = new ReconciliationBatchService(db, runner, fixture.RequestContext);
        var daily = await batches.GetWarehouseDailyAsync(fixture.Request.ReconciliationBatchId!);
        Assert.NotNull(daily);
        var day = daily.Dates.Single(x => x.ServiceDate == fixture.Request.IssueDate);
        Assert.Equal("PARTIAL", day.Status);
        Assert.Equal("IN_PROGRESS", daily.WeeklyStatus);
        Assert.Equal("PURPOSE_SHORTAGE", Assert.Single(day.Lines).QuantityStatus);
        Assert.Equal(3m, Assert.Single(day.Lines).IssuedQuantity);
    }

    [Fact]
    public async Task Supplemental_allocations_fulfill_extra_demand_without_hiding_baseline_shortage()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
        await connection.OpenAsync();
        await using var db = new RelationalIssueContext(new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var fixture = await CreateReconciliationIssueFixtureAsync(db);
        var service = AllocationIssueService(db, fixture);
        fixture.Request.Lines[0].IssuedQty = 1.5m;
        await service.CreateAsync(fixture.Request, fixture.ActorId);
        var material = await SeedApprovedExtraAsync(db, fixture);
        fixture.Request.CommandId = Guid.NewGuid().ToString(); fixture.Request.IsSupplemental = true; fixture.Request.ExpectedVersion = 4;
        fixture.Request.Lines[0].RequestedQty = 1; fixture.Request.Lines[0].IssuedQty = 1; fixture.Request.Lines[0].VarianceReason = "Cấp cho suất phát sinh đã duyệt";
        fixture.Request.Lines[0].Allocations = [new() { Purpose = "APPROVED_EXTRA_DEMAND", Quantity = 1,
            DemandMaterialId = GuidHelper.ToGuidString(material.DemandMaterialId), ExpectedDemandVersion = 3 }];
        var receipt = await service.CreateAsync(fixture.Request, fixture.ActorId);
        var balance = Assert.Single((await ReconciliationSupplementalFulfillmentQuery.GetAsync(db, material.BatchId, fixture.Request.IssueDate)).Lines);
        Assert.Equal(0.5m, balance.BaselineRemainingQuantity);
        Assert.Equal(0m, Assert.Single(balance.ExtraDemands).RemainingQuantity);
        Assert.False(balance.IsDemandFulfilled);
        var completionRunner = new EfTransactionRunner(db, fixture.RequestContext, new SystemOperationModeGuard(db));
        var batches = new ReconciliationBatchService(db, completionRunner, fixture.RequestContext);
        var completion = new ReconciliationCompletionService(db, batches, completionRunner, fixture.RequestContext);
        await Assert.ThrowsAsync<BusinessRuleException>(() => completion.CompleteAsync(fixture.Request.ReconciliationBatchId!,
            new CompleteReconciliationBatchRequest(5), fixture.ActorId));
        var replay = await service.CreateAsync(fixture.Request, fixture.ActorId);
        Assert.Equal(receipt!.IssueId, replay!.IssueId);
        Assert.Equal(2, await db.Reconciliationissueallocations.CountAsync());
        fixture.Request.CommandId = Guid.NewGuid().ToString(); fixture.Request.ExpectedVersion = 5;
        fixture.Request.Lines[0].RequestedQty = 0.5m; fixture.Request.Lines[0].IssuedQty = 0.5m;
        fixture.Request.Lines[0].Allocations = [new() { Purpose = "BASELINE_SHORTAGE", Quantity = 0.5m }];
        await service.CreateAsync(fixture.Request, fixture.ActorId);
        var fulfilled = Assert.Single((await ReconciliationSupplementalFulfillmentQuery.GetAsync(db, material.BatchId, fixture.Request.IssueDate)).Lines);
        Assert.True(fulfilled.IsDemandFulfilled);
        Assert.Equal(3m, fulfilled.NetIssuedQuantity);
        Assert.Equal(2m, (await db.Reconciliationbatchdailylines.SingleAsync()).RequiredQuantity);
        Assert.Equal(20m, (await db.Currentstocks.SingleAsync()).CurrentQty);
        Assert.Empty(await db.Stockmovements.ToListAsync());
        var completed = await completion.CompleteAsync(fixture.Request.ReconciliationBatchId!, new CompleteReconciliationBatchRequest(6), fixture.ActorId);
        Assert.Equal("COMPLETED", completed.Status);
        var reports = new ReconciliationReportsService(db, batches, fixture.RequestContext);
        Assert.Empty((await reports.GetVarianceRegisterAsync(fixture.Request.ReconciliationBatchId, null)).Rows);
        var completedRow = Assert.Single((await reports.GetCompletedRegisterAsync(new IPCManagement.Api.Shared.Contracts.PagedRequestDto())).Rows);
        Assert.Equal(3m, completedRow.TotalRequired);
        Assert.Equal(3m, completedRow.TotalIssued);
        Assert.Equal(0m, completedRow.TotalVariance);
    }

    [Theory]
    [InlineData("sum")]
    [InlineData("wrong-material")]
    [InlineData("stale-demand")]
    [InlineData("pending-demand")]
    [InlineData("over-extra")]
    [InlineData("over-baseline")]
    [InlineData("missing-purpose")]
    public async Task Invalid_supplemental_allocation_rolls_back_receipt_and_batch_version(string kind)
    {
        await using var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
        await connection.OpenAsync();
        await using var db = new RelationalIssueContext(new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var fixture = await CreateReconciliationIssueFixtureAsync(db);
        var service = AllocationIssueService(db, fixture);
        fixture.Request.Lines[0].IssuedQty = 1.5m;
        await service.CreateAsync(fixture.Request, fixture.ActorId);
        var material = await SeedApprovedExtraAsync(db, fixture);
        fixture.Request.CommandId = Guid.NewGuid().ToString(); fixture.Request.IsSupplemental = true; fixture.Request.ExpectedVersion = 4;
        fixture.Request.Lines[0].RequestedQty = 1; fixture.Request.Lines[0].IssuedQty = 1; fixture.Request.Lines[0].VarianceReason = "Xuất thêm";
        var allocation = new ReconciliationIssueAllocationRequest { Purpose = "APPROVED_EXTRA_DEMAND", Quantity = 1,
            DemandMaterialId = GuidHelper.ToGuidString(material.DemandMaterialId), ExpectedDemandVersion = 3 };
        fixture.Request.Lines[0].Allocations = [allocation];
        switch (kind)
        {
            case "sum": allocation.Quantity = 0.5m; break;
            case "wrong-material": allocation.DemandMaterialId = Guid.NewGuid().ToString(); break;
            case "stale-demand": allocation.ExpectedDemandVersion = 2; break;
            case "pending-demand": (await db.Reconciliationsupplementaldemands.SingleAsync()).Status = "PENDING"; await db.SaveChangesAsync(); break;
            case "over-extra": allocation.Quantity = 2; fixture.Request.Lines[0].IssuedQty = 2; fixture.Request.Lines[0].RequestedQty = 2; break;
            case "over-baseline": allocation.Purpose = "BASELINE_SHORTAGE"; allocation.DemandMaterialId = null; allocation.ExpectedDemandVersion = null; break;
            case "missing-purpose": fixture.Request.Lines[0].Allocations.Clear(); break;
        }
        var before = await CaptureCompleteLedgerAsync(db);
        var failure = await Record.ExceptionAsync(() => service.CreateAsync(fixture.Request, fixture.ActorId));
        Assert.True(failure is BusinessRuleException or DbUpdateConcurrencyException, failure?.ToString() ?? "Mutation unexpectedly succeeded");
        db.ChangeTracker.Clear();
        Assert.Equal(before, await CaptureCompleteLedgerAsync(db));
        Assert.Single(await db.Reconciliationissueallocations.ToListAsync());
    }

    private static InventoryIssueService AllocationIssueService(IpcManagementContext db, ReconciliationIssueFixture fixture) => new(
        new InventoryIssueRepository(db), new UnitOfWork(db),
        new StockLedgerService(new CurrentStockRepository(db), new StockMovementRepository(db)),
        new EfTransactionRunner(db, fixture.RequestContext, new SystemOperationModeGuard(db)),
        new FixedWarehouseResolver(GuidHelper.ParseGuidString(fixture.Request.WarehouseId) ?? db.Warehouses.Single().WarehouseId),
        new MaterialRequestCompletionTransitionService(db), db, fixture.RequestContext, new SystemOperationModeGuard(db));

    private static async Task<ReconciliationSupplementalDemandMaterial> SeedApprovedExtraAsync(IpcManagementContext db, ReconciliationIssueFixture fixture)
    {
        var daily = await db.Reconciliationbatchdailylines.SingleAsync();
        var demand = new ReconciliationSupplementalDemand { DemandId = GuidHelper.NewId(), BatchId = daily.BatchId,
            ServiceDate = daily.ServiceDate, Status = "APPROVED", Version = 3, SnapshotBatchVersion = 4,
            Reason = "Nhu cầu phát sinh đã được xác nhận", SnapshotFingerprint = new string('A', 64), CreatedBy = fixture.Actor,
            CreatedAt = DateTime.UtcNow, DecidedBy = fixture.Actor, DecidedAt = DateTime.UtcNow };
        var material = new ReconciliationSupplementalDemandMaterial { DemandMaterialId = GuidHelper.NewId(), DemandId = demand.DemandId,
            Demand = demand, BatchId = daily.BatchId, DailyLineId = daily.DailyLineId, IngredientId = daily.IngredientId,
            CanonicalUnitId = daily.CanonicalUnitId, RequiredQuantity = 1 };
        var dishId = GuidHelper.NewId();
        db.Dishes.Add(new Dish { DishId = dishId, DishCode = "DISH-EXTRA", DishName = "Món phát sinh", IsActive = true });
        var source = new ReconciliationBatchContributor { ContributorId = GuidHelper.NewId(), BatchLineId = daily.BatchLineId,
            DailyLineId = daily.DailyLineId, DishId = dishId, MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(),
            DishBomId = GuidHelper.NewId(), FrozenDishCode = "DISH-EXTRA", FrozenDishName = "Món phát sinh", FrozenShiftName = "MORNING",
            FrozenMenuVariant = "savory", FrozenServings = 2, SourceQuantity = 2, FrozenBomQuantityPerServing = 1,
            FrozenBomUnitToBaseRate = 1, FrozenCanonicalUnitToBaseRate = 1 };
        db.Reconciliationbatchcontributors.Add(source);
        var dish = new ReconciliationSupplementalDemandDish { DemandDishId = GuidHelper.NewId(), DemandId = demand.DemandId,
            DishId = dishId, ShiftName = "MORNING", MenuVariant = "savory", FrozenDishCode = "DISH-EXTRA", FrozenDishName = "Món phát sinh", ExtraServings = 1 };
        var contribution = new ReconciliationSupplementalDemandContribution { DemandContributionId = GuidHelper.NewId(),
            DemandDishId = dish.DemandDishId, DemandDish = dish, DemandMaterialId = material.DemandMaterialId, DemandMaterial = material,
            FrozenContributorId = source.ContributorId, CanonicalQuantityPerServing = 1, FrozenBomQuantityPerServing = 1,
            FrozenBomUnitToBaseRate = 1, FrozenCanonicalUnitToBaseRate = 1, RequiredQuantity = 1 };
        dish.Contributions.Add(contribution); material.Contributions.Add(contribution); demand.Dishes.Add(dish);
        demand.Materials.Add(material); db.Reconciliationsupplementaldemands.Add(demand); await db.SaveChangesAsync();
        return material;
    }
}
