using FluentAssertions;
using IPCManagement.Api.Features.Coordination.Services;

namespace IPCManagement.Api.Tests;

public class MealQuantityPlanPolicyTests
{
    [Theory]
    [InlineData("MORNING", "ANV-25K", "QTYK-20260728-M-ANV25K")]
    [InlineData("AFTERNOON", "ANV-25K", "QTYK-20260728-A-ANV25K")]
    [InlineData("MORNING", "---", "QTYK-20260728-M-CUS")]
    public void BuildQuickServingPlanCode_Should_CreateStableSafeCode(
        string shiftName,
        string customerCode,
        string expected)
        => MealQuantityPlanPolicy.BuildQuickServingPlanCode(
                new DateOnly(2026, 7, 28),
                shiftName,
                customerCode)
            .Should()
            .Be(expected);
}
