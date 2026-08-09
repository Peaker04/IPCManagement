using System.Security.Cryptography;
using System.Text;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reports.Services;

internal static class BusinessEvidencePolicy
{
    internal const int CurrentSchemaVersion = 1;

    private static readonly IReadOnlyDictionary<string, string[]> RequiredSourceTypes =
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["STOCK_MOVEMENT_BALANCE"] = ["LEDGER", "RECEIPT", "STOCK_SNAPSHOT"],
            ["MENU_WEEK_MISMATCH"] = ["SOURCE_WORKBOOK", "DOWNSTREAM_TRAVERSAL"],
            ["UNIT_NORMALIZATION"] = ["AUTHORITATIVE_UNIT_SOURCE"]
        };

    private static readonly IReadOnlyDictionary<string, string[]> RequiredAuthoritySlots =
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["STOCK_MOVEMENT_BALANCE"] = ["WAREHOUSE_SOURCE_OWNER", "FINANCE_SOURCE_OWNER"],
            ["MENU_WEEK_MISMATCH"] = ["COORDINATION_SOURCE_OWNER"],
            ["UNIT_NORMALIZATION"] = ["CATALOG_SOURCE_OWNER"]
        };

    internal static string ComputeManifestSha256(ReadOnlySpan<byte> manifestUtf8)
        => Convert.ToHexString(SHA256.HashData(manifestUtf8));

    internal static void Validate(
        BusinessEvidenceEnvelopeDto envelope,
        BusinessEvidencePackage package,
        IReadOnlyCollection<BusinessEvidenceAttestation> attestations,
        string currentFingerprint,
        DateTime nowUtc)
    {
        ArgumentNullException.ThrowIfNull(envelope);
        ArgumentNullException.ThrowIfNull(package);
        ArgumentNullException.ThrowIfNull(attestations);
        EnsureUtc(nowUtc, nameof(nowUtc));

        if (envelope.SchemaVersion != CurrentSchemaVersion || package.SchemaVersion != CurrentSchemaVersion)
            throw new InvalidOperationException("Unsupported business evidence schema version.");
        DataQualityDispositionPolicy.RequireText(package.CommandId, 100, "CommandId is required for idempotent evidence creation.");
        if (package.Version != 0)
            throw new InvalidOperationException("A new immutable evidence package must start at version 0.");
        if (!string.Equals(envelope.PackageId, GuidHelper.ToGuidString(package.PackageId), StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(envelope.SubjectId, GuidHelper.ToGuidString(package.SubjectId), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Envelope stable identities do not match the persisted package.");

        var issueType = DataQualityDispositionPolicy.NormalizeIssueType(envelope.IssueType);
        if (!RequiredSourceTypes.ContainsKey(issueType))
            throw new InvalidOperationException("Issue type is not owned by the DCR-01..03 evidence kernel.");
        if (!string.Equals(package.IssueType, issueType, StringComparison.Ordinal) ||
            !string.Equals(package.SourceFingerprint, envelope.SourceFingerprint, StringComparison.Ordinal) ||
            !string.Equals(package.SourceDatabase, envelope.SourceDatabase, StringComparison.Ordinal) ||
            !string.Equals(package.MigrationHead, envelope.MigrationHead, StringComparison.Ordinal) ||
            !string.Equals(package.Decision, envelope.Decision, StringComparison.Ordinal))
            throw new InvalidOperationException("Envelope metadata does not match the persisted package.");

        var normalizedCurrentFingerprint = DataQualityDispositionPolicy.NormalizeFingerprint(currentFingerprint);
        if (!string.Equals(package.SourceFingerprint, normalizedCurrentFingerprint, StringComparison.Ordinal))
            throw new InvalidOperationException("Business evidence is stale because the current fingerprint changed.");

        var exactDigest = ComputeManifestSha256(package.ManifestUtf8);
        if (!string.Equals(exactDigest, package.ManifestSha256, StringComparison.Ordinal) ||
            !IsSha256(package.ManifestSha256))
            throw new InvalidOperationException("Persisted manifest exact-byte digest is invalid.");
        if (package.ManifestUtf8.Length == 0)
            throw new InvalidOperationException("Persisted manifest bytes are required.");

        EnsureUtc(package.CreatedAtUtc, nameof(package.CreatedAtUtc));
        if (package.CreatedAtUtc > nowUtc)
            throw new InvalidOperationException("Business evidence cannot be generated in the future.");
        if (package.ExpiresAtUtc is { } expiresAtUtc)
        {
            EnsureUtc(expiresAtUtc, nameof(package.ExpiresAtUtc));
            if (expiresAtUtc <= nowUtc)
                throw new InvalidOperationException("Business evidence package is expired.");
        }

        ValidateSourceReferences(issueType, envelope.SourceReferences);
        ValidateDecisionAndOutcome(issueType, envelope);
        ValidateAttestations(issueType, package, attestations, nowUtc);
    }

    private static void ValidateSourceReferences(
        string issueType,
        IReadOnlyList<BusinessEvidenceSourceReferenceDto> references)
    {
        if (references is null || references.Count == 0)
            throw new InvalidOperationException("Issue-specific source references are required.");

        foreach (var source in references)
        {
            var sourceType = source.SourceType?.Trim().ToUpperInvariant();
            if (string.IsNullOrWhiteSpace(sourceType) || sourceType is "NORMALIZED_NAME" or "NOTE")
                throw new InvalidOperationException("Normalized names and note-only evidence are not source identity.");
            if (string.IsNullOrWhiteSpace(source.Reference) || IsPlaceholder(source.Reference))
                throw new InvalidOperationException("A retrievable redacted source reference is required.");
            if (!IsSha256(source.Sha256) || source.Sha256.All(character => character == '0'))
                throw new InvalidOperationException("A non-placeholder source SHA-256 is required.");
        }

        var sourceTypes = references.Select(item => item.SourceType.Trim().ToUpperInvariant())
            .ToHashSet(StringComparer.Ordinal);
        var missing = RequiredSourceTypes[issueType].Where(required => !sourceTypes.Contains(required)).ToArray();
        if (missing.Length > 0)
            throw new InvalidOperationException($"Missing required source evidence: {string.Join(", ", missing)}.");
    }

    private static void ValidateDecisionAndOutcome(string issueType, BusinessEvidenceEnvelopeDto envelope)
    {
        var decision = envelope.Decision?.Trim().ToUpperInvariant();
        var allowed = issueType switch
        {
            "STOCK_MOVEMENT_BALANCE" => decision is "RESOLVED_NO_CHANGE" or "CORRECTION_REQUIRED",
            "MENU_WEEK_MISMATCH" => decision is "SUPERSESSION_REQUIRED" or "CORRECTION_REQUIRED",
            "UNIT_NORMALIZATION" => decision is "CONFIRMED" or "RETAIN_DISTINCT",
            _ => false
        };
        if (!allowed || decision is "BLOCKED_BUSINESS" or "NEEDS_CONFIRMATION")
            throw new InvalidOperationException("Business evidence decision is not a terminal DCR outcome.");

        var needsOutcome = decision is "CORRECTION_REQUIRED" or "SUPERSESSION_REQUIRED";
        if (needsOutcome && (string.IsNullOrWhiteSpace(envelope.OutcomeEntityType) ||
            GuidHelper.ParseGuidString(envelope.OutcomeEntityId) is null))
            throw new InvalidOperationException("Append-only correction or supersession outcome link is required.");
    }

    private static void ValidateAttestations(
        string issueType,
        BusinessEvidencePackage package,
        IReadOnlyCollection<BusinessEvidenceAttestation> attestations,
        DateTime nowUtc)
    {
        var requiredSlots = RequiredAuthoritySlots[issueType];
        var bySlot = attestations.GroupBy(item => item.AuthoritySlot?.Trim().ToUpperInvariant() ?? string.Empty)
            .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal);

        foreach (var requiredSlot in requiredSlots)
        {
            if (!bySlot.TryGetValue(requiredSlot, out var matches) || matches.Length != 1)
                throw new InvalidOperationException($"Exactly one {requiredSlot} attestation is required.");
        }

        var required = requiredSlots.Select(slot => bySlot[slot][0]).ToArray();
        foreach (var attestation in required)
        {
            if (!attestation.PackageId.SequenceEqual(package.PackageId) ||
                !string.Equals(attestation.ManifestSha256, package.ManifestSha256, StringComparison.Ordinal))
                throw new InvalidOperationException("Attestation does not sign this exact manifest.");
            if (attestation.ActorId is not { Length: 16 } || attestation.ActorId.All(value => value == 0))
                throw new InvalidOperationException("Placeholder source-owner actor is forbidden.");
            if (string.IsNullOrWhiteSpace(attestation.AuthorityReference) || IsPlaceholder(attestation.AuthorityReference) ||
                !IsSha256(attestation.AuthoritySha256) || attestation.AuthoritySha256.All(character => character == '0'))
                throw new InvalidOperationException("Source-owner authority evidence is invalid.");
            EnsureUtc(attestation.AttestedAtUtc, nameof(attestation.AttestedAtUtc));
            if (attestation.AttestedAtUtc > nowUtc)
                throw new InvalidOperationException("Attestation cannot be in the future.");
            if (attestation.ExpiresAtUtc is { } expiresAtUtc)
            {
                EnsureUtc(expiresAtUtc, nameof(attestation.ExpiresAtUtc));
                if (expiresAtUtc <= nowUtc)
                    throw new InvalidOperationException("Source-owner attestation is expired.");
            }
        }

        if (required.Select(item => Convert.ToHexString(item.ActorId)).Distinct(StringComparer.Ordinal).Count() != required.Length)
            throw new InvalidOperationException("Required authority slots must be signed by different actors.");
    }

    private static bool IsSha256(string? value)
        => value is { Length: 64 } && value.All(Uri.IsHexDigit);

    private static bool IsPlaceholder(string value)
    {
        var normalized = value.Trim().ToUpperInvariant();
        return normalized is "UNKNOWN" or "PLACEHOLDER" or "SHARED" or "N/A" or "NONE";
    }

    private static void EnsureUtc(DateTime value, string field)
    {
        if (value.Kind != DateTimeKind.Utc)
            throw new InvalidOperationException($"{field} must be UTC.");
    }
}
