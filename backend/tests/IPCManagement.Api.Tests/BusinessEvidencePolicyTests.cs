using System.Text;
using FluentAssertions;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public sealed class BusinessEvidencePolicyTests
{
    private static readonly DateTime NowUtc = new(2026, 8, 10, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void ExactManifestBytes_AreTheSignedPayload()
    {
        var persistedBytes = Encoding.UTF8.GetBytes("{\"schemaVersion\":1,\"rows\":[\"A\"]}");
        var changedBytes = Encoding.UTF8.GetBytes("{ \"schemaVersion\":1,\"rows\":[\"A\"]}");

        var persistedDigest = BusinessEvidencePolicy.ComputeManifestSha256(persistedBytes);

        persistedDigest.Should().HaveLength(64);
        BusinessEvidencePolicy.ComputeManifestSha256(changedBytes).Should().NotBe(persistedDigest);
    }

    [Fact]
    public void MovementEnvelope_RequiresCurrentFingerprintIssueSourcesAndDistinctOwners()
    {
        var manifestBytes = Encoding.UTF8.GetBytes("{\"schemaVersion\":1,\"subjectId\":\"movement-1\"}");
        var manifestDigest = BusinessEvidencePolicy.ComputeManifestSha256(manifestBytes);
        var fingerprint = new string('A', 64);
        var package = CreatePackage(manifestBytes, manifestDigest, fingerprint);
        var envelope = CreateEnvelope(package, fingerprint,
        [
            new("LEDGER", "ledger/ref/1", new string('1', 64)),
            new("RECEIPT", "receipt/ref/1", new string('2', 64)),
            new("STOCK_SNAPSHOT", "stock/ref/1", new string('3', 64))
        ]);
        var warehouse = CreateAttestation(package, "WAREHOUSE_SOURCE_OWNER", "warehouse-authority", NowUtc.AddHours(1));
        var finance = CreateAttestation(package, "FINANCE_SOURCE_OWNER", "finance-authority", NowUtc.AddHours(1));

        var act = () => BusinessEvidencePolicy.Validate(
            envelope, package, [warehouse, finance], fingerprint, NowUtc);

        act.Should().NotThrow();

        var stale = () => BusinessEvidencePolicy.Validate(
            envelope, package, [warehouse, finance], new string('B', 64), NowUtc);
        stale.Should().Throw<InvalidOperationException>().WithMessage("*stale*");

        finance.ActorId = warehouse.ActorId;
        var sharedActor = () => BusinessEvidencePolicy.Validate(
            envelope, package, [warehouse, finance], fingerprint, NowUtc);
        sharedActor.Should().Throw<InvalidOperationException>().WithMessage("*different actors*");
    }

    [Fact]
    public void Attestation_RejectsPlaceholderExpiredOrUnsignedAuthority()
    {
        var manifestBytes = Encoding.UTF8.GetBytes("{\"schemaVersion\":1,\"subjectId\":\"movement-1\"}");
        var manifestDigest = BusinessEvidencePolicy.ComputeManifestSha256(manifestBytes);
        var fingerprint = new string('A', 64);
        var package = CreatePackage(manifestBytes, manifestDigest, fingerprint);
        var envelope = CreateEnvelope(package, fingerprint,
        [
            new("LEDGER", "ledger/ref/1", new string('1', 64)),
            new("RECEIPT", "receipt/ref/1", new string('2', 64)),
            new("STOCK_SNAPSHOT", "stock/ref/1", new string('3', 64))
        ]);
        var warehouse = CreateAttestation(package, "WAREHOUSE_SOURCE_OWNER", "warehouse-authority", NowUtc.AddHours(1));
        var finance = CreateAttestation(package, "FINANCE_SOURCE_OWNER", "finance-authority", NowUtc.AddHours(1));
        finance.ActorId = new byte[16];

        var placeholder = () => BusinessEvidencePolicy.Validate(
            envelope, package, [warehouse, finance], fingerprint, NowUtc);
        placeholder.Should().Throw<InvalidOperationException>().WithMessage("*placeholder*");

        finance.ActorId = GuidHelper.NewId();
        finance.ExpiresAtUtc = NowUtc.AddSeconds(-1);
        var expired = () => BusinessEvidencePolicy.Validate(
            envelope, package, [warehouse, finance], fingerprint, NowUtc);
        expired.Should().Throw<InvalidOperationException>().WithMessage("*expired*");

        finance.ExpiresAtUtc = NowUtc.AddHours(1);
        finance.AuthoritySha256 = new string('0', 64);
        var unsignedAuthority = () => BusinessEvidencePolicy.Validate(
            envelope, package, [warehouse, finance], fingerprint, NowUtc);
        unsignedAuthority.Should().Throw<InvalidOperationException>().WithMessage("*authority*");
    }

    [Fact]
    public void Package_RequiresInitialOptimisticVersionAndDurableCommandIdentity()
    {
        var manifestBytes = Encoding.UTF8.GetBytes("{\"schemaVersion\":1,\"subjectId\":\"movement-1\"}");
        var manifestDigest = BusinessEvidencePolicy.ComputeManifestSha256(manifestBytes);
        var fingerprint = new string('A', 64);
        var package = CreatePackage(manifestBytes, manifestDigest, fingerprint);
        var envelope = CreateEnvelope(package, fingerprint,
        [
            new("LEDGER", "ledger/ref/1", new string('1', 64)),
            new("RECEIPT", "receipt/ref/1", new string('2', 64)),
            new("STOCK_SNAPSHOT", "stock/ref/1", new string('3', 64))
        ]);
        var attestations = new[]
        {
            CreateAttestation(package, "WAREHOUSE_SOURCE_OWNER", "warehouse-authority", NowUtc.AddHours(1)),
            CreateAttestation(package, "FINANCE_SOURCE_OWNER", "finance-authority", NowUtc.AddHours(1))
        };

        package.CommandId = " ";
        var missingCommand = () => BusinessEvidencePolicy.Validate(
            envelope, package, attestations, fingerprint, NowUtc);
        missingCommand.Should().Throw<ArgumentException>().WithMessage("*CommandId*");

        package.CommandId = "business-evidence-create-1";
        package.Version = 1;
        var nonInitialVersion = () => BusinessEvidencePolicy.Validate(
            envelope, package, attestations, fingerprint, NowUtc);
        nonInitialVersion.Should().Throw<InvalidOperationException>().WithMessage("*version 0*");
    }

    [Fact]
    public void CorrectionEnvelope_MustLinkTheExactPersistedOutcome()
    {
        var manifestBytes = Encoding.UTF8.GetBytes("{\"schemaVersion\":1,\"subjectId\":\"movement-1\"}");
        var manifestDigest = BusinessEvidencePolicy.ComputeManifestSha256(manifestBytes);
        var fingerprint = new string('A', 64);
        var package = CreatePackage(manifestBytes, manifestDigest, fingerprint);
        package.Decision = "CORRECTED";
        package.OutcomeEntityType = "StockMovement";
        package.OutcomeEntityId = GuidHelper.NewId();
        var envelope = CreateEnvelope(package, fingerprint,
        [
            new("LEDGER", "ledger/ref/1", new string('1', 64)),
            new("RECEIPT", "receipt/ref/1", new string('2', 64)),
            new("STOCK_SNAPSHOT", "stock/ref/1", new string('3', 64))
        ]);
        var attestations = new[]
        {
            CreateAttestation(package, "WAREHOUSE_SOURCE_OWNER", "warehouse-authority", NowUtc.AddHours(1)),
            CreateAttestation(package, "FINANCE_SOURCE_OWNER", "finance-authority", NowUtc.AddHours(1))
        };

        var mismatchedEnvelope = envelope with { OutcomeEntityId = Guid.NewGuid().ToString() };
        var act = () => BusinessEvidencePolicy.Validate(
            mismatchedEnvelope, package, attestations, fingerprint, NowUtc);

        act.Should().Throw<InvalidOperationException>().WithMessage("*outcome*");
    }

    private static BusinessEvidencePackage CreatePackage(byte[] manifestBytes, string manifestDigest, string fingerprint) => new()
    {
        PackageId = GuidHelper.NewId(),
        SchemaVersion = 1,
        IssueType = "STOCK_MOVEMENT_BALANCE",
        SubjectId = GuidHelper.NewId(),
        SourceFingerprint = fingerprint,
        ManifestUtf8 = manifestBytes,
        ManifestSha256 = manifestDigest,
        SourceDatabase = "ipcmanagement",
        MigrationHead = "20260810030000_AddDataQualityDispositions",
        Decision = "RESOLVED_NO_CHANGE",
        CommandId = "business-evidence-create-1",
        CreatedAtUtc = NowUtc,
        ExpiresAtUtc = NowUtc.AddHours(2),
        Version = 0
    };

    private static BusinessEvidenceEnvelopeDto CreateEnvelope(
        BusinessEvidencePackage package,
        string fingerprint,
        IReadOnlyList<BusinessEvidenceSourceReferenceDto> sources) => new(
            1,
            GuidHelper.ToGuidString(package.PackageId),
            package.IssueType,
            GuidHelper.ToGuidString(package.SubjectId),
            fingerprint,
            package.SourceDatabase,
            package.MigrationHead,
            package.CreatedAtUtc,
            package.ExpiresAtUtc,
            sources,
            package.Decision,
            package.OutcomeEntityType,
            package.OutcomeEntityId is null ? null : GuidHelper.ToGuidString(package.OutcomeEntityId));

    private static BusinessEvidenceAttestation CreateAttestation(
        BusinessEvidencePackage package,
        string slot,
        string authorityReference,
        DateTime expiresAtUtc) => new()
        {
            AttestationId = GuidHelper.NewId(),
            PackageId = package.PackageId,
            AuthoritySlot = slot,
            ActorId = GuidHelper.NewId(),
            AuthorityReference = authorityReference,
            AuthoritySha256 = BusinessEvidencePolicy.ComputeManifestSha256(Encoding.UTF8.GetBytes(authorityReference)),
            ManifestSha256 = package.ManifestSha256,
            AttestedAtUtc = NowUtc.AddMinutes(-5),
            ExpiresAtUtc = expiresAtUtc
        };
}
