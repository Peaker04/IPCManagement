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

    // ── Existing ─────────────────────────────────────────────────────────────

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

    [HttpPost("orders/export")]
    [ProducesResponseType(typeof(ApiResponse<ExportOrderReportResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportOrderReport([FromBody] ExportOrderReportRequestDto request)
    {
        var result = await _coordinationService.ExportOrderReportAsync(request);
        return Ok(ApiResponse<ExportOrderReportResultDto>.SuccessResult(result, "Tạo báo cáo thành công."));
    }

    // ── BE-3.2: GET /api/coordination/menu-schedules ─────────────────────────

    /// <summary>
    /// Lấy lịch thực đơn tuần theo ngày / ca. Trả về danh sách menu schedule kèm
    /// thông tin món ăn (BOM) cho từng ca.
    /// </summary>
    [HttpGet("menu-schedules")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MenuScheduleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMenuSchedules([FromQuery] MenuScheduleQueryDto query)
    {
        var result = await _coordinationService.GetMenuSchedulesAsync(query);
        return Ok(ApiResponse<IReadOnlyList<MenuScheduleDto>>.SuccessResult(result));
    }

    // ── BE-3.3: GET /api/coordination/meal-quantity-plans ────────────────────

    /// <summary>
    /// Lấy kế hoạch số suất ăn theo ngày / trạng thái. Trả về đầy đủ thông tin
    /// forecast, confirmed và final servings theo từng ca.
    /// </summary>
    [HttpGet("meal-quantity-plans")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MealQuantityPlanDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMealQuantityPlans([FromQuery] MealQuantityPlanQueryDto query)
    {
        var result = await _coordinationService.GetMealQuantityPlansAsync(query);
        return Ok(ApiResponse<IReadOnlyList<MealQuantityPlanDto>>.SuccessResult(result));
    }

    // ── BE-4.3: POST /api/coordination/orders/{id}/signoff ───────────────────

    /// <summary>
    /// Chốt ca — chuyển trạng thái MealQuantityPlan từ CONFIRMED → COMPLETED.
    /// Ghi audit log tự động. Chỉ cho phép khi kế hoạch đang ở trạng thái CONFIRMED.
    /// </summary>
    [HttpPost("orders/{id}/signoff")]
    [ProducesResponseType(typeof(ApiResponse<SignoffOrderResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SignoffOrder(string id, [FromBody] SignoffOrderRequestDto request)
    {
        var userId = _currentUserService.GetUserId(User);

        SignoffOrderResultDto? result;
        try
        {
            result = await _coordinationService.SignoffOrderAsync(id, request, userId);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }

        if (result is null)
        {
            return NotFound(ApiResponse.FailResult($"Không tìm thấy kế hoạch với ID: {id}"));
        }

        return Ok(ApiResponse<SignoffOrderResultDto>.SuccessResult(result, "Chốt ca thành công."));
    }
}
