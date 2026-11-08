using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Controllers;

[ApiController]
[Route("api/data-quality-dispositions")]
[Authorize]
[EnableRateLimiting("api-general")]
public sealed class DataQualityDispositionsController(
    IDataQualityDispositionService service,
    ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.InventoryApproveAccess)]
    public async Task<IActionResult> GetAsync([FromQuery] string? status, CancellationToken cancellationToken)
        => Ok(ApiResponse<IReadOnlyList<DataQualityDispositionDto>>.SuccessResult(await service.GetAsync(status, cancellationToken)));

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public Task<IActionResult> CreateAsync(CreateDataQualityDispositionRequest request, CancellationToken cancellationToken)
        => ExecuteAsync(() => service.CreateAsync(request, currentUserService.GetUserId(User) ?? string.Empty, cancellationToken), 201);

    [HttpPost("{id}/review")]
    [Authorize(Policy = AuthorizationPolicies.InventoryApproveAccess)]
    public Task<IActionResult> ReviewAsync(string id, ReviewDataQualityDispositionRequest request, CancellationToken cancellationToken)
        => ExecuteAsync(() => service.ReviewAsync(id, request, currentUserService.GetUserId(User) ?? string.Empty, cancellationToken), 200);

    [HttpPost("{id}/apply")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public Task<IActionResult> ApplyAsync(string id, ApplyDataQualityDispositionRequest request, CancellationToken cancellationToken)
        => ExecuteAsync(() => service.ApplyAsync(id, request, currentUserService.GetUserId(User) ?? string.Empty, cancellationToken), 200);

    private static async Task<IActionResult> ExecuteAsync(Func<Task<DataQualityDispositionDto>> operation, int status)
    {
        try
        {
            return new ObjectResult(ApiResponse<DataQualityDispositionDto>.SuccessResult(await operation())) { StatusCode = status };
        }
        catch (ArgumentException exception) { return new BadRequestObjectResult(ApiResponse.FailResult(exception.Message)); }
        catch (UnauthorizedAccessException exception) { return new ObjectResult(ApiResponse.FailResult(exception.Message)) { StatusCode = 403 }; }
        catch (KeyNotFoundException exception) { return new NotFoundObjectResult(ApiResponse.FailResult(exception.Message)); }
        catch (DbUpdateConcurrencyException exception) { return new ConflictObjectResult(ApiResponse.FailResult(exception.Message)); }
        catch (BusinessRuleException exception) { return new ConflictObjectResult(ApiResponse.FailResult(exception.Message)); }
        catch (InvalidOperationException exception) { return new ConflictObjectResult(ApiResponse.FailResult(exception.Message)); }
    }
}
