using FluentAssertions;
using IPCManagement.Api.Features.Reports.Services;

namespace IPCManagement.Api.Tests;

public class PriceVarianceReportPolicyTests
{
    [Fact]
    public void ResolveWeightedUnitPrice_UsesQuantityWeight()
    {
        var result = PriceVarianceReportPolicy.ResolveWeightedUnitPrice(
            totalAmount: 1_400,
            totalQuantity: 10,
            simpleAverage: 300);

        result.Should().Be(140);
    }

    [Fact]
    public void ResolveWeightedUnitPrice_FallsBackWhenQuantityIsNotPositive()
    {
        PriceVarianceReportPolicy.ResolveWeightedUnitPrice(0, 0, 125)
            .Should().Be(125);
    }
}
