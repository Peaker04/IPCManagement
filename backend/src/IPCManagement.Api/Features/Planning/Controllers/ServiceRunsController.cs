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
[Authorize]
public sealed partial class ServiceRunsController(IServiceRunService serviceRunService, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> OpenAsync([FromBody] OpenServiceRunRequest request, CancellationToken cancellationToken)
    {
        var result = await serviceRunService.OpenAsync(request, currentUserService.GetUserId(User), cancellationToken);
        return Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(result!));
    }

    [HttpGet("{id}")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAsync(string id, CancellationToken cancellationToken)
    {
        var result = await serviceRunService.GetProjectionAsync(id, cancellationToken);
        return result is null ? NotFound(ApiResponse.FailResult("Không tìm thấy Ca phục vụ.")) : Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(result));
    }

    [HttpGet("by-plan")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByPlanAsync([FromQuery] ServiceRunByPlanQuery query, CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto?>.SuccessResult(
            await serviceRunService.GetByPlanAsync(query, cancellationToken)));

    [HttpGet("page")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseOrderReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<ServiceRunOperationalRowDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPageAsync([FromQuery] ServiceRunPageQuery query, CancellationToken cancellationToken)
        => Ok(ApiResponse<PagedResponseDto<ServiceRunOperationalRowDto>>.SuccessResult(
            await serviceRunService.GetPageAsync(query, cancellationToken)));

    [HttpPost("{id}/start")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> StartAsync(string id, CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(
            (await serviceRunService.StartAsync(id, currentUserService.GetUserId(User), cancellationToken))!));

    [HttpPost("{id}/actual-servings")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> RecordActualServingsAsync(string id, [FromBody] RecordActualServingsRequest request, CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(
            (await serviceRunService.RecordActualServingsAsync(id, request, currentUserService.GetUserId(User), cancellationToken))!));

    [HttpPost("{id}/service-confirmation")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ConfirmServiceAsync(string id, CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(
            (await serviceRunService.ConfirmServiceAsync(id, currentUserService.GetUserId(User), cancellationToken))!));

    [HttpPost("{id}/service-confirmation/waive")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> WaiveServiceConfirmationAsync(string id, [FromBody] ReasonRequest request, CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(
            (await serviceRunService.WaiveServiceConfirmationAsync(id, request, currentUserService.GetUserId(User), cancellationToken))!));

    [HttpPost("{id}/variance/resolve")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResolveVarianceAsync(string id, [FromBody] ReasonRequest request, CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(
            (await serviceRunService.ResolveVarianceAsync(id, request, currentUserService.GetUserId(User), cancellationToken))!));

    [HttpPost("{id}/serving-variance/resolve")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResolveServingVarianceAsync(string id, [FromBody] ReasonRequest request, CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(
            (await serviceRunService.ResolveServingVarianceAsync(id, request, currentUserService.GetUserId(User), cancellationToken))!));

    [HttpPost("{id}/close")]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    [Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
    [ProducesResponseType(typeof(ApiResponse<ServiceRunLifecycleProjectionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CloseAsync(string id, CancellationToken cancellationToken)
        => Ok(ApiResponse<ServiceRunLifecycleProjectionDto>.SuccessResult(
            (await serviceRunService.CloseAsync(id, currentUserService.GetUserId(User), cancellationToken))!));

}
