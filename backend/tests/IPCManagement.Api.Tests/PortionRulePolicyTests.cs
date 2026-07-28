using FluentAssertions;
using IPCManagement.Api.Features.Coordination.Services;

namespace IPCManagement.Api.Tests;

public class PortionRulePolicyTests
{
    [Theory]
    [InlineData("active", "ACTIVE")]
    [InlineData(" INACTIVE ", "INACTIVE")]
    [InlineData(null, null)]
    public void NormalizePortionRuleStatus_Should_NormalizeSupportedValues(string? value, string? expected)
        => PortionRulePolicy.NormalizePortionRuleStatus(value).Should().Be(expected);

    [Theory]
    [InlineData(null, "MORNING", true)]
    [InlineData("MORNING,AFTERNOON", "AFTERNOON", true)]
    [InlineData("MORNING", "AFTERNOON", false)]
    public void MatchesCsv_Should_TreatEmptyScopeAsWildcard(string? csv, string value, bool expected)
        => PortionRulePolicy.MatchesCsv(csv, value).Should().Be(expected);
}
