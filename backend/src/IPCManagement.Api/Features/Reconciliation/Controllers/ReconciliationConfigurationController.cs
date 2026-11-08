using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/configuration"), Authorize(Policy = AuthorizationPolicies.AdminAccess)]
public sealed class ReconciliationConfigurationController(
    ReconciliationToleranceInitializer initializer,
    ICurrentUserService currentUser) : ControllerBase
{
    [HttpPost("system-default/initialize")]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationToleranceInitializationResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> InitializeSystemDefault(CancellationToken cancellationToken) =>
        Ok(ApiResponse<ReconciliationToleranceInitializationResult>.SuccessResult(
            await initializer.InitializeAsync(currentUser.GetUserId(User) ?? string.Empty, cancellationToken)));
}
