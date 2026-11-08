namespace IPCManagement.Api.Models.Entities;

public sealed class DataQualityDisposition
{
    public byte[] DispositionId { get; set; } = null!;
    public string IssueType { get; set; } = null!;
    public byte[] SourceEntityId { get; set; } = null!;
    public string SourceFingerprint { get; set; } = null!;
    public string ProposedAction { get; set; } = null!;
    public string EvidenceJson { get; set; } = null!;
    public string Status { get; set; } = "PENDING_MANAGER_REVIEW";
    public string Reason { get; set; } = null!;
    public string? ReviewReason { get; set; }
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public byte[]? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public byte[]? AppliedBy { get; set; }
    public DateTime? AppliedAt { get; set; }
    public string? CorrectionEntityType { get; set; }
    public byte[]? CorrectionEntityId { get; set; }
    public long Version { get; set; }
}
