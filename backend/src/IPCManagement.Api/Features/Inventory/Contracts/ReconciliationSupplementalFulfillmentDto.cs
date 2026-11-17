namespace IPCManagement.Api.Features.Inventory.Contracts;

public sealed record ReconciliationSupplementalFulfillmentDto(string BatchId, DateOnly ServiceDate, int PendingDemandCount,
    IReadOnlyList<ReconciliationSupplementalFulfillmentLineDto> Lines);
public sealed record ReconciliationSupplementalFulfillmentLineDto(string DailyLineId, string IngredientId, string CanonicalUnitId,
    decimal BaselineRequiredQuantity, decimal BaselineIssuedQuantity, decimal? BaselineRemainingQuantity,
    decimal NetIssuedQuantity, decimal UnplannedIssuedQuantity, decimal UnallocatedIssuedQuantity,
    bool HasIncompleteAllocation, bool HasAmbiguousReturn, bool IsDemandFulfilled,
    IReadOnlyList<ReconciliationSupplementalExtraBalanceDto> ExtraDemands)
{
    internal bool HasPurposeAllocations { get; init; }
    internal bool HasPurposeEvidence => ExtraDemands.Count != 0
        || HasPurposeAllocations && (!HasIncompleteAllocation || UnplannedIssuedQuantity != 0);
    internal decimal? RemainingByPurpose => BaselineRemainingQuantity is { } baseline
        && ExtraDemands.All(x => x.RemainingQuantity.HasValue)
        ? baseline + ExtraDemands.Sum(x => x.RemainingQuantity!.Value) : null;
}
public sealed record ReconciliationSupplementalExtraBalanceDto(string DemandId, string DemandMaterialId,
    decimal RequiredQuantity, decimal IssuedQuantity, decimal? RemainingQuantity);
