using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Inventory.Services;

// One source-family predicate for the retained owner and central approval reader.
// Tracking/no-tracking remains the caller's choice; this method only composes SQL.
internal static class LegacyLineageSourceScope
{
    internal static IQueryable<LegacyLineageDisposition> Filter(IpcManagementContext context, IQueryable<LegacyLineageDisposition> query)
    {
        var issues = DefaultIssueHeaders(context);
        return query.Where(x => x.LegacyLineType == "ISSUE_LINE"
            ? context.Inventoryissuelines.Any(line => line.IssueLineId.SequenceEqual(x.LegacyLineId)
                && issues.Any(issue => issue.IssueId.SequenceEqual(line.IssueId)
                    && issue.ReconciliationBatchId == null && issue.MaterialRequestId != null))
            : x.LegacyLineType == "RETURN_LINE" && context.Inventoryreturnlines.Any(line => line.ReturnLineId.SequenceEqual(x.LegacyLineId)
                && context.Inventoryreturns.Any(receipt => receipt.ReturnId.SequenceEqual(line.ReturnId) && receipt.ReconciliationSourceDeltaId == null
                    && issues.Any(issue => issue.IssueId.SequenceEqual(receipt.IssueId) && issue.ReconciliationBatchId == null))));
    }

    internal static IQueryable<InventoryIssue> DefaultIssueHeaders(IpcManagementContext context) => context.Inventoryissues
        .Where(issue => issue.ReconciliationBatchId == null && !context.Inventoryissuelines.Any(line => line.IssueId.SequenceEqual(issue.IssueId)
            && (line.ReconciliationBatchLineId != null || line.ReconciliationBatchDailyLineId != null || line.ReconciliationServiceDate != null)));
}
