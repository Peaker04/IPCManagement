using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IStockMovementReportService
{
    Task<IReadOnlyList<CurrentStockSummaryDto>> GetCurrentStockAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<CurrentStockSummaryDto>> GetCurrentStockPageAsync(CurrentStockPageQueryDto query);
    Task<IReadOnlyList<StockMovementViewDto>> GetStockMovementsAsync(WorkflowReportQueryDto query);
    Task<CursorPageDto<StockMovementViewDto>> GetStockMovementPageAsync(StockMovementPageQueryDto query);
}
