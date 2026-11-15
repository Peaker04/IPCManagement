using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/source-history"), Authorize]
[SystemOperation("reconciliation.source-history.read", OperationDisposition.ReconciliationOnly)]
public sealed class ReconciliationSourceHistoryController(ReconciliationSourceHistoryService service) : ControllerBase
{
    [HttpGet, Authorize(Policy = AuthorizationPolicies.ReconciliationWarehouseReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<ReconciliationSourceHistoryEventDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ReconciliationSourceHistoryPageQuery query, CancellationToken token)
        => Ok(ApiResponse<PagedResponseDto<ReconciliationSourceHistoryEventDto>>.SuccessResult(
            await service.GetPageAsync(query, token)));

    [HttpGet("{eventId}"), Authorize(Policy = AuthorizationPolicies.ReconciliationWarehouseReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSourceHistoryDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Detail(string eventId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 25, CancellationToken token = default)
    {
        var detail = await service.GetDetailAsync(eventId, pageNumber, pageSize, token);
        return detail == null ? NotFound() : Ok(ApiResponse<ReconciliationSourceHistoryDetailDto>.SuccessResult(detail));
    }
}
