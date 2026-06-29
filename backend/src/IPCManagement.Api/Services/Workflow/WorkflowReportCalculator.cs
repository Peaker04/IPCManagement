using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Services.Workflow;

public static class WorkflowReportCalculator
{
    public static decimal CalculateVariancePercent(decimal referencePrice, decimal actualPrice)
    {
        if (referencePrice <= 0)
        {
            return 0;
        }

        return DecimalPolicy.RoundPercent((actualPrice - referencePrice) / referencePrice * 100);
    }

    public static bool IsPriceIncreaseWarning(decimal variancePercent, decimal thresholdPercent = 15)
        => variancePercent >= thresholdPercent;

    public static decimal CalculateUsedQuantity(decimal issuedQty, decimal returnedQty)
        => DecimalPolicy.RoundQuantity(Math.Max(0, issuedQty - returnedQty));
}
