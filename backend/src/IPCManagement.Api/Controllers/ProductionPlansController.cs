using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.ProductionPlan;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/production-plans")]
[Authorize]
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
        if (GuidHelper.ParseGuidString(id) is null)
            return BadRequest(ApiResponse.FailResult("ID không hợp lệ."));

        var result = await _productionPlanService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy kế hoạch sản xuất với ID: {id}"));

        return Ok(ApiResponse<ProductionPlanDto>.SuccessResult(result));
    }
}
