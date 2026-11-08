using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Features.SampleData.Services;
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
public sealed class DishBomImportsController(
    IDishBomTemplateService templateService,
    IDishBomImportService importService,
    ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet("bom-template")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> DownloadBomTemplateAsync(
        [FromQuery] BomTemplateQueryDto query,
        CancellationToken cancellationToken)
    {
        var bytes = await templateService.BuildAsync(query, cancellationToken);
        var scope = string.IsNullOrWhiteSpace(query.CustomerId) ? "global" : query.CustomerId;
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"bom-template-{query.TemplateType}-{query.PriceTier:0}-{scope}.xlsx");
    }

    [HttpPost("bom-import/preview")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(XlsxSecurityLimits.MaxUploadBytes)]
    [ProducesResponseType(typeof(ApiResponse<BomImportPreviewDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> PreviewBomImportAsync(
        [FromForm] BomImportPreviewRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request.File.Length == 0)
        {
            return BadRequest(ApiResponse.FailResult("File import BOM trống."));
        }

        try
        {
            await using var stream = request.File.OpenReadStream();
            return Ok(ApiResponse<BomImportPreviewDto>.SuccessResult(
                await importService.PreviewAsync(stream, request, cancellationToken)));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("bom-import/commit")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(XlsxSecurityLimits.MaxUploadBytes)]
    [ProducesResponseType(typeof(ApiResponse<BomImportCommitResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> CommitBomImportAsync(
        [FromForm] BomImportCommitRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request.File.Length == 0)
        {
            return BadRequest(ApiResponse.FailResult("File import BOM trống."));
        }

        try
        {
            await using var stream = request.File.OpenReadStream();
            var userId = currentUserService.GetUserId(User);
            var result = await importService.CommitAsync(stream, request, userId, cancellationToken);
            return Ok(ApiResponse<BomImportCommitResultDto>.SuccessResult(result, "Đã import BOM theo đơn giá."));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
