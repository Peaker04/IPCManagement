
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IWorkflowReportService
{
    Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query);
    Task<DataQualityPageDto> GetDataQualityPageAsync(DataQualityPageQueryDto query);
    Task<DataQualityIssueRemediationDto> UpdateDataQualityIssueRemediationAsync(DataQualityIssueRemediationRequest request, string actorUserId);
    Task<DataQualityCleanupResultDto> CleanupDataQualityAsync(DataQualityCleanupRequest request, string actorUserId);
    Task<OperationalKpiSummaryDto> GetOperationalKpisAsync(int? criticalDataQualityCount = null);
}
