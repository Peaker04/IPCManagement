using IPCManagement.Api.Workflows.OperationalApprovals;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Approvals.Controllers;

[ApiController]
[Route("api/operational-approvals")]
[SystemOperation("approvals.operational")]
[Authorize(Policy = AuthorizationPolicies.InventoryApproveAccess)]
public sealed class OperationalApprovalsController(OperationalApprovalService service) : ControllerBase
{
    [HttpGet("inbox")]
    [ProducesResponseType(typeof(ApiResponse<OperationalApprovalPage>), StatusCodes.Status200OK)]
    public Task<IActionResult> Inbox([FromQuery] ApprovalInboxQueryDto query, CancellationToken token) =>
        Run(() => service.GetPageAsync(User, query, token));

    [HttpGet("{targetType}/{id}")]
    [ProducesResponseType(typeof(ApiResponse<OperationalApprovalDetail>), StatusCodes.Status200OK)]
    public Task<IActionResult> Detail(string targetType, string id, CancellationToken token, [FromQuery] string state = "PENDING") =>
        Run(() => service.GetDetailAsync(User, targetType, id, token, state));

    [HttpGet("{targetType}/{id}/history")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ApprovalHistoryItemDto>>), StatusCodes.Status200OK)]
    public Task<IActionResult> History(string targetType, string id, CancellationToken token) =>
        Run(() => service.GetHistoryAsync(User, targetType, id, token));

    [HttpPost("{targetType}/{id}/decision")]
    [ProducesResponseType(typeof(ApiResponse<ApprovalResultDto>), StatusCodes.Status200OK)]
    public Task<IActionResult> Decide(string targetType, string id, [FromBody] OperationalApprovalActionRequest request,
        CancellationToken token) => Run(() => service.DecideAsync(User, targetType, id, request, token));

    private async Task<IActionResult> Run<T>(Func<Task<T>> readOrCommand)
    {
        try { return Ok(ApiResponse<T>.SuccessResult(await readOrCommand())); }
        catch (UnauthorizedAccessException error) { return StatusCode(403, ApiResponse.FailResult(error.Message)); }
        catch (KeyNotFoundException error) { return NotFound(ApiResponse.FailResult(error.Message)); }
        catch (SystemOperationConflictException error) { return Conflict(ApiResponse.FailResult(error.Message)); }
        catch (BusinessRuleException error) { return Conflict(ApiResponse.FailResult(error.Message)); }
        catch (ArgumentException error) { return BadRequest(ApiResponse.FailResult(error.Message)); }
    }
}
