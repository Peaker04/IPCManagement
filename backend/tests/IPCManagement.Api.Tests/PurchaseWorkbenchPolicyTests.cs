using FluentAssertions;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public class PurchaseWorkbenchPolicyTests
{
    [Theory]
    [InlineData(null, null)]
    [InlineData("  SUPPLIER-PRICE  ", "supplier-price")]
    [InlineData("Receiving", "receiving")]
    public void NormalizeStage_Should_ReturnCanonicalStage(string? value, string? expected)
        => PurchaseWorkbenchPolicy.NormalizeStage(value).Should().Be(expected);

    [Fact]
    public void NormalizeStage_Should_RejectUnknownStage()
    {
        var act = () => PurchaseWorkbenchPolicy.NormalizeStage("unknown");

        act.Should()
            .Throw<ArgumentException>()
            .WithParameterName("stage");
    }

    [Fact]
    public void ResolveStage_Should_ApplyAuthoritativeLifecycleOrder()
    {
        var normalLine = CreateLine(referencePrice: 100m, estimatedPrice: 100m);
        var exceptionLine = CreateLine(referencePrice: 100m, estimatedPrice: 120m);

        PurchaseWorkbenchPolicy.ResolveStage(null, [], []).Should().Be("demand");
        PurchaseWorkbenchPolicy.ResolveStage(new PurchaseRequest { Status = "DRAFT" }, [], [])
            .Should().Be("demand");
        PurchaseWorkbenchPolicy.ResolveStage(
                new PurchaseRequest { Status = "DRAFT" },
                [normalLine],
                [])
            .Should().Be("supplier-price");
        PurchaseWorkbenchPolicy.ResolveStage(
                new PurchaseRequest { Status = "DRAFT" },
                [exceptionLine],
                [])
            .Should().Be("exception");
        PurchaseWorkbenchPolicy.ResolveStage(
                new PurchaseRequest { Status = "SENTTOSUPPLIER" },
                [exceptionLine],
                [])
            .Should().Be("submitted");
        PurchaseWorkbenchPolicy.ResolveStage(
                new PurchaseRequest { Status = "APPROVED" },
                [exceptionLine],
                [])
            .Should().Be("approved-order");
        PurchaseWorkbenchPolicy.ResolveStage(
                new PurchaseRequest { Status = "DRAFT" },
                [normalLine],
                [new PurchaseOrder()])
            .Should().Be("receiving");
    }

    [Theory]
    [InlineData(0, 120, false)]
    [InlineData(100, 0, false)]
    [InlineData(100, 115, false)]
    [InlineData(100, 115.01, true)]
    public void HasPriceException_Should_UseRoundedPriceVariance(
        decimal referencePrice,
        decimal estimatedPrice,
        bool expected)
    {
        var line = CreateLine(referencePrice, estimatedPrice);

        PurchaseWorkbenchPolicy.HasPriceException(line).Should().Be(expected);
    }

    private static PurchaseRequestLine CreateLine(decimal referencePrice, decimal estimatedPrice)
        => new()
        {
            SupplierId = [1],
            EstimatedUnitPrice = estimatedPrice,
            Ingredient = new Ingredient { ReferencePrice = referencePrice }
        };
}
