namespace IPCManagement.Api.Models.Entities;

public sealed class BusinessEvidencePackage
{
    public byte[] PackageId { get; set; } = null!;
    public int SchemaVersion { get; set; }
    public string IssueType { get; set; } = null!;
    public byte[] SubjectId { get; set; } = null!;
    public string SourceFingerprint { get; set; } = null!;
    public byte[] ManifestUtf8 { get; set; } = null!;
    public string ManifestSha256 { get; set; } = null!;
    public string SourceDatabase { get; set; } = null!;
    public string MigrationHead { get; set; } = null!;
    public string Decision { get; set; } = null!;
    public string? OutcomeEntityType { get; set; }
    public byte[]? OutcomeEntityId { get; set; }
    public string CommandId { get; set; } = null!;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
    public long Version { get; set; }

    public ICollection<BusinessEvidenceAttestation> Attestations { get; set; } = [];
}
