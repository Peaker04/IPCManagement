namespace IPCManagement.Api.Models.DTOs.Inventory;

public sealed class CreateSupplementalMaterialRequestDto
{
    public string IssueId { get; set; } = string.Empty;
    public string IssueLineId { get; set; } = string.Empty;
    public decimal RequestedQty { get; set; }
    public string? Reason { get; set; }
}

public sealed class SupplementalMaterialRequestDto
{
    public string RequestId { get; set; } = string.Empty;
    public string RequestCode { get; set; } = string.Empty;
    public string IssueId { get; set; } = string.Empty;
    public string IssueCode { get; set; } = string.Empty;
    public string IssueLineId { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public decimal RequestedQty { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime RequestedAt { get; set; }
}
