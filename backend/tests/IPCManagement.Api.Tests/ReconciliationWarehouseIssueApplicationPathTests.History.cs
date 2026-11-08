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

}
