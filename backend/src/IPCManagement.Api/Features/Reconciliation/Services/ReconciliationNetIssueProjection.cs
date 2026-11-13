using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal sealed record ReconciliationNetIssueFact(
    byte[] DailyLineId,
    decimal GrossIssuedQuantity,
    decimal ReceivedReturnQuantity,
    decimal NetIssuedQuantity,
    DateTime? LatestReturnReceivedAt = null);

internal sealed class ReconciliationNetIssueProjection(IpcManagementContext context)
{
    public async Task<IReadOnlyDictionary<string, ReconciliationNetIssueFact>> LoadByDailyLineIdsAsync(
        IReadOnlyCollection<byte[]> dailyLineIds,
        CancellationToken token)
    {
        if (dailyLineIds.Count == 0)
            return new Dictionary<string, ReconciliationNetIssueFact>(StringComparer.Ordinal);

        var ids = dailyLineIds.ToList();
        var inMemory = string.Equals(
            context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);
        var issueRows = inMemory
            ? (await context.Inventoryissuelines.AsNoTracking()
                .Where(line => line.ReconciliationBatchDailyLineId != null)
                .Select(line => new
                {
                    line.IssueLineId,
                    DailyLineId = line.ReconciliationBatchDailyLineId!,
                    line.IssuedQty
                })
                .ToListAsync(token))
                .Where(line => ids.Any(id => id.AsSpan().SequenceEqual(line.DailyLineId)))
                .ToList()
            : await context.Inventoryissuelines.AsNoTracking()
                .Where(line => line.ReconciliationBatchDailyLineId != null
                    && ids.Contains(line.ReconciliationBatchDailyLineId))
                .Select(line => new
                {
                    line.IssueLineId,
                    DailyLineId = line.ReconciliationBatchDailyLineId!,
                    line.IssuedQty
                })
                .ToListAsync(token);
        if (issueRows.Count == 0)
            return new Dictionary<string, ReconciliationNetIssueFact>(StringComparer.Ordinal);

        var issueLineIds = issueRows.Select(line => line.IssueLineId).ToList();
        var receivedReturnsById = inMemory
            ? (await context.Inventoryreturns.AsNoTracking()
                .Where(inventoryReturn => inventoryReturn.ReceivedAt != null)
                .Select(inventoryReturn => new { inventoryReturn.ReturnId, inventoryReturn.ReceivedAt })
                .ToListAsync(token))
                .ToDictionary(item => Convert.ToHexString(item.ReturnId), item => item.ReceivedAt, StringComparer.Ordinal)
            : new Dictionary<string, DateTime?>(StringComparer.Ordinal);
        var receivedReturns = inMemory
            ? (await context.Inventoryreturnlines.AsNoTracking()
                .Where(line => line.SourceIssueLineId != null)
                .Select(line => new
                {
                    line.ReturnId,
                    SourceIssueLineId = line.SourceIssueLineId!,
                    line.Quantity
                })
                .ToListAsync(token))
                .Where(line =>
                    issueLineIds.Any(id => id.AsSpan().SequenceEqual(line.SourceIssueLineId)) &&
                    receivedReturnsById.ContainsKey(Convert.ToHexString(line.ReturnId)))
                .Select(line => new
                {
                    line.SourceIssueLineId,
                    line.Quantity,
                    ReceivedAt = receivedReturnsById[Convert.ToHexString(line.ReturnId)]
                })
                .ToList()
            : await context.Inventoryreturnlines.AsNoTracking()
                .Where(line => line.SourceIssueLineId != null
                    && issueLineIds.Contains(line.SourceIssueLineId)
                    && line.Return.ReceivedAt != null)
                .Select(line => new
                {
                    SourceIssueLineId = line.SourceIssueLineId!,
                    line.Quantity,
                    ReceivedAt = line.Return.ReceivedAt
                })
                .ToListAsync(token);
        var returnedByIssueLine = receivedReturns
            .GroupBy(line => Convert.ToHexString(line.SourceIssueLineId), StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => (Quantity: group.Sum(line => line.Quantity), LatestReceivedAt: group.Max(line => line.ReceivedAt)),
                StringComparer.Ordinal);

        return issueRows
            .GroupBy(line => Convert.ToHexString(line.DailyLineId), StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var gross = group.Sum(line => line.IssuedQty);
                    var returned = group.Sum(line =>
                        returnedByIssueLine.TryGetValue(Convert.ToHexString(line.IssueLineId), out var item) ? item.Quantity : 0m);
                    var latestReturn = group.Max(line =>
                        returnedByIssueLine.TryGetValue(Convert.ToHexString(line.IssueLineId), out var item) ? item.LatestReceivedAt : null);
                    return new ReconciliationNetIssueFact(
                        group.First().DailyLineId,
                        gross,
                        returned,
                        DecimalPolicy.RoundQuantity(gross - returned),
                        latestReturn);
                },
                StringComparer.Ordinal);
    }
}
