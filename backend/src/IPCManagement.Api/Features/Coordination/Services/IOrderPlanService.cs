using IPCManagement.Api.Features.Coordination.Contracts;

namespace IPCManagement.Api.Features.Coordination.Services;

public interface IOrderPlanService
{
    Task<IReadOnlyList<CoordinationOrderDto>> GetActiveOrdersAsync(CoordinationOrdersQueryDto query);
    Task<LockOrderPlanResultDto?> LockOrderPlanAsync(LockOrderPlanRequest request, string? userId);
    Task<LockOrderPlanResultDto?> UnlockOrderPlanAsync(string quantityPlanId, string? userId);
    Task<CoordinationScopeActionResultDto?> UnlockOrderPlanScopeAsync(
        CoordinationScopeActionRequest request,
        string? userId);
    Task<ExportOrderReportResultDto> ExportOrderReportAsync(ExportOrderReportRequest request);
}
