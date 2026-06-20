using FluentAssertions;
using IPCManagement.Api.Services.Workflow;

namespace IPCManagement.Api.Tests;

public class MaterialDemandCalculatorTests
{
    [Fact]
    public void Calculate_Should_ComputeDemandBeforeStockShortage()
    {
        var result = MaterialDemandCalculator.Calculate(
            servings: 120,
            grossQtyPerServing: 0.25m,
            bomRatePercent: 110,
            currentStockQty: 10);

        result.TotalRequiredQty.Should().Be(33.0m);
        result.CurrentStockQty.Should().Be(10);
        result.SuggestedPurchaseQty.Should().Be(23.0m);
    }

    [Fact]
    public void Calculate_Should_NotSuggestPurchase_WhenStockCoversDemand()
    {
        var result = MaterialDemandCalculator.Calculate(
            servings: 100,
            grossQtyPerServing: 0.1m,
            bomRatePercent: 100,
            currentStockQty: 15);

        result.TotalRequiredQty.Should().Be(10.0m);
        result.SuggestedPurchaseQty.Should().Be(0);
    }
}
