using IPCManagement.Api.Models.DTOs.Coordination;

namespace IPCManagement.Api.Services;

public interface ICoordinationService
{
    Task<IReadOnlyList<CoordinationOrderDto>> GetActiveOrdersAsync(CoordinationOrdersQueryDto query);
    Task<LockOrderPlanResultDto?> LockOrderPlanAsync(LockOrderPlanRequestDto request, string? userId);
    Task<AdjustOrderAfterLockResultDto?> AdjustOrderAfterLockAsync(AdjustOrderAfterLockRequestDto request, string? userId);
    Task<AdjustServingsResultDto?> AdjustServingsAsync(string orderId, AdjustServingsRequestDto request, string? userId);
    Task<ExportOrderReportResultDto> ExportOrderReportAsync(ExportOrderReportRequestDto request);
}
