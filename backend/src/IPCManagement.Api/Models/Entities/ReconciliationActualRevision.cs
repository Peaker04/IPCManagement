namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationActualRevision
{
    public byte[] RevisionId { get; set; } = null!;
    public byte[] ActualId { get; set; } = null!;
    public decimal OldQuantity { get; set; }
    public decimal NewQuantity { get; set; }
    public string Reason { get; set; } = null!;
    public byte[] ChangedBy { get; set; } = null!;
    public DateTime ChangedAt { get; set; }
    public ReconciliationActual Actual { get; set; } = null!;
}
