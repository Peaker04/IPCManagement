using FluentAssertions;
using IPCManagement.Api.Services.Workflow;

namespace IPCManagement.Application.Tests;

public class WorkflowReportCalculatorTests
{
    [Theory]
    [InlineData(100_000, 115_000, 15)]
    [InlineData(100_000, 85_000, -15)]
    [InlineData(0, 85_000, 0)]
    public void CalculateVariancePercent_Should_HandleIncreaseDecreaseAndMissingReference(
        decimal referencePrice,
        decimal actualPrice,
        decimal expected)
    {
        var result = WorkflowReportCalculator.CalculateVariancePercent(referencePrice, actualPrice);

        result.Should().Be(expected);
    }

    [Theory]
    [InlineData(14.99, 15, false)]
    [InlineData(15, 15, true)]
    [InlineData(20, 15, true)]
    public void IsPriceIncreaseWarning_Should_UseConfiguredThreshold(
        decimal variancePercent,
        decimal thresholdPercent,
        bool expected)
    {
        var result = WorkflowReportCalculator.IsPriceIncreaseWarning(variancePercent, thresholdPercent);

        result.Should().Be(expected);
    }

    [Theory]
    [InlineData(10, 3, 7)]
    [InlineData(10, 12, 0)]
    public void CalculateUsedQuantity_Should_NeverReturnNegativeUsage(
        decimal issuedQty,
        decimal returnedQty,
        decimal expected)
    {
        var result = WorkflowReportCalculator.CalculateUsedQuantity(issuedQty, returnedQty);

        result.Should().Be(expected);
    }
}
