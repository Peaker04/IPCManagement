using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/daily-lines"), Authorize]
public sealed class ReconciliationDailyLinesController(ReconciliationActualService service, ICurrentUserService currentUser) : ControllerBase
{
    [HttpPut("{dailyLineId}/disposition")]
    [SystemOperation("reconciliation.daily-lines.disposition", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationDispositionAccess)]
    public async Task<IActionResult> Disposition(string dailyLineId, SetReconciliationDispositionRequest request, CancellationToken token)
    {
        await service.SetDailyDispositionAsync(dailyLineId, request, currentUser.GetUserId(User) ?? "", token);
        return NoContent();
    }
}
