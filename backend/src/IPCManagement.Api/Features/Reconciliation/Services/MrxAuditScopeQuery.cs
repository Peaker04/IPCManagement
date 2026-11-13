using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal sealed class MrxAuditScopeQuery(IpcManagementContext context)
{
    private static readonly string[] ScopedEntityNames =
    [
        nameof(ReconciliationBatch),
        nameof(ReconciliationBatchLine),
        nameof(ReconciliationBatchDailyLine),
        nameof(ReconciliationBatchContributor),
        nameof(ReconciliationSourceRevision),
        nameof(ReconciliationSourceDelta),
        nameof(ReconciliationDisposition),
        nameof(ReconciliationDailyDisposition),
        nameof(ReconciliationActual),
        nameof(ReconciliationActualRevision),
        nameof(InventoryIssue),
        nameof(InventoryIssueLine),
        nameof(InventoryReturn),
        nameof(InventoryReturnLine),
        nameof(StockMovement),
        nameof(MenuAmendment),
        nameof(MealQuantityPlanLine),
        nameof(MenuSchedule),
        nameof(MenuVersion),
        nameof(QuantityImportBatch)
    ];

    public async Task<IQueryable<AuditLog>> ApplyScopedAsync(
        IQueryable<AuditLog> audits,
        byte[]? batchId,
        CancellationToken token = default)
    {
        if (batchId is null || string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal))
        {
            return Apply(audits, batchId);
        }

        var batchInfo = await context.Reconciliationbatches.AsNoTracking()
            .Where(b => b.BatchId == batchId)
            .Select(b => new { b.BatchId, b.MenuVersionId, b.QuantityImportBatchId })
            .SingleOrDefaultAsync(token);

        if (batchInfo is null)
        {
            return audits.Where(_ => false);
        }

        var batchLines = await context.Reconciliationbatchlines.AsNoTracking()
            .Where(l => l.BatchId == batchId)
            .Select(l => l.BatchLineId)
            .ToListAsync(token);
        var dailyLines = await context.Reconciliationbatchdailylines.AsNoTracking()
            .Where(d => d.BatchId == batchId)
            .Select(d => d.DailyLineId)
            .ToListAsync(token);
        var contributors = batchLines.Count == 0
            ? []
            : await context.Reconciliationbatchcontributors.AsNoTracking()
                .Where(c => batchLines.Contains(c.BatchLineId))
                .Select(c => new { c.ContributorId, c.MealQuantityPlanLineId, c.MenuScheduleId })
                .ToListAsync(token);
        var revisions = await context.Reconciliationsourcerevisions.AsNoTracking()
            .Where(r => r.BatchId == batchId)
            .Select(r => new { r.SourceRevisionId, r.MenuAmendmentId, r.PreviousMenuVersionId, r.AppliedMenuVersionId })
            .ToListAsync(token);
        var deltas = await context.Reconciliationsourcedeltas.AsNoTracking()
            .Where(d => d.BatchId == batchId)
            .Select(d => d.SourceDeltaId)
            .ToListAsync(token);
        var dispositions = batchLines.Count == 0
            ? []
            : await context.Reconciliationdispositions.AsNoTracking()
                .Where(d => batchLines.Contains(d.BatchLineId))
                .Select(d => d.DispositionId)
                .ToListAsync(token);
        var dailyDispositions = dailyLines.Count == 0
            ? []
            : await context.Reconciliationdailydispositions.AsNoTracking()
                .Where(d => dailyLines.Contains(d.DailyLineId))
                .Select(d => d.DispositionId)
                .ToListAsync(token);
        var actuals = batchLines.Count == 0
            ? []
            : await context.Reconciliationactuals.AsNoTracking()
                .Where(a => batchLines.Contains(a.BatchLineId))
                .Select(a => a.ActualId)
                .ToListAsync(token);
        var actualRevisions = actuals.Count == 0
            ? []
            : await context.Reconciliationactualrevisions.AsNoTracking()
                .Where(r => actuals.Contains(r.ActualId))
                .Select(r => r.RevisionId)
                .ToListAsync(token);
        var issues = await context.Inventoryissues.AsNoTracking()
            .Where(i => i.ReconciliationBatchId == batchId)
            .Select(i => i.IssueId)
            .ToListAsync(token);
        var issueLines = issues.Count == 0
            ? []
            : await context.Inventoryissuelines.AsNoTracking()
                .Where(l => issues.Contains(l.IssueId))
                .Select(l => l.IssueLineId)
                .ToListAsync(token);
        var returns = issues.Count == 0
            ? []
            : await context.Inventoryreturns.AsNoTracking()
                .Where(r => issues.Contains(r.IssueId))
                .Select(r => r.ReturnId)
                .ToListAsync(token);
        var returnLines = returns.Count == 0
            ? []
            : await context.Inventoryreturnlines.AsNoTracking()
                .Where(l => returns.Contains(l.ReturnId))
                .Select(l => l.ReturnLineId)
                .ToListAsync(token);

        var movementRefIds = issues.Concat(returns).DistinctBy(Convert.ToHexString).ToList();
        var movements = movementRefIds.Count == 0
            ? []
            : await context.Stockmovements.AsNoTracking()
                .Where(m => m.RefId != null && movementRefIds.Contains(m.RefId))
                .Select(m => m.MovementId)
                .ToListAsync(token);

        var versionIds = revisions.SelectMany(r => new[] { r.PreviousMenuVersionId, r.AppliedMenuVersionId })
            .Append(batchInfo.MenuVersionId)
            .DistinctBy(Convert.ToHexString)
            .ToList();
        var versionSchedules = await context.Menuschedules.AsNoTracking()
            .Where(s => s.MenuVersionId != null && versionIds.Contains(s.MenuVersionId))
            .Select(s => s.MenuScheduleId)
            .ToListAsync(token);

        var allEntityIds = new List<byte[]>
        {
            batchInfo.BatchId,
            batchInfo.QuantityImportBatchId
        };
        allEntityIds.AddRange(batchLines);
        allEntityIds.AddRange(dailyLines);
        allEntityIds.AddRange(contributors.Select(c => c.ContributorId));
        allEntityIds.AddRange(contributors.Select(c => c.MealQuantityPlanLineId));
        allEntityIds.AddRange(contributors.Select(c => c.MenuScheduleId));
        allEntityIds.AddRange(revisions.Select(r => r.SourceRevisionId));
        allEntityIds.AddRange(revisions.Where(r => r.MenuAmendmentId != null).Select(r => r.MenuAmendmentId!));
        allEntityIds.AddRange(deltas);
        allEntityIds.AddRange(dispositions);
        allEntityIds.AddRange(dailyDispositions);
        allEntityIds.AddRange(actuals);
        allEntityIds.AddRange(actualRevisions);
        allEntityIds.AddRange(issues);
        allEntityIds.AddRange(issueLines);
        allEntityIds.AddRange(returns);
        allEntityIds.AddRange(returnLines);
        allEntityIds.AddRange(movements);
        allEntityIds.AddRange(versionIds);
        allEntityIds.AddRange(versionSchedules);

        var distinctEntityIds = allEntityIds.DistinctBy(Convert.ToHexString).ToList();
        return audits.Where(audit => audit.EntityId != null
            && ScopedEntityNames.Contains(audit.EntityName)
            && distinctEntityIds.Contains(audit.EntityId));
    }

    public IQueryable<AuditLog> Apply(IQueryable<AuditLog> audits, byte[]? batchId)
    {
        var batches = context.Reconciliationbatches.AsQueryable();
        if (batchId is not null)
            batches = batches.Where(batch => batch.BatchId == batchId);

        return audits.Where(audit => audit.EntityId != null && (
            audit.EntityName == nameof(ReconciliationBatch)
                && batches.Any(batch => batch.BatchId == audit.EntityId)
            || audit.EntityName == nameof(ReconciliationBatchLine)
                && context.Reconciliationbatchlines.Any(line => line.BatchLineId == audit.EntityId
                    && batches.Any(batch => batch.BatchId == line.BatchId))
            || audit.EntityName == nameof(ReconciliationBatchDailyLine)
                && context.Reconciliationbatchdailylines.Any(line => line.DailyLineId == audit.EntityId
                    && batches.Any(batch => batch.BatchId == line.BatchId))
            || audit.EntityName == nameof(ReconciliationBatchContributor)
                && context.Reconciliationbatchcontributors.Any(contributor => contributor.ContributorId == audit.EntityId
                    && context.Reconciliationbatchlines.Any(line => line.BatchLineId == contributor.BatchLineId
                        && batches.Any(batch => batch.BatchId == line.BatchId)))
            || audit.EntityName == nameof(ReconciliationSourceRevision)
                && context.Reconciliationsourcerevisions.Any(revision => revision.SourceRevisionId == audit.EntityId
                    && batches.Any(batch => batch.BatchId == revision.BatchId))
            || audit.EntityName == nameof(ReconciliationSourceDelta)
                && context.Reconciliationsourcedeltas.Any(delta => delta.SourceDeltaId == audit.EntityId
                    && batches.Any(batch => batch.BatchId == delta.BatchId))
            || audit.EntityName == nameof(ReconciliationDisposition)
                && context.Reconciliationdispositions.Any(disposition => disposition.DispositionId == audit.EntityId
                    && context.Reconciliationbatchlines.Any(line => line.BatchLineId == disposition.BatchLineId
                        && batches.Any(batch => batch.BatchId == line.BatchId)))
            || audit.EntityName == nameof(ReconciliationDailyDisposition)
                && context.Reconciliationdailydispositions.Any(disposition => disposition.DispositionId == audit.EntityId
                    && context.Reconciliationbatchdailylines.Any(line => line.DailyLineId == disposition.DailyLineId
                        && batches.Any(batch => batch.BatchId == line.BatchId)))
            || audit.EntityName == nameof(ReconciliationActual)
                && context.Reconciliationactuals.Any(actual => actual.ActualId == audit.EntityId
                    && context.Reconciliationbatchlines.Any(line => line.BatchLineId == actual.BatchLineId
                        && batches.Any(batch => batch.BatchId == line.BatchId)))
            || audit.EntityName == nameof(ReconciliationActualRevision)
                && context.Reconciliationactualrevisions.Any(revision => revision.RevisionId == audit.EntityId
                    && context.Reconciliationactuals.Any(actual => actual.ActualId == revision.ActualId
                        && context.Reconciliationbatchlines.Any(line => line.BatchLineId == actual.BatchLineId
                            && batches.Any(batch => batch.BatchId == line.BatchId))))
            || audit.EntityName == nameof(InventoryIssue)
                && context.Inventoryissues.Any(issue => issue.IssueId == audit.EntityId
                    && issue.ReconciliationBatchId != null
                    && batches.Any(batch => batch.BatchId == issue.ReconciliationBatchId))
            || audit.EntityName == nameof(InventoryIssueLine)
                && context.Inventoryissuelines.Any(line => line.IssueLineId == audit.EntityId
                    && context.Inventoryissues.Any(issue => issue.IssueId == line.IssueId
                        && issue.ReconciliationBatchId != null
                        && batches.Any(batch => batch.BatchId == issue.ReconciliationBatchId)))
            || audit.EntityName == nameof(InventoryIssueLine) && audit.FieldName == nameof(InventoryIssueLine.IssuedQty)
                && context.Reconciliationbatchdailylines.Any(line => line.DailyLineId == audit.EntityId
                    && batches.Any(batch => batch.BatchId == line.BatchId))
            || audit.EntityName == nameof(InventoryReturn)
                && context.Inventoryreturns.Any(inventoryReturn => inventoryReturn.ReturnId == audit.EntityId
                    && context.Inventoryissues.Any(issue => issue.IssueId == inventoryReturn.IssueId
                        && issue.ReconciliationBatchId != null
                        && batches.Any(batch => batch.BatchId == issue.ReconciliationBatchId)))
            || audit.EntityName == nameof(InventoryReturnLine)
                && context.Inventoryreturnlines.Any(line => line.ReturnLineId == audit.EntityId
                    && context.Inventoryreturns.Any(inventoryReturn => inventoryReturn.ReturnId == line.ReturnId
                        && context.Inventoryissues.Any(issue => issue.IssueId == inventoryReturn.IssueId
                            && issue.ReconciliationBatchId != null
                            && batches.Any(batch => batch.BatchId == issue.ReconciliationBatchId))))
            || audit.EntityName == nameof(StockMovement)
                && context.Stockmovements.Any(movement => movement.MovementId == audit.EntityId
                    && movement.RefId != null
                    && (context.Inventoryissues.Any(issue => issue.IssueId == movement.RefId
                            && issue.ReconciliationBatchId != null
                            && batches.Any(batch => batch.BatchId == issue.ReconciliationBatchId))
                        || context.Inventoryreturns.Any(inventoryReturn => inventoryReturn.ReturnId == movement.RefId
                            && context.Inventoryissues.Any(issue => issue.IssueId == inventoryReturn.IssueId
                                && issue.ReconciliationBatchId != null
                                && batches.Any(batch => batch.BatchId == issue.ReconciliationBatchId)))))
            || audit.EntityName == nameof(MenuAmendment)
                && context.Menuamendments.Any(amendment => amendment.MenuAmendmentId == audit.EntityId
                    && context.Reconciliationsourcerevisions.Any(revision => revision.MenuAmendmentId == amendment.MenuAmendmentId
                        && batches.Any(batch => batch.BatchId == revision.BatchId)))
            || audit.EntityName == nameof(MealQuantityPlanLine)
                && context.Reconciliationbatchcontributors.Any(contributor => contributor.MealQuantityPlanLineId == audit.EntityId
                    && context.Reconciliationbatchlines.Any(line => line.BatchLineId == contributor.BatchLineId
                        && batches.Any(batch => batch.BatchId == line.BatchId)))
            || audit.EntityName == nameof(MenuSchedule)
                && (context.Reconciliationbatchcontributors.Any(contributor => contributor.MenuScheduleId == audit.EntityId
                        && context.Reconciliationbatchlines.Any(line => line.BatchLineId == contributor.BatchLineId
                            && batches.Any(batch => batch.BatchId == line.BatchId)))
                    || context.Menuschedules.Any(schedule => schedule.MenuScheduleId == audit.EntityId
                        && schedule.MenuVersionId != null
                        && (batches.Any(batch => batch.MenuVersionId == schedule.MenuVersionId)
                            || context.Reconciliationsourcerevisions.Any(revision =>
                                (revision.PreviousMenuVersionId == schedule.MenuVersionId || revision.AppliedMenuVersionId == schedule.MenuVersionId)
                                && batches.Any(batch => batch.BatchId == revision.BatchId)))))
            || audit.EntityName == nameof(MenuVersion)
                && (batches.Any(batch => batch.MenuVersionId == audit.EntityId)
                    || context.Reconciliationsourcerevisions.Any(revision =>
                        (revision.PreviousMenuVersionId == audit.EntityId || revision.AppliedMenuVersionId == audit.EntityId)
                        && batches.Any(batch => batch.BatchId == revision.BatchId)))
            || audit.EntityName == nameof(QuantityImportBatch)
                && batches.Any(batch => batch.QuantityImportBatchId == audit.EntityId)));
    }
}
