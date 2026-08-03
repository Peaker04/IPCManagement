using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Exceptions;
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
public sealed class MenuSchedulesController : ControllerBase
{
    private readonly IMenuScheduleService _service;
    private readonly ICurrentUserService _currentUserService;

    public MenuSchedulesController(IMenuScheduleService service, ICurrentUserService currentUserService)
    {
        _service = service;
        _currentUserService = currentUserService;
    }

    [HttpGet("menu-schedules")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MenuScheduleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMenuSchedulesAsync([FromQuery] MenuScheduleQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<MenuScheduleDto>>.SuccessResult(await _service.GetMenuSchedulesAsync(query)));

    [HttpPatch("menu-schedules/{id}/rules")]
    [ProducesResponseType(typeof(ApiResponse<MenuScheduleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateMenuScheduleRulesAsync(string id, [FromBody] UpdateMenuScheduleRulesRequest request)
    {
        try
        {
            var result = await _service.UpdateMenuScheduleRulesAsync(
                id,
                request,
                _currentUserService.GetUserId(User),
                HttpContext.TraceIdentifier);
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy lịch thực đơn để cập nhật quy tắc."))
                : Ok(ApiResponse<MenuScheduleDto>.SuccessResult(result, "Đã cập nhật quy tắc suất ăn."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
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
            var result = await _service.UpdateMenuScheduleVersionAsync(
                id,
                request,
                _currentUserService.GetUserId(User),
                HttpContext.TraceIdentifier);
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy lịch thực đơn để cập nhật version."))
                : Ok(ApiResponse<MenuScheduleDto>.SuccessResult(result, "Đã cập nhật version thực đơn."));
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
            var result = await _service.RollbackMenuVersionAsync(request, _currentUserService.GetUserId(User));
            return Ok(ApiResponse<MenuVersionRollbackResultDto>.SuccessResult(result, "Đã quay lại version thực đơn trước đó."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
