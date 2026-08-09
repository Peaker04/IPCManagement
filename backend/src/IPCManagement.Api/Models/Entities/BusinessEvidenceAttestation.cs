namespace IPCManagement.Api.Models.Entities;

public sealed class BusinessEvidenceAttestation
{
    public byte[] AttestationId { get; set; } = null!;
    public byte[] PackageId { get; set; } = null!;
    public string AuthoritySlot { get; set; } = null!;
    public byte[] ActorId { get; set; } = null!;
    public string AuthorityReference { get; set; } = null!;
    public string AuthoritySha256 { get; set; } = null!;
    public string ManifestSha256 { get; set; } = null!;
    public DateTime AttestedAtUtc { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }

    public BusinessEvidencePackage Package { get; set; } = null!;
}
