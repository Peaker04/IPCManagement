using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Reports.Persistence;

internal sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> entity)
    {
        entity.HasKey(e => e.AuditId).HasName("PRIMARY");
        entity.ToTable("auditlogs");
        entity.HasIndex(e => new { e.ChangedBy, e.ChangedAt }, "ixAuditLogsChangedBy");
        entity.Property(e => e.AuditId).HasMaxLength(16).IsFixedLength().HasColumnName("auditId");
        entity.Property(e => e.BusinessArea).HasMaxLength(100).HasColumnName("businessArea");
        entity.Property(e => e.ChangedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("changedAt");
        entity.Property(e => e.ChangedBy).HasMaxLength(16).IsFixedLength().HasColumnName("changedBy");
        entity.Property(e => e.EntityId).HasMaxLength(16).IsFixedLength().HasColumnName("entityId");
        entity.Property(e => e.EntityName).HasMaxLength(100).HasColumnName("entityName");
        entity.Property(e => e.FieldName).HasMaxLength(100).HasColumnName("fieldName");
        entity.Property(e => e.NewValue).HasColumnType("text").HasColumnName("newValue");
        entity.Property(e => e.OldValue).HasColumnType("text").HasColumnName("oldValue");
        entity.Property(e => e.Reason).HasColumnType("text").HasColumnName("reason");

        entity.HasOne(d => d.ChangedByNavigation).WithMany(p => p.Auditlogs)
            .HasForeignKey(d => d.ChangedBy)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("auditlogs_ibfk_1");
    }
}
