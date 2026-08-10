namespace IPCManagement.Api.Shared.Contracts;

public sealed record EvidenceAttestationInput(
    string AuthoritySlot,
    string ActorId,
    string ManifestSha256,
    DateTime AttestedAtUtc,
    DateTime? ExpiresAtUtc);

public sealed record EvidencePackageInput(
    string PackageId,
    string IssueType,
    string SubjectId,
    string SourceFingerprint,
    byte[] ManifestUtf8,
    string ManifestSha256,
    string Decision,
    string? OutcomeEntityId,
    DateTime CreatedAtUtc,
    DateTime? ExpiresAtUtc,
    IReadOnlyList<string> SourceTypes,
    IReadOnlyList<EvidenceAttestationInput> Attestations);

public sealed record ResolutionCommandContext(
    string CommandId,
    long ExpectedVersion,
    string ActorId,
    string ActorRole,
    DateTime NowUtc,
    string? CurrentFingerprint = null);

public sealed record EvidenceResolutionState(
    string ResolutionId,
    string SubjectId,
    string Status,
    long Version,
    string PreviewedBy,
    string? ReviewedBy,
    string? AppliedBy,
    string Decision,
    string OutcomeId,
    int AuditCount);
