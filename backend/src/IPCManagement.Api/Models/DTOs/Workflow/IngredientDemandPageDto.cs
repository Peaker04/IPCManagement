namespace IPCManagement.Api.Models.DTOs.Workflow;

public sealed class IngredientDemandPageQueryDto : WorkflowReportPageQueryDto
{
}

public sealed class IngredientDemandPageDto
{
    public IReadOnlyList<IngredientDemandReportDto> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasPrev => PageNumber > 1;
    public bool HasNext => PageNumber < TotalPages;
    public int ShortageCount { get; set; }
}
