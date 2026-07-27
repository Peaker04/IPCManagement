
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IWorkflowReportService
{
    Task<IReadOnlyList<CurrentStockSummaryDto>> GetCurrentStockAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<CurrentStockSummaryDto>> GetCurrentStockPageAsync(CurrentStockPageQueryDto query);
    Task<IReadOnlyList<StockMovementViewDto>> GetStockMovementsAsync(WorkflowReportQueryDto query);
    Task<CursorPageDto<StockMovementViewDto>> GetStockMovementPageAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockLedgerReconciliationDto>> GetStockLedgerReconciliationAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockSnapshotDto>> GetStockSnapshotsAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockSnapshotDto>> GenerateMonthlyStockSnapshotAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<WorkflowDocumentDto>> GetWorkflowDocumentsAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<IngredientDemandReportDto>> GetIngredientDemandAsync(WorkflowReportQueryDto query);
    Task<IngredientDemandPageDto> GetIngredientDemandPageAsync(IngredientDemandPageQueryDto query);
    Task<IngredientDemandAggregatePageDto> GetIngredientDemandAggregatePageAsync(IngredientDemandAggregatePageQueryDto query);
    Task<MaterialRequestCandidatePageDto> GetMaterialRequestCandidatePageAsync(MaterialRequestCandidatePageQueryDto query);
    Task<IReadOnlyList<PurchaseDemandReportDto>> GetPurchaseDemandAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<PurchasePlanReportDto>> GetPurchasePlanAsync(WorkflowReportQueryDto query);
    Task<PurchasePlanPageDto> GetPurchasePlanPageAsync(PurchasePlanPageQueryDto query);
    Task<IReadOnlyList<KitchenIssueReportDto>> GetKitchenIssuesAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<KitchenIssueReportDto>> GetKitchenIssuesPageAsync(KitchenIssuePageQueryDto query);
    Task<IReadOnlyList<IssueVsReturnUsageReportDto>> GetIssueVsReturnAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<IssueVsReturnUsageReportDto>> GetIssueVsReturnPageAsync(IssueVsReturnPageQueryDto query);
    Task<IReadOnlyList<AuditChangeReportDto>> GetAuditChangesAsync(WorkflowReportQueryDto query);
    Task<CursorPageDto<AuditChangeReportDto>> GetAuditChangePageAsync(WorkflowReportQueryDto query);
    Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query);
    Task<DataQualityPageDto> GetDataQualityPageAsync(DataQualityPageQueryDto query);
    Task<DataQualityIssueRemediationDto> UpdateDataQualityIssueRemediationAsync(DataQualityIssueRemediationRequest request, string actorUserId);
    Task<DataQualityCleanupResultDto> CleanupDataQualityAsync(DataQualityCleanupRequest request, string actorUserId);
    Task<IReadOnlyList<OrderExportReportRowDto>> GetOrderExportAsync(WorkflowReportQueryDto query);
    Task<OperationalKpiSummaryDto> GetOperationalKpisAsync(int? criticalDataQualityCount = null);
}
