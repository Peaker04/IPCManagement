namespace IPCManagement.Api.Models.DTOs.Workflow;

/// <summary>
/// Page-number contract for current-stock screens that need server-side lazy loading.
/// Report filters remain compatible with WorkflowReportQueryDto.
/// </summary>
public sealed class CurrentStockPageQueryDto : WorkflowReportQueryDto
{
    private int _pageNumber = 1;
    private int _pageSize = 20;

    public int PageNumber
    {
        get => _pageNumber;
        set => _pageNumber = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value < 1 ? 1 : Math.Min(value, 100);
    }
}
