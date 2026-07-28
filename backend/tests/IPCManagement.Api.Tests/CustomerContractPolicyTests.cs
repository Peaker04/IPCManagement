using FluentAssertions;
using IPCManagement.Api.Features.Coordination.Services;

namespace IPCManagement.Api.Tests;

public class CustomerContractPolicyTests
{
    [Theory]
    [InlineData("2026-07-01", "2026-07-10", "2026-07-10", "2026-07-20", true)]
    [InlineData("2026-07-01", "2026-07-09", "2026-07-10", "2026-07-20", false)]
    [InlineData("2026-07-01", null, "2030-01-01", null, true)]
    public void DatesOverlap_Should_UseInclusiveOpenEndedRanges(
        string leftStart,
        string? leftEnd,
        string rightStart,
        string? rightEnd,
        bool expected)
        => CustomerContractPolicy.DatesOverlap(
                DateOnly.Parse(leftStart),
                leftEnd is null ? null : DateOnly.Parse(leftEnd),
                DateOnly.Parse(rightStart),
                rightEnd is null ? null : DateOnly.Parse(rightEnd))
            .Should().Be(expected);

    [Fact]
    public void NormalizeCustomerCode_Should_TrimAndUppercase()
        => CustomerContractPolicy.NormalizeCustomerCode(" anv ").Should().Be("ANV");
}
