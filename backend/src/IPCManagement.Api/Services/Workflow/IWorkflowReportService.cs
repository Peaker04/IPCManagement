using IPCManagement.Api.Models.DTOs.Workflow;

namespace IPCManagement.Api.Services.Workflow;

public interface IWorkflowReportService
{
    Task<IReadOnlyList<CurrentStockSummaryDto>> GetCurrentStockAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockMovementViewDto>> GetStockMovementsAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockLedgerReconciliationDto>> GetStockLedgerReconciliationAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockSnapshotDto>> GetStockSnapshotsAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockSnapshotDto>> GenerateMonthlyStockSnapshotAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<WorkflowDocumentDto>> GetWorkflowDocumentsAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<IngredientDemandReportDto>> GetIngredientDemandAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<PurchaseDemandReportDto>> GetPurchaseDemandAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<ReceiptPriceVarianceReportDto>> GetReceiptPriceVarianceAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<PriceVarianceBySupplierDto>> GetPriceVarianceBySupplierAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<PriceVarianceByPeriodDto>> GetPriceVarianceByPeriodAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<PriceVarianceByDishGroupDto>> GetPriceVarianceByDishGroupAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<KitchenIssueReportDto>> GetKitchenIssuesAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<IssueVsReturnUsageReportDto>> GetIssueVsReturnAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<AuditChangeReportDto>> GetAuditChangesAsync(WorkflowReportQueryDto query);
    Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query);
    Task<DataQualityIssueRemediationDto> UpdateDataQualityIssueRemediationAsync(DataQualityIssueRemediationRequestDto request, string actorUserId);
    Task<DataQualityCleanupResultDto> CleanupDataQualityAsync(DataQualityCleanupRequestDto request, string actorUserId);
    Task<IReadOnlyList<OrderExportReportRowDto>> GetOrderExportAsync(WorkflowReportQueryDto query);
    Task<OperationalKpiSummaryDto> GetOperationalKpisAsync();
}
