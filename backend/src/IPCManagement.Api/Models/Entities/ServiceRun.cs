namespace IPCManagement.Api.Models.Entities;

public sealed class ServiceRun
{
    public byte[] ServiceRunId { get; set; } = null!;
    public byte[] PlanId { get; set; } = null!;
    public string ShiftName { get; set; } = null!;
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
}
