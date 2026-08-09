using System.Security.Cryptography;

namespace IPCManagement.Api.Features.Purchasing.Services;

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
    DateTime NowUtc);

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

public sealed record QuotationCoverageCandidate(
    string QuotationId,
    string IngredientId,
    string UnitId,
    string SupplierId,
    bool SupplierIsActive,
    bool QuotationIsActive,
    string SourceLineSha256,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo);

public sealed record QuotationResolutionRequest(
    string IngredientId,
    string UnitId,
    DateOnly AsOf,
    string CurrentFingerprint,
    EvidencePackageInput Evidence,
    IReadOnlyList<QuotationCoverageCandidate> Quotations);

public sealed record QuotationCoverage(string OutcomeId, string Decision);

public interface IQuotationEvidenceResolutionService
{
    EvidenceResolutionState Preview(QuotationResolutionRequest request, ResolutionCommandContext command);
    EvidenceResolutionState Review(string resolutionId, ResolutionCommandContext command);
    EvidenceResolutionState Apply(string resolutionId, ResolutionCommandContext command, DateTime nowUtc);
}

public sealed class QuotationEvidenceResolutionService : IQuotationEvidenceResolutionService
{
    private readonly Dictionary<string, Entry> _entries = new(StringComparer.Ordinal);
    private readonly Dictionary<string, EvidenceResolutionState> _receipts = new(StringComparer.Ordinal);
    private readonly object _sync = new();

    public static QuotationCoverage EvaluateCoverage(QuotationResolutionRequest request, DateTime nowUtc)
    {
        EvidencePackageGuard.Validate(
            request.Evidence, "QUOTATION_GAP", request.IngredientId, request.CurrentFingerprint,
            "PURCHASING_SOURCE_OWNER", "SUPPLIER_QUOTATION_LINE", nowUtc);

        if (request.Evidence.Decision == "TIME_BOUND_EXCEPTION")
        {
            if (request.Evidence.ExpiresAtUtc is null || request.Evidence.ExpiresAtUtc <= nowUtc)
                throw new InvalidOperationException("Quotation exception is expired and the gap is open again.");
            return new QuotationCoverage(request.Evidence.PackageId, request.Evidence.Decision);
        }

        if (request.Evidence.Decision != "EFFECTIVE_QUOTATION")
            throw new InvalidOperationException("Quotation evidence decision is not terminal.");

        var matches = request.Quotations.Where(item =>
            item.IngredientId == request.IngredientId && item.UnitId == request.UnitId &&
            item.SupplierIsActive && item.QuotationIsActive && IsSha256(item.SourceLineSha256) &&
            item.EffectiveFrom <= request.AsOf && (item.EffectiveTo is null || item.EffectiveTo >= request.AsOf)).ToArray();
        if (matches.Length == 0)
            throw new InvalidOperationException("No effective quotation exists for the exact ingredient/unit and as-of date.");
        if (matches.Length != 1)
            throw new InvalidOperationException("Multiple overlapping effective quotations are not deterministic evidence.");
        if (request.Evidence.OutcomeEntityId != matches[0].QuotationId)
            throw new InvalidOperationException("Signed quotation outcome does not match the current source line.");
        return new QuotationCoverage(matches[0].QuotationId, request.Evidence.Decision);
    }

    public EvidenceResolutionState Preview(QuotationResolutionRequest request, ResolutionCommandContext command)
    {
        RequireRole(command, "Admin", "Purchasing", "PurchaseStaff", "ProcurementStaff");
        var coverage = EvaluateCoverage(request, command.NowUtc);
        EvidencePackageGuard.RequireIndependentActor(request.Evidence, command.ActorId);
        lock (_sync)
        {
            if (_receipts.TryGetValue(command.CommandId, out var replay)) return replay;
            var state = new EvidenceResolutionState(Guid.NewGuid().ToString(), request.IngredientId,
                "PENDING_MANAGER_REVIEW", 0, command.ActorId, null, null,
                request.Evidence.Decision, coverage.OutcomeId, 1);
            _entries.Add(state.ResolutionId, new Entry(request, state));
            _receipts.Add(command.CommandId, state);
            return state;
        }
    }

    public EvidenceResolutionState Review(string resolutionId, ResolutionCommandContext command)
    {
        RequireRole(command, "Manager");
        lock (_sync)
        {
            if (_receipts.TryGetValue(command.CommandId, out var replay)) return replay;
            var entry = Get(resolutionId);
            RequireVersion(entry.State, command.ExpectedVersion);
            if (entry.State.Status != "PENDING_MANAGER_REVIEW")
                throw new InvalidOperationException("Only a pending quotation resolution may be reviewed.");
            if (entry.State.PreviewedBy == command.ActorId)
                throw new InvalidOperationException("Quotation review requires a different actor.");
            EvidencePackageGuard.RequireIndependentActor(entry.Request.Evidence, command.ActorId);
            entry.State = entry.State with { Status = "APPROVED", Version = 1, ReviewedBy = command.ActorId, AuditCount = 2 };
            _receipts.Add(command.CommandId, entry.State);
            return entry.State;
        }
    }

    public EvidenceResolutionState Apply(string resolutionId, ResolutionCommandContext command, DateTime nowUtc)
    {
        RequireRole(command, "Admin", "Purchasing", "PurchaseStaff", "ProcurementStaff");
        lock (_sync)
        {
            if (_receipts.TryGetValue(command.CommandId, out var replay)) return replay;
            var entry = Get(resolutionId);
            RequireVersion(entry.State, command.ExpectedVersion);
            if (entry.State.Status != "APPROVED")
                throw new InvalidOperationException("Only an approved quotation resolution may be applied.");
            EvaluateCoverage(entry.Request, nowUtc);
            EvidencePackageGuard.RequireIndependentActor(entry.Request.Evidence, command.ActorId);
            entry.State = entry.State with { Status = "APPLIED", Version = 2, AppliedBy = command.ActorId, AuditCount = 3 };
            _receipts.Add(command.CommandId, entry.State);
            return entry.State;
        }
    }

    private Entry Get(string id) => _entries.GetValueOrDefault(id)
        ?? throw new KeyNotFoundException("Quotation evidence resolution was not found.");

    private static void RequireVersion(EvidenceResolutionState state, long expected)
    {
        if (state.Version != expected) throw new InvalidOperationException("Quotation resolution version is stale.");
    }

    private static void RequireRole(ResolutionCommandContext command, params string[] roles)
    {
        if (!roles.Contains(command.ActorRole, StringComparer.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Actor is not authorized for this quotation command.");
        if (string.IsNullOrWhiteSpace(command.CommandId) || string.IsNullOrWhiteSpace(command.ActorId))
            throw new ArgumentException("Command and actor identity are required.");
    }

    private static bool IsSha256(string? value) => value is { Length: 64 } && value.All(Uri.IsHexDigit);
    private sealed class Entry(QuotationResolutionRequest request, EvidenceResolutionState state)
    {
        public QuotationResolutionRequest Request { get; } = request;
        public EvidenceResolutionState State { get; set; } = state;
    }
}

internal static class EvidencePackageGuard
{
    internal static void Validate(
        EvidencePackageInput evidence,
        string issueType,
        string subjectId,
        string currentFingerprint,
        string authoritySlot,
        string sourceType,
        DateTime nowUtc)
    {
        if (evidence.IssueType != issueType || evidence.SubjectId != subjectId)
            throw new InvalidOperationException("Evidence stable identity does not match the resolution subject.");
        if (!IsSha256(currentFingerprint) || evidence.SourceFingerprint != currentFingerprint)
            throw new InvalidOperationException("Evidence package is stale.");
        var digest = Convert.ToHexString(SHA256.HashData(evidence.ManifestUtf8));
        if (evidence.ManifestUtf8.Length == 0 || evidence.ManifestSha256 != digest)
            throw new InvalidOperationException("Evidence exact manifest bytes or digest are invalid.");
        if (evidence.CreatedAtUtc.Kind != DateTimeKind.Utc || evidence.CreatedAtUtc > nowUtc)
            throw new InvalidOperationException("Evidence generation time is invalid.");
        if (evidence.ExpiresAtUtc is { } expiry && (expiry.Kind != DateTimeKind.Utc || expiry <= nowUtc))
            throw new InvalidOperationException("Evidence package is expired.");
        if (!evidence.SourceTypes.Contains(sourceType, StringComparer.Ordinal))
            throw new InvalidOperationException(sourceType == "SUPPLIER_QUOTATION_LINE"
                ? "Evidence requires an exact source quotation line."
                : $"Evidence requires an exact {sourceType.ToLowerInvariant().Replace('_', ' ')}.");
        var owner = evidence.Attestations.Where(item => item.AuthoritySlot == authoritySlot).ToArray();
        if (owner.Length != 1 || owner[0].ManifestSha256 != digest || string.IsNullOrWhiteSpace(owner[0].ActorId) ||
            owner[0].ExpiresAtUtc is { } ownerExpiry && ownerExpiry <= nowUtc)
            throw new InvalidOperationException("One current source-owner attestation over the exact manifest is required.");
    }

    internal static void RequireIndependentActor(EvidencePackageInput evidence, string actorId)
    {
        if (evidence.Attestations.Any(item => item.ActorId == actorId))
            throw new InvalidOperationException("Workflow actor must differ from every source-owner attestation actor.");
    }

    internal static bool IsSha256(string? value) => value is { Length: 64 } && value.All(Uri.IsHexDigit);
}
