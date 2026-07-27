using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;

namespace IPCManagement.Api.Features.Coordination.Controllers;

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
    public async Task<IActionResult> GetOrdersAsync(
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

    [HttpGet("customer-contracts")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CustomerContractDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomerContractsAsync()
    {
        var result = await _coordinationService.GetCustomerContractsAsync();
        return Ok(ApiResponse<IReadOnlyList<CustomerContractDto>>.SuccessResult(result));
    }

    [HttpPost("customers/contract")]
    [ProducesResponseType(typeof(ApiResponse<CustomerContractDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCustomerContractAsync([FromBody] CreateCustomerContractRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _coordinationService.CreateCustomerContractAsync(request, userId);
            return CreatedAtAction(
                nameof(GetCustomerContractsAsync),
                ApiResponse<CustomerContractDto>.SuccessResult(result, "Đã tạo khách hàng và contract."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPut("customers/{id}/contract")]
    [ProducesResponseType(typeof(ApiResponse<CustomerContractDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCustomerContractAsync(string id, [FromBody] UpdateCustomerContractRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _coordinationService.UpdateCustomerContractAsync(id, request, userId);
            if (result is null)
            {
                return NotFound(ApiResponse.FailResult("Không tìm thấy khách hàng để cập nhật contract."));
            }

            return Ok(ApiResponse<CustomerContractDto>.SuccessResult(result, "Đã cập nhật contract khách hàng."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpGet("portion-rules")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PortionRuleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPortionRulesAsync([FromQuery] PortionRuleQueryDto query)
    {
        var result = await _coordinationService.GetPortionRulesAsync(query);
        return Ok(ApiResponse<IReadOnlyList<PortionRuleDto>>.SuccessResult(result));
    }

    [HttpPost("portion-rules")]
    [ProducesResponseType(typeof(ApiResponse<PortionRuleDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreatePortionRuleAsync([FromBody] CreatePortionRuleRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _coordinationService.CreatePortionRuleAsync(request, userId);
            return CreatedAtAction(
                nameof(GetPortionRulesAsync),
                ApiResponse<PortionRuleDto>.SuccessResult(result, "Đã tạo portion rule."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPut("portion-rules/{id}")]
    [ProducesResponseType(typeof(ApiResponse<PortionRuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePortionRuleAsync(string id, [FromBody] UpdatePortionRuleRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _coordinationService.UpdatePortionRuleAsync(id, request, userId);
            if (result is null)
            {
                return NotFound(ApiResponse.FailResult("Không tìm thấy portion rule."));
            }

            return Ok(ApiResponse<PortionRuleDto>.SuccessResult(result, "Đã cập nhật portion rule."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("portion-rules/resolve")]
    [ProducesResponseType(typeof(ApiResponse<ResolvedPortionRuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResolvePortionRuleAsync([FromBody] ResolvePortionRuleRequest request)
    {
        try
        {
            var result = await _coordinationService.ResolvePortionRuleAsync(request);
            if (result is null)
            {
                return NotFound(ApiResponse.FailResult("Không tìm thấy khách hàng để resolve portion rule."));
            }

            return Ok(ApiResponse<ResolvedPortionRuleDto>.SuccessResult(result));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpGet("menu-schedules")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MenuScheduleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMenuSchedulesAsync([FromQuery] MenuScheduleQueryDto query)
    {
        var result = await _coordinationService.GetMenuSchedulesAsync(query);
        return Ok(ApiResponse<IReadOnlyList<MenuScheduleDto>>.SuccessResult(result));
    }

    [HttpPatch("menu-schedules/{id}/rules")]
    [ProducesResponseType(typeof(ApiResponse<MenuScheduleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMenuScheduleRulesAsync(string id, [FromBody] UpdateMenuScheduleRulesRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _coordinationService.UpdateMenuScheduleRulesAsync(id, request, userId);
            if (result is null)
            {
                return NotFound(ApiResponse.FailResult("Không tìm thấy lịch thực đơn để cập nhật quy tắc."));
            }

            return Ok(ApiResponse<MenuScheduleDto>.SuccessResult(result, "Đã cập nhật quy tắc suất ăn."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPatch("menu-schedules/{id}/version")]
    [ProducesResponseType(typeof(ApiResponse<MenuScheduleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMenuScheduleVersionAsync(string id, [FromBody] UpdateMenuScheduleVersionRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _coordinationService.UpdateMenuScheduleVersionAsync(id, request, userId);
            if (result is null)
            {
                return NotFound(ApiResponse.FailResult("Không tìm thấy lịch thực đơn để cập nhật version."));
            }

            return Ok(ApiResponse<MenuScheduleDto>.SuccessResult(result, "Đã cập nhật version thực đơn."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("menu-versions/rollback")]
    [ProducesResponseType(typeof(ApiResponse<MenuVersionRollbackResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RollbackMenuVersionAsync([FromBody] RollbackMenuVersionRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _coordinationService.RollbackMenuVersionAsync(request, userId);
            return Ok(ApiResponse<MenuVersionRollbackResultDto>.SuccessResult(result, "Đã quay lại version thực đơn trước đó."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpGet("meal-quantity-plans")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MealQuantityPlanDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMealQuantityPlansAsync([FromQuery] MealQuantityPlanQueryDto query)
    {
        var result = await _coordinationService.GetMealQuantityPlansAsync(query);
        return Ok(ApiResponse<IReadOnlyList<MealQuantityPlanDto>>.SuccessResult(result));
    }

    [HttpPost("meal-quantity-plans/quick-servings")]
    [ProducesResponseType(typeof(ApiResponse<MealQuantityPlanDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpsertQuickServingsAsync([FromBody] UpsertQuickServingsRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _coordinationService.UpsertQuickServingsAsync(request, userId);
            if (result is null)
            {
                return NotFound(ApiResponse.FailResult("Không tìm thấy lịch menu cho ngày/ca này để tạo kế hoạch suất."));
            }

            return Ok(ApiResponse<MealQuantityPlanDto>.SuccessResult(
                result,
                request.Complete ? "Đã hoàn tất số suất cho KHSX." : "Đã lưu số suất cho KHSX."));
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

    [HttpPost("orders/lock")]
    [ProducesResponseType(typeof(ApiResponse<LockOrderPlanResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> LockOrderPlanAsync([FromBody] LockOrderPlanRequest request)
    {
        var userId = _currentUserService.GetUserId(User);
        LockOrderPlanResultDto? result;
        try
        {
            result = await _coordinationService.LockOrderPlanAsync(request, userId);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }

        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy kế hoạch suất ăn để chốt."));
        }

        return Ok(ApiResponse<LockOrderPlanResultDto>.SuccessResult(result, "Chốt đơn thành công."));
    }

    [HttpPost("orders/signoff")]
    [ProducesResponseType(typeof(ApiResponse<CoordinationScopeActionResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SignoffOrderScopeAsync([FromBody] CoordinationScopeActionRequest request)
    {
        var userId = _currentUserService.GetUserId(User);
        try
        {
            var result = await _coordinationService.SignoffOrderScopeAsync(request, userId);
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
        var userId = _currentUserService.GetUserId(User);
        try
        {
            var result = await _coordinationService.UnlockOrderPlanScopeAsync(request, userId);
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
        var userId = _currentUserService.GetUserId(User);
        AdjustOrderAfterLockResultDto? result;
        try
        {
            result = await _coordinationService.AdjustOrderAfterLockAsync(request, userId);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }

        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để điều chỉnh."));
        }

        return Ok(ApiResponse<AdjustOrderAfterLockResultDto>.SuccessResult(result, "Đã gửi yêu cầu duyệt điều chỉnh."));
    }

    [HttpPost("orders/{id}/signoff")]
    [ProducesResponseType(typeof(ApiResponse<SignoffOrderResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SignoffOrderAsync(string id, [FromBody] SignoffOrderRequest request)
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

        return Ok(ApiResponse<SignoffOrderResultDto>.SuccessResult(result, "Hoàn tất ca thành công."));
    }

    [HttpPost("orders/{id}/unlock")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<LockOrderPlanResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UnlockOrderPlanAsync(string id)
    {
        var userId = _currentUserService.GetUserId(User);

        LockOrderPlanResultDto? result;
        try
        {
            result = await _coordinationService.UnlockOrderPlanAsync(id, userId);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }

        if (result is null)
        {
            return NotFound(ApiResponse.FailResult($"Không tìm thấy kế hoạch với ID: {id}"));
        }

        return Ok(ApiResponse<LockOrderPlanResultDto>.SuccessResult(result, "Mở khóa kế hoạch thành công."));
    }

    [HttpPatch("orders/{id}/servings")]
    [ProducesResponseType(typeof(ApiResponse<AdjustServingsResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustServingsAsync([FromRoute] string id, [FromBody] AdjustServingsRequest request)
    {
        var userId = _currentUserService.GetUserId(User);
        AdjustServingsResultDto? result;
        try
        {
            result = await _coordinationService.AdjustServingsAsync(id, request, userId);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }

        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để điều chỉnh."));
        }

        var message = result.Warning ?? "Điều chỉnh số suất ăn thành công.";
        return Ok(ApiResponse<AdjustServingsResultDto>.SuccessResult(result, message));
    }

    [HttpPatch("orders/{id}/forecast")]
    [ProducesResponseType(typeof(ApiResponse<AdjustServingsResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateForecastServingsAsync([FromRoute] string id, [FromBody] UpdateForecastServingsRequest request)
    {
        var userId = _currentUserService.GetUserId(User);
        AdjustServingsResultDto? result;
        try
        {
            result = await _coordinationService.UpdateForecastServingsAsync(id, request, userId);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }

        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để cập nhật."));
        }

        return Ok(ApiResponse<AdjustServingsResultDto>.SuccessResult(result, "Cập nhật số suất dự kiến thành công."));
    }

    [HttpPost("orders/export")]
    [ProducesResponseType(typeof(ApiResponse<ExportOrderReportResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportOrderReportAsync([FromBody] ExportOrderReportRequest request)
    {
        var result = await _coordinationService.ExportOrderReportAsync(request);
        return Ok(ApiResponse<ExportOrderReportResultDto>.SuccessResult(result, "Tạo báo cáo thành công."));
    }

}
