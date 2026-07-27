using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
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
public class StockMovementReportsController : ControllerBase
{
    private readonly IStockMovementReportService _reportService;

    public StockMovementReportsController(IStockMovementReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("current-stock")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CurrentStockSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentStockAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<CurrentStockSummaryDto>>.SuccessResult(
            await _reportService.GetCurrentStockAsync(query)));

    [HttpGet("current-stock/page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<CurrentStockSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentStockPageAsync([FromQuery] CurrentStockPageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<CurrentStockSummaryDto>>.SuccessResult(
            await _reportService.GetCurrentStockPageAsync(query)));

    [HttpGet("stock-movements")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<StockMovementViewDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStockMovementsAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockMovementViewDto>>.SuccessResult(
            await _reportService.GetStockMovementsAsync(query)));

    [HttpGet("stock-movements/page")]
    [ProducesResponseType(typeof(ApiResponse<CursorPageDto<StockMovementViewDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStockMovementPageAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<CursorPageDto<StockMovementViewDto>>.SuccessResult(
            await _reportService.GetStockMovementPageAsync(query)));
}
