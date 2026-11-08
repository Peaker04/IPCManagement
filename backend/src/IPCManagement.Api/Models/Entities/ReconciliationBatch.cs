namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationBatch
{
    public byte[] BatchId { get; set; } = null!;
    public byte[] MenuVersionId { get; set; } = null!;
    public byte[] QuantityImportBatchId { get; set; } = null!;
    public string Status { get; set; } = "DRAFT";
    public long Version { get; set; }
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public byte[]? ReadyBy { get; set; }
    public DateTime? ReadyAt { get; set; }
    public byte[]? CompletedBy { get; set; }
    public DateTime? CompletedAt { get; set; }
    public ICollection<ReconciliationBatchLine> Lines { get; set; } = [];
}
