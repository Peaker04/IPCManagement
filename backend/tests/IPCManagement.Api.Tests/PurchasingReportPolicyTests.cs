using FluentAssertions;
using IPCManagement.Api.Features.Reports.Services;

namespace IPCManagement.Api.Tests;

public class PurchasingReportPolicyTests
{
    [Fact]
    public void ResolvePeriod_GroupsWeekFromMondayThroughSunday()
    {
        var period = PurchasingReportPolicy.ResolvePeriod(new DateOnly(2027, 1, 1), "week");

        period.Start.Should().Be(new DateOnly(2026, 12, 28));
        period.End.Should().Be(new DateOnly(2027, 1, 3));
    }

    [Fact]
    public void NormalizePriceTier_RejectsUnsupportedTier()
    {
        var act = () => PurchasingReportPolicy.NormalizePriceTier(35_000);

        act.Should().Throw<ArgumentException>();
    }
}
