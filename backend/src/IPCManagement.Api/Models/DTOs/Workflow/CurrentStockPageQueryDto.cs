namespace IPCManagement.Api.Models.DTOs.Workflow;

/// <summary>
/// Page-number contract for current-stock screens that need server-side lazy loading.
/// Report filters remain compatible with WorkflowReportQueryDto.
/// </summary>
public sealed class CurrentStockPageQueryDto : WorkflowReportPageQueryDto
{
}
