using System.Security.Cryptography;
using System.Text;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal static class PurchaseReceivingMapper
{
    private const string StatusOrdered = "ORDERED";
    private const string StatusPartiallyReceived = "PARTIALLY_RECEIVED";
    private const string StatusReceived = "RECEIVED";

    public static IReadOnlyList<PurchaseReceiptEvidenceRequirementsDto> BuildEvidenceRequirements(PurchaseOrder order)
        => order.Purchaseorderlines
            .OrderBy(line => line.Ingredient.IngredientName, StringComparer.Ordinal)
            .Select(line => new PurchaseReceiptEvidenceRequirementsDto
            {
                PurchaseOrderLineId = GuidHelper.ToGuidString(line.PurchaseOrderLineId),
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                IngredientName = line.Ingredient.IngredientName,
                LotNumberRequired = true,
                ManufactureDateRequired = line.Ingredient.IsFreshDaily,
                ExpiryDateRequired = line.Ingredient.IsFreshDaily,
                BlockerReason = line.Ingredient.IsActive == true
                    ? null
                    : $"Thiếu chính sách bằng chứng nhập kho hiện hành cho '{line.Ingredient.IngredientName}'."
            })
            .ToList();

    public static string ComputeOrderStatus(IEnumerable<PurchaseOrderLine> lines)
    {
        var lineList = lines.ToList();
        if (lineList.All(line => !DecimalPolicy.LessThanQuantity(line.ReceivedQty, line.OrderedQty)))
        {
            return StatusReceived;
        }

        return lineList.Any(line => line.ReceivedQty > 0m) ? StatusPartiallyReceived : StatusOrdered;
    }

    public static WarehousePurchaseReceiptResultDto BuildResult(
        InventoryReceipt receipt,
        PurchaseOrder order,
        string idempotencyKey,
        IReadOnlyList<PurchaseReceiptEvidenceRequirementsDto> requirements)
        => new()
        {
            ReceiptId = GuidHelper.ToGuidString(receipt.ReceiptId),
            PurchaseOrderId = GuidHelper.ToGuidString(order.PurchaseOrderId),
            IdempotencyKey = idempotencyKey,
            PurchaseOrderStatus = order.Status,
            ReceiptStatus = receipt.Status,
            QualityStatus = receipt.QualityStatus,
            ConcurrencyVersion = receipt.ConcurrencyVersion,
            EvidenceRequirements = requirements
        };

    public static ReceiptCorrectionResultDto BuildCorrectionResult(ReceiptCorrection correction)
        => new()
        {
            CorrectionId = GuidHelper.ToGuidString(correction.CorrectionId),
            CorrectionCode = correction.CorrectionCode,
            ReceiptId = GuidHelper.ToGuidString(correction.ReceiptId),
            Status = correction.Status,
            ConcurrencyVersion = correction.ConcurrencyVersion,
            Lines = correction.Lines.Select(line => new ReceiptCorrectionLineResultDto
            {
                ReceiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                UnitId = GuidHelper.ToGuidString(line.UnitId),
                Quantity = line.Quantity
            }).ToArray()
        };

    public static byte[] BuildReceiptId(byte[] purchaseOrderId, string idempotencyKey)
        => HashId($"receipt|{GuidHelper.ToGuidString(purchaseOrderId)}|{idempotencyKey}");

    public static byte[] BuildReceiptLineId(byte[] receiptId, byte[] purchaseOrderLineId)
        => HashId($"receipt-line|{Convert.ToHexString(receiptId)}|{GuidHelper.ToGuidString(purchaseOrderLineId)}");

    public static byte[] BuildReceiptCorrectionId(byte[] receiptId, string commandId)
        => HashId($"receipt-correction|{Convert.ToHexString(receiptId)}|{commandId}");

    public static byte[] BuildReceiptCorrectionLineId(byte[] correctionId, byte[] receiptLineId)
        => HashId($"receipt-correction-line|{Convert.ToHexString(correctionId)}|{Convert.ToHexString(receiptLineId)}");

    public static byte[] BuildAuditId(byte[] receiptId)
        => HashId($"receipt-audit|{Convert.ToHexString(receiptId)}");

    public static byte[] BuildAuditId(byte[] receiptId, string operation)
        => HashId($"receipt-audit|{operation}|{Convert.ToHexString(receiptId)}");

    public static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static bool ByteArraysEqual(byte[]? left, byte[]? right)
        => left is null ? right is null : right is not null && left.AsSpan().SequenceEqual(right);

    private static byte[] HashId(string value)
        => SHA256.HashData(Encoding.UTF8.GetBytes(value)).AsSpan(0, 16).ToArray();
}
