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
        // Existing foreign keys still reference this alternate key. Keep it while the
        // scoped identity is introduced so legacy rows and referential integrity remain intact.
        entity.HasIndex(item => new { item.PlanId, item.ShiftName }, "uqServiceRunsPlanShift").IsUnique();
        entity.HasIndex(item => new { item.CustomerId, item.ServiceDate, item.ShiftName, item.PriceTierAmount }, "uqServiceRunsCustomerDateShiftTier").IsUnique();
        entity.HasIndex(item => new { item.Status, item.UpdatedAt }, "ixServiceRunsStatusUpdatedAt");

        entity.Property(item => item.ServiceRunId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunId");
        entity.Property(item => item.PlanId).HasMaxLength(16).IsFixedLength().HasColumnName("planId");
        entity.Property(item => item.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(item => item.ServiceDate).HasColumnName("serviceDate");
        entity.Property(item => item.ShiftName).HasColumnType("enum('MORNING','AFTERNOON')").HasColumnName("shiftName");
        entity.Property(item => item.PriceTierAmount).HasPrecision(18, 2).HasColumnName("priceTierAmount");
        entity.Property(item => item.ConcurrencyVersion).IsConcurrencyToken().HasDefaultValue(0L).HasColumnName("concurrencyVersion");
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
        entity.HasOne<Customer>().WithMany().HasForeignKey(item => item.CustomerId)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("fkServiceRunsCustomer");
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

internal sealed class ServiceRunSourceLineConfiguration : IEntityTypeConfiguration<ServiceRunSourceLine>
{
    public void Configure(EntityTypeBuilder<ServiceRunSourceLine> entity)
    {
        entity.HasKey(item => item.ServiceRunSourceLineId).HasName("PRIMARY");
        entity.ToTable("servicerunsourcelines");
        entity.HasIndex(item => new { item.ServiceRunId, item.MaterialRequestLineId }, "uqServiceRunSourceLinesRunLine").IsUnique();
        entity.Property(item => item.ServiceRunSourceLineId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunSourceLineId");
        entity.Property(item => item.ServiceRunId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunId");
        entity.Property(item => item.MaterialRequestLineId).HasMaxLength(16).IsFixedLength().HasColumnName("materialRequestLineId");
        entity.Property(item => item.RecordedAt).HasColumnType("datetime").HasColumnName("recordedAt");
        entity.HasOne(item => item.ServiceRun).WithMany(item => item.SourceLines).HasForeignKey(item => item.ServiceRunId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(item => item.MaterialRequestLine).WithMany().HasForeignKey(item => item.MaterialRequestLineId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ServiceRunDecisionItemConfiguration : IEntityTypeConfiguration<ServiceRunDecisionItem>
{
    public void Configure(EntityTypeBuilder<ServiceRunDecisionItem> entity)
    {
        entity.HasKey(item => item.ServiceRunDecisionItemId).HasName("PRIMARY");
        entity.ToTable("servicerundecisionitems");
        entity.HasIndex(item => new { item.PlanId, item.ShiftName, item.Reason }, "ixServiceRunDecisionItemsPlanShiftReason");
        entity.Property(item => item.ServiceRunDecisionItemId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunDecisionItemId");
        entity.Property(item => item.PlanId).HasMaxLength(16).IsFixedLength().HasColumnName("planId");
        entity.Property(item => item.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(item => item.ServiceDate).HasColumnName("serviceDate");
        entity.Property(item => item.ShiftName).HasMaxLength(20).HasColumnName("shiftName");
        entity.Property(item => item.PriceTierAmount).HasPrecision(18, 2).HasColumnName("priceTierAmount");
        entity.Property(item => item.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
    }
}
