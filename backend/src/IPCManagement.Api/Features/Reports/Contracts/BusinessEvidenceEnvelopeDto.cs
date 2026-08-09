namespace IPCManagement.Api.Features.Reports.Contracts;

public sealed record BusinessEvidenceSourceReferenceDto(
    string SourceType,
    string Reference,
    string Sha256);

public sealed record BusinessEvidenceEnvelopeDto(
    int SchemaVersion,
    string PackageId,
    string IssueType,
    string SubjectId,
    string SourceFingerprint,
    string SourceDatabase,
    string MigrationHead,
    DateTime GeneratedAtUtc,
    DateTime? ExpiresAtUtc,
    IReadOnlyList<BusinessEvidenceSourceReferenceDto> SourceReferences,
    string Decision,
    string? OutcomeEntityType,
    string? OutcomeEntityId);
