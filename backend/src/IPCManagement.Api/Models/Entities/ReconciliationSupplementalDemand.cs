namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationSupplementalDemand
{
    public byte[] DemandId { get; set; } = null!;
    public byte[] BatchId { get; set; } = null!;
    public DateOnly ServiceDate { get; set; }
    public string Status { get; set; } = "DRAFT";
    public string Reason { get; set; } = string.Empty;
    public long Version { get; set; } = 1;
    public long SnapshotBatchVersion { get; set; }
    public string SnapshotFingerprint { get; set; } = string.Empty;
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public byte[]? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public string? DecisionReason { get; set; }
    public ReconciliationBatch Batch { get; set; } = null!;
    public ICollection<ReconciliationSupplementalDemandDish> Dishes { get; set; } = [];
    public ICollection<ReconciliationSupplementalDemandMaterial> Materials { get; set; } = [];
}

public sealed class ReconciliationSupplementalDemandDish
{
    public byte[] DemandDishId { get; set; } = null!;
    public byte[] DemandId { get; set; } = null!;
    public byte[] DishId { get; set; } = null!;
    public string ShiftName { get; set; } = string.Empty;
    public string MenuVariant { get; set; } = string.Empty;
    public string FrozenDishCode { get; set; } = string.Empty;
    public string FrozenDishName { get; set; } = string.Empty;
    public int ExtraServings { get; set; }
    public ReconciliationSupplementalDemand Demand { get; set; } = null!;
    public ICollection<ReconciliationSupplementalDemandContribution> Contributions { get; set; } = [];
}

public sealed class ReconciliationSupplementalDemandMaterial
{
    public byte[] DemandMaterialId { get; set; } = null!;
    public byte[] DemandId { get; set; } = null!;
    public byte[] BatchId { get; set; } = null!;
    public byte[] DailyLineId { get; set; } = null!;
    public byte[] IngredientId { get; set; } = null!;
    public byte[] CanonicalUnitId { get; set; } = null!;
    public decimal RequiredQuantity { get; set; }
    public ReconciliationSupplementalDemand Demand { get; set; } = null!;
    public ReconciliationBatchDailyLine DailyLine { get; set; } = null!;
    public ICollection<ReconciliationSupplementalDemandContribution> Contributions { get; set; } = [];
}

public sealed class ReconciliationSupplementalDemandContribution
{
    public byte[] DemandContributionId { get; set; } = null!;
    public byte[] DemandDishId { get; set; } = null!;
    public byte[] DemandMaterialId { get; set; } = null!;
    public byte[] FrozenContributorId { get; set; } = null!;
    public decimal CanonicalQuantityPerServing { get; set; }
    public decimal FrozenBomQuantityPerServing { get; set; }
    public decimal FrozenBomUnitToBaseRate { get; set; }
    public decimal FrozenCanonicalUnitToBaseRate { get; set; }
    public decimal WasteRatePercent { get; set; }
    public decimal RequiredQuantity { get; set; }
    public ReconciliationSupplementalDemandDish DemandDish { get; set; } = null!;
    public ReconciliationSupplementalDemandMaterial DemandMaterial { get; set; } = null!;
}

public sealed class ReconciliationIssueAllocation
{
    public byte[] AllocationId { get; set; } = null!;
    public byte[] IssueLineId { get; set; } = null!;
    public byte[] DailyLineId { get; set; } = null!;
    public byte[]? DemandMaterialId { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public InventoryIssueLine IssueLine { get; set; } = null!;
    public ReconciliationBatchDailyLine DailyLine { get; set; } = null!;
    public ReconciliationSupplementalDemandMaterial? DemandMaterial { get; set; }
}
