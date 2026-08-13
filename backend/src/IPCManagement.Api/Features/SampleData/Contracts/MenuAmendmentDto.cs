namespace IPCManagement.Api.Features.SampleData.Contracts;

public sealed class CreateMenuAmendmentRequest
{
    public string CustomerId { get; set; } = string.Empty;
    public DateOnly WeekStartDate { get; set; }
    public string Reason { get; set; } = string.Empty;
    public List<CreateMenuAmendmentLineRequest> Lines { get; set; } = [];
}

public sealed class CreateMenuAmendmentLineRequest
{
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = string.Empty;
    public string DishSlot { get; set; } = string.Empty;
    public string NewDishId { get; set; } = string.Empty;
}

public sealed class MenuAmendmentResultDto
{
    public string MenuAmendmentId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public bool RequiresReconciliation { get; set; }
    public int AffectedDemandCount { get; set; }
    public int AffectedPurchaseRequestCount { get; set; }
    public bool HasPurchaseOrder { get; set; }
    public bool HasReceipt { get; set; }
    public bool HasIssue { get; set; }
    public string? AppliedMenuVersionId { get; set; }
    public string? ReconciliationCaseId { get; set; }
    public IReadOnlyList<string> AffectedDocumentIds { get; set; } = [];
    public IReadOnlyList<string> AffectedSourceLineIds { get; set; } = [];
    public IReadOnlyList<MenuAmendmentDecisionScopeDto> DecisionScopes { get; set; } = [];
}

public sealed class ReviewMenuAmendmentRequest
{
    public bool Approved { get; set; }
    public string? Reason { get; set; }
}

public sealed class BreakGlassMenuAmendmentRequest
{
    public string Reason { get; set; } = string.Empty;
}

public sealed class CreateMenuAmendmentReconciliationCorrectionRequest
{
    public string Reason { get; set; } = string.Empty;
}

public sealed class MenuAmendmentDecisionCommandRequest
{
    public string DecisionItemId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string CommandId { get; set; } = string.Empty;
    public long ExpectedVersion { get; set; }
    public string? CorrelationId { get; set; }
    public string? CausationId { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public sealed class RemediateMenuAmendmentDecisionFanRequest
{
    public string CommandId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

public sealed class MenuAmendmentDecisionRemediationDto
{
    public string ReconciliationCaseId { get; set; } = string.Empty;
    public string RemediationId { get; set; } = string.Empty;
    public int PreservedDecisionCount { get; set; }
    public int EffectiveDecisionCount { get; set; }
}

public sealed class MenuAmendmentDecisionScopeDto
{
    public string DecisionItemId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = string.Empty;
    public decimal? PriceTierAmount { get; set; }
    public IReadOnlyList<string> DocumentIds { get; set; } = [];
    public IReadOnlyList<string> SourceLineIds { get; set; } = [];
}

public sealed class MenuAmendmentDecisionItemDto
{
    public string DecisionItemId { get; set; } = string.Empty;
    public string MenuAmendmentId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = string.Empty;
    public decimal? PriceTierAmount { get; set; }
    public IReadOnlyList<string> DocumentIds { get; set; } = [];
    public IReadOnlyList<string> SourceLineIds { get; set; } = [];
    public string Reason { get; set; } = string.Empty;
    public string AccountableRole { get; set; } = string.Empty;
    public DateTime DueAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public long Version { get; set; }
    public IReadOnlyList<string> AllowedActions { get; set; } = [];
}

public sealed class MenuAmendmentDecisionPageDto
{
    public IReadOnlyList<MenuAmendmentDecisionItemDto> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}

public sealed class MenuAmendmentInboxItemDto
{
    public string MenuAmendmentId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public DateOnly WeekStartDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool RequiresReconciliation { get; set; }
    public bool HasPurchaseOrder { get; set; }
    public bool HasReceipt { get; set; }
    public bool HasIssue { get; set; }
    public int AffectedDemandCount { get; set; }
    public int AffectedPurchaseRequestCount { get; set; }
}
