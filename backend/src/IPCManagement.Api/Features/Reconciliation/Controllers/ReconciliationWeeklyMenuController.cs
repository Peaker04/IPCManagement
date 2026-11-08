using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController]
[Route("api/reconciliation/weekly-menu")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[SystemOperation("reconciliation.weekly-menu.read", OperationDisposition.ReconciliationOnly)]
public sealed class ReconciliationWeeklyMenuController(
    IWeeklyMenuQueryService queryService,
    MrxEditScopeQuery editScopeQuery) : ControllerBase
{
    [HttpGet("edit-scope")]
    [ProducesResponseType(typeof(ApiResponse<MrxEditScopeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetEditScopeAsync(
        [FromQuery] string customerId,
        [FromQuery] string weekStartDate,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(customerId))
            return BadRequest(ApiResponse.FailResult("Vui lòng chọn khách hàng để tải phạm vi chỉnh sửa."));
        if (!DateOnly.TryParse(weekStartDate, out var parsedWeekStart))
            return BadRequest(ApiResponse.FailResult("Ngày bắt đầu tuần không hợp lệ."));
        var result = await editScopeQuery.GetAsync(customerId, parsedWeekStart, cancellationToken);
        return result is null
            ? NotFound(ApiResponse.FailResult("Chưa có thực đơn tuần trong phạm vi đã chọn."))
            : Ok(ApiResponse<MrxEditScopeDto>.SuccessResult(result));
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<WeeklyMenuImportResultDto?>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetAsync(
        [FromQuery] string customerId,
        [FromQuery] string? weekStartDate,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(customerId))
        {
            return BadRequest(ApiResponse.FailResult("Vui lòng chọn khách hàng để tải thực đơn tuần."));
        }

        DateOnly? parsedWeekStart = null;
        if (!string.IsNullOrWhiteSpace(weekStartDate))
        {
            if (!DateOnly.TryParse(weekStartDate, out var parsed))
            {
                return BadRequest(ApiResponse.FailResult("Ngày bắt đầu tuần không hợp lệ."));
            }

            parsedWeekStart = parsed;
        }

        var result = await queryService.GetCommittedWeeklyMenuAsync(
            customerId,
            parsedWeekStart,
            cancellationToken);

        return Ok(ApiResponse<WeeklyMenuImportResultDto?>.SuccessResult(
            result,
            result is null ? "Chưa có thực đơn tuần đã lưu." : "Đã tải thực đơn tuần đã lưu."));
    }
}
