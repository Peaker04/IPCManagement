namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationDisposition
{
    public byte[] DispositionId { get; set; } = null!;
    public byte[] BatchLineId { get; set; } = null!;
    public string Category { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public long Version { get; set; }
    public byte[] DisposedBy { get; set; } = null!;
    public DateTime DisposedAt { get; set; }
    public ReconciliationBatchLine BatchLine { get; set; } = null!;
}
