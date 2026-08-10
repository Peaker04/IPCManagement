using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.SampleData.Controllers;

public sealed partial class WeeklyMenuImportsController
{
    [HttpPost("weekly-menu/amendments")]
    [ProducesResponseType(typeof(ApiResponse<MenuAmendmentResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateMenuAmendmentAsync(
        [FromBody] CreateMenuAmendmentRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _menuAmendmentService.CreateAsync(
                request,
                _currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(
                result,
                result.RequiresReconciliation
                    ? "Đã tạo yêu cầu thay đổi; cần đối soát chứng từ phía sau."
                    : "Đã tạo yêu cầu thay đổi thực đơn, chờ review."));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("weekly-menu/amendments/{amendmentId}/review")]
    [Authorize(Roles = "Manager,MANAGER,Quản lý")]
    public async Task<IActionResult> ReviewMenuAmendmentAsync(
        string amendmentId,
        [FromBody] ReviewMenuAmendmentRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _menuAmendmentService.ReviewAsync(
                amendmentId,
                request,
                _currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(
                result,
                "Đã hậu kiểm yêu cầu thay đổi thực đơn."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("weekly-menu/amendments/{amendmentId}/execute")]
    [Authorize(Roles = "Admin,ADMIN,Quản trị")]
    public async Task<IActionResult> ExecuteMenuAmendmentAsync(
        string amendmentId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _menuAmendmentService.ExecuteAsync(
                amendmentId,
                _currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(
                result,
                "Đã thực thi thay đổi thực đơn."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("weekly-menu/amendments/{amendmentId}/break-glass-execute")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> BreakGlassExecuteMenuAmendmentAsync(
        string amendmentId,
        [FromBody] BreakGlassMenuAmendmentRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _menuAmendmentService.BreakGlassExecuteAsync(
                amendmentId,
                request,
                _currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(
                result,
                "Đã thực thi break-glass và ghi audit hậu kiểm."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpGet("weekly-menu/amendments")]
    public async Task<IActionResult> GetMenuAmendmentsAsync(
        [FromQuery] string? status,
        CancellationToken cancellationToken)
        => Ok(ApiResponse<IReadOnlyList<MenuAmendmentInboxItemDto>>.SuccessResult(
            await _menuAmendmentService.GetInboxAsync(status, cancellationToken)));
}
