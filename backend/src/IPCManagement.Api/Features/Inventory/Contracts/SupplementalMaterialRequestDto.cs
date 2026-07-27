
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Contracts;

public sealed class CreateSupplementalMaterialRequest
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
    public decimal FulfilledQty { get; set; }
    public decimal RemainingQty { get; set; }
    public decimal AvailableQty { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime RequestedAt { get; set; }
    public string? PurchaseRequestId { get; set; }
    public string? PurchaseRequestCode { get; set; }
    public string? PurchaseRequestStatus { get; set; }
    public bool CanFulfill { get; set; }
    public bool CanRouteToPurchasing { get; set; }
    public bool CanReject { get; set; }
    public string? ActionDisabledReason { get; set; }
}

public sealed class SupplementalMaterialRequestFilterDto : PagedRequestDto
{
    public string? WarehouseId { get; set; }
    public string? Status { get; set; }
}

public sealed class FulfillSupplementalMaterialRequest
{
    public decimal Quantity { get; set; }
}

public sealed class RejectSupplementalMaterialRequest
{
    public string Reason { get; set; } = string.Empty;
}
