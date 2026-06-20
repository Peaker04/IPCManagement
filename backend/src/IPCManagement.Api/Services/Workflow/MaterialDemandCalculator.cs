using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Services.Workflow;

internal static class MaterialDemandCalculator
{
    public static MaterialDemandNumbers Calculate(
        int servings,
        decimal grossQtyPerServing,
        decimal bomRatePercent,
        decimal currentStockQty)
    {
        var totalRequiredQty = DecimalPolicy.RoundQuantity(servings * grossQtyPerServing * (bomRatePercent / 100m));
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
