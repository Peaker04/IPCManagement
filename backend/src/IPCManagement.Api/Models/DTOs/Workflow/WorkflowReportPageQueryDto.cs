namespace IPCManagement.Api.Models.DTOs.Workflow;

/// <summary>
/// Shared page-number contract for list-style workflow reports.
/// </summary>
public class WorkflowReportPageQueryDto : WorkflowReportQueryDto
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
