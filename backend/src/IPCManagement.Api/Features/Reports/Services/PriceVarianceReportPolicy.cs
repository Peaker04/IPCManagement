namespace IPCManagement.Api.Features.Reports.Services;

public static class PriceVarianceReportPolicy
{
    public static double ResolveWeightedUnitPrice(
        double totalAmount,
        double totalQuantity,
        double simpleAverage)
        => totalQuantity > 0 ? totalAmount / totalQuantity : simpleAverage;
}
