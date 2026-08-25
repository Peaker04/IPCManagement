using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/lines"), Authorize]
public sealed class ReconciliationActualsController(ReconciliationActualService service, ICurrentUserService currentUser) : ControllerBase
{
    [HttpPut("{lineId}/purchased"), Authorize(Policy = AuthorizationPolicies.PurchaseAccess)] public async Task<IActionResult> Purchased(string lineId, UpsertReconciliationActualRequest request, CancellationToken token) { await service.UpsertAsync(lineId, "PURCHASED", request, currentUser.GetUserId(User) ?? "", token); return NoContent(); }
    [HttpPut("{lineId}/issued"), Authorize(Policy = AuthorizationPolicies.WarehouseAccess)] public async Task<IActionResult> Issued(string lineId, UpsertReconciliationActualRequest request, CancellationToken token) { await service.UpsertAsync(lineId, "ISSUED", request, currentUser.GetUserId(User) ?? "", token); return NoContent(); }
    [HttpPut("{lineId}/disposition"), Authorize(Policy = AuthorizationPolicies.ReportRead)] public async Task<IActionResult> Disposition(string lineId, SetReconciliationDispositionRequest request, CancellationToken token) { await service.SetDispositionAsync(lineId, request, currentUser.GetUserId(User) ?? "", token); return NoContent(); }
}
