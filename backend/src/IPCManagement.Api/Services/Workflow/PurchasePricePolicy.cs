using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Services.Workflow;

public static class PurchasePricePolicy
{
    private const decimal ExceptionThresholdPercent = 15m;

    public static decimal CalculateVariancePercent(decimal? referencePrice, decimal proposedPrice)
    {
        if (referencePrice is null || referencePrice <= 0)
        {
            throw new InvalidOperationException(
                "Thiếu giá tham chiếu hợp lệ để đánh giá ngoại lệ giá mua.");
        }

        var normalizedReferencePrice = DecimalPolicy.RoundMoney(referencePrice.Value);
        var normalizedProposedPrice = DecimalPolicy.RoundMoney(proposedPrice);
        if (normalizedReferencePrice <= 0)
        {
            throw new InvalidOperationException(
                "Thiếu giá tham chiếu hợp lệ để đánh giá ngoại lệ giá mua.");
        }

        return DecimalPolicy.RoundPercent(
            (normalizedProposedPrice - normalizedReferencePrice) / normalizedReferencePrice * 100m);
    }

    public static bool RequiresException(decimal variancePercent)
        => variancePercent > ExceptionThresholdPercent;
}
