using IPCManagement.Api.Features.Coordination.Contracts;

namespace IPCManagement.Api.Features.Coordination.Services;

public interface IOrderAdjustmentService
{
    Task<AdjustOrderAfterLockResultDto?> AdjustOrderAfterLockAsync(
        AdjustOrderAfterLockRequest request,
        string? userId);
    Task<AdjustServingsResultDto?> AdjustServingsAsync(
        string orderId,
        AdjustServingsRequest request,
        string? userId);
    Task<AdjustServingsResultDto?> UpdateForecastServingsAsync(
        string orderId,
        UpdateForecastServingsRequest request,
        string? userId);
}
