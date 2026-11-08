using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal sealed class MrxAuditScopeQuery(IpcManagementContext context)
{
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
