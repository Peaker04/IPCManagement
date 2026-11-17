using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Shared.Contracts;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/supplemental-demands")]
[Authorize(Policy = AuthorizationPolicies.ReconciliationSupplementalDemandReadAccess)]
[SystemOperation("reconciliation.supplemental-demands", OperationDisposition.ReconciliationOnly)]
public sealed class ReconciliationSupplementalDemandsController(ReconciliationSupplementalDemandService service) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<ReconciliationSupplementalDemandSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ReconciliationSupplementalDemandPageQuery query, CancellationToken token) =>
        Ok(ApiResponse<PagedResponseDto<ReconciliationSupplementalDemandSummaryDto>>.SuccessResult(await service.GetPageAsync(query, User, token)));

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSupplementalDemandDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(string id, CancellationToken token) =>
        Ok(ApiResponse<ReconciliationSupplementalDemandDto>.SuccessResult(await service.GetAsync(id, User, token)));

    [HttpGet("batches/{batchId}/fulfillment")]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSupplementalFulfillmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Fulfillment(string batchId, [FromQuery] DateOnly serviceDate, CancellationToken token) =>
        Ok(ApiResponse<ReconciliationSupplementalFulfillmentDto>.SuccessResult(await service.GetFulfillmentAsync(batchId, serviceDate, User, token)));

    [HttpGet("batches/{batchId}/dish-options")]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSupplementalDishOptionsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DishOptions(string batchId, [FromQuery] DateOnly serviceDate, CancellationToken token) =>
        Ok(ApiResponse<ReconciliationSupplementalDishOptionsDto>.SuccessResult(await service.GetDishOptionsAsync(batchId, serviceDate, User, token)));

    [HttpPost, Authorize(Policy = AuthorizationPolicies.ReconciliationSupplementalDemandWriteAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSupplementalDemandDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Create([FromBody] ReconciliationSupplementalDemandWriteRequest request, CancellationToken token) =>
        Ok(ApiResponse<ReconciliationSupplementalDemandDto>.SuccessResult(await service.CreateAsync(request, User, token)));

    [HttpPut("{id}"), Authorize(Policy = AuthorizationPolicies.ReconciliationSupplementalDemandWriteAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSupplementalDemandDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(string id, [FromBody] ReconciliationSupplementalDemandWriteRequest request, CancellationToken token) =>
        Ok(ApiResponse<ReconciliationSupplementalDemandDto>.SuccessResult(await service.UpdateDraftAsync(id, request, User, token)));

    [HttpPost("{id}/submit"), Authorize(Policy = AuthorizationPolicies.ReconciliationSupplementalDemandWriteAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSupplementalDemandDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Submit(string id, [FromBody] ReconciliationSupplementalDemandCommand request, CancellationToken token) =>
        Ok(ApiResponse<ReconciliationSupplementalDemandDto>.SuccessResult(await service.SubmitAsync(id, request, User, token)));

    [HttpPost("{id}/approve"), Authorize(Policy = AuthorizationPolicies.ReconciliationSupplementalDemandApproveAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSupplementalDemandDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Approve(string id, [FromBody] ReconciliationSupplementalDemandCommand request, CancellationToken token) =>
        Ok(ApiResponse<ReconciliationSupplementalDemandDto>.SuccessResult(await service.ApproveAsync(id, request, User, token)));

    [HttpPost("{id}/reject"), Authorize(Policy = AuthorizationPolicies.ReconciliationSupplementalDemandApproveAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSupplementalDemandDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Reject(string id, [FromBody] ReconciliationSupplementalDemandCommand request, CancellationToken token) =>
        Ok(ApiResponse<ReconciliationSupplementalDemandDto>.SuccessResult(await service.RejectAsync(id, request, User, token)));

    [HttpPost("{id}/cancel"), Authorize(Policy = AuthorizationPolicies.ReconciliationSupplementalDemandWriteAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationSupplementalDemandDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Cancel(string id, [FromBody] ReconciliationSupplementalDemandCommand request, CancellationToken token) =>
        Ok(ApiResponse<ReconciliationSupplementalDemandDto>.SuccessResult(await service.CancelAsync(id, request, User, token)));
}
