using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Inventory.Validators;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed partial class ReconciliationWarehouseIssueApplicationPathTests
{
    [Fact]
    public async Task Reconciliation_issue_accepts_manual_quantity_above_required_with_audited_reason()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
        await connection.OpenAsync();
        await using var context = new RelationalIssueContext(new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options);
        await context.Database.EnsureCreatedAsync();
        var fixture = await CreateReconciliationIssueFixtureAsync(context);
        fixture.Request.Lines[0].IssuedQty = 2.1m;
        fixture.Request.Lines[0].VarianceReason = "Bao bì thực tế cần thêm nguyên liệu";

        await fixture.Service.CreateAsync(fixture.Request, fixture.ActorId);

        var stored = Assert.Single(context.Inventoryissuelines.Local);
        Assert.Equal(2m, stored.RequestedQty);
        Assert.Equal(2.1m, stored.IssuedQty);
        var audit = Assert.Single(context.Auditlogs.Local, item => item.FieldName == nameof(InventoryIssueLine.IssuedQty));
        Assert.Equal(stored.IssueLineId, audit.EntityId);
        Assert.Equal("Bao bì thực tế cần thêm nguyên liệu", audit.Reason);
        Assert.Equal("2", audit.OldValue);
        Assert.Equal("2.1", audit.NewValue);
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), fixture.RequestContext);
        var detail = await batches.GetAsync(fixture.Request.ReconciliationBatchId!);
        Assert.Contains(audit.Reason!, Assert.Single(detail!.DailyReview!.Lines).IssueNotes!);
        Assert.Contains(audit.Reason!, Assert.Single(detail.Lines).IssueNotes!);
        var reports = new ReconciliationReportsService(context, batches, fixture.RequestContext);
        var variance = Assert.Single((await reports.GetVarianceRegisterAsync(fixture.Request.ReconciliationBatchId, null)).Rows);
        Assert.Contains(audit.Reason!, variance.IssueNotes!);
        Assert.Contains(await new MrxAuditScopeQuery(context).Apply(context.Auditlogs, stored.Issue.ReconciliationBatchId).ToListAsync(),
            item => item.AuditId.SequenceEqual(audit.AuditId));
        await fixture.Ledger.DidNotReceiveWithAnyArgs().RemoveStockWithCheckAsync(
            default!, default!, default!, default, default!, default!, default!, default!, default!, default!);

        var supplemental = CloneRequest(fixture.Request);
        supplemental.CommandId = $"note-supplemental-{Guid.NewGuid():N}";
        supplemental.ExpectedVersion = 4;
        supplemental.IsSupplemental = true;
        supplemental.Lines[0].RequestedQty = 0.2m;
        supplemental.Lines[0].IssuedQty = 0.2m;
        supplemental.Lines[0].VarianceReason = "Second issue reason";
        var second = await fixture.Service.CreateAsync(supplemental, fixture.ActorId);
        Assert.NotNull(second);
        var secondLine = await context.Inventoryissuelines.SingleAsync(line => line.IssueId == GuidHelper.ParseGuidString(second.IssueId));
        var secondAudit = await context.Auditlogs.SingleAsync(item => item.Reason == "Second issue reason");
        Assert.Equal(secondLine.IssueLineId, secondAudit.EntityId);
        Assert.NotEqual(stored.IssueLineId, secondAudit.EntityId);
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = fixture.Actor,
            BusinessArea = "Inventory", EntityName = nameof(InventoryIssueLine), EntityId = stored.ReconciliationBatchDailyLineId,
            FieldName = nameof(InventoryIssueLine.IssuedQty), Reason = "Legacy daily note"
        });
        await context.SaveChangesAsync();
        var reloaded = await batches.GetAsync(fixture.Request.ReconciliationBatchId!);
        Assert.Equal(new[] { audit.Reason!, "Second issue reason", "Legacy daily note" },
            Assert.Single(reloaded!.DailyReview!.Lines).IssueNotes);
        var scoped = await new MrxAuditScopeQuery(context).Apply(context.Auditlogs, stored.Issue.ReconciliationBatchId).ToListAsync();
        Assert.Contains(scoped, item => item.Reason == "Legacy daily note");
    }

    [Theory]
    [InlineData(1, false)]
    [InlineData(0, false)]
    [InlineData(0, true)]
    public async Task Reconciliation_initial_issue_requires_only_positive_frozen_lines(decimal secondRequired, bool includeZeroLine)
    {
        await using var context = CreateContext();
        var fixture = await CreateReconciliationIssueFixtureAsync(context);
        var batch = Assert.Single(context.Reconciliationbatches.Local);
        var secondLineId = GuidHelper.NewId();
        var secondDailyId = GuidHelper.NewId();
        var secondIngredientId = GuidHelper.NewId();
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = secondIngredientId, IngredientCode = "RETAINED-ZERO", IngredientName = "Retained ingredient",
            UnitId = fixture.UnitId, WarehouseId = Assert.Single(context.Warehouses.Local).WarehouseId, IsActive = true
        });
        batch.Lines.Add(new ReconciliationBatchLine
        {
            BatchLineId = secondLineId, BatchId = batch.BatchId, IngredientId = secondIngredientId,
            CanonicalUnitId = fixture.UnitId, RequiredQuantity = secondRequired, FrozenTolerance = 0.1m,
            ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1,
            DailyLines =
            [
                new ReconciliationBatchDailyLine
                {
                    DailyLineId = secondDailyId, BatchLineId = secondLineId, BatchId = batch.BatchId,
                    IngredientId = secondIngredientId, CanonicalUnitId = fixture.UnitId,
                    ServiceDate = fixture.Request.IssueDate, RequiredQuantity = secondRequired, Version = 1
                }
            ]
        });
        await context.SaveChangesAsync();
        if (includeZeroLine)
            fixture.Request.Lines.Add(new CreateInventoryIssueLineRequest
            {
                ReconciliationBatchLineId = GuidHelper.ToGuidString(secondLineId),
                ReconciliationBatchDailyLineId = GuidHelper.ToGuidString(secondDailyId),
                IngredientId = GuidHelper.ToGuidString(secondIngredientId), UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                RequestedQty = 0m, IssuedQty = 1m, VarianceReason = "Removed ingredient"
            });
        var before = CaptureEffects(context);

        if (secondRequired > 0 || includeZeroLine)
        {
            await Assert.ThrowsAsync<BusinessRuleException>(() => fixture.Service.CreateAsync(fixture.Request, fixture.ActorId));
            Assert.Equal(before, CaptureEffects(context));
            await fixture.Ledger.DidNotReceiveWithAnyArgs().RemoveStockWithCheckAsync(default!, default!, default!, default, default!, default!, default!, default!, default!, default!);
        }
        else
        {
            await fixture.Service.CreateAsync(fixture.Request, fixture.ActorId);
            Assert.Single(await context.Inventoryissuelines.ToListAsync());
        }
        Assert.Equal(secondRequired, (await context.Reconciliationbatchdailylines.AsNoTracking()
            .SingleAsync(line => line.DailyLineId == secondDailyId)).RequiredQuantity);
    }

    [Fact]
    public async Task Ready_snapshot_remains_exact_after_shared_master_edits_and_only_new_version_reflects_authority()
    {
        await using var context = CreateContext();
        var actor = GuidHelper.NewId();
        var unit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var warehouse = new Warehouse { WarehouseId = GuidHelper.NewId(), WarehouseCode = "WH", WarehouseName = "Kho", WarehouseType = "MAIN", IsOperationalActive = true };
        var ingredient = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "MAT-OLD", IngredientName = "Vật tư cũ", UnitId = unit.UnitId, Unit = unit, WarehouseId = warehouse.WarehouseId, Warehouse = warehouse, IsActive = true };
        var batch = new ReconciliationBatch
        {
            BatchId = GuidHelper.NewId(), MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "READY", Version = 2, CreatedBy = actor, CreatedAt = DateTime.UtcNow,
        };
        var line = new ReconciliationBatchLine
        {
            BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, Batch = batch, IngredientId = ingredient.IngredientId,
            Ingredient = ingredient, CanonicalUnitId = unit.UnitId, CanonicalUnit = unit, RequiredQuantity = 12.345678m,
            FrozenTolerance = 0.125m, ToleranceSourceKind = "INGREDIENT", ToleranceSourceVersion = "4", Version = 1,
        };
        line.Contributors.Add(new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line,
            MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId(), SourceQuantity = 12.345678m,
        });
        batch.Lines.Add(line);
        context.AddRange(unit, warehouse, ingredient, batch);
        await context.SaveChangesAsync();
        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), ProtectedContext());

        var before = await CaptureFrozenSnapshotAsync(context, batch.BatchId);
        ingredient.IngredientCode = "MAT-NEW";
        ingredient.IngredientName = "Vật tư mới";
        unit.UnitName = "kg changed";
        unit.ConvertRateToBase = 2;
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var reloaded = await service.GetAsync(GuidHelper.ToGuidString(batch.BatchId));
        var after = await CaptureFrozenSnapshotAsync(context, batch.BatchId);
        Assert.NotNull(reloaded);
        Assert.Equal(before, after);

        var newBatch = new ReconciliationBatch
        {
            BatchId = GuidHelper.NewId(), MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 2,
            CreatedBy = actor, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = GuidHelper.NewId(), IngredientId = ingredient.IngredientId, CanonicalUnitId = unit.UnitId,
                    RequiredQuantity = 24.691356m, FrozenTolerance = 0.25m, ToleranceSourceKind = "INGREDIENT", ToleranceSourceVersion = "5", Version = 1,
                }
            ]
        };
        context.Reconciliationbatches.Add(newBatch);
        await context.SaveChangesAsync();
        var next = await CaptureFrozenSnapshotAsync(context, newBatch.BatchId);

        Assert.NotEqual(before.MenuVersionId, next.MenuVersionId);
        Assert.NotEqual(before.QuantityImportBatchId, next.QuantityImportBatchId);
        Assert.NotEqual(before.RequiredQuantity, next.RequiredQuantity);
        Assert.Equal(before.IngredientId, next.IngredientId);
        Assert.Equal(before.CanonicalUnitId, next.CanonicalUnitId);
    }

}
