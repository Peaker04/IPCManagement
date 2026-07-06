using FluentAssertions;
using IPCManagement.Api.Services.Workflow;

namespace IPCManagement.Api.Tests;

public class PurchaseRequestPlannerTests
{
    [Theory]
    [InlineData(12.5, 12.5)]
    [InlineData(0, 0)]
    [InlineData(-3, 0)]
    public void CalculatePurchaseQty_Should_OnlyUsePositiveShortage(decimal shortage, decimal expected)
    {
        var result = PurchaseRequestPlanner.CalculatePurchaseQty(shortage);

        result.Should().Be(expected);
    }

    [Fact]
    public void EstimateUnitPrice_Should_PreferLatestReceiptPrice()
    {
        var result = PurchaseRequestPlanner.EstimateUnitPrice(
            latestReceiptPrice: 22000,
            ingredientReferencePrice: 18000);

        result.Should().Be(22000);
    }

    [Fact]
    public void EstimateUnitPrice_Should_FallbackToReferencePrice()
    {
        var result = PurchaseRequestPlanner.EstimateUnitPrice(
            latestReceiptPrice: 0,
            ingredientReferencePrice: 18000);

        result.Should().Be(18000);
    }
}
