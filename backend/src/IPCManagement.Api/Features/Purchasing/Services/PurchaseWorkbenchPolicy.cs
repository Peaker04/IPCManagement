
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

}
