using IPCManagement.Api.Features.Coordination.Contracts;

namespace IPCManagement.Api.Features.Coordination.Services;

public interface IMenuScheduleService
{
    Task<IReadOnlyList<MenuScheduleDto>> GetMenuSchedulesAsync(MenuScheduleQueryDto query);
    Task<MenuScheduleDto?> UpdateMenuScheduleRulesAsync(
        string menuScheduleId,
        UpdateMenuScheduleRulesRequest request,
        string? userId);
    Task<MenuScheduleDto?> UpdateMenuScheduleVersionAsync(
        string menuScheduleId,
        UpdateMenuScheduleVersionRequest request,
        string? userId);
    Task<MenuVersionRollbackResultDto> RollbackMenuVersionAsync(
        RollbackMenuVersionRequest request,
        string? userId);
}
