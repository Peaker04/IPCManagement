namespace IPCManagement.Api.Models.Entities;

public sealed class Supplementalmaterialrequest
{
    public byte[] RequestId { get; set; } = null!;
    public string RequestCode { get; set; } = null!;
    public byte[] IssueId { get; set; } = null!;
    public byte[] IssueLineId { get; set; } = null!;
    public byte[] WarehouseId { get; set; } = null!;
    public byte[] IngredientId { get; set; } = null!;
    public byte[] UnitId { get; set; } = null!;
    public decimal RequestedQty { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = "PENDING";
    public byte[] RequestedBy { get; set; } = null!;
    public DateTime RequestedAt { get; set; }
}
