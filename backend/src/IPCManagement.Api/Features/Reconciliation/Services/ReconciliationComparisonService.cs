using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public static class ReconciliationComparisonService
{
    public static ReconciliationLineDto Map(ReconciliationBatchLine line, IReadOnlyList<ReconciliationActual> actuals, ReconciliationDisposition? disposition, decimal? linkedIssuedQuantity = null)
    {
        var purchasedActual = actuals.FirstOrDefault(x => x.Side == "PURCHASED");
        var issuedActual = actuals.FirstOrDefault(x => x.Side == "ISSUED");
        var purchased = purchasedActual?.Quantity;
        var issued = linkedIssuedQuantity ?? issuedActual?.Quantity;
        var pr = purchased - line.RequiredQuantity;
        var ir = issued - line.RequiredQuantity;
        var pi = purchased - issued;
        var triggers = new List<string>();
        if (pr is { } prValue && Math.Abs(prValue) > line.FrozenTolerance) triggers.Add("PURCHASED_REQUIRED");
        if (ir is { } irValue && Math.Abs(irValue) > line.FrozenTolerance) triggers.Add("ISSUED_REQUIRED");
        if (pi is { } piValue && Math.Abs(piValue) > line.FrozenTolerance) triggers.Add("PURCHASED_ISSUED");
        var linkedProjection = linkedIssuedQuantity.HasValue;
        var matched = linkedProjection
            ? triggers.All(trigger => trigger != "ISSUED_REQUIRED")
            : triggers.Count == 0 && purchased.HasValue && issued.HasValue;
        return new(GuidHelper.ToGuidString(line.BatchLineId), GuidHelper.ToGuidString(line.IngredientId), line.Ingredient?.IngredientCode, line.Ingredient?.IngredientName, GuidHelper.ToGuidString(line.CanonicalUnitId), line.CanonicalUnit?.UnitName, line.RequiredQuantity, line.FrozenTolerance, purchased, purchasedActual?.Version, issued, linkedProjection ? null : issuedActual?.Version, pr, ir, pi, triggers, matched ? "MATCHED" : triggers.Count > 0 ? "NEEDS_REVIEW" : "INCOMPLETE", line.Version,
            disposition is null ? null : new(disposition.Category, disposition.Reason, disposition.Version, disposition.DisposedAt));
    }
}
