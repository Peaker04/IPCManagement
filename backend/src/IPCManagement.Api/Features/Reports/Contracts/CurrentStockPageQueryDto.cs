namespace IPCManagement.Api.Features.Reports.Contracts;

/// <summary>
/// Page-number contract for current-stock screens that need server-side lazy loading.
/// Report filters remain compatible with WorkflowReportQueryDto.
/// </summary>
public sealed class CurrentStockPageQueryDto : WorkflowReportPageQueryDto
{
}
