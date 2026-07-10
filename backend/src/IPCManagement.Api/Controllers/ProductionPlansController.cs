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
    private readonly ICurrentUserService _currentUserService;

    public ProductionPlansController(
        IProductionPlanService productionPlanService,
        ICurrentUserService currentUserService)
    {
        _productionPlanService = productionPlanService;
        _currentUserService = currentUserService;
    }

    /// <summary>Lấy danh sách kế hoạch sản xuất.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
    {
        var result = await _productionPlanService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<ProductionPlanDto>>.SuccessResult(result));
    }

    /// <summary>Lấy danh sách kế hoạch sản xuất theo ngày và khách hàng.</summary>
    [HttpGet("filter")]
    public async Task<IActionResult> GetFiltered(
        [FromQuery] string? serviceDate,
        [FromQuery] string? customerId,
        CancellationToken cancellationToken)
    {
        var result = await _productionPlanService.GetFilteredAsync(serviceDate, customerId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<ProductionPlanDto>>.SuccessResult(result));
    }

    /// <summary>Kế hoạch sản xuất trong ngày để gửi/hiển thị cho bếp.</summary>
    [HttpGet("daily")]
    public async Task<IActionResult> GetDaily(
        [FromQuery] string? serviceDate,
        [FromQuery] string? customerId,
        [FromQuery] string? shiftName,
        CancellationToken cancellationToken)
    {
        var result = await _productionPlanService.GetDailyAsync(serviceDate, customerId, shiftName, cancellationToken);
        return Ok(ApiResponse<DailyProductionPlanDto>.SuccessResult(result));
    }

    /// <summary>Đánh dấu KHSX trong ngày đã gửi bếp.</summary>
    [HttpPost("daily/send-to-kitchen")]
    public async Task<IActionResult> SendDailyToKitchen(
        [FromBody] SendDailyProductionPlanRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _productionPlanService.SendDailyToKitchenAsync(request, userId, cancellationToken);
        return Ok(ApiResponse<DailyProductionPlanDto>.SuccessResult(result, "Đã gửi kế hoạch sản xuất cho bếp."));
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
