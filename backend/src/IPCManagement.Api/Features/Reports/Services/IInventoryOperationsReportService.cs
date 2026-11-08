using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IInventoryOperationsReportService
{
    Task<IReadOnlyList<WorkflowDocumentDto>> GetWorkflowDocumentsAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<KitchenIssueReportDto>> GetKitchenIssuesAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<KitchenIssueReportDto>> GetKitchenIssuesPageAsync(KitchenIssuePageQueryDto query);
    Task<IReadOnlyList<IssueVsReturnUsageReportDto>> GetIssueVsReturnAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<IssueVsReturnUsageReportDto>> GetIssueVsReturnPageAsync(IssueVsReturnPageQueryDto query);
    Task<IReadOnlyList<SupplyLineReconciliationDto>> GetSupplyLineReconciliationAsync(WorkflowReportQueryDto query);
}
