using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Catalog.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
[EnableRateLimiting("api-general")]
public sealed class UnitsController(IUnitService service) : ControllerBase
{
    /// <summary>Lấy danh sách đơn vị đo dùng cho danh mục.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<UnitDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAsync(CancellationToken cancellationToken)
    {
        var units = await service.GetAllAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<UnitDto>>.SuccessResult(units));
    }
}
