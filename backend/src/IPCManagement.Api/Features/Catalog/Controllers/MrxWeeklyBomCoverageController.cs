using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Catalog.Controllers;

[ApiController, Route("api/reconciliation/weekly-menu/bom-coverage")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[EnableRateLimiting("api-general")]
public sealed class MrxWeeklyBomCoverageController(MrxWeeklyBomCoverageQuery coverage) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<MrxWeeklyBomCoverage>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetAsync([FromQuery] string customerId, [FromQuery] DateOnly weekStartDate,
        [FromQuery] string menuVersionId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await coverage.ReadAsync(customerId, weekStartDate, menuVersionId, cancellationToken);
            return Ok(ApiResponse<MrxWeeklyBomCoverage>.SuccessResult(result));
        }
        catch (ArgumentException error)
        {
            return BadRequest(ApiResponse.FailResult(error.Message));
        }
    }
}
