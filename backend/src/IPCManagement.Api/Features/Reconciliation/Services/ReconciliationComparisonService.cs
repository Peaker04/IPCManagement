using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public static class ReconciliationComparisonService
{
    public static ReconciliationLineDto Map(ReconciliationBatchLine line, IReadOnlyList<ReconciliationActual> actuals, ReconciliationDisposition? disposition)
    {
        var purchased = actuals.FirstOrDefault(x => x.Side == "PURCHASED")?.Quantity;
        var issued = actuals.FirstOrDefault(x => x.Side == "ISSUED")?.Quantity;
        var pr = purchased - line.RequiredQuantity;
        var ir = issued - line.RequiredQuantity;
        var pi = purchased - issued;
        var triggers = new List<string>();
        if (pr is { } prValue && Math.Abs(prValue) > line.FrozenTolerance) triggers.Add("PURCHASED_REQUIRED");
        if (ir is { } irValue && Math.Abs(irValue) > line.FrozenTolerance) triggers.Add("ISSUED_REQUIRED");
        if (pi is { } piValue && Math.Abs(piValue) > line.FrozenTolerance) triggers.Add("PURCHASED_ISSUED");
        return new(GuidHelper.ToGuidString(line.BatchLineId), GuidHelper.ToGuidString(line.IngredientId), GuidHelper.ToGuidString(line.CanonicalUnitId), line.RequiredQuantity, line.FrozenTolerance, purchased, issued, pr, ir, pi, triggers, triggers.Count == 0 && purchased.HasValue && issued.HasValue ? "MATCHED" : triggers.Count > 0 ? "NEEDS_REVIEW" : "INCOMPLETE", line.Version,
            disposition is null ? null : new(disposition.Category, disposition.Reason, disposition.Version, disposition.DisposedAt));
    }
}
