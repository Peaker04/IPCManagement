namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationSourceRevision
{
    public byte[] SourceRevisionId { get; set; } = null!;
    public byte[] MenuAmendmentId { get; set; } = null!;
    public byte[] BatchId { get; set; } = null!;
    public byte[] PreviousMenuVersionId { get; set; } = null!;
    public byte[] AppliedMenuVersionId { get; set; } = null!;
    public long RevisionNumber { get; set; }
    public string Status { get; set; } = "APPLIED";
    public string Reason { get; set; } = null!;
    public byte[] AppliedBy { get; set; } = null!;
    public DateTime AppliedAt { get; set; }
    public ReconciliationBatch Batch { get; set; } = null!;
    public ICollection<ReconciliationSourceDelta> Deltas { get; set; } = [];
}

public sealed class ReconciliationSourceDelta
{
    public byte[] SourceDeltaId { get; set; } = null!;
    public byte[] SourceRevisionId { get; set; } = null!;
    public byte[] BatchId { get; set; } = null!;
    public byte[]? DailyLineId { get; set; }
    public DateOnly ServiceDate { get; set; }
    public byte[] IngredientId { get; set; } = null!;
    public byte[] CanonicalUnitId { get; set; } = null!;
    public decimal PreviousRequiredQuantity { get; set; }
    public decimal NewRequiredQuantity { get; set; }
    public decimal DeltaQuantity { get; set; }
    public string WorkKind { get; set; } = null!;
    public string Status { get; set; } = "PENDING";
    public long Version { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public byte[]? ResolvedBy { get; set; }
    public string? ResolutionEntity { get; set; }
    public byte[]? ResolutionId { get; set; }
    public string? ResolutionCommandId { get; set; }
    public ReconciliationSourceRevision SourceRevision { get; set; } = null!;
    public ReconciliationBatchDailyLine? DailyLine { get; set; }
}
