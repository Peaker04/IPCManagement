using IPCManagement.Api.Features.SystemOperation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Features.SystemOperation.Initialization;
using IPCManagement.Api.Security;
using IPCManagement.Api.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.SystemOperation.Controllers;

[ApiController]
[Route("api/system-operation-mode")]
[Authorize]
[SystemOperationNeutral]
public sealed class SystemOperationModeController(SystemOperationModeService service, SystemOperationModeInitializer initializer, ICurrentUserService currentUser) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAsync(CancellationToken cancellationToken) =>
        Ok(ApiResponse<SystemOperationModeDto>.SuccessResult(await service.GetAsync(cancellationToken)));

    [HttpPost("initialize")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> InitializeAsync(CancellationToken cancellationToken) =>
        Ok(ApiResponse<InitializationResult>.SuccessResult(await initializer.InitializeAsync(currentUser.GetUserId(User) ?? string.Empty, cancellationToken)));

    [HttpPut]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> ChangeAsync(ChangeSystemOperationModeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.ChangeAsync(request, currentUser.GetUserId(User) ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<SystemOperationModeDto>.SuccessResult(result));
        }
        catch (SystemOperationConflictException exception) { return Conflict(ApiResponse.FailResult(exception.Message)); }
        catch (ArgumentException exception) { return BadRequest(ApiResponse.FailResult(exception.Message)); }
    }
}
