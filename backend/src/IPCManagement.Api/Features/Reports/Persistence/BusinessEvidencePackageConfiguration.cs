using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace IPCManagement.Api.Features.Reports.Persistence;

internal sealed class BusinessEvidencePackageConfiguration : IEntityTypeConfiguration<BusinessEvidencePackage>
{
    internal static readonly ValueConverter<DateTime, DateTime> UtcDateTime = new(
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

    internal static readonly ValueConverter<DateTime?, DateTime?> NullableUtcDateTime = new(
        value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null,
        value => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null);

    public void Configure(EntityTypeBuilder<BusinessEvidencePackage> entity)
    {
        entity.HasKey(item => item.PackageId).HasName("PRIMARY");
        entity.ToTable("businessevidencepackages");
        entity.HasIndex(item => item.CommandId, "uqBusinessEvidencePackageCommand").IsUnique();
        entity.HasIndex(item => new { item.IssueType, item.SubjectId, item.SourceFingerprint },
            "ixBusinessEvidencePackageSubjectFingerprint");

        entity.Property(item => item.PackageId).HasMaxLength(16).IsFixedLength().HasColumnName("packageId");
        entity.Property(item => item.SchemaVersion).HasColumnName("schemaVersion");
        entity.Property(item => item.IssueType).HasMaxLength(50).HasColumnName("issueType");
        entity.Property(item => item.SubjectId).HasMaxLength(16).IsFixedLength().HasColumnName("subjectId");
        entity.Property(item => item.SourceFingerprint).HasMaxLength(64).HasColumnName("sourceFingerprint");
        entity.Property(item => item.ManifestUtf8).HasColumnType("longblob").HasColumnName("manifestUtf8");
        entity.Property(item => item.ManifestSha256).HasMaxLength(64).HasColumnName("manifestSha256");
        entity.Property(item => item.SourceDatabase).HasMaxLength(80).HasColumnName("sourceDatabase");
        entity.Property(item => item.MigrationHead).HasMaxLength(180).HasColumnName("migrationHead");
        entity.Property(item => item.Decision).HasMaxLength(50).HasColumnName("decision");
        entity.Property(item => item.OutcomeEntityType).HasMaxLength(80).HasColumnName("outcomeEntityType");
        entity.Property(item => item.OutcomeEntityId).HasMaxLength(16).IsFixedLength().HasColumnName("outcomeEntityId");
        entity.Property(item => item.CommandId).HasMaxLength(100).HasColumnName("commandId");
        entity.Property(item => item.CreatedAtUtc).HasConversion(UtcDateTime).HasColumnType("datetime").HasColumnName("createdAtUtc");
        entity.Property(item => item.ExpiresAtUtc).HasConversion(NullableUtcDateTime).HasColumnType("datetime").HasColumnName("expiresAtUtc");
        entity.Property(item => item.Version).IsConcurrencyToken().HasDefaultValue(0L).HasColumnName("version");

        foreach (var property in entity.Metadata.GetProperties().Where(property => property.Name != nameof(BusinessEvidencePackage.Version)))
        {
            property.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        }
    }
}

internal sealed class BusinessEvidenceAttestationConfiguration : IEntityTypeConfiguration<BusinessEvidenceAttestation>
{
    public void Configure(EntityTypeBuilder<BusinessEvidenceAttestation> entity)
    {
        entity.HasKey(item => item.AttestationId).HasName("PRIMARY");
        entity.ToTable("businessevidenceattestations");
        entity.HasIndex(item => new { item.PackageId, item.AuthoritySlot },
            "uqBusinessEvidenceAttestationSlot").IsUnique();

        entity.Property(item => item.AttestationId).HasMaxLength(16).IsFixedLength().HasColumnName("attestationId");
        entity.Property(item => item.PackageId).HasMaxLength(16).IsFixedLength().HasColumnName("packageId");
        entity.Property(item => item.AuthoritySlot).HasMaxLength(60).HasColumnName("authoritySlot");
        entity.Property(item => item.ActorId).HasMaxLength(16).IsFixedLength().HasColumnName("actorId");
        entity.Property(item => item.AuthorityReference).HasMaxLength(500).HasColumnName("authorityReference");
        entity.Property(item => item.AuthoritySha256).HasMaxLength(64).HasColumnName("authoritySha256");
        entity.Property(item => item.ManifestSha256).HasMaxLength(64).HasColumnName("manifestSha256");
        entity.Property(item => item.AttestedAtUtc).HasConversion(BusinessEvidencePackageConfiguration.UtcDateTime).HasColumnType("datetime").HasColumnName("attestedAtUtc");
        entity.Property(item => item.ExpiresAtUtc).HasConversion(BusinessEvidencePackageConfiguration.NullableUtcDateTime).HasColumnType("datetime").HasColumnName("expiresAtUtc");

        entity.HasOne(item => item.Package)
            .WithMany(package => package.Attestations)
            .HasForeignKey(item => item.PackageId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("fkBusinessEvidenceAttestationPackage");

        foreach (var property in entity.Metadata.GetProperties())
        {
            property.SetAfterSaveBehavior(PropertySaveBehavior.Throw);
        }
    }
}
