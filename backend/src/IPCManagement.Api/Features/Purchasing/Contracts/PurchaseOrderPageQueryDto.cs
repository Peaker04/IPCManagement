namespace IPCManagement.Api.Features.Purchasing.Contracts;

public sealed class PurchaseOrderPageQueryDto
{
    public string? Status { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 6;
}
