namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed record ReconciliationDailyRequirement(
    DateOnly ServiceDate,
    string IngredientId,
    string CanonicalUnitId,
    decimal RequiredQuantity);

public sealed record ReconciliationWeeklyRequirement(
    string IngredientId,
    string CanonicalUnitId,
    decimal RequiredQuantity);

public sealed record ReconciliationDailyLineStatus(string QuantityStatus, bool HasValidDisposition = false);

public sealed record ReconciliationDailySummary(string Status, bool IsApplicable = true);

public sealed record ReconciliationDailyCompatibility(bool CanRead, bool CanIssueByDate, string? ReasonCode);

public static class ReconciliationDailyIssuePolicy
{
    public static IReadOnlyList<ReconciliationWeeklyRequirement> SumWeeklyRequirements(
        IEnumerable<ReconciliationDailyRequirement> dailyRequirements) =>
        dailyRequirements
            .GroupBy(item => new { item.IngredientId, item.CanonicalUnitId })
            .Select(group => new ReconciliationWeeklyRequirement(
                group.Key.IngredientId,
                group.Key.CanonicalUnitId,
                Normalize(group.Sum(item => item.RequiredQuantity))))
            .ToList();

    public static ReconciliationDailyLineStatus ResolveLineStatus(
        decimal requiredQuantity,
        decimal? netIssuedQuantity,
        bool hasValidDisposition)
    {
        if (!netIssuedQuantity.HasValue) return new("UNTOUCHED");

        var difference = Normalize(netIssuedQuantity.Value - requiredQuantity);
        return difference switch
        {
            < 0 => new("UNDER_ISSUED"),
            > 0 => new("OVER_ISSUED", hasValidDisposition),
            _ => new("EXACT")
        };
    }

    public static string ResolveDailyStatus(IReadOnlyCollection<ReconciliationDailyLineStatus> lines)
    {
        if (lines.Count == 0) return "NO_REQUIREMENT";
        if (lines.All(line => line.QuantityStatus == "UNTOUCHED")) return "UNTOUCHED";
        if (lines.Any(line => line.QuantityStatus is "UNTOUCHED" or "UNDER_ISSUED")) return "PARTIAL";
        if (lines.Any(line => line.QuantityStatus == "OVER_ISSUED" && !line.HasValidDisposition))
            return "OVERAGE_REQUIRES_RESOLUTION";
        return "COMPLETE";
    }

    public static string ResolveWeeklyStatus(IReadOnlyCollection<ReconciliationDailySummary> dates)
    {
        var applicable = dates.Where(date => date.IsApplicable).ToList();
        if (applicable.Count == 0 || applicable.All(date => date.Status == "UNTOUCHED")) return "WEEK_UNTOUCHED";
        if (applicable.Any(date => date.Status is "UNTOUCHED" or "PARTIAL")) return "IN_PROGRESS";
        if (applicable.Any(date => date.Status == "OVERAGE_REQUIRES_RESOLUTION"))
            return "VARIANCE_REQUIRES_RESOLUTION";
        return "WEEK_COMPLETE";
    }

    public static ReconciliationDailyCompatibility ResolveCompatibility(bool hasDailyLineage, string batchStatus)
    {
        if (!hasDailyLineage) return new(true, false, "LEGACY_DAILY_LINEAGE_MISSING");
        if (string.Equals(batchStatus, "COMPLETED", StringComparison.Ordinal))
            return new(true, false, "BATCH_READ_ONLY");
        return new(true, true, null);
    }

    private static decimal Normalize(decimal quantity) => decimal.Round(quantity, 6, MidpointRounding.AwayFromZero);
}
