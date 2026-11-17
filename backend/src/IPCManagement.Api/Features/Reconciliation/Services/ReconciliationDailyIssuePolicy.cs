using IPCManagement.Api.Features.Inventory.Services;
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

    internal static ReconciliationDailyLineStatus ResolveWithPurpose(decimal required, decimal? issued, bool hasDisposition,
        IPCManagement.Api.Features.Inventory.Contracts.ReconciliationSupplementalFulfillmentLineDto? balance)
    {
        var arithmetic = ResolveLineStatus(required, issued, hasDisposition);
        if (balance is not { HasPurposeEvidence: true }) return arithmetic;
        if (balance.RemainingByPurpose is null) return new("ALLOCATION_REQUIRES_REVIEW");
        if (!balance.IsDemandFulfilled && issued.HasValue && arithmetic.QuantityStatus != "UNDER_ISSUED")
            return new("PURPOSE_SHORTAGE");
        return arithmetic;
    }

    public static string ResolveDailyStatus(IReadOnlyCollection<ReconciliationDailyLineStatus> lines)
    {
        if (lines.Count == 0) return "NO_REQUIREMENT";
        if (lines.All(line => line.QuantityStatus == "UNTOUCHED")) return "UNTOUCHED";
        if (lines.Any(line => line.QuantityStatus == "UNTOUCHED")) return "PARTIAL";
        if (lines.Any(line => line.QuantityStatus is "UNDER_ISSUED" or "PURPOSE_SHORTAGE" or "ALLOCATION_REQUIRES_REVIEW"))
            return "PARTIAL";
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
        return ReconciliationInventoryIssueCreator.AllowsIssue(batchStatus)
            ? new(true, true, null)
            : new(true, false, "BATCH_NOT_TRANSFERRED");
    }

    private static decimal Normalize(decimal quantity) => decimal.Round(quantity, 6, MidpointRounding.AwayFromZero);
}
