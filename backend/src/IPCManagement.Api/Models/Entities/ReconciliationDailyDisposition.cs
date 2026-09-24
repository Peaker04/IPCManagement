namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationDailyDisposition
{
    public byte[] DispositionId { get; set; } = null!;
    public byte[] DailyLineId { get; set; } = null!;
    public string Category { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public long Version { get; set; }
    public byte[] DisposedBy { get; set; } = null!;
    public DateTime DisposedAt { get; set; }
    public ReconciliationBatchDailyLine DailyLine { get; set; } = null!;
}
