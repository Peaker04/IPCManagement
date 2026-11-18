using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/historical-purpose")]
[Authorize(Policy = AuthorizationPolicies.ReconciliationSupplementalDemandWriteAccess)]
[SystemOperation(MrxHistoricalPurposeRecoveryService.Operation, OperationDisposition.ReconciliationOnly)]
public sealed class MrxHistoricalPurposeController(MrxHistoricalPurposeRecoveryService service) : ControllerBase
{
    [HttpGet("batches/{batchId}")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MrxHistoricalPurposeCandidate>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(string batchId, [FromQuery] DateOnly date, CancellationToken token) =>
        Ok(ApiResponse<IReadOnlyList<MrxHistoricalPurposeCandidate>>.SuccessResult(await service.ListAsync(batchId, date, User, token)));

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<MrxHistoricalPurposeDetail>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Propose(MrxHistoricalPurposeProposalRequest request, CancellationToken token) =>
        Ok(ApiResponse<MrxHistoricalPurposeDetail>.SuccessResult(await service.ProposeAsync(request, User, token)));
}
