using IPCManagement.Api.Models.DTOs.Coordination;

namespace IPCManagement.Api.Services;

public interface ICoordinationService
{
    Task<IReadOnlyList<CoordinationOrderDto>> GetActiveOrdersAsync(CoordinationOrdersQueryDto query);
    Task<IReadOnlyList<CustomerContractDto>> GetCustomerContractsAsync();
    Task<CustomerContractDto> CreateCustomerContractAsync(CreateCustomerContractDto request, string? userId);
    Task<CustomerContractDto?> UpdateCustomerContractAsync(string customerId, UpdateCustomerContractDto request, string? userId);
    Task<IReadOnlyList<PortionRuleDto>> GetPortionRulesAsync(PortionRuleQueryDto query);
    Task<PortionRuleDto> CreatePortionRuleAsync(CreatePortionRuleDto request, string? userId);
    Task<PortionRuleDto?> UpdatePortionRuleAsync(string portionRuleId, UpdatePortionRuleDto request, string? userId);
    Task<ResolvedPortionRuleDto?> ResolvePortionRuleAsync(ResolvePortionRuleDto request);
    Task<IReadOnlyList<MenuScheduleDto>> GetMenuSchedulesAsync(MenuScheduleQueryDto query);
    Task<MenuScheduleDto?> UpdateMenuScheduleRulesAsync(string menuScheduleId, UpdateMenuScheduleRulesDto request, string? userId);
    Task<MenuScheduleDto?> UpdateMenuScheduleVersionAsync(string menuScheduleId, UpdateMenuScheduleVersionDto request, string? userId);
    Task<MenuVersionRollbackResultDto> RollbackMenuVersionAsync(RollbackMenuVersionDto request, string? userId);
    Task<IReadOnlyList<MealQuantityPlanDto>> GetMealQuantityPlansAsync(MealQuantityPlanQueryDto query);
    Task<LockOrderPlanResultDto?> LockOrderPlanAsync(LockOrderPlanRequestDto request, string? userId);
    Task<AdjustOrderAfterLockResultDto?> AdjustOrderAfterLockAsync(AdjustOrderAfterLockRequestDto request, string? userId);
    Task<SignoffOrderResultDto?> SignoffOrderAsync(string quantityPlanId, SignoffOrderRequestDto request, string? userId);
    Task<AdjustServingsResultDto?> UpdateForecastServingsAsync(string orderId, UpdateForecastServingsRequestDto request, string? userId);
    Task<AdjustServingsResultDto?> AdjustServingsAsync(string orderId, AdjustServingsRequestDto request, string? userId);
    Task<ExportOrderReportResultDto> ExportOrderReportAsync(ExportOrderReportRequestDto request);
}
