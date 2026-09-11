using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Controllers;

[ApiController]
[Route("api/legacy-lineage-dispositions")]
[Authorize]
[EnableRateLimiting("api-general")]
public sealed class LegacyLineageDispositionsController : ControllerBase
{
    private readonly ILegacyLineageDispositionService _service;
    private readonly ICurrentUserService _currentUserService;

    public LegacyLineageDispositionsController(
        ILegacyLineageDispositionService service,
        ICurrentUserService currentUserService)
    {
        _service = service;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.InventoryApproveAccess)]
    public async Task<IActionResult> GetAsync([FromQuery] string? status, CancellationToken cancellationToken)
        => Ok(ApiResponse<IReadOnlyList<LegacyLineageDispositionDto>>.SuccessResult(
            await _service.GetAsync(status, cancellationToken)));

    [HttpGet("candidates")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> GetCandidatesAsync(
        [FromQuery] string legacyLineType,
        [FromQuery] string legacyLineId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(ApiResponse<IReadOnlyList<LegacyLineageCandidateDto>>.SuccessResult(
                await _service.GetCandidatesAsync(legacyLineType, legacyLineId, cancellationToken)));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse.FailResult(exception.Message));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse.FailResult(exception.Message));
        }
        catch (BusinessRuleException exception)
        {
            return Conflict(ApiResponse.FailResult(exception.Message));
        }
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> CreateAsync([FromBody] CreateLegacyLineageDispositionRequest request, CancellationToken cancellationToken)
        => await ExecuteAsync(
            () => _service.CreateAsync(request, _currentUserService.GetUserId(User) ?? string.Empty, cancellationToken),
            StatusCodes.Status201Created,
            "Đã tạo proposal đối soát lineage legacy chờ Manager duyệt.");

    [HttpPost("{id}/review")]
    [Authorize(Policy = AuthorizationPolicies.InventoryApproveAccess)]
    public async Task<IActionResult> ReviewAsync(
        string id,
        [FromBody] ReviewLegacyLineageDispositionRequest request,
        CancellationToken cancellationToken)
        => await ExecuteAsync(
            () => _service.ReviewAsync(id, request, _currentUserService.GetUserId(User) ?? string.Empty, cancellationToken),
            StatusCodes.Status200OK,
            "Đã ghi nhận quyết định Manager cho proposal lineage legacy.");

    [HttpPost("{id}/apply")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> ApplyAsync(
        string id,
        [FromBody] ApplyLegacyLineageDispositionRequest request,
        CancellationToken cancellationToken)
        => await ExecuteAsync(
            () => _service.ApplyAsync(id, request, _currentUserService.GetUserId(User) ?? string.Empty, cancellationToken),
            StatusCodes.Status200OK,
            "Đã áp dụng provenance legacy đã được duyệt.");

    private static async Task<IActionResult> ExecuteAsync(
        Func<Task<LegacyLineageDispositionDto>> operation,
        int successStatus,
        string successMessage)
    {
        try
        {
            var result = await operation();
            return new ObjectResult(ApiResponse<LegacyLineageDispositionDto>.SuccessResult(result, successMessage))
            {
                StatusCode = successStatus,
            };
        }
        catch (ArgumentException exception)
        {
            return new BadRequestObjectResult(ApiResponse.FailResult(exception.Message));
        }
        catch (UnauthorizedAccessException exception)
        {
            return new ObjectResult(ApiResponse.FailResult(exception.Message)) { StatusCode = StatusCodes.Status403Forbidden };
        }
        catch (KeyNotFoundException exception)
        {
            return new NotFoundObjectResult(ApiResponse.FailResult(exception.Message));
        }
        catch (DbUpdateConcurrencyException exception)
        {
            return new ConflictObjectResult(ApiResponse.FailResult(exception.Message));
        }
        catch (BusinessRuleException exception)
        {
            return new ConflictObjectResult(ApiResponse.FailResult(exception.Message));
        }
    }
}
