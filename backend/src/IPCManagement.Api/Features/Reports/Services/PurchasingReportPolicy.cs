namespace IPCManagement.Api.Features.Reports.Services;

public static class PurchasingReportPolicy
{
    public static decimal NormalizePriceTier(decimal tier)
    {
        var normalized = decimal.Round(tier, 0);
        return normalized switch
        {
            25000m or 30000m or 34000m => normalized,
            _ => throw new ArgumentException("Đơn giá BOM chỉ được là 25000, 30000 hoặc 34000.")
        };
    }

    public static (DateOnly Start, DateOnly End) ResolvePeriod(DateOnly date, string groupBy)
    {
        if (!string.Equals(groupBy, "week", StringComparison.OrdinalIgnoreCase))
        {
            return (date, date);
        }

        var offset = ((int)date.DayOfWeek + 6) % 7;
        var start = date.AddDays(-offset);
        return (start, start.AddDays(6));
    }
}
