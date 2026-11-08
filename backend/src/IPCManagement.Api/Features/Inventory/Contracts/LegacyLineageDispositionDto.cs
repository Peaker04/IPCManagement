namespace IPCManagement.Api.Features.Inventory.Contracts;

public sealed class CreateLegacyLineageDispositionRequest
{
    public string CommandId { get; set; } = string.Empty;
    public string LegacyLineType { get; set; } = string.Empty;
    public string LegacyLineId { get; set; } = string.Empty;
    public string TargetLineId { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

public sealed class ReviewLegacyLineageDispositionRequest
{
    public string CommandId { get; set; } = string.Empty;
    public long ExpectedVersion { get; set; }
    public bool Approve { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public sealed class ApplyLegacyLineageDispositionRequest
{
    public string CommandId { get; set; } = string.Empty;
    public long ExpectedVersion { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public sealed class LegacyLineageDispositionDto
{
    public string DispositionId { get; set; } = string.Empty;
    public string LegacyLineType { get; set; } = string.Empty;
    public string LegacyLineId { get; set; } = string.Empty;
    public string? TargetMaterialRequestLineId { get; set; }
    public string? TargetIssueLineId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? ReviewReason { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? AppliedBy { get; set; }
    public DateTime? AppliedAt { get; set; }
    public long Version { get; set; }
}

public sealed class LegacyLineageCandidateDto
{
    public string LegacyLineType { get; set; } = string.Empty;
    public string LegacyLineId { get; set; } = string.Empty;
    public string TargetLineId { get; set; } = string.Empty;
    public string DocumentCode { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
}
