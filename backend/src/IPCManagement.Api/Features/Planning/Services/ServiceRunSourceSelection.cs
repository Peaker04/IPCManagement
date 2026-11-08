using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Planning.Services;

internal static class ServiceRunSourceSelection
{
    internal static IQueryable<MaterialRequestLine> SelectRequestSourceLines(IQueryable<MaterialRequestLine> sourceLines, byte[] requestId)
        => sourceLines.Where(line => line.RequestId.SequenceEqual(requestId));

    internal static IReadOnlyList<InventoryIssueLine> SelectRelevantIssueLines(
        IEnumerable<InventoryIssue> issues,
        IEnumerable<MaterialRequestLine> demandLines)
    {
        var demandLineIds = demandLines.Select(line => Convert.ToBase64String(line.RequestLineId)).ToHashSet();
        return issues
            .Where(issue => issue.ReconciliationBatchId == null &&
                (issue.MaterialRequestId != null || issue.Inventoryissuelines.Any(line =>
                    line.MaterialRequestLineId != null && line.ReconciliationBatchLineId == null)))
            .SelectMany(issue => issue.Inventoryissuelines.Where(line =>
                line.MaterialRequestLineId != null && line.ReconciliationBatchLineId == null &&
                demandLineIds.Contains(Convert.ToBase64String(line.MaterialRequestLineId))))
            .ToList();
    }
}
