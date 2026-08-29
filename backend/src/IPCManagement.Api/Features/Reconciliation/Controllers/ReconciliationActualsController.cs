using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/lines"), Authorize]
public sealed class ReconciliationActualsController(ReconciliationActualService service, ICurrentUserService currentUser) : ControllerBase
{
    [HttpGet("disposition-categories"), Authorize(Policy = AuthorizationPolicies.ReportAccess), ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ReconciliationDispositionCategoryDto>>), StatusCodes.Status200OK)]
    public IActionResult DispositionCategories() => Ok(ApiResponse<IReadOnlyList<ReconciliationDispositionCategoryDto>>.SuccessResult(ReconciliationDispositionCategories.Options));

    [HttpPut("{lineId}/purchased"), SystemOperation("reconciliation.actuals.purchased", OperationDisposition.ReconciliationOnly), Authorize(Policy = AuthorizationPolicies.PurchaseAccess)] public async Task<IActionResult> Purchased(string lineId, UpsertReconciliationActualRequest request, CancellationToken token) { await service.UpsertAsync(lineId, "PURCHASED", request, currentUser.GetUserId(User) ?? "", token); return NoContent(); }
    [HttpPut("{lineId}/issued"), SystemOperation("reconciliation.actuals.issued", OperationDisposition.ReconciliationOnly), Authorize(Policy = AuthorizationPolicies.WarehouseAccess)] public async Task<IActionResult> Issued(string lineId, UpsertReconciliationActualRequest request, CancellationToken token) { await service.UpsertAsync(lineId, "ISSUED", request, currentUser.GetUserId(User) ?? "", token); return NoContent(); }
    [HttpPut("{lineId}/disposition"), SystemOperation("reconciliation.actuals.disposition", OperationDisposition.ReconciliationOnly), Authorize(Policy = AuthorizationPolicies.ReconciliationDispositionAccess)] public async Task<IActionResult> Disposition(string lineId, SetReconciliationDispositionRequest request, CancellationToken token) { await service.SetDispositionAsync(lineId, request, currentUser.GetUserId(User) ?? "", token); return NoContent(); }
}
