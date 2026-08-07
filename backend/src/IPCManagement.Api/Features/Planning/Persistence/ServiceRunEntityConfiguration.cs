using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Planning.Persistence;

internal sealed class ServiceRunConfiguration : IEntityTypeConfiguration<ServiceRun>
{
    public void Configure(EntityTypeBuilder<ServiceRun> entity)
    {
        entity.HasKey(item => item.ServiceRunId).HasName("PRIMARY");
        entity.ToTable("serviceruns", table =>
        {
            table.HasCheckConstraint("ckServiceRunsConfirmationOutcome", "`serviceConfirmedAt` IS NULL OR `serviceConfirmationWaivedAt` IS NULL");
            table.HasCheckConstraint("ckServiceRunsConfirmationPolicy", "`serviceConfirmationPolicy` IN ('REQUIRED', 'WAIVABLE')");
        });
        entity.HasIndex(item => new { item.PlanId, item.ShiftName }, "uqServiceRunsPlanShift").IsUnique();
        entity.HasIndex(item => new { item.Status, item.UpdatedAt }, "ixServiceRunsStatusUpdatedAt");

        entity.Property(item => item.ServiceRunId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunId");
        entity.Property(item => item.PlanId).HasMaxLength(16).IsFixedLength().HasColumnName("planId");
        entity.Property(item => item.ShiftName).HasColumnType("enum('MORNING','AFTERNOON')").HasColumnName("shiftName");
        entity.Property(item => item.Status).HasMaxLength(40).HasDefaultValue("PLANNED").HasColumnName("status");
        entity.Property(item => item.ActualServings).HasColumnName("actualServings");
        entity.Property(item => item.ActualServingsReason).HasColumnType("text").HasColumnName("actualServingsReason");
        entity.Property(item => item.ActualServingsRecordedAt).HasColumnType("datetime").HasColumnName("actualServingsRecordedAt");
        entity.Property(item => item.ActualServingsRecordedBy).HasMaxLength(16).IsFixedLength().HasColumnName("actualServingsRecordedBy");
        entity.Property(item => item.ServingVarianceResolvedAt).HasColumnType("datetime").HasColumnName("servingVarianceResolvedAt");
        entity.Property(item => item.ServingVarianceResolvedBy).HasMaxLength(16).IsFixedLength().HasColumnName("servingVarianceResolvedBy");
        entity.Property(item => item.ServingVarianceResolutionReason).HasColumnType("text").HasColumnName("servingVarianceResolutionReason");
        entity.Property(item => item.ServiceConfirmationPolicy).HasMaxLength(20).HasDefaultValue("WAIVABLE").HasColumnName("serviceConfirmationPolicy");
        entity.Property(item => item.ServiceConfirmedAt).HasColumnType("datetime").HasColumnName("serviceConfirmedAt");
        entity.Property(item => item.ServiceConfirmedBy).HasMaxLength(16).IsFixedLength().HasColumnName("serviceConfirmedBy");
        entity.Property(item => item.ServiceConfirmationWaivedAt).HasColumnType("datetime").HasColumnName("serviceConfirmationWaivedAt");
        entity.Property(item => item.ServiceConfirmationWaivedBy).HasMaxLength(16).IsFixedLength().HasColumnName("serviceConfirmationWaivedBy");
        entity.Property(item => item.ServiceConfirmationWaiverReason).HasColumnType("text").HasColumnName("serviceConfirmationWaiverReason");
        entity.Property(item => item.VarianceResolvedAt).HasColumnType("datetime").HasColumnName("varianceResolvedAt");
        entity.Property(item => item.VarianceResolvedBy).HasMaxLength(16).IsFixedLength().HasColumnName("varianceResolvedBy");
        entity.Property(item => item.VarianceResolutionReason).HasColumnType("text").HasColumnName("varianceResolutionReason");
        entity.Property(item => item.StartedAt).HasColumnType("datetime").HasColumnName("startedAt");
        entity.Property(item => item.StartedBy).HasMaxLength(16).IsFixedLength().HasColumnName("startedBy");
        entity.Property(item => item.ClosedAt).HasColumnType("datetime").HasColumnName("closedAt");
        entity.Property(item => item.ClosedBy).HasMaxLength(16).IsFixedLength().HasColumnName("closedBy");
        entity.Property(item => item.CloseSnapshotJson).HasColumnType("longtext").HasColumnName("closeSnapshotJson");
        entity.Property(item => item.OpenedBy).HasMaxLength(16).IsFixedLength().HasColumnName("openedBy");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(item => item.UpdatedAt).HasColumnType("datetime").HasColumnName("updatedAt");

        entity.HasOne(item => item.Plan).WithMany().HasForeignKey(item => item.PlanId)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsPlan");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.OpenedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsOpenedBy");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.ActualServingsRecordedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsActualServingsRecordedBy");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.ServingVarianceResolvedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsServingVarianceResolvedBy");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.ServiceConfirmedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsServiceConfirmedBy");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.ServiceConfirmationWaivedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsConfirmationWaivedBy");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.ClosedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsClosedBy");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.VarianceResolvedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsVarianceResolvedBy");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.StartedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsStartedBy");
    }
}
