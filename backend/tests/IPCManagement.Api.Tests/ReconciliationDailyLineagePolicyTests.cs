using IPCManagement.Api.Features.Reconciliation.Services;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationDailyLineagePolicyTests
{
    [Fact]
    public void Frozen_daily_lines_keep_same_ingredient_separate_while_weekly_total_is_their_sum()
    {
        var monday = new ReconciliationDailyRequirement(new DateOnly(2026, 9, 14), "ingredient-1", "kg", 4.25m);
        var tuesday = new ReconciliationDailyRequirement(new DateOnly(2026, 9, 15), "ingredient-1", "kg", 6.75m);

        var weekly = ReconciliationDailyIssuePolicy.SumWeeklyRequirements([monday, tuesday]);

        Assert.Equal(4.25m, monday.RequiredQuantity);
        Assert.Equal(6.75m, tuesday.RequiredQuantity);
        Assert.Equal(11m, Assert.Single(weekly).RequiredQuantity);
    }

    [Theory]
    [MemberData(nameof(LineStatusCases))]
    public void Daily_line_status_uses_net_ledger_quantity_and_keeps_factual_overage(
        decimal? netIssuedQuantity,
        bool hasValidDisposition,
        string expected)
    {
        var status = ReconciliationDailyIssuePolicy.ResolveLineStatus(
            requiredQuantity: 10m,
            netIssuedQuantity,
            hasValidDisposition);

        Assert.Equal(expected, status.QuantityStatus);
        Assert.Equal(hasValidDisposition && netIssuedQuantity > 10m, status.HasValidDisposition);
    }

    public static TheoryData<decimal?, bool, string> LineStatusCases => new()
    {
        { null, false, "UNTOUCHED" },
        { 4m, false, "UNDER_ISSUED" },
        { 10m, false, "EXACT" },
        { 12m, false, "OVER_ISSUED" },
        { 10m, true, "EXACT" },
        { 12m, true, "OVER_ISSUED" },
    };

    [Fact]
    public void Confirmed_return_can_move_a_line_from_over_to_exact_or_under()
    {
        Assert.Equal("EXACT", ReconciliationDailyIssuePolicy.ResolveLineStatus(10m, 12m - 2m, false).QuantityStatus);
        Assert.Equal("UNDER_ISSUED", ReconciliationDailyIssuePolicy.ResolveLineStatus(10m, 12m - 3m, false).QuantityStatus);
    }

    [Theory]
    [MemberData(nameof(DailySummaryCases))]
    public void Daily_summary_follows_the_locked_truth_table(
        ReconciliationDailyLineStatus[] lines,
        string expected)
    {
        Assert.Equal(expected, ReconciliationDailyIssuePolicy.ResolveDailyStatus(lines));
    }

    public static TheoryData<ReconciliationDailyLineStatus[], string> DailySummaryCases => new()
    {
        { [Line("UNTOUCHED")], "UNTOUCHED" },
        { [Line("UNTOUCHED"), Line("EXACT")], "PARTIAL" },
        { [Line("UNDER_ISSUED"), Line("EXACT")], "PARTIAL" },
        { [Line("EXACT"), Line("EXACT")], "COMPLETE" },
        { [Line("OVER_ISSUED"), Line("EXACT")], "OVERAGE_REQUIRES_RESOLUTION" },
        { [Line("OVER_ISSUED", true), Line("EXACT")], "COMPLETE" },
    };

    [Theory]
    [MemberData(nameof(WeeklySummaryCases))]
    public void Weekly_summary_uses_all_applicable_dates_not_a_selected_filter(
        ReconciliationDailySummary[] dates,
        string expected)
    {
        Assert.Equal(expected, ReconciliationDailyIssuePolicy.ResolveWeeklyStatus(dates));
    }

    public static TheoryData<ReconciliationDailySummary[], string> WeeklySummaryCases => new()
    {
        { [Day("NO_REQUIREMENT", false), Day("UNTOUCHED")], "WEEK_UNTOUCHED" },
        { [Day("COMPLETE"), Day("PARTIAL")], "IN_PROGRESS" },
        { [Day("COMPLETE"), Day("OVERAGE_REQUIRES_RESOLUTION")], "VARIANCE_REQUIRES_RESOLUTION" },
        { [Day("COMPLETE"), Day("COMPLETE"), Day("NO_REQUIREMENT", false)], "WEEK_COMPLETE" },
    };

    [Theory]
    [InlineData(false, "READY", false, "LEGACY_DAILY_LINEAGE_MISSING")]
    [InlineData(false, "COMPLETED", false, "LEGACY_DAILY_LINEAGE_MISSING")]
    [InlineData(true, "READY", true, null)]
    public void Legacy_batches_remain_readable_but_daily_issue_requires_frozen_daily_lineage(
        bool hasDailyLineage,
        string batchStatus,
        bool canIssue,
        string? reason)
    {
        var compatibility = ReconciliationDailyIssuePolicy.ResolveCompatibility(hasDailyLineage, batchStatus);

        Assert.True(compatibility.CanRead);
        Assert.Equal(canIssue, compatibility.CanIssueByDate);
        Assert.Equal(reason, compatibility.ReasonCode);
    }

    private static ReconciliationDailyLineStatus Line(string status, bool disposition = false) => new(status, disposition);

    private static ReconciliationDailySummary Day(string status, bool applicable = true) => new(status, applicable);
}
