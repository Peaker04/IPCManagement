namespace IPCManagement.Api.Features.Reports.Contracts;

public sealed record CreateDataQualityDispositionRequest(
    string IssueType,
    string SourceEntityId,
    string SourceFingerprint,
    string ProposedAction,
    string EvidenceJson,
    string Reason,
    string CommandId);

public sealed record ReviewDataQualityDispositionRequest(
    string Decision,
    string Reason,
    long ExpectedVersion,
    string CommandId);

public sealed record ApplyDataQualityDispositionRequest(
    string CorrectionEntityType,
    string CorrectionEntityId,
    string Reason,
    long ExpectedVersion,
    string CommandId);

public sealed record DataQualityDispositionDto(
    string DispositionId,
    string IssueType,
    string SourceEntityId,
    string SourceFingerprint,
    string ProposedAction,
    string EvidenceJson,
    string Status,
    string Reason,
    string? ReviewReason,
    string CreatedBy,
    DateTime CreatedAt,
    string? ReviewedBy,
    DateTime? ReviewedAt,
    string? AppliedBy,
    DateTime? AppliedAt,
    string? CorrectionEntityType,
    string? CorrectionEntityId,
    long Version);
