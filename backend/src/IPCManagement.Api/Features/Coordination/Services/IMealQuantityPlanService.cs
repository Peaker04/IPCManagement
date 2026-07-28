using IPCManagement.Api.Features.Coordination.Contracts;

namespace IPCManagement.Api.Features.Coordination.Services;

public interface IMealQuantityPlanService
{
    Task<IReadOnlyList<MealQuantityPlanDto>> GetMealQuantityPlansAsync(MealQuantityPlanQueryDto query);
    Task<MealQuantityPlanDto?> UpsertQuickServingsAsync(
        UpsertQuickServingsRequest request,
        string? userId);
}
