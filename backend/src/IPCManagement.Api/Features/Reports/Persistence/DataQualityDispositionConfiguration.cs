using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Reports.Persistence;

internal sealed class DataQualityDispositionConfiguration : IEntityTypeConfiguration<DataQualityDisposition>
{
    public void Configure(EntityTypeBuilder<DataQualityDisposition> entity)
    {
        entity.HasKey(item => item.DispositionId).HasName("PRIMARY");
        entity.ToTable("dataqualitydispositions", table =>
        {
            table.HasCheckConstraint(
                "ckDataQualityDispositionStatus",
                "`status` IN ('PENDING_MANAGER_REVIEW','APPROVED','REJECTED','BLOCKED_BUSINESS','APPLIED')");
        });
        entity.HasIndex(
                item => new { item.IssueType, item.SourceEntityId, item.SourceFingerprint },
                "uqDataQualityDispositionSourceFingerprint")
            .IsUnique();
        entity.HasIndex(item => new { item.Status, item.CreatedAt }, "ixDataQualityDispositionQueue");

        entity.Property(item => item.DispositionId).HasMaxLength(16).IsFixedLength().HasColumnName("dispositionId");
        entity.Property(item => item.IssueType).HasMaxLength(50).HasColumnName("issueType");
        entity.Property(item => item.SourceEntityId).HasMaxLength(16).IsFixedLength().HasColumnName("sourceEntityId");
        entity.Property(item => item.SourceFingerprint).HasMaxLength(64).HasColumnName("sourceFingerprint");
        entity.Property(item => item.ProposedAction).HasMaxLength(80).HasColumnName("proposedAction");
        entity.Property(item => item.EvidenceJson).HasColumnType("longtext").HasColumnName("evidenceJson");
        entity.Property(item => item.Status).HasMaxLength(30).HasDefaultValue("PENDING_MANAGER_REVIEW").HasColumnName("status");
        entity.Property(item => item.Reason).HasMaxLength(1000).HasColumnName("reason");
        entity.Property(item => item.ReviewReason).HasMaxLength(1000).HasColumnName("reviewReason");
        entity.Property(item => item.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(item => item.ReviewedBy).HasMaxLength(16).IsFixedLength().HasColumnName("reviewedBy");
        entity.Property(item => item.ReviewedAt).HasColumnType("datetime").HasColumnName("reviewedAt");
        entity.Property(item => item.AppliedBy).HasMaxLength(16).IsFixedLength().HasColumnName("appliedBy");
        entity.Property(item => item.AppliedAt).HasColumnType("datetime").HasColumnName("appliedAt");
        entity.Property(item => item.CorrectionEntityType).HasMaxLength(80).HasColumnName("correctionEntityType");
        entity.Property(item => item.CorrectionEntityId).HasMaxLength(16).IsFixedLength().HasColumnName("correctionEntityId");
        entity.Property(item => item.Version).IsConcurrencyToken().HasDefaultValue(0L).HasColumnName("version");
    }
}
