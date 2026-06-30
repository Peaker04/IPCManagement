using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Services.Workflow;

internal static class MaterialDemandCalculator
{
    public static MaterialDemandNumbers Calculate(
        int servings,
        decimal grossQtyPerServing,
        decimal bomRatePercent,
        decimal currentStockQty,
        decimal portionRatePercent = 100,
        decimal? yieldLossPercent = null)
    {
        var yieldRate = yieldLossPercent is null ? 1m : Math.Max(1m - (yieldLossPercent.Value / 100m), 0.000001m);
        var totalRequiredQty = DecimalPolicy.RoundQuantity(
            servings *
            grossQtyPerServing *
            (portionRatePercent / 100m) *
            (bomRatePercent / 100m) /
            yieldRate);
        var stockQty = DecimalPolicy.RoundQuantity(currentStockQty);
        var suggestedPurchaseQty = DecimalPolicy.RoundQuantity(Math.Max(totalRequiredQty - stockQty, 0));

        return new MaterialDemandNumbers(
            totalRequiredQty,
            stockQty,
            suggestedPurchaseQty);
    }
}

internal sealed record MaterialDemandNumbers(
    decimal TotalRequiredQty,
    decimal CurrentStockQty,
    decimal SuggestedPurchaseQty);
