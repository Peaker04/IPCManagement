using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Reports.Controllers;

[ApiController]
[Route("api/unit-normalization-reviews")]
[Authorize(Policy = AuthorizationPolicies.InventoryApproveAccess)]
[EnableRateLimiting("api-general")]
public sealed class UnitNormalizationReviewsController(
    IUnitNormalizationReviewService service,
    ICurrentUserService currentUserService) : ControllerBase
{
    [HttpPost("{reviewId}/decision")]
    public async Task<IActionResult> DecideAsync(
        string reviewId,
        UnitNormalizationReviewDecisionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.DecideAsync(
                reviewId, request, currentUserService.GetUserId(User) ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<UnitNormalizationReviewDecisionDto>.SuccessResult(result));
        }
        catch (ArgumentException exception) { return BadRequest(ApiResponse.FailResult(exception.Message)); }
        catch (UnauthorizedAccessException exception) { return StatusCode(403, ApiResponse.FailResult(exception.Message)); }
        catch (KeyNotFoundException exception) { return NotFound(ApiResponse.FailResult(exception.Message)); }
        catch (InvalidOperationException exception) { return Conflict(ApiResponse.FailResult(exception.Message)); }
    }
}
