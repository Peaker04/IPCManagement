using IPCManagement.Api.Models.DTOs.Coordination;

namespace IPCManagement.Api.Services;

public interface ICoordinationService
{
    // Existing
    Task<IReadOnlyList<CoordinationOrderDto>> GetActiveOrdersAsync(CoordinationOrdersQueryDto query);
    Task<LockOrderPlanResultDto?> LockOrderPlanAsync(LockOrderPlanRequestDto request, string? userId);
    Task<AdjustOrderAfterLockResultDto?> AdjustOrderAfterLockAsync(AdjustOrderAfterLockRequestDto request, string? userId);
    Task<ExportOrderReportResultDto> ExportOrderReportAsync(ExportOrderReportRequestDto request);

    // BE-3.2
    Task<IReadOnlyList<MenuScheduleDto>> GetMenuSchedulesAsync(MenuScheduleQueryDto query);

    // BE-3.3
    Task<IReadOnlyList<MealQuantityPlanDto>> GetMealQuantityPlansAsync(MealQuantityPlanQueryDto query);

    // BE-4.3
    Task<SignoffOrderResultDto?> SignoffOrderAsync(string quantityPlanId, SignoffOrderRequestDto request, string? userId);
}
