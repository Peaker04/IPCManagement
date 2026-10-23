using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/source-deltas"), Authorize]
[SystemOperation("reconciliation.source-deltas.read", OperationDisposition.ReconciliationOnly)]
public sealed class ReconciliationSourceDeltasController(ReconciliationSourceRevisionService service) : ControllerBase
{
    [HttpGet, Authorize(Policy = AuthorizationPolicies.ReconciliationWarehouseReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<ReconciliationSourceDeltaQueueItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ReconciliationSourceDeltaPageQuery query, CancellationToken token)
        => Ok(ApiResponse<PagedResponseDto<ReconciliationSourceDeltaQueueItemDto>>.SuccessResult(
            await service.GetPendingPageAsync(query, token)));
}
