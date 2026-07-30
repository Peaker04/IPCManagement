using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Planning.Services;

internal static class MaterialDemandStockReservation
{
    public static async Task ReserveAsync(
        IpcManagementContext context,
        IReadOnlyDictionary<string, List<CurrentStock>> stockByIngredient,
        byte[] currentRequestId,
        DateOnly serviceDate,
        IReadOnlyCollection<byte[]> ingredientIds,
        CancellationToken cancellationToken)
    {
        if (ingredientIds.Count == 0 || stockByIngredient.Count == 0)
        {
            return;
        }

        var candidateLines = await context.Materialrequestlines
            .AsNoTracking()
            .Include(line => line.Request)
            .Include(line => line.Unit)
            .Include(line => line.Purchaserequestlines)
                .ThenInclude(line => line.PurchaseOrderLine)
            .Where(line => ingredientIds.Contains(line.IngredientId))
            .Where(line => line.Request.RequestDate <= serviceDate)
            .Where(line => line.Request.Status != "CANCELLED" && line.Request.Status != "REJECTED")
            .ToListAsync(cancellationToken);

        var committedLines = candidateLines
            .Where(line => !line.RequestId.SequenceEqual(currentRequestId))
            .ToList();
        if (committedLines.Count == 0)
        {
            return;
        }

        var committedRequestKeys = committedLines
            .Select(line => BuildKey(line.RequestId))
            .ToHashSet(StringComparer.Ordinal);
        var issuedLines = await context.Inventoryissuelines
            .AsNoTracking()
            .Include(line => line.Issue)
            .Where(line => ingredientIds.Contains(line.IngredientId))
            .Where(line => line.Issue.IssueDate <= serviceDate)
            .ToListAsync(cancellationToken);
        var issuedByRequestItem = issuedLines
            .Where(line => committedRequestKeys.Contains(BuildKey(line.Issue.MaterialRequestId)))
            .GroupBy(line => BuildReservationKey(
                line.Issue.MaterialRequestId,
                line.IngredientId,
                line.UnitId))
            .ToDictionary(
                group => group.Key,
                group => group.Sum(line => line.IssuedQty),
                StringComparer.Ordinal);

        var committedGroups = committedLines
            .GroupBy(line => BuildReservationKey(line.RequestId, line.IngredientId, line.UnitId))
            .OrderBy(group => group.First().Request.RequestDate)
            .ThenBy(group => group.First().Request.RequestCode, StringComparer.Ordinal)
            .ThenBy(group => group.Key, StringComparer.Ordinal);
        foreach (var group in committedGroups)
        {
            var first = group.First();
            var required = group.Sum(line => line.TotalRequiredQty);
            var baselineAllocation = group.Sum(line =>
                Math.Max(line.TotalRequiredQty - line.SuggestedPurchaseQty, 0));
            var receivedPurchase = group.Sum(line => line.Purchaserequestlines.Sum(purchaseLine =>
                purchaseLine.PurchaseOrderLine?.ReceivedQty ?? 0));
            var issued = issuedByRequestItem.GetValueOrDefault(group.Key);
            var remainingRequired = Math.Max(required - issued, 0);
            var committedQuantity = Math.Min(
                Math.Max(baselineAllocation + receivedPurchase - issued, 0),
                remainingRequired);
            if (committedQuantity <= 0)
            {
                continue;
            }

            var ingredientStocks = stockByIngredient.GetValueOrDefault(BuildKey(first.IngredientId));
            if (ingredientStocks is not null)
            {
                MaterialStockPool.ConsumeInBomUnit(ingredientStocks, first.Unit, committedQuantity);
            }
        }
    }

    private static string BuildReservationKey(byte[] requestId, byte[] ingredientId, byte[] unitId)
        => $"{BuildKey(requestId)}:{BuildKey(ingredientId)}:{BuildKey(unitId)}";

    private static string BuildKey(byte[] value)
        => Convert.ToBase64String(value);
}
