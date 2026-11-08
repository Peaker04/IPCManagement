using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Planning.Controllers;

[ApiController]
[Route("api/service-runs")]
[Tags("ServiceRuns")]
[Authorize]
public sealed class ServiceRunVarianceDeclarationsController(
    IServiceRunService serviceRunService,
    ICurrentUserService currentUserService) : ControllerBase
{
    [HttpPost("{id}/variance/declarations")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    public async Task<IActionResult> DeclareVarianceAsync(
        string id,
        [FromBody] DeclareServiceRunVarianceRequest request,
        CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(
            (await serviceRunService.DeclareVarianceAsync(
                id,
                request,
                currentUserService.GetUserId(User),
                cancellationToken))!));

    [HttpPost("{id}/variance/declarations/{declarationId}/waive")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> ApproveVarianceWaiverAsync(
        string id,
        string declarationId,
        [FromBody] ApproveServiceRunVarianceWaiverRequest request,
        CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(
            (await serviceRunService.ApproveVarianceWaiverAsync(
                id,
                declarationId,
                request,
                currentUserService.GetUserId(User),
                cancellationToken))!));
}
