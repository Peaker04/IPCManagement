using IPCManagement.Api.Models.DTOs.Workflow;

namespace IPCManagement.Api.Services.Workflow;

public interface IWorkflowReportService
{
    Task<IReadOnlyList<CurrentStockSummaryDto>> GetCurrentStockAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockMovementViewDto>> GetStockMovementsAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<WorkflowDocumentDto>> GetWorkflowDocumentsAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<IngredientDemandReportDto>> GetIngredientDemandAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<PurchaseDemandReportDto>> GetPurchaseDemandAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<ReceiptPriceVarianceReportDto>> GetReceiptPriceVarianceAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<KitchenIssueReportDto>> GetKitchenIssuesAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<IssueVsReturnUsageReportDto>> GetIssueVsReturnAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<AuditChangeReportDto>> GetAuditChangesAsync(WorkflowReportQueryDto query);
    Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<OrderExportReportRowDto>> GetOrderExportAsync(WorkflowReportQueryDto query);
}
