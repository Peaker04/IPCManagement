
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Planning.Services;

public interface IProductionPlanService
{
    Task<PagedResponseDto<ProductionPlanDto>> GetPagedAsync(PagedRequestDto request);
    Task<ProductionPlanDto?> GetByIdAsync(string id);
    Task<IReadOnlyList<ProductionPlanDto>> GetFilteredAsync(string? serviceDate, string? dateFrom, string? dateTo, string? customerId, CancellationToken cancellationToken = default);
    Task<DailyProductionPlanDto> GetDailyAsync(string? serviceDate, string? customerId, string? shiftName, CancellationToken cancellationToken = default);
    Task<DailyProductionPlanDto> SendDailyToKitchenAsync(SendDailyProductionPlanRequest request, string? userId, CancellationToken cancellationToken = default);
}
