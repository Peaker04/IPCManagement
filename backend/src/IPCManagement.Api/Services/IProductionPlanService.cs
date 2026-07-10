using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.ProductionPlan;

namespace IPCManagement.Api.Services;

public interface IProductionPlanService
{
    Task<PagedResponseDto<ProductionPlanDto>> GetPagedAsync(PagedRequestDto request);
    Task<ProductionPlanDto?> GetByIdAsync(string id);
    Task<IReadOnlyList<ProductionPlanDto>> GetFilteredAsync(string? serviceDate, string? customerId, CancellationToken cancellationToken = default);
    Task<DailyProductionPlanDto> GetDailyAsync(string? serviceDate, string? customerId, string? shiftName, CancellationToken cancellationToken = default);
    Task<DailyProductionPlanDto> SendDailyToKitchenAsync(SendDailyProductionPlanRequestDto request, string? userId, CancellationToken cancellationToken = default);
}
