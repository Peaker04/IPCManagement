namespace IPCManagement.Api.Features.SampleData.Contracts;

public sealed class CreateMenuAmendmentRequest
{
    public string CustomerId { get; set; } = string.Empty;
    public DateOnly WeekStartDate { get; set; }
    public string Reason { get; set; } = string.Empty;
    public List<CreateMenuAmendmentLineRequest> Lines { get; set; } = [];
}

public sealed class CreateMenuAmendmentLineRequest
{
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = string.Empty;
    public string DishSlot { get; set; } = string.Empty;
    public string NewDishId { get; set; } = string.Empty;
}

public sealed class MenuAmendmentResultDto
{
    public string MenuAmendmentId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool RequiresReconciliation { get; set; }
    public int AffectedDemandCount { get; set; }
    public int AffectedPurchaseRequestCount { get; set; }
    public bool HasPurchaseOrder { get; set; }
    public bool HasReceipt { get; set; }
    public bool HasIssue { get; set; }
    public string? AppliedMenuVersionId { get; set; }
}

public sealed class ReviewMenuAmendmentRequest
{
    public bool Approved { get; set; }
    public string? Reason { get; set; }
}

public sealed class MenuAmendmentInboxItemDto
{
    public string MenuAmendmentId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public DateOnly WeekStartDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool RequiresReconciliation { get; set; }
    public bool HasPurchaseOrder { get; set; }
    public bool HasReceipt { get; set; }
    public bool HasIssue { get; set; }
    public int AffectedDemandCount { get; set; }
    public int AffectedPurchaseRequestCount { get; set; }
}
