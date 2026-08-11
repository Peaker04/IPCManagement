using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Planning.Persistence;

internal sealed class ServiceRunVarianceDeclarationConfiguration : IEntityTypeConfiguration<ServiceRunVarianceDeclaration>
{
    public void Configure(EntityTypeBuilder<ServiceRunVarianceDeclaration> entity)
    {
        entity.HasKey(item => item.ServiceRunVarianceDeclarationId).HasName("PRIMARY");
        entity.ToTable("servicerunvariancedeclarations");
        entity.HasIndex(item => new { item.ServiceRunId, item.DeclaredAt }, "ixServiceRunVarianceDeclarationsRunDeclaredAt");
        entity.Property(item => item.ServiceRunVarianceDeclarationId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunVarianceDeclarationId");
        entity.Property(item => item.ServiceRunId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunId");
        entity.Property(item => item.Track).HasMaxLength(32).HasColumnName("track");
        entity.Property(item => item.SourceLineEvidenceJson).HasColumnType("longtext").HasColumnName("sourceLineEvidenceJson");
        entity.Property(item => item.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(item => item.DeclaredBy).HasMaxLength(16).IsFixedLength().HasColumnName("declaredBy");
        entity.Property(item => item.DeclaredAt).HasColumnType("datetime").HasColumnName("declaredAt");
        entity.HasOne(item => item.ServiceRun).WithMany().HasForeignKey(item => item.ServiceRunId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ServiceRunVarianceWaiverConfiguration : IEntityTypeConfiguration<ServiceRunVarianceWaiver>
{
    public void Configure(EntityTypeBuilder<ServiceRunVarianceWaiver> entity)
    {
        entity.HasKey(item => item.ServiceRunVarianceWaiverId).HasName("PRIMARY");
        entity.ToTable("servicerunvariancewaivers");
        entity.HasIndex(item => item.ServiceRunVarianceDeclarationId, "uqServiceRunVarianceWaiverDeclaration").IsUnique();
        entity.Property(item => item.ServiceRunVarianceWaiverId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunVarianceWaiverId");
        entity.Property(item => item.ServiceRunVarianceDeclarationId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunVarianceDeclarationId");
        entity.Property(item => item.ApprovedBy).HasMaxLength(16).IsFixedLength().HasColumnName("approvedBy");
        entity.Property(item => item.ApprovedAt).HasColumnType("datetime").HasColumnName("approvedAt");
        entity.Property(item => item.Reason).HasColumnType("text").HasColumnName("reason");
        entity.HasOne(item => item.Declaration).WithMany().HasForeignKey(item => item.ServiceRunVarianceDeclarationId).OnDelete(DeleteBehavior.Restrict);
    }
}
