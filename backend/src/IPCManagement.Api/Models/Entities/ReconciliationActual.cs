namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationActual
{
    public byte[] ActualId { get; set; } = null!;
    public byte[] BatchLineId { get; set; } = null!;
    public string Side { get; set; } = null!;
    public decimal Quantity { get; set; }
    public long Version { get; set; }
    public byte[] EnteredBy { get; set; } = null!;
    public DateTime EnteredAt { get; set; }
    public ReconciliationBatchLine BatchLine { get; set; } = null!;
    public ICollection<ReconciliationActualRevision> Revisions { get; set; } = [];
}
