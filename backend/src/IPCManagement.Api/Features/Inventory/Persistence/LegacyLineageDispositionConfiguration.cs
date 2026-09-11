using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Inventory.Persistence;

internal sealed class LegacyLineageDispositionConfiguration : IEntityTypeConfiguration<LegacyLineageDisposition>
{
    public void Configure(EntityTypeBuilder<LegacyLineageDisposition> entity)
    {
        entity.HasKey(item => item.DispositionId).HasName("PRIMARY");
        entity.ToTable("legacylinedispositions", table =>
        {
            table.HasCheckConstraint(
                "ckLegacyLineageDispositionsTypeTarget",
                "(`legacyLineType` = 'ISSUE_LINE' AND `targetMaterialRequestLineId` IS NOT NULL AND `targetIssueLineId` IS NULL) OR (`legacyLineType` = 'RETURN_LINE' AND `targetIssueLineId` IS NOT NULL AND `targetMaterialRequestLineId` IS NULL)");
            table.HasCheckConstraint(
                "ckLegacyLineageDispositionsStatus",
                "`status` IN ('PENDING_MANAGER_REVIEW', 'APPROVED', 'REJECTED', 'APPLIED')");
        });
        entity.HasIndex(item => new { item.LegacyLineType, item.LegacyLineId });
        entity.HasIndex(item => item.TargetMaterialRequestLineId);
        entity.HasIndex(item => item.TargetIssueLineId);
        entity.Property<int?>("OpenDispositionKey")
            .HasColumnName("openDispositionKey")
            .HasComputedColumnSql("CASE WHEN `status` IN ('PENDING_MANAGER_REVIEW', 'APPROVED') THEN 1 ELSE NULL END", stored: false);
        entity.HasIndex("LegacyLineType", "LegacyLineId", "OpenDispositionKey")
            .IsUnique()
            .HasDatabaseName("uxLegacyLineageDispositionsOpenLine");

        entity.Property(item => item.DispositionId).HasMaxLength(16).IsFixedLength().HasColumnName("dispositionId");
        entity.Property(item => item.LegacyLineType).HasMaxLength(32).HasColumnName("legacyLineType");
        entity.Property(item => item.LegacyLineId).HasMaxLength(16).IsFixedLength().HasColumnName("legacyLineId");
        entity.Property(item => item.TargetMaterialRequestLineId).HasMaxLength(16).IsFixedLength().HasColumnName("targetMaterialRequestLineId");
        entity.Property(item => item.TargetIssueLineId).HasMaxLength(16).IsFixedLength().HasColumnName("targetIssueLineId");
        entity.Property(item => item.Status).HasMaxLength(32).HasColumnName("status");
        entity.Property(item => item.Reason).HasMaxLength(1000).HasColumnName("reason");
        entity.Property(item => item.ReviewReason).HasMaxLength(1000).HasColumnName("reviewReason");
        entity.Property(item => item.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(item => item.ReviewedBy).HasMaxLength(16).IsFixedLength().HasColumnName("reviewedBy");
        entity.Property(item => item.ReviewedAt).HasColumnType("datetime").HasColumnName("reviewedAt");
        entity.Property(item => item.AppliedBy).HasMaxLength(16).IsFixedLength().HasColumnName("appliedBy");
        entity.Property(item => item.AppliedAt).HasColumnType("datetime").HasColumnName("appliedAt");
        entity.Property(item => item.Version).IsConcurrencyToken().HasDefaultValue(0L).HasColumnName("version");

        entity.HasOne<User>().WithMany().HasForeignKey(item => item.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.ReviewedBy).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.AppliedBy).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<MaterialRequestLine>().WithMany().HasForeignKey(item => item.TargetMaterialRequestLineId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<InventoryIssueLine>().WithMany().HasForeignKey(item => item.TargetIssueLineId).OnDelete(DeleteBehavior.Restrict);
    }
}
