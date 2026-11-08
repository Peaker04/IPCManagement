using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.LifecycleOutbox;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Admin.Controllers;

[ApiController]
[Route("api/admin/lifecycle-outbox")]
[Authorize(Policy = AuthorizationPolicies.AdminAccess)]
[EnableRateLimiting("api-general")]
public sealed class LifecycleOutboxController(
    ILifecycleOutboxAdminService service,
    ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAsync(
        [FromQuery] string? status,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
        => Ok(ApiResponse<IReadOnlyList<LifecycleOutboxMessageDto>>.SuccessResult(
            await service.GetAsync(status, limit, cancellationToken)));

    [HttpPost("{messageId}/replay")]
    public async Task<IActionResult> ReplayAsync(
        string messageId,
        [FromBody] ReplayLifecycleOutboxRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.ReplayAsync(
                messageId,
                currentUserService.GetUserId(User) ?? string.Empty,
                request.Reason,
                cancellationToken);
            return Ok(ApiResponse<LifecycleOutboxMessageDto>.SuccessResult(result, "Đã đưa message về hàng đợi và ghi audit."));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse.FailResult(exception.Message));
        }
        catch (UnauthorizedAccessException exception)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult(exception.Message));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse.FailResult(exception.Message));
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(ApiResponse.FailResult(exception.Message));
        }
    }
}
