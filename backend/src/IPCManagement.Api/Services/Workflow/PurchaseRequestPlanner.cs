using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Services.Workflow;

internal static class PurchaseRequestPlanner
{
    public static decimal CalculatePurchaseQty(decimal suggestedPurchaseQty)
        => suggestedPurchaseQty > 0 ? DecimalPolicy.RoundQuantity(suggestedPurchaseQty) : 0;

    public static decimal EstimateUnitPrice(decimal latestReceiptPrice, decimal ingredientReferencePrice)
    {
        if (latestReceiptPrice > 0)
        {
            return DecimalPolicy.RoundMoney(latestReceiptPrice);
        }

        return ingredientReferencePrice > 0 ? DecimalPolicy.RoundMoney(ingredientReferencePrice) : 0;
    }
}
