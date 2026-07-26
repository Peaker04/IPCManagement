namespace IPCManagement.Api.Models.DTOs.Workflow;

public sealed class MaterialRequestCandidatePageQueryDto : WorkflowReportPageQueryDto
{
    public string Purpose { get; set; } = "purchase";
}

public sealed class MaterialRequestCandidateDto
{
    public string MaterialRequestId { get; set; } = string.Empty;
    public string MaterialRequestCode { get; set; } = string.Empty;
    public DateOnly RequestDate { get; set; }
    public string RequestScope { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int ActionableLineCount { get; set; }
    public decimal ActionableQuantity { get; set; }
    public bool HasExistingPurchaseRequest { get; set; }
}

public sealed class MaterialRequestCandidatePageDto
{
    public IReadOnlyList<MaterialRequestCandidateDto> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasPrev => PageNumber > 1;
    public bool HasNext => PageNumber < TotalPages;
}
