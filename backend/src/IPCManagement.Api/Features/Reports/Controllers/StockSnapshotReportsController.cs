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
[Route("api/workflow-reports")]
[Tags("WorkflowReports")]
[Authorize]
[EnableRateLimiting("api-general")]
public class StockSnapshotReportsController : ControllerBase
{
    private readonly IStockSnapshotReportService _reportService;

    public StockSnapshotReportsController(IStockSnapshotReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("stock-snapshots")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<StockSnapshotDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStockSnapshotsAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockSnapshotDto>>.SuccessResult(
            await _reportService.GetStockSnapshotsAsync(query)));

    [HttpPost("stock-snapshots/generate")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<StockSnapshotDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> GenerateStockSnapshotsAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockSnapshotDto>>.SuccessResult(
            await _reportService.GenerateMonthlyStockSnapshotAsync(query)));
}
