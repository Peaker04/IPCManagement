using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Security;
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
    private readonly ICurrentUserService _currentUserService;

    public WorkflowReportsController(
        IWorkflowReportService workflowReportService,
        ICurrentUserService currentUserService)
    {
        _workflowReportService = workflowReportService;
        _currentUserService = currentUserService;
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

    [HttpGet("stock-snapshots")]
    public async Task<IActionResult> GetStockSnapshots([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockSnapshotDto>>.SuccessResult(
            await _workflowReportService.GetStockSnapshotsAsync(query)));

    [HttpPost("stock-snapshots/generate")]
    public async Task<IActionResult> GenerateStockSnapshots([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockSnapshotDto>>.SuccessResult(
            await _workflowReportService.GenerateMonthlyStockSnapshotAsync(query)));

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

    [HttpGet("audit-changes/csv")]
    public async Task<IActionResult> ExportAuditChangesCsv([FromQuery] WorkflowReportQueryDto query)
    {
        query.Limit = 1000;
        var data = await _workflowReportService.GetAuditChangesAsync(query);
        
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Mã log,Thời gian,Người thực hiện,Mảng nghiệp vụ,Tên bảng,ID thực thể,Tên cột,Giá trị cũ,Giá trị mới,Lý do");
        
        foreach (var row in data)
        {
            sb.AppendLine($"\"{row.AuditId}\",\"{row.ChangedAt:yyyy-MM-dd HH:mm:ss}\",\"{row.ChangedByName}\",\"{row.BusinessArea}\",\"{row.EntityName}\",\"{row.EntityId}\",\"{row.FieldName}\",\"{row.OldValue?.Replace("\"", "\"\"")}\",\"{row.NewValue?.Replace("\"", "\"\"")}\",\"{row.Reason?.Replace("\"", "\"\"")}\"");
        }
        
        var bytes = System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv", $"audit-log-{DateTime.Now:yyyyMMddHHmmss}.csv");
    }

    [HttpGet("data-quality")]
    public async Task<IActionResult> GetDataQuality([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<DataQualityReportDto>.SuccessResult(
            await _workflowReportService.GetDataQualityAsync(query)));

    [HttpPost("data-quality/issues/remediation")]
    public async Task<IActionResult> UpdateDataQualityIssueRemediation([FromBody] DataQualityIssueRemediationRequestDto request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));
            }

            var result = await _workflowReportService.UpdateDataQualityIssueRemediationAsync(request, userId);
            return Ok(ApiResponse<DataQualityIssueRemediationDto>.SuccessResult(result, "Đã cập nhật trạng thái xử lý data-quality issue."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpGet("order-export")]
    public async Task<IActionResult> GetOrderExport([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<OrderExportReportRowDto>>.SuccessResult(
            await _workflowReportService.GetOrderExportAsync(query)));
}
