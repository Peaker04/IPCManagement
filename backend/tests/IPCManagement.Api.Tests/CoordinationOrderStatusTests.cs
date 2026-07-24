using FluentAssertions;
using IPCManagement.Api.Models.DTOs.Coordination;
using Xunit;

namespace IPCManagement.Api.Tests;

public class CoordinationOrderStatusTests
{
    private static readonly string[] KnownStatuses =
    [
        OrderStatus.Draft,
        OrderStatus.Forecasted,
        OrderStatus.Confirmed,
        OrderStatus.Adjusted,
        OrderStatus.Completed,
        OrderStatus.Archived,
        OrderStatus.Cancelled
    ];

    [Fact]
    public void CanTransition_Should_CoverEveryKnownStatusPair()
    {
        var allowed = new HashSet<(string From, string To)>
        {
            (OrderStatus.Draft, OrderStatus.Confirmed),
            (OrderStatus.Forecasted, OrderStatus.Confirmed),
            (OrderStatus.Confirmed, OrderStatus.Completed),
            (OrderStatus.Adjusted, OrderStatus.Completed),
            (OrderStatus.Completed, OrderStatus.Archived)
        };

        foreach (var from in KnownStatuses)
        {
            foreach (var to in KnownStatuses)
            {
                OrderStatus.CanTransition(from, to)
                    .Should().Be(allowed.Contains((from, to)), $"transition {from} -> {to} must follow the business state machine");
            }
        }
    }

    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData(" confirmed ", OrderStatus.Confirmed)]
    [InlineData("adjusted", OrderStatus.Adjusted)]
    [InlineData("Completed", OrderStatus.Completed)]
    public void Normalize_Should_HandleNullWhitespaceAndCase(string? input, string expected)
    {
        OrderStatus.Normalize(input).Should().Be(expected);
    }

    [Fact]
    public void CanEditForecast_Should_OnlyAllowDraftAndForecasted()
    {
        foreach (var status in KnownStatuses)
        {
            OrderStatus.CanEditForecast(status)
                .Should().Be(status is OrderStatus.Draft or OrderStatus.Forecasted);
        }

        OrderStatus.CanEditForecast(null).Should().BeFalse();
        OrderStatus.CanEditForecast("UNKNOWN").Should().BeFalse();
    }

    [Fact]
    public void IsLocked_Should_OnlyMatchConfirmedAndAdjusted()
    {
        foreach (var status in KnownStatuses)
        {
            OrderStatus.IsLocked(status)
                .Should().Be(status is OrderStatus.Confirmed or OrderStatus.Adjusted);
        }

        OrderStatus.IsLocked(null).Should().BeFalse();
        OrderStatus.IsLocked("UNKNOWN").Should().BeFalse();
    }
}
