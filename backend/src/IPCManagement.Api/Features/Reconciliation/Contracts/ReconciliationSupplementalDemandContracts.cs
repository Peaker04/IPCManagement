namespace IPCManagement.Api.Features.Reconciliation.Contracts;

using IPCManagement.Api.Shared.Contracts;

public sealed record ReconciliationSupplementalDishSelection(string DishId, string ShiftName, string MenuVariant, int ExtraServings);
public sealed record ReconciliationSupplementalDishOptionsDto(string BatchId, long BatchVersion, DateOnly ServiceDate,
    bool CanCreate, string? BlockedReason, IReadOnlyList<ReconciliationSupplementalDishOptionDto> Dishes)
{
    public bool RequiresApproval { get; init; } = true;
}
public sealed record ReconciliationSupplementalDishOptionDto(string DishId, string DishCode, string DishName,
    string ShiftName, string MenuVariant, string? BlockedReason);

public sealed record ReconciliationSupplementalDemandWriteRequest(string CommandId, long ExpectedVersion,
    long ExpectedBatchVersion, string BatchId, DateOnly ServiceDate, string Reason,
    IReadOnlyList<ReconciliationSupplementalDishSelection> Dishes);
public sealed record ReconciliationSupplementalDemandCommand(string CommandId, long ExpectedVersion, long ExpectedBatchVersion, string Reason);
public sealed record ReconciliationSupplementalDemandDto(string DemandId, string BatchId, DateOnly ServiceDate,
    string Status, long Version, long BatchVersion, string Reason, string SnapshotFingerprint,
    string CreatedBy, DateTime CreatedAt, DateTime? SubmittedAt, string? DecidedBy, DateTime? DecidedAt, string? DecisionReason,
    IReadOnlyList<ReconciliationSupplementalDishDto> Dishes, IReadOnlyList<ReconciliationSupplementalMaterialDto> Materials);
public sealed record ReconciliationSupplementalDishDto(string DemandDishId, string DishId, string DishCode,
    string DishName, string ShiftName, string MenuVariant, int ExtraServings);
public sealed record ReconciliationSupplementalMaterialDto(string DemandMaterialId, string DailyLineId,
    string IngredientId, string CanonicalUnitId, decimal RequiredQuantity);

public sealed class ReconciliationSupplementalDemandPageQuery : PagedRequestDto
{
    public string? BatchId { get; set; }
    public DateOnly? ServiceDate { get; set; }
    public string Status { get; set; } = "ALL";
}
public sealed record ReconciliationSupplementalDemandSummaryDto(string DemandId, string BatchId, DateOnly ServiceDate,
    string Status, long Version, long BatchVersion, string Reason, DateTime CreatedAt, DateTime? SubmittedAt, int DishCount);
