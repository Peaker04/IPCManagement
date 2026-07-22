using System.Security.Claims;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.SampleData;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.SampleData;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/sample-data")]
[Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
[EnableRateLimiting("api-general")]
public class SampleDataController : ControllerBase
{
    private readonly ISampleDataImportService _sampleDataImportService;
    private readonly IPurchaseHistoryReconciliationService _purchaseHistoryReconciliationService;
    private readonly IHostEnvironment _environment;

    public SampleDataController(
        ISampleDataImportService sampleDataImportService,
        IPurchaseHistoryReconciliationService purchaseHistoryReconciliationService,
        IHostEnvironment environment)
    {
        _sampleDataImportService = sampleDataImportService;
        _purchaseHistoryReconciliationService = purchaseHistoryReconciliationService;
        _environment = environment;
    }

    /// <summary>Dry-run hoặc import dữ liệu mẫu IPC từ thư mục .docs. Chỉ bật trong Development.</summary>
    [HttpPost("import")]
    [ProducesResponseType(typeof(ApiResponse<SampleDataImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Import(
        [FromBody] SampleDataImportRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!_environment.IsDevelopment())
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                ApiResponse.FailResult("Import dữ liệu mẫu chỉ được bật trong môi trường Development."));
        }

        var result = await _sampleDataImportService.ImportAsync(request, cancellationToken);
        var message = result.DryRun
            ? "Dry-run dữ liệu mẫu hoàn tất."
            : "Import dữ liệu mẫu hoàn tất.";

        return Ok(ApiResponse<SampleDataImportResultDto>.SuccessResult(result, message));
    }

    /// <summary>Xem trước đối soát lịch sử mua hàng từ nguồn server. Chỉ bật trong Development.</summary>
    [HttpPost("purchase-history/preview")]
    [ProducesResponseType(typeof(ApiResponse<PurchaseHistoryPreviewDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> PreviewPurchaseHistory(
        [FromBody] PurchaseHistoryPreviewRequestDto request,
        CancellationToken cancellationToken)
    {
        _ = request;
        if (!_environment.IsDevelopment())
        {
            return StatusCode(
                StatusCodes.Status403Forbidden,
                ApiResponse.FailResult("Đối soát lịch sử mua hàng chỉ được bật trong môi trường Development."));
        }

        var result = await _purchaseHistoryReconciliationService.PreviewAsync(cancellationToken);
        result.PreviewedBy = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.Identity?.Name
            ?? "authenticated-user";

        return Ok(ApiResponse<PurchaseHistoryPreviewDto>.SuccessResult(
            result,
            "Xem trước đối soát lịch sử mua hàng hoàn tất."));
    }
}
