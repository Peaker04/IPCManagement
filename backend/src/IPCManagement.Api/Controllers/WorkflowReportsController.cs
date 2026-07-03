using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Services.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/workflow-reports")]
[Authorize]
[EnableRateLimiting("api-general")]
public class WorkflowReportsController : ControllerBase
{
    private readonly IWorkflowReportService _workflowReportService;

    public WorkflowReportsController(IWorkflowReportService workflowReportService)
    {
        _workflowReportService = workflowReportService;
    }

    [HttpGet("current-stock")]
    public async Task<IActionResult> GetCurrentStock([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<CurrentStockSummaryDto>>.SuccessResult(
            await _workflowReportService.GetCurrentStockAsync(query)));

    [HttpGet("stock-movements")]
    public async Task<IActionResult> GetStockMovements([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockMovementViewDto>>.SuccessResult(
            await _workflowReportService.GetStockMovementsAsync(query)));

    [HttpGet("stock-ledger-reconciliation")]
    public async Task<IActionResult> GetStockLedgerReconciliation([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockLedgerReconciliationDto>>.SuccessResult(
            await _workflowReportService.GetStockLedgerReconciliationAsync(query)));

    [HttpGet("workflow-documents")]
    public async Task<IActionResult> GetWorkflowDocuments([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<WorkflowDocumentDto>>.SuccessResult(
            await _workflowReportService.GetWorkflowDocumentsAsync(query)));

    [HttpGet("ingredient-demand")]
    public async Task<IActionResult> GetIngredientDemand([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<IngredientDemandReportDto>>.SuccessResult(
            await _workflowReportService.GetIngredientDemandAsync(query)));

    [HttpGet("purchase-demand")]
    public async Task<IActionResult> GetPurchaseDemand([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PurchaseDemandReportDto>>.SuccessResult(
            await _workflowReportService.GetPurchaseDemandAsync(query)));

    [HttpGet("receipt-price-variance")]
    public async Task<IActionResult> GetReceiptPriceVariance([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<ReceiptPriceVarianceReportDto>>.SuccessResult(
            await _workflowReportService.GetReceiptPriceVarianceAsync(query)));

    [HttpGet("price-variance/by-supplier")]
    public async Task<IActionResult> GetPriceVarianceBySupplier([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceBySupplierDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceBySupplierAsync(query)));

    [HttpGet("price-variance/by-period")]
    public async Task<IActionResult> GetPriceVarianceByPeriod([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceByPeriodDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByPeriodAsync(query)));

    [HttpGet("price-variance/by-dish-group")]
    public async Task<IActionResult> GetPriceVarianceByDishGroup([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceByDishGroupDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByDishGroupAsync(query)));

    [HttpGet("kitchen-issues")]
    public async Task<IActionResult> GetKitchenIssues([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<KitchenIssueReportDto>>.SuccessResult(
            await _workflowReportService.GetKitchenIssuesAsync(query)));

    [HttpGet("operational-kpis")]
    public async Task<IActionResult> GetOperationalKpis()
        => Ok(ApiResponse<OperationalKpiSummaryDto>.SuccessResult(
            await _workflowReportService.GetOperationalKpisAsync()));

    [HttpGet("issue-vs-return")]
    public async Task<IActionResult> GetIssueVsReturn([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<IssueVsReturnUsageReportDto>>.SuccessResult(
            await _workflowReportService.GetIssueVsReturnAsync(query)));

    [HttpGet("audit-changes")]
    public async Task<IActionResult> GetAuditChanges([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<AuditChangeReportDto>>.SuccessResult(
            await _workflowReportService.GetAuditChangesAsync(query)));

    [HttpGet("data-quality")]
    public async Task<IActionResult> GetDataQuality([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<DataQualityReportDto>.SuccessResult(
            await _workflowReportService.GetDataQualityAsync(query)));

    [HttpGet("order-export")]
    public async Task<IActionResult> GetOrderExport([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<OrderExportReportRowDto>>.SuccessResult(
            await _workflowReportService.GetOrderExportAsync(query)));
}
