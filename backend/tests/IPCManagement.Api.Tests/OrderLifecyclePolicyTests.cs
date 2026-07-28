using FluentAssertions;
using IPCManagement.Api.Features.Coordination.Services;

namespace IPCManagement.Api.Tests;

public class OrderLifecyclePolicyTests
{
    [Theory]
    [InlineData("morning", "MORNING")]
    [InlineData("Ca sáng", "MORNING")]
    [InlineData("AFTERNOON", "AFTERNOON")]
    [InlineData("invalid", null)]
    public void NormalizeShiftName_Should_NormalizeSupportedAliases(string? value, string? expected)
        => OrderLifecyclePolicy.NormalizeShiftName(value).Should().Be(expected);

    [Theory]
    [InlineData("MORNING", "MORNING")]
    [InlineData("afternoon", "AFTERNOON")]
    [InlineData("FULLDAY", "FULLDAY")]
    [InlineData(null, "FULLDAY")]
    public void NormalizeScope_Should_DefaultUnknownValuesToFullDay(string? value, string expected)
        => OrderLifecyclePolicy.NormalizeScope(value).Should().Be(expected);

    [Fact]
    public void ResolveServiceDate_Should_PreserveExplicitDate()
        => OrderLifecyclePolicy.ResolveServiceDate("2026-07-28", "cn")
            .Should()
            .Be(new DateOnly(2026, 7, 28));
}
