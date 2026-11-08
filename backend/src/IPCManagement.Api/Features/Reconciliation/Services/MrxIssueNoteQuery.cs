using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal sealed record MrxIssueNote(byte[] BatchLineId, byte[]? DailyLineId, string Reason);

internal sealed class MrxIssueNoteQuery(IpcManagementContext context)
{
    public async Task<IReadOnlyList<MrxIssueNote>> LoadAsync(List<byte[]> batchLineIds, CancellationToken token)
    {
        var audits = context.Auditlogs.AsNoTracking().Where(audit =>
            audit.EntityName == nameof(InventoryIssueLine) && audit.FieldName == nameof(InventoryIssueLine.IssuedQty)
            && audit.EntityId != null && audit.Reason != null);
        var current = from audit in audits
            join line in context.Inventoryissuelines on audit.EntityId equals line.IssueLineId
            join issue in context.Inventoryissues on line.IssueId equals issue.IssueId
            join weekly in context.Reconciliationbatchlines on line.ReconciliationBatchLineId equals weekly.BatchLineId
            where batchLineIds.Contains(weekly.BatchLineId) && issue.ReconciliationBatchId == weekly.BatchId
            select new { BatchLineId = weekly.BatchLineId, DailyLineId = line.ReconciliationBatchDailyLineId,
                Reason = audit.Reason!, audit.ChangedAt };
        // Legacy notes identify a persisted daily/weekly requirement, never an inferred individual issue.
        var legacyDaily = from audit in audits
            join line in context.Reconciliationbatchdailylines on audit.EntityId equals line.DailyLineId
            where batchLineIds.Contains(line.BatchLineId)
            select new { line.BatchLineId, DailyLineId = (byte[]?)line.DailyLineId, Reason = audit.Reason!, audit.ChangedAt };
        var legacyWeekly = from audit in audits
            join line in context.Reconciliationbatchlines on audit.EntityId equals line.BatchLineId
            where batchLineIds.Contains(line.BatchLineId)
            select new { line.BatchLineId, DailyLineId = (byte[]?)null, Reason = audit.Reason!, audit.ChangedAt };
        return await current.Concat(legacyDaily).Concat(legacyWeekly).OrderBy(note => note.ChangedAt)
            .Select(note => new MrxIssueNote(note.BatchLineId, note.DailyLineId, note.Reason)).ToListAsync(token);
    }
}
