using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/coordination")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[EnableRateLimiting("api-general")]
public class CoordinationController : ControllerBase
{
    private readonly ICoordinationService _coordinationService;
    private readonly ICurrentUserService _currentUserService;

    public CoordinationController(
        ICoordinationService coordinationService,
        ICurrentUserService currentUserService)
    {
        _coordinationService = coordinationService;
        _currentUserService = currentUserService;
    }

    [HttpGet("orders")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CoordinationOrderDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrders(
        [FromQuery] string? serviceDate,
        [FromQuery] string? dayOfWeek,
        [FromQuery] string? shiftName,
        [FromQuery] string? shift)
    {
        var result = await _coordinationService.GetActiveOrdersAsync(new CoordinationOrdersQueryDto
        {
            ServiceDate = serviceDate,
            DayOfWeek = dayOfWeek,
            ShiftName = shiftName,
            Shift = shift
        });

        return Ok(ApiResponse<IReadOnlyList<CoordinationOrderDto>>.SuccessResult(result));
    }

    [HttpPost("orders/lock")]
    [ProducesResponseType(typeof(ApiResponse<LockOrderPlanResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> LockOrderPlan([FromBody] LockOrderPlanRequestDto request)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _coordinationService.LockOrderPlanAsync(request, userId);
        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy kế hoạch suất ăn để chốt."));
        }

        return Ok(ApiResponse<LockOrderPlanResultDto>.SuccessResult(result, "Chốt đơn thành công."));
    }

    [HttpPost("orders/adjust")]
    [ProducesResponseType(typeof(ApiResponse<AdjustOrderAfterLockResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustOrderAfterLock([FromBody] AdjustOrderAfterLockRequestDto request)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _coordinationService.AdjustOrderAfterLockAsync(request, userId);
        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để điều chỉnh."));
        }

        return Ok(ApiResponse<AdjustOrderAfterLockResultDto>.SuccessResult(result, "Điều chỉnh đơn thành công."));
    }

    [HttpPatch("orders/{id}/servings")]
    [ProducesResponseType(typeof(ApiResponse<AdjustServingsResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustServings([FromRoute] string id, [FromBody] AdjustServingsRequestDto request)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _coordinationService.AdjustServingsAsync(id, request, userId);
        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để điều chỉnh."));
        }

        return Ok(ApiResponse<AdjustServingsResultDto>.SuccessResult(result, "Điều chỉnh số suất ăn thành công."));
    }

    [HttpPost("orders/export")]
    [ProducesResponseType(typeof(ApiResponse<ExportOrderReportResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportOrderReport([FromBody] ExportOrderReportRequestDto request)
    {
        var result = await _coordinationService.ExportOrderReportAsync(request);
        return Ok(ApiResponse<ExportOrderReportResultDto>.SuccessResult(result, "Tạo báo cáo thành công."));
    }
}
