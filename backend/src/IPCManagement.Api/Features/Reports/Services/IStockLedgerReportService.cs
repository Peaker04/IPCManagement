using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IStockLedgerReportService
{
    Task<IReadOnlyList<StockLedgerReconciliationDto>> GetStockLedgerReconciliationAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<StockLedgerSourceRow>> LoadSourceRowsAsync(WorkflowReportQueryDto query);
}
