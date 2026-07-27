using IPCManagement.Api.Models.DTOs.Coordination;

namespace IPCManagement.Api.Services;

public interface ICoordinationService
{
    Task<IReadOnlyList<CoordinationOrderDto>> GetActiveOrdersAsync(CoordinationOrdersQueryDto query);
    Task<IReadOnlyList<CustomerContractDto>> GetCustomerContractsAsync();
    Task<CustomerContractDto> CreateCustomerContractAsync(CreateCustomerContractRequest request, string? userId);
    Task<CustomerContractDto?> UpdateCustomerContractAsync(string customerId, UpdateCustomerContractRequest request, string? userId);
    Task<IReadOnlyList<PortionRuleDto>> GetPortionRulesAsync(PortionRuleQueryDto query);
    Task<PortionRuleDto> CreatePortionRuleAsync(CreatePortionRuleRequest request, string? userId);
    Task<PortionRuleDto?> UpdatePortionRuleAsync(string portionRuleId, UpdatePortionRuleRequest request, string? userId);
    Task<ResolvedPortionRuleDto?> ResolvePortionRuleAsync(ResolvePortionRuleRequest request);
    Task<IReadOnlyList<MenuScheduleDto>> GetMenuSchedulesAsync(MenuScheduleQueryDto query);
    Task<MenuScheduleDto?> UpdateMenuScheduleRulesAsync(string menuScheduleId, UpdateMenuScheduleRulesRequest request, string? userId);
    Task<MenuScheduleDto?> UpdateMenuScheduleVersionAsync(string menuScheduleId, UpdateMenuScheduleVersionRequest request, string? userId);
    Task<MenuVersionRollbackResultDto> RollbackMenuVersionAsync(RollbackMenuVersionRequest request, string? userId);
    Task<IReadOnlyList<MealQuantityPlanDto>> GetMealQuantityPlansAsync(MealQuantityPlanQueryDto query);
    Task<MealQuantityPlanDto?> UpsertQuickServingsAsync(UpsertQuickServingsRequest request, string? userId);
    Task<LockOrderPlanResultDto?> LockOrderPlanAsync(LockOrderPlanRequest request, string? userId);
    Task<LockOrderPlanResultDto?> UnlockOrderPlanAsync(string quantityPlanId, string? userId);
    Task<AdjustOrderAfterLockResultDto?> AdjustOrderAfterLockAsync(AdjustOrderAfterLockRequest request, string? userId);
    Task<SignoffOrderResultDto?> SignoffOrderAsync(string quantityPlanId, SignoffOrderRequest request, string? userId);
    Task<CoordinationScopeActionResultDto?> SignoffOrderScopeAsync(CoordinationScopeActionRequest request, string? userId);
    Task<CoordinationScopeActionResultDto?> UnlockOrderPlanScopeAsync(CoordinationScopeActionRequest request, string? userId);
    Task<AdjustServingsResultDto?> UpdateForecastServingsAsync(string orderId, UpdateForecastServingsRequest request, string? userId);
    Task<AdjustServingsResultDto?> AdjustServingsAsync(string orderId, AdjustServingsRequest request, string? userId);
    Task<ExportOrderReportResultDto> ExportOrderReportAsync(ExportOrderReportRequest request);
}
