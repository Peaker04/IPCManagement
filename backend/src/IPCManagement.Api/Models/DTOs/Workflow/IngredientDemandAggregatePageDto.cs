namespace IPCManagement.Api.Models.DTOs.Workflow;

public sealed class IngredientDemandAggregatePageQueryDto : WorkflowReportPageQueryDto
{
}

public sealed class IngredientDemandAggregateDto
{
    public DateOnly RequestDate { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal TotalRequiredQty { get; set; }
    public decimal CurrentStockQty { get; set; }
    public decimal SuggestedPurchaseQty { get; set; }
    public int LineCount { get; set; }
    public bool HasCancelledLine { get; set; }
}

public sealed class IngredientDemandAggregatePageDto
{
    public IReadOnlyList<IngredientDemandAggregateDto> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasPrev => PageNumber > 1;
    public bool HasNext => PageNumber < TotalPages;
    public int ShortageCount { get; set; }
}
