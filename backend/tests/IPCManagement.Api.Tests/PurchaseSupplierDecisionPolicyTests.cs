using FluentAssertions;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public class PurchaseSupplierDecisionPolicyTests
{
    [Fact]
    public void CanConvertUnits_Should_RequireSameBaseUnitAndPositiveRates()
    {
        var kilograms = CreateUnit([1], "KG", "KG", 1m);
        var grams = CreateUnit([2], "G", "KG", 0.001m);
        var litres = CreateUnit([3], "L", "L", 1m);

        PurchaseSupplierDecisionPolicy.CanConvertUnits(kilograms, grams).Should().BeTrue();
        PurchaseSupplierDecisionPolicy.CanConvertUnits(kilograms, litres).Should().BeFalse();
    }

    [Fact]
    public void ResolveLatestReceiptPrice_Should_ConvertToTargetUnit()
    {
        var kilograms = CreateUnit([1], "KG", "KG", 1m);
        var grams = CreateUnit([2], "G", "KG", 0.001m);
        var receiptLine = new InventoryReceiptLine
        {
            UnitId = kilograms.UnitId,
            Unit = kilograms,
            UnitPrice = 100_000m
        };

        PurchaseSupplierDecisionPolicy.ResolveLatestReceiptPrice(receiptLine, grams)
            .Should().Be(100m);
    }

    [Fact]
    public void BuildFingerprint_Should_BeDeterministicAndPriceSensitive()
    {
        var deliveryDate = new DateOnly(2026, 7, 29);
        var first = PurchaseSupplierDecisionPolicy.BuildFingerprint(
            [1], [2], "EFFECTIVE_QUOTATION", [3], 100m, 110m, deliveryDate);
        var same = PurchaseSupplierDecisionPolicy.BuildFingerprint(
            [1], [2], "EFFECTIVE_QUOTATION", [3], 100.001m, 110.001m, deliveryDate);
        var changed = PurchaseSupplierDecisionPolicy.BuildFingerprint(
            [1], [2], "EFFECTIVE_QUOTATION", [3], 100m, 111m, deliveryDate);

        first.Should().Be(same);
        changed.Should().NotBe(first);
    }

    [Theory]
    [InlineData(SupplierEvidenceType.EffectiveQuotation, "EFFECTIVE_QUOTATION")]
    [InlineData(SupplierEvidenceType.LatestValidReceipt, "LATEST_VALID_RECEIPT")]
    public void EvidenceType_Should_RoundTrip(
        SupplierEvidenceType contractValue,
        string persistenceValue)
    {
        PurchaseSupplierDecisionPolicy.ToPersistenceEvidenceType(contractValue)
            .Should().Be(persistenceValue);
        PurchaseSupplierDecisionPolicy.FromPersistenceEvidenceType(persistenceValue)
            .Should().Be(contractValue);
    }

    private static Unit CreateUnit(
        byte[] id,
        string code,
        string baseCode,
        decimal rate)
        => new()
        {
            UnitId = id,
            UnitCode = code,
            UnitName = code,
            BaseUnitCode = baseCode,
            ConvertRateToBase = rate
        };
}

