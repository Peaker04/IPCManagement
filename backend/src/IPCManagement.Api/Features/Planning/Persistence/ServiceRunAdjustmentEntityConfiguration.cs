using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Planning.Persistence;

internal sealed class ServiceRunAdjustmentConfiguration : IEntityTypeConfiguration<ServiceRunAdjustment>
{
    public void Configure(EntityTypeBuilder<ServiceRunAdjustment> entity)
    {
        entity.HasKey(item => item.ServiceRunAdjustmentId).HasName("PRIMARY");
        entity.ToTable("servicerunadjustments");
        entity.HasIndex(item => new { item.ServiceRunId, item.CreatedAt }, "ixServiceRunAdjustmentsRunCreatedAt");
        entity.Property(item => item.ServiceRunAdjustmentId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunAdjustmentId");
        entity.Property(item => item.ServiceRunId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunId");
        entity.Property(item => item.CorrectedActualServings).HasColumnName("correctedActualServings");
        entity.Property(item => item.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(item => item.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.HasOne(item => item.ServiceRun).WithMany().HasForeignKey(item => item.ServiceRunId)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunAdjustmentsRun");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunAdjustmentsCreatedBy");
    }
}
