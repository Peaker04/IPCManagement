namespace IPCManagement.Api.Models.Entities;

/// <summary>
/// Reviewed provenance repair for a legacy physical-document line. This records
/// the decision lifecycle; it never changes quantities, stock movements or the
/// physical document state.
/// </summary>
public sealed class LegacyLineageDisposition
{
    public byte[] DispositionId { get; set; } = null!;
    public string LegacyLineType { get; set; } = null!;
    public byte[] LegacyLineId { get; set; } = null!;
    public byte[]? TargetMaterialRequestLineId { get; set; }
    public byte[]? TargetIssueLineId { get; set; }
    public string Status { get; set; } = "PENDING_MANAGER_REVIEW";
    public string Reason { get; set; } = null!;
    public string? ReviewReason { get; set; }
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public byte[]? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public byte[]? AppliedBy { get; set; }
    public DateTime? AppliedAt { get; set; }
    public long Version { get; set; }
}
