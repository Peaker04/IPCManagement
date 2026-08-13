using FluentAssertions;
using IPCManagement.Api.Infrastructure.Lifecycle;

namespace IPCManagement.Api.Tests;

public sealed class LifecycleProjectionTests
{
    [Fact]
    public void ReconciliationLine_Should_KeepSourceLineAndUnitAsTheCalculationKey()
    {
        var line = new LifecycleReconciliationLine(
            "request-line-1", "kg", 20m, 24m, 18m, 2m, -1m);

        line.SourceLineId.Should().Be("request-line-1");
        line.UnitId.Should().Be("kg");
        line.AvailableForIssue.Should().Be(7m);
        line.UnresolvedDemand.Should().Be(2m);
    }

    [Fact]
    public void DecisionCorrectionCompletion_Should_RequireEveryEffectiveDecision()
    {
        DecisionCorrectionCompletionPolicy.IsComplete(["decision-1", "decision-2"], ["decision-1"])
            .Should().BeFalse();
        DecisionCorrectionCompletionPolicy.IsComplete(["decision-1", "decision-2"], ["decision-2", "decision-1"])
            .Should().BeTrue();
        DecisionCorrectionCompletionPolicy.IsComplete([], []).Should().BeFalse();
    }
}
