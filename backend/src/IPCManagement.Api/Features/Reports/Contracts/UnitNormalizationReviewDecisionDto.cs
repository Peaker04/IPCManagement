namespace IPCManagement.Api.Features.Reports.Contracts;

public sealed record UnitNormalizationReviewDecisionRequest(
    string Decision,
    string EvidenceSource,
    string EvidenceNote,
    decimal? SourceToCatalogFactor,
    string? RecommendedUnitId);

public sealed record UnitNormalizationReviewDecisionDto(
    string ReviewId,
    string Status,
    string Confidence,
    decimal? SourceToCatalogFactor,
    string? RecommendedUnitId,
    string EvidenceSource,
    string EvidenceNote,
    string ReviewedBy,
    DateTime ReviewedAt);
