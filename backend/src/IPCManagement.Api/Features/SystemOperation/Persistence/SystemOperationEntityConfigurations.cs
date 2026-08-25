using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.SystemOperation.Persistence;

internal sealed class SystemOperationModeConfiguration : IEntityTypeConfiguration<SystemOperationMode>
{
    public void Configure(EntityTypeBuilder<SystemOperationMode> entity)
    {
        entity.ToTable("systemoperationmodes", table =>
        {
            table.HasCheckConstraint("ckSystemOperationModesSingleton", "`id` = 1");
            table.HasCheckConstraint("ckSystemOperationModesToken", "`mode` IN ('DEFAULT','MATERIAL_RECONCILIATION')");
        });
        entity.HasKey(item => item.Id);
        entity.Property(item => item.Id).ValueGeneratedNever().HasColumnName("id");
        entity.Property(item => item.Mode).HasMaxLength(32).HasColumnName("mode");
        entity.Property(item => item.Version).IsConcurrencyToken().HasColumnName("version");
        entity.Property(item => item.UpdatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("updatedBy");
        entity.Property(item => item.UpdatedAt).HasColumnType("datetime").HasColumnName("updatedAt");
        entity.Property(item => item.Reason).HasMaxLength(1000).HasColumnName("reason");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.UpdatedBy).OnDelete(DeleteBehavior.Restrict);
    }
}
