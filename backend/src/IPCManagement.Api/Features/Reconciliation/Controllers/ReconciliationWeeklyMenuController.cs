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
[SystemOperation("reconciliation.weekly-menu.read")]
public sealed class ReconciliationWeeklyMenuController(IWeeklyMenuQueryService queryService) : ControllerBase
{
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
