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
public class PriceVarianceReportsController : ControllerBase
{
    private readonly IPriceVarianceReportService _reportService;

    public PriceVarianceReportsController(IPriceVarianceReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("receipt-price-variance")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ReceiptPriceVarianceReportDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseOrderReadAccess)]
    public async Task<IActionResult> GetReceiptPriceVarianceAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<ReceiptPriceVarianceReportDto>>.SuccessResult(
            await _reportService.GetReceiptPriceVarianceAsync(query)));

    [HttpGet("receipt-price-variance/page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<ReceiptPriceVarianceReportDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseOrderReadAccess)]
    public async Task<IActionResult> GetReceiptPriceVariancePageAsync([FromQuery] ReceiptPriceVariancePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<ReceiptPriceVarianceReportDto>>.SuccessResult(
            await _reportService.GetReceiptPriceVariancePageAsync(query)));

    [HttpGet("price-variance/by-supplier")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PriceVarianceBySupplierDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceBySupplierAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceBySupplierDto>>.SuccessResult(
            await _reportService.GetPriceVarianceBySupplierAsync(query)));

    [HttpGet("price-variance/by-supplier/page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<PriceVarianceBySupplierDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceBySupplierPageAsync([FromQuery] PriceVarianceAggregatePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<PriceVarianceBySupplierDto>>.SuccessResult(
            await _reportService.GetPriceVarianceBySupplierPageAsync(query)));

    [HttpGet("price-variance/by-period")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PriceVarianceByPeriodDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceByPeriodAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceByPeriodDto>>.SuccessResult(
            await _reportService.GetPriceVarianceByPeriodAsync(query)));

    [HttpGet("price-variance/by-period/page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<PriceVarianceByPeriodDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceByPeriodPageAsync([FromQuery] PriceVarianceAggregatePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<PriceVarianceByPeriodDto>>.SuccessResult(
            await _reportService.GetPriceVarianceByPeriodPageAsync(query)));

    [HttpGet("price-variance/by-dish-group")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PriceVarianceByDishGroupDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceByDishGroupAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceByDishGroupDto>>.SuccessResult(
            await _reportService.GetPriceVarianceByDishGroupAsync(query)));

    [HttpGet("price-variance/by-dish-group/page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<PriceVarianceByDishGroupDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceByDishGroupPageAsync([FromQuery] PriceVarianceAggregatePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<PriceVarianceByDishGroupDto>>.SuccessResult(
            await _reportService.GetPriceVarianceByDishGroupPageAsync(query)));
}
