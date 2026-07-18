using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
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

    [HttpGet("current-stock/page")]
    public async Task<IActionResult> GetCurrentStockPage([FromQuery] CurrentStockPageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<CurrentStockSummaryDto>>.SuccessResult(
            await _workflowReportService.GetCurrentStockPageAsync(query)));

    [HttpGet("stock-movements")]
    public async Task<IActionResult> GetStockMovements([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockMovementViewDto>>.SuccessResult(
            await _workflowReportService.GetStockMovementsAsync(query)));

    [HttpGet("stock-movements/page")]
    public async Task<IActionResult> GetStockMovementPage([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<CursorPageDto<StockMovementViewDto>>.SuccessResult(
            await _workflowReportService.GetStockMovementPageAsync(query)));

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

    [HttpGet("ingredient-demand/page")]
    public async Task<IActionResult> GetIngredientDemandPage([FromQuery] IngredientDemandPageQueryDto query)
        => Ok(ApiResponse<IngredientDemandPageDto>.SuccessResult(
            await _workflowReportService.GetIngredientDemandPageAsync(query)));

    [HttpGet("purchase-demand")]
    public async Task<IActionResult> GetPurchaseDemand([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PurchaseDemandReportDto>>.SuccessResult(
            await _workflowReportService.GetPurchaseDemandAsync(query)));

    [HttpGet("purchase-plan")]
    public async Task<IActionResult> GetPurchasePlan([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PurchasePlanReportDto>>.SuccessResult(
            await _workflowReportService.GetPurchasePlanAsync(query)));

    [HttpGet("purchase-plan/page")]
    public async Task<IActionResult> GetPurchasePlanPage([FromQuery] PurchasePlanPageQueryDto query)
        => Ok(ApiResponse<PurchasePlanPageDto>.SuccessResult(
            await _workflowReportService.GetPurchasePlanPageAsync(query)));

    [HttpGet("receipt-price-variance")]
    public async Task<IActionResult> GetReceiptPriceVariance([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<ReceiptPriceVarianceReportDto>>.SuccessResult(
            await _workflowReportService.GetReceiptPriceVarianceAsync(query)));

    [HttpGet("receipt-price-variance/page")]
    public async Task<IActionResult> GetReceiptPriceVariancePage([FromQuery] ReceiptPriceVariancePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<ReceiptPriceVarianceReportDto>>.SuccessResult(
            await _workflowReportService.GetReceiptPriceVariancePageAsync(query)));

    [HttpGet("price-variance/by-supplier")]
    public async Task<IActionResult> GetPriceVarianceBySupplier([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceBySupplierDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceBySupplierAsync(query)));

    [HttpGet("price-variance/by-supplier/page")]
    public async Task<IActionResult> GetPriceVarianceBySupplierPage([FromQuery] PriceVarianceAggregatePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<PriceVarianceBySupplierDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceBySupplierPageAsync(query)));

    [HttpGet("price-variance/by-period")]
    public async Task<IActionResult> GetPriceVarianceByPeriod([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceByPeriodDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByPeriodAsync(query)));

    [HttpGet("price-variance/by-period/page")]
    public async Task<IActionResult> GetPriceVarianceByPeriodPage([FromQuery] PriceVarianceAggregatePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<PriceVarianceByPeriodDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByPeriodPageAsync(query)));

    [HttpGet("price-variance/by-dish-group")]
    public async Task<IActionResult> GetPriceVarianceByDishGroup([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceByDishGroupDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByDishGroupAsync(query)));

    [HttpGet("price-variance/by-dish-group/page")]
    public async Task<IActionResult> GetPriceVarianceByDishGroupPage([FromQuery] PriceVarianceAggregatePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<PriceVarianceByDishGroupDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByDishGroupPageAsync(query)));

    [HttpGet("kitchen-issues")]
    public async Task<IActionResult> GetKitchenIssues([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<KitchenIssueReportDto>>.SuccessResult(
            await _workflowReportService.GetKitchenIssuesAsync(query)));

    [HttpGet("kitchen-issues/page")]
    public async Task<IActionResult> GetKitchenIssuesPage([FromQuery] KitchenIssuePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<KitchenIssueReportDto>>.SuccessResult(
            await _workflowReportService.GetKitchenIssuesPageAsync(query)));

    [HttpGet("operational-kpis")]
    public async Task<IActionResult> GetOperationalKpis()
        => Ok(ApiResponse<OperationalKpiSummaryDto>.SuccessResult(
            await _workflowReportService.GetOperationalKpisAsync()));

    [HttpGet("issue-vs-return")]
    public async Task<IActionResult> GetIssueVsReturn([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<IssueVsReturnUsageReportDto>>.SuccessResult(
            await _workflowReportService.GetIssueVsReturnAsync(query)));

    [HttpGet("issue-vs-return/page")]
    public async Task<IActionResult> GetIssueVsReturnPage([FromQuery] IssueVsReturnPageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<IssueVsReturnUsageReportDto>>.SuccessResult(
            await _workflowReportService.GetIssueVsReturnPageAsync(query)));

    [HttpGet("audit-changes")]
    public async Task<IActionResult> GetAuditChanges([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<AuditChangeReportDto>>.SuccessResult(
            await _workflowReportService.GetAuditChangesAsync(query)));

    [HttpGet("audit-changes/page")]
    public async Task<IActionResult> GetAuditChangePage([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<CursorPageDto<AuditChangeReportDto>>.SuccessResult(
            await _workflowReportService.GetAuditChangePageAsync(query)));

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

    [HttpGet("data-quality/page")]
    public async Task<IActionResult> GetDataQualityPage([FromQuery] DataQualityPageQueryDto query)
        => Ok(ApiResponse<DataQualityPageDto>.SuccessResult(
            await _workflowReportService.GetDataQualityPageAsync(query)));

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

    [HttpPost("data-quality/cleanup")]
    public async Task<IActionResult> CleanupDataQuality([FromBody] DataQualityCleanupRequestDto request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));
            }

            var result = await _workflowReportService.CleanupDataQualityAsync(request, userId);
            var message = result.DryRun
                ? "Đã quét dữ liệu có thể dọn, chưa thay đổi dữ liệu."
                : "Đã dọn dữ liệu mồ côi/stale theo chính sách data-quality.";

            return Ok(ApiResponse<DataQualityCleanupResultDto>.SuccessResult(result, message));
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
