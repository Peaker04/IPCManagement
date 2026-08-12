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
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public IReadOnlyList<string> Blockers { get; set; } = [];
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

public sealed class ServiceRunByPlanQuery
{
    public string PlanId { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
}

public sealed class ServiceRunPageQuery : PagedRequestDto
{
    public DateOnly? ServiceDate { get; set; }
    public string? ShiftName { get; set; }
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
