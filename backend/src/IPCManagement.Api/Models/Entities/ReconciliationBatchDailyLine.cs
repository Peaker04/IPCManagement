namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationBatchDailyLine
{
    public byte[] DailyLineId { get; set; } = null!;
    public byte[] BatchLineId { get; set; } = null!;
    public byte[] BatchId { get; set; } = null!;
    public byte[] IngredientId { get; set; } = null!;
    public byte[] CanonicalUnitId { get; set; } = null!;
    public DateOnly ServiceDate { get; set; }
    public decimal RequiredQuantity { get; set; }
    public long Version { get; set; }
    public ReconciliationBatchLine BatchLine { get; set; } = null!;
    public ICollection<ReconciliationBatchContributor> Contributors { get; set; } = [];
    public ICollection<InventoryIssueLine> InventoryIssueLines { get; set; } = [];
    public ReconciliationDailyDisposition? Disposition { get; set; }
}
