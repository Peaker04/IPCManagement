using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class ReconciliationLinkedIssueQuery
{
    internal static async Task<IReadOnlyDictionary<string, decimal>> LoadAsync(IpcManagementContext context, IReadOnlyCollection<byte[]> lineIds, CancellationToken token)
    {
        if (lineIds.Count == 0) return new Dictionary<string, decimal>();
        var inMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
        var issueRows = inMemory
            ? (await context.Inventoryissuelines.AsNoTracking().Where(line => line.ReconciliationBatchLineId != null)
                .Select(line => new { line.IssueLineId, line.ReconciliationBatchLineId, line.IssuedQty }).ToListAsync(token))
                .Where(row => lineIds.Any(id => id.SequenceEqual(row.ReconciliationBatchLineId!))).ToList()
            : await context.Inventoryissuelines.AsNoTracking()
                .Where(line => line.ReconciliationBatchLineId != null && lineIds.Contains(line.ReconciliationBatchLineId))
                .Select(line => new { line.IssueLineId, line.ReconciliationBatchLineId, line.IssuedQty }).ToListAsync(token);
        var issueLineIds = issueRows.Select(row => row.IssueLineId).ToList();
        var receivedReturns = inMemory
            ? (await context.Inventoryreturnlines.AsNoTracking()
                .Where(line => line.SourceIssueLineId != null && line.Return.ReceivedAt != null)
                .Select(line => new { line.SourceIssueLineId, line.Quantity }).ToListAsync(token))
                .Where(row => issueLineIds.Any(id => id.SequenceEqual(row.SourceIssueLineId!))).ToList()
            : await context.Inventoryreturnlines.AsNoTracking()
                .Where(line => line.SourceIssueLineId != null && issueLineIds.Contains(line.SourceIssueLineId) && line.Return.ReceivedAt != null)
                .Select(line => new { line.SourceIssueLineId, line.Quantity }).ToListAsync(token);
        return ProjectNetIssuedQuantities(
            issueRows.Select(row => (row.IssueLineId, row.ReconciliationBatchLineId!, row.IssuedQty)),
            receivedReturns.Select(row => (row.SourceIssueLineId!, row.Quantity)));
    }

    internal static IReadOnlyDictionary<string, decimal> ProjectNetIssuedQuantities(
        IEnumerable<(byte[] IssueLineId, byte[] ReconciliationBatchLineId, decimal IssuedQty)> issueRows,
        IEnumerable<(byte[] SourceIssueLineId, decimal Quantity)> receivedReturns)
    {
        var returnedByIssueLine = receivedReturns
            .GroupBy(row => Convert.ToHexString(row.SourceIssueLineId))
            .ToDictionary(group => group.Key, group => group.Sum(row => row.Quantity), StringComparer.Ordinal);
        return issueRows.GroupBy(row => Convert.ToHexString(row.ReconciliationBatchLineId))
            .ToDictionary(
                group => group.Key,
                group => group.Sum(row => row.IssuedQty - returnedByIssueLine.GetValueOrDefault(Convert.ToHexString(row.IssueLineId))),
                StringComparer.Ordinal);
    }

}
