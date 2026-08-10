using System.Security.Cryptography;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Infrastructure.Lifecycle;

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

internal sealed class DurableResolutionStore(
    IpcManagementContext context,
    IEfTransactionRunner transactionRunner,
    ILifecycleTransitionRecorder lifecycleRecorder)
{
    public EvidenceResolutionState Preview(
        string issueType,
        string subjectId,
        string fingerprint,
        EvidencePackageInput evidence,
        ResolutionCommandContext command,
        string outcomeId)
    {
        var subject = Parse(subjectId, "Resolution subject ID is invalid.");
        var actor = Identity(command.ActorId);
        var aggregateType = $"BusinessEvidence:{issueType}";
        var replay = lifecycleRecorder.FindExistingCommandAsync(command.CommandId, aggregateType, subject).GetAwaiter().GetResult();
        if (replay is not null) return Deserialize(replay.ResponseJson);
        return transactionRunner.ExecuteAsync(async token =>
        {
            var packageId = Parse(evidence.PackageId, "Evidence package ID is invalid.");
            if (await context.Dataqualitydispositions.AnyAsync(item =>
                    item.IssueType == issueType && item.SourceEntityId.SequenceEqual(subject) &&
                    item.SourceFingerprint == fingerprint, token))
                throw new InvalidOperationException("A current business evidence resolution already exists.");
            var package = ToPackage(issueType, subject, evidence, packageId, outcomeId);
            context.Businessevidencepackages.Add(package);
            foreach (var attestation in evidence.Attestations)
                context.Businessevidenceattestations.Add(ToAttestation(packageId, evidence, attestation));
            var item = new DataQualityDisposition
            {
                DispositionId = GuidHelper.NewId(), IssueType = issueType, SourceEntityId = subject,
                SourceFingerprint = fingerprint, ProposedAction = evidence.Decision,
                EvidenceJson = Convert.ToBase64String(evidence.ManifestUtf8), Status = "PENDING_MANAGER_REVIEW",
                Reason = "Business evidence resolution registered.", CreatedBy = actor, CreatedAt = command.NowUtc, Version = 0
            };
            context.Dataqualitydispositions.Add(item);
            var state = Map(item, outcomeId);
            lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                aggregateType, subject, command.CommandId, 0, null, item.Status, actor, 0,
                item.Reason, command.CommandId, null, JsonSerializer.Serialize(state), JsonSerializer.Serialize(state)));
            await context.SaveChangesAsync(token);
            return state;
        }, token => Task.FromResult(lifecycleRecorder.FindExistingCommandAsync(command.CommandId, aggregateType, subject).GetAwaiter().GetResult() is not null),
        System.Data.IsolationLevel.Serializable).GetAwaiter().GetResult();
    }

    public EvidenceResolutionState Review(string issueType, string resolutionId, ResolutionCommandContext command)
        => Transition(issueType, resolutionId, command, "APPROVED", "PENDING_MANAGER_REVIEW", 1);

    public EvidenceResolutionState Apply(string issueType, string resolutionId, ResolutionCommandContext command, DateTime nowUtc)
        => Transition(issueType, resolutionId, command, "APPLIED", "APPROVED", 2, nowUtc);

    private EvidenceResolutionState Transition(
        string issueType,
        string resolutionId,
        ResolutionCommandContext command,
        string target,
        string expectedStatus,
        int sequence,
        DateTime? nowUtc = null)
    {
        var id = Parse(resolutionId, "Resolution ID is invalid.");
        var aggregateType = $"BusinessEvidence:{issueType}";
        var snapshot = context.Dataqualitydispositions.AsNoTracking().SingleOrDefault(item => item.DispositionId.SequenceEqual(id))
            ?? throw new KeyNotFoundException("Business evidence resolution was not found.");
        var subject = snapshot.SourceEntityId;
        var replay = lifecycleRecorder.FindExistingCommandAsync(command.CommandId, aggregateType, subject).GetAwaiter().GetResult();
        if (replay is not null) return Deserialize(replay.ResponseJson);
        return transactionRunner.ExecuteAsync(async token =>
        {
            var item = await context.Dataqualitydispositions.SingleAsync(value => value.DispositionId.SequenceEqual(id), token);
            if (item.Version != command.ExpectedVersion) throw new InvalidOperationException("Resolution version is stale.");
            if (command.CurrentFingerprint is not null && command.CurrentFingerprint != item.SourceFingerprint)
                throw new InvalidOperationException("Current source fingerprint changed after evidence review.");
            if (item.Status != expectedStatus) throw new InvalidOperationException($"Resolution must be {expectedStatus}.");
            var package = await context.Businessevidencepackages.AsNoTracking()
                .SingleAsync(value => value.IssueType == issueType && value.SubjectId.SequenceEqual(item.SourceEntityId) && value.SourceFingerprint == item.SourceFingerprint, token);
            ValidatePersisted(package, nowUtc ?? command.NowUtc);
            var actor = Identity(command.ActorId);
            if (await context.Businessevidenceattestations.AsNoTracking()
                    .AnyAsync(value => value.PackageId.SequenceEqual(package.PackageId) && value.ActorId.SequenceEqual(actor), token))
                throw new InvalidOperationException("Workflow actor must differ from every persisted source-owner attestation actor.");
            if (target == "APPROVED")
            {
                item.Status = target; item.ReviewedBy = actor; item.ReviewedAt = command.NowUtc; item.Version++;
            }
            else
            {
                item.Status = target; item.AppliedBy = actor; item.AppliedAt = command.NowUtc;
                item.CorrectionEntityType = package.OutcomeEntityType ?? nameof(BusinessEvidencePackage);
                item.CorrectionEntityId = package.OutcomeEntityId ?? package.PackageId; item.Version++;
            }
            var state = Map(item, item.CorrectionEntityId is null ? GuidHelper.ToGuidString(package.PackageId) : GuidHelper.ToGuidString(item.CorrectionEntityId));
            lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                aggregateType, subject, command.CommandId, sequence, expectedStatus, target, actor, command.ExpectedVersion,
                "Business evidence workflow transition.", command.CommandId, null, JsonSerializer.Serialize(state), JsonSerializer.Serialize(state)));
            await context.SaveChangesAsync(token);
            return state;
        }, token => Task.FromResult(lifecycleRecorder.FindExistingCommandAsync(command.CommandId, aggregateType, subject).GetAwaiter().GetResult() is not null),
        System.Data.IsolationLevel.Serializable).GetAwaiter().GetResult();
    }

    private static BusinessEvidencePackage ToPackage(string issueType, byte[] subject, EvidencePackageInput input, byte[] packageId, string outcomeId)
    {
        var linkedOutcome = input.OutcomeEntityId ?? (GuidHelper.ParseGuidString(outcomeId) is not null ? outcomeId : null);
        return new BusinessEvidencePackage
        {
            PackageId = packageId, SchemaVersion = 1, IssueType = issueType, SubjectId = subject,
            SourceFingerprint = input.SourceFingerprint, ManifestUtf8 = input.ManifestUtf8, ManifestSha256 = input.ManifestSha256,
            SourceDatabase = "ipcmanagement", MigrationHead = "current", Decision = input.Decision,
            OutcomeEntityType = linkedOutcome is null ? null : "DomainOutcome",
            OutcomeEntityId = linkedOutcome is null ? null : Parse(linkedOutcome, "Outcome ID is invalid."),
            CommandId = input.PackageId, CreatedAtUtc = input.CreatedAtUtc, ExpiresAtUtc = input.ExpiresAtUtc, Version = 0
        };
    }

    private static BusinessEvidenceAttestation ToAttestation(byte[] packageId, EvidencePackageInput input, EvidenceAttestationInput attestation)
        => new()
        {
            AttestationId = GuidHelper.NewId(), PackageId = packageId, AuthoritySlot = attestation.AuthoritySlot,
            ActorId = Identity(attestation.ActorId), AuthorityReference = "redacted", AuthoritySha256 = attestation.ManifestSha256,
            ManifestSha256 = input.ManifestSha256, AttestedAtUtc = attestation.AttestedAtUtc, ExpiresAtUtc = attestation.ExpiresAtUtc
        };

    private static void ValidatePersisted(BusinessEvidencePackage package, DateTime now)
    {
        if (package.ManifestSha256 != Convert.ToHexString(SHA256.HashData(package.ManifestUtf8)))
            throw new InvalidOperationException("Persisted evidence exact-byte digest is invalid.");
        if (package.ExpiresAtUtc is { } expiry && expiry <= now) throw new InvalidOperationException("Persisted evidence package is expired.");
    }

    private static EvidenceResolutionState Map(DataQualityDisposition item, string outcomeId)
        => new(GuidHelper.ToGuidString(item.DispositionId), GuidHelper.ToGuidString(item.SourceEntityId), item.Status,
            item.Version, GuidHelper.ToGuidString(item.CreatedBy), item.ReviewedBy is null ? null : GuidHelper.ToGuidString(item.ReviewedBy),
            item.AppliedBy is null ? null : GuidHelper.ToGuidString(item.AppliedBy), item.ProposedAction, outcomeId,
            item.Status == "PENDING_MANAGER_REVIEW" ? 1 : item.Status == "APPROVED" ? 2 : 3);

    private static EvidenceResolutionState Deserialize(string json)
        => JsonSerializer.Deserialize<EvidenceResolutionState>(json) ?? throw new InvalidOperationException("Durable command receipt is invalid.");

    private static byte[] Parse(string value, string message)
        => GuidHelper.ParseGuidString(value) ?? throw new ArgumentException(message);

    private static byte[] Identity(string value)
        => GuidHelper.ParseGuidString(value) ?? SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value))[..16];
}
