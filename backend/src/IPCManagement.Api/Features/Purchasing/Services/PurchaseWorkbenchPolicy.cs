using System.Globalization;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal static class PurchaseWorkbenchPolicy
{
    private const string PurchaseSubmittedStatus = "SENTTOSUPPLIER";
    private static readonly HashSet<string> WorkbenchStages = new(StringComparer.Ordinal)
    {
        "demand", "supplier-price", "exception", "submitted", "approved-order", "receiving"
    };

    internal static DateOnly ParseDate(string? value, string parameterName)
    {
        if (!DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var parsed))
        {
            throw new ArgumentException("Ngày phải có định dạng yyyy-MM-dd.", parameterName);
        }

        return parsed;
    }

    internal static string? NormalizeStage(string? stage)
    {
        if (string.IsNullOrWhiteSpace(stage))
        {
            return null;
        }

        var normalized = stage.Trim().ToLowerInvariant();
        if (!WorkbenchStages.Contains(normalized))
        {
            throw new ArgumentException("Giai đoạn thu mua không hợp lệ.", nameof(stage));
        }

        return normalized;
    }

    internal static string ResolveStage(
        PurchaseRequest? request,
        IReadOnlyCollection<PurchaseRequestLine> lines,
        IReadOnlyCollection<PurchaseOrder> orders)
    {
        if (request is null || lines.Count == 0)
        {
            return "demand";
        }

        if (orders.Count > 0)
        {
            return "receiving";
        }

        if (string.Equals(request.Status, "APPROVED", StringComparison.OrdinalIgnoreCase))
        {
            return "approved-order";
        }

        if (string.Equals(request.Status, PurchaseSubmittedStatus, StringComparison.OrdinalIgnoreCase))
        {
            return "submitted";
        }

        return lines.Any(HasPriceException) ? "exception" : "supplier-price";
    }

    internal static bool IsSupplierReady(PurchaseRequestLine line)
        => line.SupplierId is not null &&
           line.EstimatedUnitPrice > 0 &&
           line.ExpectedDeliveryDate is not null &&
           line.SupplierDecisions.Any(decision =>
               string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal) &&
               decision.SupplierId.SequenceEqual(line.SupplierId));

    internal static bool HasPriceException(PurchaseRequestLine line)
    {
        if (line.SupplierId is null || line.EstimatedUnitPrice <= 0 || line.Ingredient.ReferencePrice <= 0)
        {
            return false;
        }

        var variance = PurchasePricePolicy.CalculateVariancePercent(
            DecimalPolicy.RoundMoney(line.Ingredient.ReferencePrice),
            DecimalPolicy.RoundMoney(line.EstimatedUnitPrice));
        return PurchasePricePolicy.RequiresException(variance);
    }

    internal static void IncrementStageCount(PurchaseWorkflowStageCountsDto counts, string stage)
    {
        switch (stage)
        {
            case "demand": counts.Demand++; break;
            case "supplier-price": counts.SupplierPrice++; break;
            case "exception": counts.Exception++; break;
            case "submitted": counts.SubmittedRequest++; break;
            case "approved-order": counts.ApprovedOrder++; break;
            case "receiving": counts.ReceivingProgress++; break;
        }
    }

    internal static string BuildKey(byte[] value) => Convert.ToBase64String(value);

    internal static PurchaseRequestWorkflowLineDto MapLine(PurchaseRequestLine line)
    {
        var decisions = line.SupplierDecisions
            .OrderByDescending(decision => decision.Version)
            .ThenByDescending(decision => decision.ConfirmedAt)
            .Select(MapSupplierDecision)
            .ToList();
        var currentDecision = decisions.SingleOrDefault(decision =>
            string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal));
        return new PurchaseRequestWorkflowLineDto
        {
            PurchaseRequestLineId = GuidHelper.ToGuidString(line.PurchaseRequestLineId),
            MaterialRequestLineId = GuidHelper.ToGuidString(line.MaterialRequestLineId),
            IngredientId = GuidHelper.ToGuidString(line.IngredientId),
            IngredientName = line.Ingredient.IngredientName,
            SupplierId = line.SupplierId is null ? null : GuidHelper.ToGuidString(line.SupplierId),
            SupplierName = line.Supplier?.SupplierName,
            UnitId = GuidHelper.ToGuidString(line.UnitId),
            UnitName = line.Unit.UnitName,
            RequiredQty = line.RequiredQty,
            CurrentStockQty = line.CurrentStockQty,
            PurchaseQty = line.PurchaseQty,
            EstimatedUnitPrice = line.EstimatedUnitPrice,
            ExpectedDeliveryDate = line.ExpectedDeliveryDate?.ToString("yyyy-MM-dd"),
            Note = line.Note,
            SupplierDecisionStatus = currentDecision is not null
                ? "CONFIRMED"
                : line.IsLegacySupplierSnapshot ? "LEGACY" : "BLOCKED",
            CurrentSupplierDecision = currentDecision,
            SupplierDecisionHistory = decisions
        };
    }

    private static PurchaseLineSupplierDecisionDto MapSupplierDecision(PurchaseLineSupplierDecision decision)
        => new()
        {
            PurchaseLineSupplierDecisionId = GuidHelper.ToGuidString(decision.PurchaseLineSupplierDecisionId),
            SupplierId = GuidHelper.ToGuidString(decision.SupplierId),
            EvidenceType = FromPersistenceEvidenceType(decision.EvidenceType),
            EvidenceId = GuidHelper.ToGuidString(decision.EvidenceId),
            EvidenceDate = decision.EvidenceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            EvidenceReferencePrice = decision.EvidenceReferencePrice,
            ProposedUnitPrice = decision.ProposedUnitPrice,
            ProposedDeliveryDate = decision.ProposedDeliveryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ConfirmedBy = GuidHelper.ToGuidString(decision.ConfirmedBy),
            ConfirmedAt = decision.ConfirmedAt.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
            DecisionFingerprint = decision.DecisionFingerprint,
            Version = decision.Version,
            Status = decision.Status,
            SupersededByDecisionId = decision.SupersededByDecisionId is null
                ? null
                : GuidHelper.ToGuidString(decision.SupersededByDecisionId),
            ConcurrencyVersion = decision.ConcurrencyVersion
        };

    private static SupplierEvidenceType FromPersistenceEvidenceType(string evidenceType)
        => evidenceType switch
        {
            "EFFECTIVE_QUOTATION" => SupplierEvidenceType.EffectiveQuotation,
            "LATEST_VALID_RECEIPT" => SupplierEvidenceType.LatestValidReceipt,
            _ => throw new InvalidOperationException($"Loại bằng chứng nhà cung cấp không hợp lệ: {evidenceType}.")
        };
}
