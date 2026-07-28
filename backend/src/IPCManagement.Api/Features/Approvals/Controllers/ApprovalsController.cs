using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Approvals.Controllers;

[ApiController]
[Route("api/approvals")]
[Authorize]
public class ApprovalsController : ControllerBase
{
    private readonly IApprovalInboxService _approvalInboxService;
    private readonly IApprovalWorkflowService _approvalWorkflowService;
    private readonly ICurrentUserService _currentUserService;

    public ApprovalsController(
        IApprovalInboxService approvalInboxService,
        IApprovalWorkflowService approvalWorkflowService,
        ICurrentUserService currentUserService)
    {
        _approvalInboxService = approvalInboxService;
        _approvalWorkflowService = approvalWorkflowService;
        _currentUserService = currentUserService;
    }

    [HttpGet("inbox")]
    [ProducesResponseType(typeof(ApiResponse<ApprovalInboxPageDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInboxAsync([FromQuery] ApprovalInboxQueryDto query, CancellationToken cancellationToken)
        => Ok(ApiResponse<ApprovalInboxPageDto>.SuccessResult(
            await _approvalInboxService.GetPendingPageAsync(User, query, cancellationToken)));

    [HttpPost("{targetType}/{id}")]
    [ProducesResponseType(typeof(ApiResponse<ApprovalResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ExecuteAsync([FromRoute] string targetType, [FromRoute] string id, [FromBody] ApprovalRequest request)
    {
        var actorUserId = _currentUserService.GetUserId(User);
        ApprovalResultDto? result;
        try
        {
            result = await _approvalWorkflowService.ExecuteAsync(targetType, id, request, actorUserId, User);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }

        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy phiếu cần phê duyệt."));
        }

        return Ok(ApiResponse<ApprovalResultDto>.SuccessResult(result, "Thực hiện phê duyệt thành công."));
    }
}
