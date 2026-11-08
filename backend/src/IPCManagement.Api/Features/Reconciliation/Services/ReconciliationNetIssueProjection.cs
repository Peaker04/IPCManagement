using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal sealed record ReconciliationNetIssueFact(
    byte[] DailyLineId,
    decimal GrossIssuedQuantity,
    decimal ReceivedReturnQuantity,
    decimal NetIssuedQuantity);

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
        var receivedReturnIds = inMemory
            ? await context.Inventoryreturns.AsNoTracking()
                .Where(inventoryReturn => inventoryReturn.ReceivedAt != null)
                .Select(inventoryReturn => inventoryReturn.ReturnId)
                .ToListAsync(token)
            : [];
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
                    receivedReturnIds.Any(id => id.AsSpan().SequenceEqual(line.ReturnId)))
                .Select(line => new { line.SourceIssueLineId, line.Quantity })
                .ToList()
            : await context.Inventoryreturnlines.AsNoTracking()
                .Where(line => line.SourceIssueLineId != null
                    && issueLineIds.Contains(line.SourceIssueLineId)
                    && line.Return.ReceivedAt != null)
                .Select(line => new { SourceIssueLineId = line.SourceIssueLineId!, line.Quantity })
                .ToListAsync(token);
        var returnedByIssueLine = receivedReturns
            .GroupBy(line => Convert.ToHexString(line.SourceIssueLineId))
            .ToDictionary(group => group.Key, group => group.Sum(line => line.Quantity), StringComparer.Ordinal);

        return issueRows
            .GroupBy(line => Convert.ToHexString(line.DailyLineId), StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var gross = group.Sum(line => line.IssuedQty);
                    var returned = group.Sum(line =>
                        returnedByIssueLine.GetValueOrDefault(Convert.ToHexString(line.IssueLineId)));
                    return new ReconciliationNetIssueFact(
                        group.First().DailyLineId,
                        gross,
                        returned,
                        DecimalPolicy.RoundQuantity(gross - returned));
                },
                StringComparer.Ordinal);
    }
}
