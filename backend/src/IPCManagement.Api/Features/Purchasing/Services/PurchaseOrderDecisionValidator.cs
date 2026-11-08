using System.Security.Cryptography;
using System.Text;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal static class PurchaseOrderDecisionValidator
{
    internal static List<ExpectedOrderLine> ValidateCurrentOrderDecisions(
        IReadOnlyCollection<PurchaseRequestLine> purchaseRequestLines)
    {
        if (purchaseRequestLines.Count == 0)
        {
            throw new BusinessRuleException("Đề xuất mua hàng không có dòng nào để tạo đơn.");
        }

        var expectedLines = new List<ExpectedOrderLine>(purchaseRequestLines.Count);
        foreach (var line in purchaseRequestLines)
        {
            var currentDecisions = line.SupplierDecisions
                .Where(decision => string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal))
                .ToList();
            if (currentDecisions.Count != 1)
            {
                throw new BusinessRuleException("Mỗi dòng mua phải có đúng một quyết định nhà cung cấp hiện hành trước khi tạo đơn mua hàng.");
            }

            var decision = currentDecisions[0];
            if (line.SupplierId is null ||
                !line.SupplierId.AsSpan().SequenceEqual(decision.SupplierId) ||
                DecimalPolicy.RoundMoney(line.EstimatedUnitPrice) != DecimalPolicy.RoundMoney(decision.ProposedUnitPrice) ||
                line.ExpectedDeliveryDate != decision.ProposedDeliveryDate ||
                decision.ReceivingWarehouseId is null ||
                string.IsNullOrWhiteSpace(decision.PurchasingTerms))
            {
                throw new DbUpdateConcurrencyException("Dòng mua không còn khớp với quyết định nhà cung cấp hiện hành.");
            }

            var variancePercent = PurchasePricePolicy.CalculateVariancePercent(
                decision.EvidenceReferencePrice,
                decision.ProposedUnitPrice);
            if (PurchasePricePolicy.RequiresException(variancePercent) &&
                !decision.Purchasepriceexceptions.Any(priceException =>
                    string.Equals(priceException.ProposalFingerprint, decision.DecisionFingerprint, StringComparison.Ordinal) &&
                    priceException.ProposalVersion == decision.Version &&
                    priceException.ReferencePrice == decision.EvidenceReferencePrice &&
                    priceException.ProposedPrice == decision.ProposedUnitPrice &&
                    string.Equals(priceException.EvidenceType, decision.EvidenceType, StringComparison.Ordinal) &&
                    priceException.EvidenceId.AsSpan().SequenceEqual(decision.EvidenceId) &&
                    priceException.EvidenceDate == decision.EvidenceDate &&
                    string.Equals(priceException.Status, "APPROVED", StringComparison.Ordinal)))
            {
                throw new BusinessRuleException("Ngoại lệ giá của quyết định nhà cung cấp hiện hành chưa được Quản lý duyệt.");
            }

            expectedLines.Add(new ExpectedOrderLine(line, decision));
        }

        return expectedLines;
    }

    internal static void ValidateEstablishedOrders(
        IReadOnlyCollection<PurchaseOrder> orders,
        IReadOnlyCollection<ExpectedOrderLine> expectedLines,
        Exception? innerException = null)
    {
        var expectedSupplierCount = expectedLines
            .Select(expected => CreateCompatibilityKey(expected.Decision))
            .Distinct()
            .Count();
        var establishedLines = orders.SelectMany(order => order.Purchaseorderlines).ToList();
        var matches = orders.Count == expectedSupplierCount &&
            establishedLines.Count == expectedLines.Count &&
            expectedLines.All(expected =>
            {
                var expectedLineId = BuildDecisionSnapshotId(
                    expected.Line.PurchaseRequestLineId,
                    expected.Decision.DecisionFingerprint);
                return orders.Any(order =>
                    order.SupplierId.AsSpan().SequenceEqual(expected.Decision.SupplierId) &&
                    order.ProposedDeliveryDate == expected.Decision.ProposedDeliveryDate &&
                    order.ReceivingWarehouseId is not null &&
                    order.ReceivingWarehouseId.AsSpan().SequenceEqual(expected.Decision.ReceivingWarehouseId!) &&
                    string.Equals(order.PurchasingTerms, expected.Decision.PurchasingTerms, StringComparison.Ordinal) &&
                    order.CreatedAt >= expected.Decision.ConfirmedAt &&
                    order.Purchaseorderlines.Any(line =>
                        line.PurchaseOrderLineId.AsSpan().SequenceEqual(expectedLineId) &&
                        line.PurchaseRequestLineId.AsSpan().SequenceEqual(expected.Line.PurchaseRequestLineId) &&
                        line.IngredientId.AsSpan().SequenceEqual(expected.Line.IngredientId) &&
                        line.UnitId.AsSpan().SequenceEqual(expected.Line.UnitId) &&
                        line.OrderedQty == DecimalPolicy.RoundQuantity(expected.Line.PurchaseQty) &&
                        line.UnitPrice == DecimalPolicy.RoundMoney(expected.Decision.ProposedUnitPrice)));
            });

        if (!matches)
        {
            const string message = "Tập đơn mua hàng đã tạo không còn khớp với quyết định nhà cung cấp hiện hành.";
            throw innerException is null
                ? new DbUpdateConcurrencyException(message)
                : new DbUpdateConcurrencyException(message, innerException);
        }
    }

    internal static byte[] BuildDecisionSnapshotId(byte[] purchaseRequestLineId, string decisionFingerprint)
    {
        var snapshotKey = $"{GuidHelper.ToGuidString(purchaseRequestLineId)}|{decisionFingerprint}";
        return SHA256.HashData(Encoding.UTF8.GetBytes(snapshotKey)).AsSpan(0, 16).ToArray();
    }

    internal sealed record ExpectedOrderLine(
        PurchaseRequestLine Line,
        PurchaseLineSupplierDecision Decision);

    internal sealed record PurchaseOrderCompatibilityKey(
        string SupplierId,
        DateOnly ProposedDeliveryDate,
        string ReceivingWarehouseId,
        string PurchasingTerms);

    internal static PurchaseOrderCompatibilityKey CreateCompatibilityKey(PurchaseLineSupplierDecision decision)
        => new(
            Convert.ToHexString(decision.SupplierId),
            decision.ProposedDeliveryDate,
            Convert.ToHexString(decision.ReceivingWarehouseId!),
            decision.PurchasingTerms!);

    internal static string BuildPurchaseOrderCode(string purchaseRequestCode, PurchaseOrderCompatibilityKey compatibility)
    {
        var compatibilityHash = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(
                $"{compatibility.ProposedDeliveryDate:yyyy-MM-dd}|{compatibility.ReceivingWarehouseId}|{compatibility.PurchasingTerms}")))
            [..8];
        return $"PO-{purchaseRequestCode}-{compatibility.SupplierId[..8]}-{compatibilityHash}";
    }

}
