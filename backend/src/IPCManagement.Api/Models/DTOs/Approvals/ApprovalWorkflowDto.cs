namespace IPCManagement.Api.Models.DTOs.Approvals;

public enum ApprovalTargetType
{
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