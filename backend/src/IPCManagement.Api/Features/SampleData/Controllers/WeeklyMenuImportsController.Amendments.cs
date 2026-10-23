using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.SampleData.Controllers;

public sealed partial class WeeklyMenuImportsController
{
    [HttpPost("weekly-menu/amendments/preview")]
    [SystemOperation("reconciliation.source-change.preview", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MenuAmendmentResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> PreviewMenuAmendmentAsync(
        [FromBody] CreateMenuAmendmentRequest request,
        CancellationToken cancellationToken)
        => Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(
            await _menuAmendmentService.PreviewMrxAsync(request, cancellationToken)));

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

    [HttpPost("weekly-menu/amendments/mrx-submit")]
    [SystemOperation("reconciliation.source-change.submit", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MenuAmendmentResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SubmitMrxMenuAmendmentAsync(
        [FromBody] CreateMenuAmendmentRequest request,
        CancellationToken cancellationToken)
        => Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(
            await _menuAmendmentService.SubmitMrxAsync(
                request,
                _currentUserService.GetUserId(User),
                cancellationToken)));

    [HttpPost("weekly-menu/amendments/admin-confirm")]
    [SystemOperation("reconciliation.source-change.confirm", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    [ProducesResponseType(typeof(ApiResponse<MenuAmendmentResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ConfirmMrxMenuAmendmentAsync(
        [FromBody] CreateMenuAmendmentRequest request,
        CancellationToken cancellationToken)
        => Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(
            await _menuAmendmentService.ConfirmMrxAsync(
                request,
                _currentUserService.GetUserId(User),
                cancellationToken)));

    [HttpPost("weekly-menu/amendments/{amendmentId}/mrx-decision")]
    [SystemOperation("reconciliation.source-change.decide", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    [ProducesResponseType(typeof(ApiResponse<MenuAmendmentResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DecideMrxMenuAmendmentAsync(
        string amendmentId,
        [FromBody] ReviewMenuAmendmentRequest request,
        CancellationToken cancellationToken)
        => Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(
            await _menuAmendmentService.DecideMrxAsync(
                amendmentId,
                request,
                _currentUserService.GetUserId(User),
                cancellationToken)));

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

    [HttpGet("weekly-menu/amendments/mrx-inbox")]
    [SystemOperation("reconciliation.source-change.inbox", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MenuAmendmentInboxItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMrxMenuAmendmentInboxAsync(CancellationToken cancellationToken)
        => Ok(ApiResponse<IReadOnlyList<MenuAmendmentInboxItemDto>>.SuccessResult(
            await _menuAmendmentService.GetMrxInboxAsync(cancellationToken)));

    [HttpGet("weekly-menu/amendments")]
    public async Task<IActionResult> GetMenuAmendmentsAsync(
        [FromQuery] string? status,
        CancellationToken cancellationToken)
        => Ok(ApiResponse<IReadOnlyList<MenuAmendmentInboxItemDto>>.SuccessResult(
            await _menuAmendmentService.GetInboxAsync(status, cancellationToken)));

    [HttpPost("weekly-menu/amendments/decisions/{decisionItemId}/commands")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> ExecuteMenuAmendmentDecisionAsync(string decisionItemId, [FromBody] MenuAmendmentDecisionCommandRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _menuAmendmentService.ExecuteDecisionAsync(decisionItemId, request, _currentUserService.GetUserId(User), cancellationToken);
            return Ok(ApiResponse<MenuAmendmentDecisionItemDto>.SuccessResult(result, "Đã ghi correction append-only; ServiceRun và close snapshot không bị mở lại."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
        {
            return Conflict(ApiResponse<MenuAmendmentDecisionItemDto>.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("weekly-menu/amendments/reconciliation-cases/{reconciliationCaseId}/decision-fan-remediations")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> RemediateMenuAmendmentDecisionFanAsync(string reconciliationCaseId, [FromBody] RemediateMenuAmendmentDecisionFanRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _menuAmendmentService.RemediateDecisionFanAsync(reconciliationCaseId, request, _currentUserService.GetUserId(User), cancellationToken);
            return Ok(ApiResponse<MenuAmendmentDecisionRemediationDto>.SuccessResult(result, "Đã giữ nguyên hồ sơ cũ và bổ sung phạm vi xử lý chính xác."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse.FailResult(ex.Message)); }
        catch (BusinessRuleException ex) { return Conflict(ApiResponse.FailResult(ex.Message)); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse.FailResult(ex.Message)); }
    }

    [HttpGet("weekly-menu/amendments/decisions")]
    public async Task<IActionResult> GetMenuAmendmentDecisionPageAsync(
        [FromQuery] string? customerId,
        [FromQuery] bool allCustomers,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
        => Ok(ApiResponse<MenuAmendmentDecisionPageDto>.SuccessResult(
            await _menuAmendmentService.GetDecisionPageAsync(customerId, allCustomers, page, pageSize, cancellationToken)));
}
