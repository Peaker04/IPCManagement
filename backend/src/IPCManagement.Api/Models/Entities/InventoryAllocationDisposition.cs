namespace IPCManagement.Api.Models.Entities;

/// <summary>
/// Immutable cross-scope allocation overlay. It never rewrites issue, return, or waste documents.
/// </summary>
public sealed class InventoryAllocationDisposition
{
    public byte[] AllocationDispositionId { get; set; } = null!;
    public byte[] SourceIssueLineId { get; set; } = null!;
    public byte[] DestinationIssueLineId { get; set; } = null!;
    public decimal Quantity { get; set; }
    public string Reason { get; set; } = null!;
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public long Version { get; set; }
    public string? CorrelationId { get; set; }
    public string? CausationId { get; set; }
}
