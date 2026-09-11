using System.Globalization;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal static class PurchaseWorkflowMapper
{
    internal static PurchaseRequestWorkflowResultDto MapResult(
        PurchaseRequest purchaseRequest,
        byte[] materialRequestId,
        IEnumerable<PurchaseRequestLine> lines)
        => new()
        {
            PurchaseRequestId = GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId),
            PurchaseRequestCode = purchaseRequest.PurchaseRequestCode,
            MaterialRequestId = GuidHelper.ToGuidString(materialRequestId),
            PurchaseForDate = purchaseRequest.PurchaseForDate.ToString("yyyy-MM-dd"),
            ShiftName = purchaseRequest.ShiftName,
            Status = purchaseRequest.Status,
            Lines = lines
                .OrderBy(line => line.Ingredient.IngredientName)
                .Select(MapLine)
                .ToList()
        };

    internal static PurchaseRequestWorkflowLineDto MapLine(PurchaseRequestLine line)
    {
        var decisions = line.SupplierDecisions
            .OrderByDescending(decision => decision.Version)
            .ThenByDescending(decision => decision.ConfirmedAt)
            .Select(MapDecision)
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

    internal static PurchaseLineSupplierDecisionDto MapDecision(
        PurchaseLineSupplierDecision decision)
        => new()
        {
            PurchaseLineSupplierDecisionId =
                GuidHelper.ToGuidString(decision.PurchaseLineSupplierDecisionId),
            SupplierId = GuidHelper.ToGuidString(decision.SupplierId),
            EvidenceType =
                PurchaseSupplierDecisionPolicy.FromPersistenceEvidenceType(decision.EvidenceType),
            EvidenceId = GuidHelper.ToGuidString(decision.EvidenceId),
            EvidenceDate = decision.EvidenceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            EvidenceReferencePrice = decision.EvidenceReferencePrice,
            ProposedUnitPrice = decision.ProposedUnitPrice,
            ProposedDeliveryDate =
                decision.ProposedDeliveryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ReceivingWarehouseId = decision.ReceivingWarehouseId is null
                ? string.Empty
                : GuidHelper.ToGuidString(decision.ReceivingWarehouseId),
            PurchasingTerms = decision.PurchasingTerms ?? string.Empty,
            ConfirmedBy = GuidHelper.ToGuidString(decision.ConfirmedBy),
            ConfirmedAt =
                decision.ConfirmedAt.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
            DecisionFingerprint = decision.DecisionFingerprint,
            Version = decision.Version,
            Status = decision.Status,
            SupersededByDecisionId = decision.SupersededByDecisionId is null
                ? null
                : GuidHelper.ToGuidString(decision.SupersededByDecisionId),
            ConcurrencyVersion = decision.ConcurrencyVersion
        };
}

