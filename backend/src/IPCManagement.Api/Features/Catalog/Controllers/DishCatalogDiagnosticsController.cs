using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Catalog.Controllers;

[ApiController]
[Route("api/Dishes")]
[Authorize]
[EnableRateLimiting("api-general")]
[Tags("Dishes")]
public sealed class DishCatalogDiagnosticsController(IDishCatalogDiagnosticsService service) : ControllerBase
{
    [HttpGet("bom-coverage")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<BomCoverageReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBomCoverageAsync()
        => Ok(ApiResponse<BomCoverageReportDto>.SuccessResult(await service.GetBomCoverageAsync()));

    [HttpGet("bom-validation")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<BomValidationReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBomValidationAsync()
        => Ok(ApiResponse<BomValidationReportDto>.SuccessResult(await service.GetBomValidationAsync()));

    [HttpGet("import-history")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MenuImportHistoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMenuImportHistoryAsync()
        => Ok(ApiResponse<MenuImportHistoryDto>.SuccessResult(await service.GetMenuImportHistoryAsync()));

    [HttpGet("sample-import-status")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<SampleImportStatusDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSampleImportStatusAsync()
        => Ok(ApiResponse<SampleImportStatusDto>.SuccessResult(await service.GetSampleImportStatusAsync()));
}
