using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Approvals;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/approvals")]
[Authorize]
public class ApprovalsController : ControllerBase
{
    private readonly IApprovalWorkflowService _approvalWorkflowService;
    private readonly ICurrentUserService _currentUserService;

    public ApprovalsController(IApprovalWorkflowService approvalWorkflowService, ICurrentUserService currentUserService)
    {
        _approvalWorkflowService = approvalWorkflowService;
        _currentUserService = currentUserService;
    }

    [HttpPost("{targetType}/{id}")]
    [ProducesResponseType(typeof(ApiResponse<ApprovalResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Execute([FromRoute] string targetType, [FromRoute] string id, [FromBody] ApprovalRequestDto request)
    {
        var actorUserId = _currentUserService.GetUserId(User);
        ApprovalResultDto? result;
        try
        {
            result = await _approvalWorkflowService.ExecuteAsync(targetType, id, request, actorUserId);
        }
        catch (InvalidOperationException ex)
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
