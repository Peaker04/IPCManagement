using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Features.SystemOperation.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Approvals.Controllers;

[ApiController]
[Route("api/approval-history")]
[Authorize]
public class ApprovalHistoryController : ControllerBase
{
    private readonly IApprovalHistoryQueryService _queryService;

    public ApprovalHistoryController(IApprovalHistoryQueryService queryService)
    {
        _queryService = queryService;
    }

    [HttpGet("{documentType}/{documentId}")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ApprovalHistoryItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHistoryAsync(string documentType, string documentId)
    {
        var targetId = GuidHelper.ParseGuidString(documentId);
        if (targetId is null)
        {
            return BadRequest(ApiResponse.FailResult("Mã tài liệu không hợp lệ."));
        }

        var targetType = documentType.Trim().ToLowerInvariant();
        try
        {
            OperationalApprovalRegistry.Require(User, SystemOperationEligibility.Default, targetType);
        }
        catch (UnauthorizedAccessException error)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult(error.Message));
        }
        var result = await _queryService.GetHistoryAsync(targetType, targetId);
        return Ok(ApiResponse<IReadOnlyList<ApprovalHistoryItemDto>>.SuccessResult(result));
    }
}
