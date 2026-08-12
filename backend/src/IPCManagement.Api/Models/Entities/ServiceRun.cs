namespace IPCManagement.Api.Models.Entities;

public sealed class ServiceRun
{
    public byte[] ServiceRunId { get; set; } = null!;
    public byte[] PlanId { get; set; } = null!;
    public byte[] CustomerId { get; set; } = null!;
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = null!;
    public decimal PriceTierAmount { get; set; }
    public long ConcurrencyVersion { get; set; }
    public string Status { get; set; } = "PLANNED";
    public int? ActualServings { get; set; }
    public string? ActualServingsReason { get; set; }
    public DateTime? ActualServingsRecordedAt { get; set; }
    public byte[]? ActualServingsRecordedBy { get; set; }
    public DateTime? ServingVarianceResolvedAt { get; set; }
    public byte[]? ServingVarianceResolvedBy { get; set; }
    public string? ServingVarianceResolutionReason { get; set; }
    public string ServiceConfirmationPolicy { get; set; } = "WAIVABLE";
    public DateTime? ServiceConfirmedAt { get; set; }
    public byte[]? ServiceConfirmedBy { get; set; }
    public DateTime? ServiceConfirmationWaivedAt { get; set; }
    public byte[]? ServiceConfirmationWaivedBy { get; set; }
    public string? ServiceConfirmationWaiverReason { get; set; }
    public DateTime? VarianceResolvedAt { get; set; }
    public byte[]? VarianceResolvedBy { get; set; }
    public string? VarianceResolutionReason { get; set; }
    public DateTime? StartedAt { get; set; }
    public byte[]? StartedBy { get; set; }
    public DateTime? ClosedAt { get; set; }
    public byte[]? ClosedBy { get; set; }
    public string? CloseSnapshotJson { get; set; }
    public byte[] OpenedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ProductionPlan Plan { get; set; } = null!;
    public ICollection<ServiceRunSourceLine> SourceLines { get; set; } = new List<ServiceRunSourceLine>();
}

public sealed class ServiceRunSourceLine
{
    public byte[] ServiceRunSourceLineId { get; set; } = null!;
    public byte[] ServiceRunId { get; set; } = null!;
    public byte[] MaterialRequestLineId { get; set; } = null!;
    public DateTime RecordedAt { get; set; }
    public ServiceRun ServiceRun { get; set; } = null!;
    public MaterialRequestLine MaterialRequestLine { get; set; } = null!;
}

public sealed class ServiceRunDecisionItem
{
    public byte[] ServiceRunDecisionItemId { get; set; } = null!;
    public byte[] PlanId { get; set; } = null!;
    public byte[]? CustomerId { get; set; }
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = null!;
    public decimal? PriceTierAmount { get; set; }
    public string Reason { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}

public sealed class ServiceRunVarianceDeclaration
{
    public byte[] ServiceRunVarianceDeclarationId { get; set; } = null!;
    public byte[] ServiceRunId { get; set; } = null!;
    public string Track { get; set; } = null!;
    public string SourceLineEvidenceJson { get; set; } = null!;
    public string Reason { get; set; } = null!;
    public byte[] DeclaredBy { get; set; } = null!;
    public DateTime DeclaredAt { get; set; }
    public ServiceRun ServiceRun { get; set; } = null!;
}

public sealed class ServiceRunVarianceWaiver
{
    public byte[] ServiceRunVarianceWaiverId { get; set; } = null!;
    public byte[] ServiceRunVarianceDeclarationId { get; set; } = null!;
    public byte[] ApprovedBy { get; set; } = null!;
    public DateTime ApprovedAt { get; set; }
    public string Reason { get; set; } = null!;
    public ServiceRunVarianceDeclaration Declaration { get; set; } = null!;
}
