using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IWorkflowReportAggregateCache
{
    Task<OperationalKpiSummaryDto> GetOperationalKpisAsync(
        Func<Task<OperationalKpiSummaryDto>> factory);

    Task<DataQualityReportDto> GetDataQualitySnapshotAsync(
        WorkflowReportQueryDto query,
        Func<WorkflowReportQueryDto, Task<DataQualityReportDto>> factory);

    Task<T> GetOrCreateReportAsync<T>(
        string reportType,
        object query,
        Func<Task<T>> factory)
        where T : class;

    void Invalidate();
}
