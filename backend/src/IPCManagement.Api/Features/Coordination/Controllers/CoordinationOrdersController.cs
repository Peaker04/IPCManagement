using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Coordination.Controllers;

[ApiController]
[Route("api/coordination")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[EnableRateLimiting("api-general")]
[Tags("Coordination")]
public sealed class CoordinationOrdersController : ControllerBase
{
    private readonly IOrderPlanService _planService;
    private readonly IOrderAdjustmentService _adjustmentService;
    private readonly IOrderSignoffService _signoffService;
    private readonly ICurrentUserService _currentUserService;

    public CoordinationOrdersController(
        IOrderPlanService planService,
        IOrderAdjustmentService adjustmentService,
        IOrderSignoffService signoffService,
        ICurrentUserService currentUserService)
    {
        _planService = planService;
        _adjustmentService = adjustmentService;
        _signoffService = signoffService;
        _currentUserService = currentUserService;
    }

    [HttpGet("orders")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CoordinationOrderDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrdersAsync(
        [FromQuery] string? serviceDate,
        [FromQuery] string? dayOfWeek,
        [FromQuery] string? shiftName,
        [FromQuery] string? shift)
    {
        var result = await _planService.GetActiveOrdersAsync(new CoordinationOrdersQueryDto
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
    public async Task<IActionResult> LockOrderPlanAsync([FromBody] LockOrderPlanRequest request)
    {
        try
        {
            var result = await _planService.LockOrderPlanAsync(request, UserId());
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy kế hoạch suất ăn để chốt."))
                : Ok(ApiResponse<LockOrderPlanResultDto>.SuccessResult(result, "Chốt đơn thành công."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("orders/signoff")]
    [ProducesResponseType(typeof(ApiResponse<CoordinationScopeActionResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SignoffOrderScopeAsync([FromBody] CoordinationScopeActionRequest request)
    {
        try
        {
            var result = await _signoffService.SignoffOrderScopeAsync(request, UserId());
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy kế hoạch suất ăn cho ca đã chọn."))
                : Ok(ApiResponse<CoordinationScopeActionResultDto>.SuccessResult(result, "Hoàn tất ca thành công."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("orders/unlock")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<CoordinationScopeActionResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UnlockOrderPlanScopeAsync([FromBody] CoordinationScopeActionRequest request)
    {
        try
        {
            var result = await _planService.UnlockOrderPlanScopeAsync(request, UserId());
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy kế hoạch suất ăn cho ca đã chọn."))
                : Ok(ApiResponse<CoordinationScopeActionResultDto>.SuccessResult(result, "Mở khóa ca thành công."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("orders/adjust")]
    [ProducesResponseType(typeof(ApiResponse<AdjustOrderAfterLockResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustOrderAfterLockAsync([FromBody] AdjustOrderAfterLockRequest request)
    {
        try
        {
            var result = await _adjustmentService.AdjustOrderAfterLockAsync(request, UserId());
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để điều chỉnh."))
                : Ok(ApiResponse<AdjustOrderAfterLockResultDto>.SuccessResult(result, "Đã gửi yêu cầu duyệt điều chỉnh."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("orders/{id}/signoff")]
    [ProducesResponseType(typeof(ApiResponse<SignoffOrderResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SignoffOrderAsync(string id, [FromBody] SignoffOrderRequest request)
    {
        try
        {
            var result = await _signoffService.SignoffOrderAsync(id, request, UserId());
            return result is null
                ? NotFound(ApiResponse.FailResult($"Không tìm thấy kế hoạch với ID: {id}"))
                : Ok(ApiResponse<SignoffOrderResultDto>.SuccessResult(result, "Hoàn tất ca thành công."));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("orders/{id}/unlock")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<LockOrderPlanResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UnlockOrderPlanAsync(string id)
    {
        try
        {
            var result = await _planService.UnlockOrderPlanAsync(id, UserId());
            return result is null
                ? NotFound(ApiResponse.FailResult($"Không tìm thấy kế hoạch với ID: {id}"))
                : Ok(ApiResponse<LockOrderPlanResultDto>.SuccessResult(result, "Mở khóa kế hoạch thành công."));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPatch("orders/{id}/servings")]
    [ProducesResponseType(typeof(ApiResponse<AdjustServingsResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustServingsAsync(string id, [FromBody] AdjustServingsRequest request)
    {
        try
        {
            var result = await _adjustmentService.AdjustServingsAsync(id, request, UserId());
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để điều chỉnh."))
                : Ok(ApiResponse<AdjustServingsResultDto>.SuccessResult(result, result.Warning ?? "Điều chỉnh số suất ăn thành công."));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPatch("orders/{id}/forecast")]
    [ProducesResponseType(typeof(ApiResponse<AdjustServingsResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateForecastServingsAsync(string id, [FromBody] UpdateForecastServingsRequest request)
    {
        try
        {
            var result = await _adjustmentService.UpdateForecastServingsAsync(id, request, UserId());
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để cập nhật."))
                : Ok(ApiResponse<AdjustServingsResultDto>.SuccessResult(result, "Cập nhật số suất dự kiến thành công."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("orders/export")]
    [ProducesResponseType(typeof(ApiResponse<ExportOrderReportResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportOrderReportAsync([FromBody] ExportOrderReportRequest request)
        => Ok(ApiResponse<ExportOrderReportResultDto>.SuccessResult(
            await _planService.ExportOrderReportAsync(request),
            "Tạo báo cáo thành công."));

    private string? UserId() => _currentUserService.GetUserId(User);
}
