using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.ProductionPlan;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/production-plans")]
[Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
[EnableRateLimiting("api-general")]
public class ProductionPlansController : ControllerBase
{
    private readonly IProductionPlanService _productionPlanService;

    public ProductionPlansController(IProductionPlanService productionPlanService)
    {
        _productionPlanService = productionPlanService;
    }

    /// <summary>Lấy danh sách kế hoạch sản xuất.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
    {
        var result = await _productionPlanService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<ProductionPlanDto>>.SuccessResult(result));
    }

    /// <summary>Lấy chi tiết kế hoạch sản xuất theo ID.</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _productionPlanService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy kế hoạch sản xuất với ID: {id}"));

        return Ok(ApiResponse<ProductionPlanDto>.SuccessResult(result));
    }
}
