
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal static class PurchaseSupplierDecisionPolicy
{
    internal static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
    {
        if (sourceUnit.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return true;
        }

        return sourceUnit.ConvertRateToBase > 0 &&
               targetUnit.ConvertRateToBase > 0 &&
               string.Equals(
                   NormalizedBaseUnitCode(sourceUnit),
                   NormalizedBaseUnitCode(targetUnit),
                   StringComparison.OrdinalIgnoreCase);
    }

    internal static decimal ResolveLatestReceiptPrice(
        InventoryReceiptLine? latestReceiptLine,
        Unit targetUnit)
    {
        if (latestReceiptLine is null || latestReceiptLine.UnitPrice <= 0)
        {
            return 0m;
        }

        if (latestReceiptLine.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return latestReceiptLine.UnitPrice;
        }

        if (!CanConvertUnits(latestReceiptLine.Unit, targetUnit))
        {
            return 0m;
        }

        return DecimalPolicy.RoundMoney(
            latestReceiptLine.UnitPrice *
            targetUnit.ConvertRateToBase /
            latestReceiptLine.Unit.ConvertRateToBase);
    }

    internal static string BuildKey(byte[] value) => Convert.ToBase64String(value);

    internal static string BuildFingerprint(
        byte[] purchaseRequestLineId,
        byte[] supplierId,
        string evidenceType,
        byte[] evidenceId,
        decimal evidenceReferencePrice,
        decimal proposedUnitPrice,
        DateOnly proposedDeliveryDate)
    {
        var payload = string.Join(
            '|',
            BuildKey(purchaseRequestLineId),
            BuildKey(supplierId),
            evidenceType,
            BuildKey(evidenceId),
            DecimalPolicy.RoundMoney(evidenceReferencePrice).ToString("0.00", CultureInfo.InvariantCulture),
            DecimalPolicy.RoundMoney(proposedUnitPrice).ToString("0.00", CultureInfo.InvariantCulture),
            proposedDeliveryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload)));
    }

    internal static string ToPersistenceEvidenceType(SupplierEvidenceType evidenceType)
        => evidenceType switch
        {
            SupplierEvidenceType.EffectiveQuotation => "EFFECTIVE_QUOTATION",
            SupplierEvidenceType.LatestValidReceipt => "LATEST_VALID_RECEIPT",
            _ => throw new ArgumentOutOfRangeException(nameof(evidenceType))
        };

    internal static SupplierEvidenceType FromPersistenceEvidenceType(string evidenceType)
        => evidenceType switch
        {
            "EFFECTIVE_QUOTATION" => SupplierEvidenceType.EffectiveQuotation,
            "LATEST_VALID_RECEIPT" => SupplierEvidenceType.LatestValidReceipt,
            _ => throw new InvalidOperationException(
                $"Loại bằng chứng nhà cung cấp không hợp lệ: {evidenceType}.")
        };

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();
}

