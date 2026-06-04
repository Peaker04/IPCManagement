using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.ProductionPlan;

namespace IPCManagement.Application.Interfaces.Services;

public interface IProductionPlanService
{
    Task<PagedResponseDto<ProductionPlanDto>> GetPagedAsync(PagedRequestDto request);
    Task<ProductionPlanDto?> GetByIdAsync(string id);
}
