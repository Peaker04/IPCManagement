using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.ProductionPlan;

namespace IPCManagement.Api.Services;

public interface IProductionPlanService
{
    Task<PagedResponseDto<ProductionPlanDto>> GetPagedAsync(PagedRequestDto request);
    Task<ProductionPlanDto?> GetByIdAsync(string id);
}
