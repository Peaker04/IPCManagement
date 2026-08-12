namespace IPCManagement.Api.Features.Planning.Contracts;

using IPCManagement.Api.Shared.Contracts;

public sealed class OpenServiceRunRequest
{
    public string PlanId { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public string? CustomerId { get; set; }
    public decimal? PriceTierAmount { get; set; }
}

public sealed class ServiceRunLifecycleProjectionDto
{
    public string ServiceRunId { get; set; } = string.Empty;
    public string PlanId { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerLabel { get; set; } = string.Empty;
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = string.Empty;
    public decimal PriceTierAmount { get; set; }
    public long CurrentVersion { get; set; }
    public string Status { get; set; } = string.Empty;
    public IReadOnlyList<string> Blockers { get; set; } = [];
    public IReadOnlyList<ServiceRunTrackDto> Tracks { get; set; } = ServiceRunTrackDto.CreateEmptyTracks();
    public IReadOnlyList<ServiceRunAllowedActionDto> AllowedActions { get; set; } = [];
    public ServiceRunCloseSnapshotViewDto CloseSnapshot { get; set; } = new();
    public ServiceRunCorrectionOverlayDto CorrectionOverlay { get; set; } = new();
    public bool CanStartService { get; set; }
    public bool CanRecordActualServings { get; set; }
    public bool CanConfirmService { get; set; }
    public bool CanWaiveServiceConfirmation { get; set; }
    public bool CanResolveVariance { get; set; }
    public bool CanResolveServingVariance { get; set; }
    public bool CanClose { get; set; }
    public string ServiceConfirmationOutcome { get; set; } = "PENDING";
    public int PlannedServings { get; set; }
    public int? ActualServings { get; set; }
    public int MaterialRequestLineCount { get; set; }
    public int IssueCount { get; set; }
    public int UnreceivedIssueCount { get; set; }
    public int OpenSupplementalCount { get; set; }
    public int UnreceivedReturnCount { get; set; }
    public bool HasBomBlocker { get; set; }
    public int AdjustmentCount { get; set; }
}

public sealed class ServiceRunTrackDto
{
    public string TrackId { get; set; } = string.Empty;
    public string DisplayLabel { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public IReadOnlyList<ServiceRunBlockerEvidenceDto> Blockers { get; set; } = [];
    public string ResponsibleRole { get; set; } = string.Empty;
    public DateTime? DueAt { get; set; }

    public static IReadOnlyList<ServiceRunTrackDto> CreateEmptyTracks() =>
    [
        new() { TrackId = "PLANNING", DisplayLabel = "Kế hoạch", Status = "PENDING", ResponsibleRole = "Điều phối" },
        new() { TrackId = "MATERIAL_SUPPLY", DisplayLabel = "Vật tư / cung ứng", Status = "PENDING", ResponsibleRole = "Kho" },
        new() { TrackId = "SERVICE_EXECUTION", DisplayLabel = "Phục vụ", Status = "PENDING", ResponsibleRole = "Bếp" },
        new() { TrackId = "RECONCILIATION", DisplayLabel = "Đối soát", Status = "PENDING", ResponsibleRole = "Quản lý" },
    ];
}

public sealed class ServiceRunBlockerEvidenceDto
{
    public string BlockerCode { get; set; } = string.Empty;
    public string DisplayLabel { get; set; } = string.Empty;
    public string? DocumentId { get; set; }
    public string? SourceLineId { get; set; }
}

public sealed class ServiceRunAllowedActionDto
{
    public string ActionId { get; set; } = string.Empty;
    public string DisplayLabel { get; set; } = string.Empty;
}

public sealed class ServiceRunCloseSnapshotViewDto
{
    public bool IsImmutable { get; set; }
    public DateTime? ClosedAt { get; set; }
    public int? ActualServings { get; set; }
}

public sealed class ServiceRunCorrectionOverlayDto
{
    public string State { get; set; } = "NONE";
    public int? CorrectedActualServings { get; set; }
    public int? ActualServingsDelta { get; set; }
    public string? Reason { get; set; }
}

public sealed class ServiceRunByPlanQuery
{
    public string PlanId { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
}

public sealed class ServiceRunScopeQuery
{
    public string? CustomerId { get; set; }
    public DateOnly? ServiceDate { get; set; }
    public string? ShiftName { get; set; }
    public decimal? PriceTierAmount { get; set; }
    public bool AllCustomers { get; set; }
}

public sealed class ServiceRunPageQuery : PagedRequestDto
{
    public string? CustomerId { get; set; }
    public DateOnly? ServiceDate { get; set; }
    public string? ShiftName { get; set; }
    public decimal? PriceTierAmount { get; set; }
    public bool AllCustomers { get; set; }
    public string? Status { get; set; }
}

public sealed class ServiceRunOperationalRowDto
{
    public ServiceRunLifecycleProjectionDto Lifecycle { get; set; } = new();
    public IReadOnlyList<string> MaterialRequestCodes { get; set; } = [];
    public IReadOnlyList<string> IssueCodes { get; set; } = [];
    public IReadOnlyList<string> ReturnCodes { get; set; } = [];
    public IReadOnlyList<string> SupplementalRequestCodes { get; set; } = [];
    public IReadOnlyList<string> MaterialRequestLineIds { get; set; } = [];
    public IReadOnlyList<string> IssueLineIds { get; set; } = [];
    public decimal EstimatedPurchaseCost { get; set; }
    public decimal? ActualReceivedCost { get; set; }
    public bool IsCloseSnapshot { get; set; }
}

public sealed class ServiceRunCloseSnapshotDto
{
    public int Version { get; set; } = 2;
    public ServiceRunOperationalRowDto OperationalRow { get; set; } = new();
}

public sealed class RecordActualServingsRequest
{
    public int ActualServings { get; set; }
    public string? Reason { get; set; }
}

public sealed class ReasonRequest
{
    public string Reason { get; set; } = string.Empty;
}

public sealed class DeclareServiceRunVarianceRequest
{
    public string Track { get; set; } = string.Empty;
    public IReadOnlyList<string> SourceLineIds { get; set; } = [];
    public string Reason { get; set; } = string.Empty;
}

public sealed class ApproveServiceRunVarianceWaiverRequest
{
    public string Reason { get; set; } = string.Empty;
}

public sealed class CreateServiceRunAdjustmentRequest
{
    public int CorrectedActualServings { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public sealed class ServiceRunAdjustmentDto
{
    public string ServiceRunAdjustmentId { get; set; } = string.Empty;
    public string ServiceRunId { get; set; } = string.Empty;
    public int CorrectedActualServings { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
