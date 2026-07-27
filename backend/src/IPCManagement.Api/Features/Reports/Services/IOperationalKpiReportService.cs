using IPCManagement.Api.Features.Reports.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IOperationalKpiReportService
{
    Task<OperationalKpiSummaryDto> GetOperationalKpisAsync(int? criticalDataQualityCount = null);
}
