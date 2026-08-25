using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/batches"), Authorize]
public sealed class ReconciliationBatchesController(ReconciliationBatchService service, ReconciliationCompletionService completion, ICurrentUserService currentUser) : ControllerBase
{
    [HttpGet, Authorize(Policy = AuthorizationPolicies.ReportAccess), ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ReconciliationBatchDto>>), StatusCodes.Status200OK)] public async Task<IActionResult> List(CancellationToken token) => Ok(ApiResponse<IReadOnlyList<ReconciliationBatchDto>>.SuccessResult(await service.ListAsync(token)));
    [HttpGet("{id}"), Authorize(Policy = AuthorizationPolicies.ReportAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Get(string id, CancellationToken token) { var item = await service.GetAsync(id, token); return item is null ? NotFound(ApiResponse.FailResult("Không tìm thấy lô đối chiếu.")) : Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(item)); }
    [HttpPost, Authorize(Policy = AuthorizationPolicies.CoordinationAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Create(CreateReconciliationDraftRequest request, CancellationToken token) => Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(await service.CreateDraftAsync(request, currentUser.GetUserId(User) ?? "", token)));
    [HttpPost("{id}/ready"), Authorize(Policy = AuthorizationPolicies.CoordinationAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Ready(string id, ReadyReconciliationBatchRequest request, CancellationToken token) => Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(await service.ReadyAsync(id, request, currentUser.GetUserId(User) ?? "", token)));
    [HttpPost("{id}/complete"), Authorize(Policy = AuthorizationPolicies.ReconciliationCompleteAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Complete(string id, CompleteReconciliationBatchRequest request, CancellationToken token) => Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(await completion.CompleteAsync(id, request, currentUser.GetUserId(User) ?? "", token)));
}
