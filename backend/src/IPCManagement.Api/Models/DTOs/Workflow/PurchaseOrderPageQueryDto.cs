namespace IPCManagement.Api.Models.DTOs.Workflow;

public sealed class PurchaseOrderPageQueryDto
{
    public string? Status { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 6;
}
