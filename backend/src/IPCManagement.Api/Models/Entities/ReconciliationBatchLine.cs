namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationBatchLine
{
    public byte[] BatchLineId { get; set; } = null!;
    public byte[] BatchId { get; set; } = null!;
    public byte[] IngredientId { get; set; } = null!;
    public byte[] CanonicalUnitId { get; set; } = null!;
    public decimal RequiredQuantity { get; set; }
    public decimal FrozenTolerance { get; set; }
    public string ToleranceSourceKind { get; set; } = null!;
    public string ToleranceSourceVersion { get; set; } = null!;
    public long Version { get; set; }
    public ReconciliationBatch Batch { get; set; } = null!;
    public Ingredient Ingredient { get; set; } = null!;
    public Unit CanonicalUnit { get; set; } = null!;
    public ICollection<ReconciliationBatchContributor> Contributors { get; set; } = [];
}
