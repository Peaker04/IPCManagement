using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reconciliation.Contracts;

public sealed record QuantityInspectionPageDto<T>(
    string MenuVersionId, string ContentFingerprint, int FingerprintFormatVersion,
    IReadOnlyList<string> Diagnostics, PagedResponseDto<T> Page);

public sealed record QuantityMaterialInspectionDto(
    string IngredientId, string IngredientCode, string IngredientName,
    string CanonicalUnitId, string CanonicalUnitName, decimal RequiredQuantity,
    IReadOnlyList<QuantityMaterialInspectionContributionDto> Contributions);

public sealed record QuantityMaterialInspectionContributionDto(
    DateOnly ServiceDate, string Shift, string QuantityPlanLineId,
    string DishId, string DishName, string? DishSlot, int FinalServings,
    QuantityImportMaterialContributionDto Material);

public sealed record QuantityPlanInspectionDto(
    DateOnly ServiceDate, string PlanCode, QuantityImportPlanLineDto Line);
