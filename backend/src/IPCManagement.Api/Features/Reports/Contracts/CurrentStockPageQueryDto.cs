using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Contracts;

/// <summary>
/// Page-number contract for current-stock screens that need server-side lazy loading.
/// Report filters remain compatible with WorkflowReportQueryDto.
/// </summary>
public sealed class CurrentStockPageQueryDto : WorkflowReportPageQueryDto
{
    public string? SearchKeyword { get; set; }
}

/// <summary>
/// Cursor-page contract for stock movements with server-side text search.
/// </summary>
public sealed class StockMovementPageQueryDto : WorkflowReportQueryDto
{
    public string? SearchKeyword { get; set; }
}
