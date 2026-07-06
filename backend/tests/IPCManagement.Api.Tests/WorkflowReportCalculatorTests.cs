using FluentAssertions;
using IPCManagement.Api.Services.Workflow;

namespace IPCManagement.Api.Tests;

public class WorkflowReportCalculatorTests
{
    [Fact]
    public void CalculateVariancePercent_Should_ReturnIncreasePercent()
    {
        var result = WorkflowReportCalculator.CalculateVariancePercent(
            referencePrice: 20000,
            actualPrice: 23000);

        result.Should().Be(15);
    }

    [Fact]
    public void IsPriceIncreaseWarning_Should_Warn_WhenIncreaseReachesThreshold()
    {
        var variance = WorkflowReportCalculator.CalculateVariancePercent(
            referencePrice: 20000,
            actualPrice: 23000);

        WorkflowReportCalculator.IsPriceIncreaseWarning(variance).Should().BeTrue();
    }

    [Fact]
    public void CalculateUsedQuantity_Should_SubtractReturnedQuantity()
    {
        var result = WorkflowReportCalculator.CalculateUsedQuantity(
            issuedQty: 10,
            returnedQty: 2);

        result.Should().Be(8);
    }

    [Fact]
    public void CalculateUsedQuantity_Should_NotReturnNegativeUsage()
    {
        var result = WorkflowReportCalculator.CalculateUsedQuantity(
            issuedQty: 5,
            returnedQty: 8);

        result.Should().Be(0);
    }
}
