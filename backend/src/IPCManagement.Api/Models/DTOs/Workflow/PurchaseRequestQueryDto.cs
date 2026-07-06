namespace IPCManagement.Api.Models.DTOs.Workflow;

public class PurchaseRequestQueryDto
{
    public string? Status { get; set; }
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
