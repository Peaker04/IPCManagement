using IPCManagement.Api.Features.Purchasing.Contracts;
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
public class PurchasingReportsController : ControllerBase
{
    private readonly IPurchasingReportService _reportService;

    public PurchasingReportsController(IPurchasingReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("purchase-demand")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PurchaseDemandReportDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPurchaseDemandAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PurchaseDemandReportDto>>.SuccessResult(
            await _reportService.GetPurchaseDemandAsync(query)));

    [HttpGet("purchase-plan")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PurchasePlanReportDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPurchasePlanAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PurchasePlanReportDto>>.SuccessResult(
            await _reportService.GetPurchasePlanAsync(query)));

    [HttpGet("purchase-plan/page")]
    [ProducesResponseType(typeof(ApiResponse<PurchasePlanPageDto>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPurchasePlanPageAsync([FromQuery] PurchasePlanPageQueryDto query)
        => Ok(ApiResponse<PurchasePlanPageDto>.SuccessResult(
            await _reportService.GetPurchasePlanPageAsync(query)));

    [HttpGet("order-export")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<OrderExportReportRowDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrderExportAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<OrderExportReportRowDto>>.SuccessResult(
            await _reportService.GetOrderExportAsync(query)));
}
