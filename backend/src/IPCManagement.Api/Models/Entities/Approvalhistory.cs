using System;

namespace IPCManagement.Api.Models.Entities;

public partial class Approvalhistory
{
    public byte[] ApprovalHistoryId { get; set; } = null!;

    public string TargetType { get; set; } = null!;

    public byte[] TargetId { get; set; } = null!;

    public string Decision { get; set; } = null!;

    public string? OldStatus { get; set; }

    public string? NewStatus { get; set; }

    public string? Reason { get; set; }

    public byte[] ActionBy { get; set; } = null!;

    public DateTime ActionAt { get; set; }

    public virtual User ActionByNavigation { get; set; } = null!;
}