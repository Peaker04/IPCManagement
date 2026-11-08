using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Planning.Controllers;

public sealed partial class ServiceRunsController
{
    [HttpGet("{id}/adjustments")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ServiceRunAdjustmentDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAdjustmentsAsync(string id, CancellationToken cancellationToken)
        => Ok(ApiResponse<IReadOnlyList<ServiceRunAdjustmentDto>>.SuccessResult(
            await serviceRunService.GetAdjustmentsAsync(id, cancellationToken)));

    [HttpPost("{id}/adjustments")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunAdjustmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateAdjustmentAsync(string id, [FromBody] CreateServiceRunAdjustmentRequest request, CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunAdjustmentDto>.SuccessResult(
            (await serviceRunService.CreateAdjustmentAsync(id, request, currentUserService.GetUserId(User), cancellationToken))!));
}
