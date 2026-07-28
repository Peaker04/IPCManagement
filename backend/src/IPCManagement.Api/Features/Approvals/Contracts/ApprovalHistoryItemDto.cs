namespace IPCManagement.Api.Features.Approvals.Contracts;

public class ApprovalHistoryItemDto
{
    public string HistoryId { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public string TargetId { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public string? OldStatus { get; set; }
    public string? NewStatus { get; set; }
    public string? Reason { get; set; }
    public string ActionBy { get; set; } = string.Empty;
    public string ActionByName { get; set; } = string.Empty;
    public DateTime ActionAt { get; set; }
}
