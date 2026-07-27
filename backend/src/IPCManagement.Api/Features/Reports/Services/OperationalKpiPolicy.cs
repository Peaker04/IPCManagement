using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Features.Reports.Services;

internal static class OperationalKpiPolicy
{
    internal static bool IsLowStock(
        decimal totalRequiredQuantity,
        decimal currentQuantity,
        int demandWindowDays = 7)
    {
        if (demandWindowDays <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(demandWindowDays));
        }

        var averageDailyQuantity = totalRequiredQuantity / demandWindowDays;
        return averageDailyQuantity > 0 &&
               DecimalPolicy.LessThanQuantity(currentQuantity, averageDailyQuantity);
    }
}
