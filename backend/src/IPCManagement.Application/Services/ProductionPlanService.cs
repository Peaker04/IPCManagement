using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.ProductionPlan;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Repositories;
using IPCManagement.Application.Interfaces.Services;
using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Services;

public class ProductionPlanService : IProductionPlanService
{
    private readonly IProductionPlanRepository _productionPlanRepository;

    public ProductionPlanService(IProductionPlanRepository productionPlanRepository)
    {
        _productionPlanRepository = productionPlanRepository;
    }

    public async Task<PagedResponseDto<ProductionPlanDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _productionPlanRepository.GetPagedAsync(
            request.PageNumber,
            request.PageSize);

        return PagedResponseDto<ProductionPlanDto>.Create(
            items.Select(plan => MapPlan(plan)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<ProductionPlanDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var plan = await _productionPlanRepository.GetByIdWithLinesAsync(bytes);
        return plan is null ? null : MapPlan(plan, includeLines: true);
    }

    private static ProductionPlanDto MapPlan(Productionplan plan, bool includeLines = false) => new()
    {
        PlanId = GuidHelper.ToGuidString(plan.PlanId),
        PlanCode = plan.PlanCode,
        PlanDate = plan.PlanDate,
        Status = plan.Status,
        CreatedBy = GuidHelper.ToGuidString(plan.CreatedBy),
        CreatedByName = plan.CreatedByNavigation?.FullName,
        CreatedAt = plan.CreatedAt,
        Lines = includeLines
            ? plan.Productionplanlines.Select(MapLine).ToList()
            : new List<ProductionPlanLineDto>()
    };

    private static ProductionPlanLineDto MapLine(Productionplanline line) => new()
    {
        PlanLineId = GuidHelper.ToGuidString(line.PlanLineId),
        DishId = GuidHelper.ToGuidString(line.DishId),
        DishName = line.Dish?.DishName,
        ShiftName = line.ShiftName,
        TotalServings = line.TotalServings
    };
}
