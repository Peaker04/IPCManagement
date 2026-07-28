using FluentAssertions;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public class DishBomPolicyTests
{
    [Theory]
    [InlineData(24999.6, 25000)]
    [InlineData(30000, 30000)]
    [InlineData(34000.4, 34000)]
    public void NormalizePriceTier_Should_PreserveSupportedRoundedTiers(decimal input, decimal expected)
        => DishBomPolicy.NormalizePriceTier(input).Should().Be(expected);

    [Fact]
    public void NormalizePriceTier_Should_RejectUnsupportedTier()
        => FluentActions.Invoking(() => DishBomPolicy.NormalizePriceTier(26000m))
            .Should().Throw<ArgumentException>()
            .WithMessage("Đơn giá BOM chỉ được là 25000, 30000 hoặc 34000.");

    [Theory]
    [InlineData(null, "PUBLISHED")]
    [InlineData(" draft ", "DRAFT")]
    [InlineData("archived", "ARCHIVED")]
    public void NormalizeStatus_Should_PreserveCanonicalStatus(string? input, string expected)
        => DishBomPolicy.NormalizeStatus(input).Should().Be(expected);

    [Fact]
    public void CustomerScopeAndDateRange_Should_UseExactIdsAndInclusiveDates()
    {
        var customerId = GuidHelper.NewId();
        var sameCustomerId = customerId.ToArray();

        DishBomPolicy.MatchesCustomerScope(customerId, sameCustomerId).Should().BeTrue();
        DishBomPolicy.MatchesCustomerScope(customerId, GuidHelper.NewId()).Should().BeFalse();
        DishBomPolicy.MatchesCustomerScope(null, null).Should().BeTrue();
        DishBomPolicy.DateRangesOverlap(
            new DateOnly(2026, 7, 1),
            new DateOnly(2026, 7, 15),
            new DateOnly(2026, 7, 15),
            null).Should().BeTrue();
        DishBomPolicy.DateRangesOverlap(
            new DateOnly(2026, 7, 1),
            new DateOnly(2026, 7, 14),
            new DateOnly(2026, 7, 15),
            null).Should().BeFalse();
    }

    [Fact]
    public void StatusAndTemplateHelpers_Should_PreserveFallbacks()
    {
        DishBomPolicy.IsPublished(new DishBom()).Should().BeTrue();
        DishBomPolicy.MapStatusLabel("DRAFT").Should().Be("Draft");
        DishBomPolicy.NormalizeTemplateType(null, hasDishFilter: false).Should().Be("missing");
        DishBomPolicy.NormalizeTemplateType(null, hasDishFilter: true).Should().Be("dish");
        DishBomPolicy.NormalizeTemplateType("unknown", hasDishFilter: true).Should().Be("missing");
    }
}
