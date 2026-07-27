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
public class StockLedgerReportsController : ControllerBase
{
    private readonly IStockLedgerReportService _reportService;

    public StockLedgerReportsController(IStockLedgerReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("stock-ledger-reconciliation")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<StockLedgerReconciliationDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStockLedgerReconciliationAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockLedgerReconciliationDto>>.SuccessResult(
            await _reportService.GetStockLedgerReconciliationAsync(query)));
}
