using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class MrxAuditScopeQueryTests
{
    [Fact]
    public async Task Batch_scope_includes_related_daily_issue_amendment_revision_and_disposition_ids()
    {
        await using var context = CreateContext();
        var graph = SeedGraph(context);
        AddAudit(context, nameof(InventoryIssueLine), context.Reconciliationbatchdailylines.Local.Single().DailyLineId, "Inventory");
        var legacyNote = context.Auditlogs.Local.Single(audit => audit.EntityName == nameof(InventoryIssueLine)
            && audit.EntityId!.SequenceEqual(context.Reconciliationbatchdailylines.Local.Single().DailyLineId));
        legacyNote.FieldName = nameof(InventoryIssueLine.IssuedQty);
        legacyNote.Reason = "Retained daily-keyed note";
        var revision = context.Reconciliationsourcerevisions.Local.Single();
        AddAudit(context, nameof(MenuVersion), revision.PreviousMenuVersionId, "Planning");
        await context.SaveChangesAsync();

        var rows = await new MrxAuditScopeQuery(context).Apply(context.Auditlogs.AsNoTracking(), graph.BatchId)
            .Select(audit => audit.EntityName)
            .ToListAsync();

        rows.Should().BeEquivalentTo([
            nameof(ReconciliationBatch), nameof(ReconciliationBatchDailyLine), nameof(InventoryIssueLine), nameof(InventoryIssueLine),
            nameof(MenuVersion),
            nameof(MenuAmendment), nameof(ReconciliationSourceRevision), nameof(ReconciliationDailyDisposition),
            nameof(MealQuantityPlanLine)
        ]);
    }

    [Fact]
    public async Task Batch_scope_excludes_unrelated_mrx_batch_and_default_inventory_ids()
    {
        await using var context = CreateContext();
        var graph = SeedGraph(context);
        var other = SeedGraph(context);
        AddAudit(context, nameof(ReconciliationBatch), other.BatchId, "Reconciliation");
        var defaultIssueId = GuidHelper.NewId();
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = defaultIssueId, IssueCode = "DEFAULT-ISSUE", IssueDate = new DateOnly(2026, 7, 20),
            WarehouseId = GuidHelper.NewId(), IssuedBy = GuidHelper.NewId(), CreatedAt = DateTime.UtcNow
        });
        AddAudit(context, nameof(InventoryIssue), defaultIssueId, "Inventory");
        var otherDailyId = context.Reconciliationbatchdailylines.Local.Single(line => line.BatchId.SequenceEqual(other.BatchId)).DailyLineId;
        AddAudit(context, nameof(InventoryIssueLine), otherDailyId, "Inventory");
        context.Auditlogs.Local.Single(audit => audit.EntityName == nameof(InventoryIssueLine)
            && audit.EntityId!.SequenceEqual(otherDailyId)).FieldName = nameof(InventoryIssueLine.IssuedQty);
        var otherVersionId = context.Reconciliationsourcerevisions.Local.Single(revision => revision.BatchId.SequenceEqual(other.BatchId)).PreviousMenuVersionId;
        AddAudit(context, nameof(MenuVersion), otherVersionId, "Planning");
        await context.SaveChangesAsync();

        var ids = await new MrxAuditScopeQuery(context).Apply(context.Auditlogs.AsNoTracking(), graph.BatchId)
            .Select(audit => audit.EntityId)
            .ToListAsync();

        ids.Should().OnlyContain(id => id != null
            && !id.SequenceEqual(other.BatchId));
        ids.Should().NotContain(id => id != null && id.SequenceEqual(defaultIssueId));
        ids.Should().NotContain(id => id != null && (id.SequenceEqual(otherDailyId) || id.SequenceEqual(otherVersionId)));
    }

    [Fact]
    public async Task Global_scope_excludes_default_inventory_audit_with_same_business_area()
    {
        await using var context = CreateContext();
        var graph = SeedGraph(context);
        var defaultIssueId = GuidHelper.NewId();
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = defaultIssueId, IssueCode = "DEFAULT-ISSUE", IssueDate = new DateOnly(2026, 7, 20),
            WarehouseId = GuidHelper.NewId(), IssuedBy = GuidHelper.NewId(), CreatedAt = DateTime.UtcNow
        });
        AddAudit(context, nameof(InventoryIssue), defaultIssueId, "Inventory");
        await context.SaveChangesAsync();

        var ids = await new MrxAuditScopeQuery(context).Apply(context.Auditlogs.AsNoTracking(), null)
            .Select(audit => audit.EntityId)
            .ToListAsync();

        ids.Should().Contain(id => id != null && id.SequenceEqual(graph.IssueLineId));
        ids.Should().NotContain(id => id != null && id.SequenceEqual(defaultIssueId));
    }

    private static IpcManagementContext CreateContext() => new(
        new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"mrx-audit-scope-{Guid.NewGuid():N}")
            .Options);

    private static Graph SeedGraph(IpcManagementContext context)
    {
        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var dailyId = GuidHelper.NewId();
        var issueId = GuidHelper.NewId();
        var issueLineId = GuidHelper.NewId();
        var amendmentId = GuidHelper.NewId();
        var revisionId = GuidHelper.NewId();
        var planLineId = GuidHelper.NewId();
        var actorId = GuidHelper.NewId();
        var batch = new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "IN_PROGRESS", Version = 1, CreatedBy = actorId, CreatedAt = DateTime.UtcNow
        };
        var line = new ReconciliationBatchLine
        {
            BatchLineId = lineId, BatchId = batchId, Batch = batch, IngredientId = GuidHelper.NewId(),
            CanonicalUnitId = GuidHelper.NewId(), RequiredQuantity = 10m, FrozenTolerance = 0m,
            ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1
        };
        var daily = new ReconciliationBatchDailyLine
        {
            DailyLineId = dailyId, BatchLineId = lineId, BatchId = batchId,
            IngredientId = line.IngredientId, CanonicalUnitId = line.CanonicalUnitId,
            ServiceDate = new DateOnly(2026, 7, 20), RequiredQuantity = 10m, Version = 1, BatchLine = line
        };
        batch.Lines.Add(line);
        line.DailyLines.Add(daily);
        var contributor = new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = lineId, DailyLineId = dailyId,
            MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = planLineId, DishBomId = GuidHelper.NewId(),
            SourceQuantity = 10m, BatchLine = line, DailyLine = daily
        };
        line.Contributors.Add(contributor);
        var amendment = new MenuAmendment
        {
            MenuAmendmentId = amendmentId, CustomerId = GuidHelper.NewId(), WeekStartDate = new DateOnly(2026, 7, 20),
            Status = "EXECUTED", Reason = "MRX", ImpactSnapshotJson = "{}", CreatedBy = actorId, CreatedAt = DateTime.UtcNow
        };
        var revision = new ReconciliationSourceRevision
        {
            SourceRevisionId = revisionId, MenuAmendmentId = amendmentId, BatchId = batchId,
            PreviousMenuVersionId = GuidHelper.NewId(), AppliedMenuVersionId = batch.MenuVersionId,
            RevisionNumber = 1, Status = "APPLIED", Reason = "MRX", AppliedBy = actorId,
            AppliedAt = DateTime.UtcNow, AppliedByRole = "ADMIN", ApplyMode = "DIRECT"
        };
        var issue = new InventoryIssue
        {
            IssueId = issueId, IssueCode = $"MRX-{Guid.NewGuid():N}", IssueDate = daily.ServiceDate,
            WarehouseId = GuidHelper.NewId(), ReconciliationBatchId = batchId, IssuedBy = actorId, CreatedAt = DateTime.UtcNow
        };
        var issueLine = new InventoryIssueLine
        {
            IssueLineId = issueLineId, IssueId = issueId, Issue = issue, IngredientId = line.IngredientId,
            UnitId = line.CanonicalUnitId, RequestedQty = 10m, IssuedQty = 10m,
            ReconciliationBatchLineId = lineId, ReconciliationBatchDailyLineId = dailyId,
            ReconciliationServiceDate = daily.ServiceDate
        };
        issue.Inventoryissuelines.Add(issueLine);
        var disposition = new ReconciliationDailyDisposition
        {
            DispositionId = GuidHelper.NewId(), DailyLineId = dailyId, Category = "ACCEPTED_VARIANCE",
            Reason = "MRX", Version = 1, DisposedBy = actorId, DisposedAt = DateTime.UtcNow, DailyLine = daily
        };
        context.AddRange(batch, line, daily, contributor, amendment, revision, issue, issueLine, disposition);
        AddAudit(context, nameof(ReconciliationBatch), batchId, "Reconciliation");
        AddAudit(context, nameof(ReconciliationBatchDailyLine), dailyId, "Reconciliation");
        AddAudit(context, nameof(InventoryIssueLine), issueLineId, "Inventory");
        AddAudit(context, nameof(MenuAmendment), amendmentId, "Reconciliation");
        AddAudit(context, nameof(ReconciliationSourceRevision), revisionId, "Reconciliation");
        AddAudit(context, nameof(ReconciliationDailyDisposition), disposition.DispositionId, "RECONCILIATION");
        AddAudit(context, nameof(MealQuantityPlanLine), planLineId, "Reconciliation");
        return new Graph(batchId, issueLineId);
    }

    private static void AddAudit(IpcManagementContext context, string entityName, byte[] entityId, string area) =>
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = GuidHelper.NewId(),
            BusinessArea = area, EntityName = entityName, EntityId = entityId, FieldName = "Test"
        });

    private sealed record Graph(byte[] BatchId, byte[] IssueLineId);
}
