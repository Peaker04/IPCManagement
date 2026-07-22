namespace IPCManagement.Api.Models.DTOs.Approvals;

public enum ApprovalTargetType
{
    MaterialDemand,
    PurchaseRequest,
    InventoryReceipt,
    InventoryIssue,
    InventoryAdjustment
}

public enum ApprovalDecision
{
    Approve,
    Reject
}

public class ApprovalRequestDto
{
    public ApprovalDecision Status { get; set; }
    public string? Reason { get; set; }
}

public class ApprovalResultDto
{
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? OldStatus { get; set; }
    public string? NewStatus { get; set; }
    public string HistoryId { get; set; } = string.Empty;
    public DateTime ActionAt { get; set; }
}

public class ApprovalInboxQueryDto
{
    public int Limit { get; set; } = 20;
    public string? Cursor { get; set; }
}

public class ApprovalInboxPageDto
{
    public IReadOnlyList<ApprovalInboxItemDto> Items { get; set; } = [];
    public int Limit { get; set; }
    public bool HasNext { get; set; }
    public string? NextCursor { get; set; }
}

public class ApprovalInboxItemDto
{
    public string InboxItemId { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string TargetCode { get; set; } = string.Empty;
    public string ItemType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string OwnerRole { get; set; } = string.Empty;
    public string SubmittedBy { get; set; } = string.Empty;
    public DateOnly? DueDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string NextAction { get; set; } = string.Empty;
    public string Tone { get; set; } = "warning";
    public string Route { get; set; } = string.Empty;
    public DateOnly? WeekStartDate { get; set; }
    public DateOnly? ServiceDate { get; set; }
    public string? Scope { get; set; }
    public int? LineCount { get; set; }
    public decimal? TotalQuantity { get; set; }
    public decimal? TotalValue { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? SlaDeadline { get; set; }
    public int? SlaHours { get; set; }
    public IReadOnlyList<ApprovalInboxMaterialDto> Materials { get; set; } = [];
}

public class ApprovalInboxMaterialDto
{
    public string Name { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = string.Empty;
}
