using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal static class PurchaseRequestSubmissionPolicy
{
    private static readonly HashSet<string> ApprovedDemandStatuses =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "MANAGERAPPROVED",
            "APPROVED"
        };

    internal static bool IsApprovedDemandStatus(string status)
        => ApprovedDemandStatuses.Contains(status);

    internal static string BuildKey(byte[] value) => Convert.ToBase64String(value);

    internal static void ValidateCurrentSupplierDecisions(PurchaseRequest purchaseRequest)
    {
        foreach (var line in purchaseRequest.Purchaserequestlines)
        {
            var currentDecision = line.SupplierDecisions.SingleOrDefault(decision =>
                string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal));
            if (currentDecision is null ||
                line.SupplierId is null ||
                !currentDecision.SupplierId.SequenceEqual(line.SupplierId) ||
                currentDecision.ProposedUnitPrice != DecimalPolicy.RoundMoney(line.EstimatedUnitPrice) ||
                currentDecision.ProposedDeliveryDate != line.ExpectedDeliveryDate)
            {
                throw new InvalidOperationException(
                    "Có dòng mua chưa có quyết định nhà cung cấp hiện hành hợp lệ.");
            }
        }
    }

    internal static void ValidatePriceExceptions(PurchaseRequest purchaseRequest)
    {
        foreach (var line in purchaseRequest.Purchaserequestlines)
        {
            var currentDecision = line.SupplierDecisions.Single(decision =>
                string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal));
            var variance = PurchasePricePolicy.CalculateVariancePercent(
                currentDecision.EvidenceReferencePrice,
                currentDecision.ProposedUnitPrice);
            if (!PurchasePricePolicy.RequiresException(variance))
            {
                continue;
            }

            var currentException = currentDecision.Purchasepriceexceptions.SingleOrDefault(
                priceException =>
                    string.Equals(
                        priceException.ProposalFingerprint,
                        currentDecision.DecisionFingerprint,
                        StringComparison.Ordinal) &&
                    priceException.ProposalVersion == currentDecision.Version &&
                    !string.Equals(priceException.Status, "SUPERSEDED", StringComparison.Ordinal));
            if (currentException is null)
            {
                throw new InvalidOperationException(
                    "Có dòng mua cần ngoại lệ giá hiện hành trước khi gửi đơn mua.");
            }

            if (string.Equals(currentException.Status, "REJECTED", StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "Ngoại lệ giá đã bị từ chối; hãy cập nhật và gửi lại đề xuất giá.");
            }

            if (!string.Equals(currentException.Status, "APPROVED", StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "Có dòng mua cần ngoại lệ giá được Quản lý duyệt trước khi gửi đơn mua.");
            }
        }
    }
}

