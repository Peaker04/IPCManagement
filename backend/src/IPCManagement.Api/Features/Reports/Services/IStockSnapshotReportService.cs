using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IStockSnapshotReportService
{
    Task<IReadOnlyList<StockSnapshotDto>> GetStockSnapshotsAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockSnapshotDto>> GenerateMonthlyStockSnapshotAsync(WorkflowReportQueryDto query);
}
