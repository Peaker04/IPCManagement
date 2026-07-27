using FluentAssertions;
using IPCManagement.Api.Features.Reports.Services;

namespace IPCManagement.Api.Tests;

public class OperationalKpiPolicyTests
{
    [Theory]
    [InlineData(70, 9.99999, true)]
    [InlineData(70, 10, false)]
    [InlineData(0, -1, false)]
    public void IsLowStock_Should_CompareAgainstAverageDailyDemand(
        decimal totalRequiredQuantity,
        decimal currentQuantity,
        bool expected)
        => OperationalKpiPolicy.IsLowStock(totalRequiredQuantity, currentQuantity).Should().Be(expected);

    [Fact]
    public void IsLowStock_Should_RejectNonPositiveDemandWindow()
    {
        var action = () => OperationalKpiPolicy.IsLowStock(70, 5, 0);

        action.Should().Throw<ArgumentOutOfRangeException>();
    }
}
