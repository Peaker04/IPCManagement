using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.SampleData.Persistence;

internal sealed class MenuAmendmentConfiguration : IEntityTypeConfiguration<MenuAmendment>
{
    public void Configure(EntityTypeBuilder<MenuAmendment> entity)
    {
        entity.HasKey(item => item.MenuAmendmentId).HasName("PRIMARY");
        entity.ToTable("menuamendments");
        entity.HasIndex(item => new { item.CustomerId, item.WeekStartDate, item.Status }, "ixMenuAmendmentsScopeStatus");
        entity.Property(item => item.MenuAmendmentId).HasMaxLength(16).IsFixedLength().HasColumnName("menuAmendmentId");
        entity.Property(item => item.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(item => item.WeekStartDate).HasColumnName("weekStartDate");
        entity.Property(item => item.BaseMenuVersionId).HasMaxLength(16).IsFixedLength().HasColumnName("baseMenuVersionId");
        entity.Property(item => item.Status).HasMaxLength(40).HasColumnName("status");
        entity.Property(item => item.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(item => item.ImpactSnapshotJson).HasColumnType("longtext").HasColumnName("impactSnapshotJson");
        entity.Property(item => item.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(item => item.ReviewedBy).HasMaxLength(16).IsFixedLength().HasColumnName("reviewedBy");
        entity.Property(item => item.ReviewedAt).HasColumnType("datetime").HasColumnName("reviewedAt");
        entity.Property(item => item.ExecutedBy).HasMaxLength(16).IsFixedLength().HasColumnName("executedBy");
        entity.Property(item => item.ExecutedAt).HasColumnType("datetime").HasColumnName("executedAt");
        entity.HasOne(item => item.Customer).WithMany().HasForeignKey(item => item.CustomerId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(item => item.BaseMenuVersion).WithMany().HasForeignKey(item => item.BaseMenuVersionId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(item => item.CreatedByNavigation).WithMany().HasForeignKey(item => item.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(item => item.ReviewedByNavigation).WithMany().HasForeignKey(item => item.ReviewedBy).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(item => item.ExecutedByNavigation).WithMany().HasForeignKey(item => item.ExecutedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class MenuAmendmentLineConfiguration : IEntityTypeConfiguration<MenuAmendmentLine>
{
    public void Configure(EntityTypeBuilder<MenuAmendmentLine> entity)
    {
        entity.HasKey(item => item.MenuAmendmentLineId).HasName("PRIMARY");
        entity.ToTable("menuamendmentlines");
        entity.HasIndex(item => new { item.MenuAmendmentId, item.ServiceDate, item.ShiftName, item.DishSlot }, "uqMenuAmendmentLinesScope").IsUnique();
        entity.Property(item => item.MenuAmendmentLineId).HasMaxLength(16).IsFixedLength().HasColumnName("menuAmendmentLineId");
        entity.Property(item => item.MenuAmendmentId).HasMaxLength(16).IsFixedLength().HasColumnName("menuAmendmentId");
        entity.Property(item => item.ServiceDate).HasColumnName("serviceDate");
        entity.Property(item => item.ShiftName).HasMaxLength(20).HasColumnName("shiftName");
        entity.Property(item => item.DishSlot).HasMaxLength(40).HasColumnName("dishSlot");
        entity.Property(item => item.OldDishId).HasMaxLength(16).IsFixedLength().HasColumnName("oldDishId");
        entity.Property(item => item.NewDishId).HasMaxLength(16).IsFixedLength().HasColumnName("newDishId");
        entity.HasOne(item => item.MenuAmendment).WithMany(item => item.Lines).HasForeignKey(item => item.MenuAmendmentId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(item => item.OldDish).WithMany().HasForeignKey(item => item.OldDishId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(item => item.NewDish).WithMany().HasForeignKey(item => item.NewDishId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class MenuAmendmentReconciliationCaseConfiguration : IEntityTypeConfiguration<MenuAmendmentReconciliationCase>
{
    public void Configure(EntityTypeBuilder<MenuAmendmentReconciliationCase> entity)
    {
        entity.HasKey(item => item.MenuAmendmentReconciliationCaseId).HasName("PRIMARY");
        entity.ToTable("menuamendmentreconciliationcases");
        entity.HasIndex(item => item.MenuAmendmentId, "uqMenuAmendmentReconciliationCase").IsUnique();
        entity.Property(item => item.MenuAmendmentReconciliationCaseId).HasMaxLength(16).IsFixedLength().HasColumnName("menuAmendmentReconciliationCaseId");
        entity.Property(item => item.MenuAmendmentId).HasMaxLength(16).IsFixedLength().HasColumnName("menuAmendmentId");
        entity.Property(item => item.ImpactSnapshotJson).HasColumnType("longtext").HasColumnName("impactSnapshotJson");
        entity.Property(item => item.Status).HasMaxLength(32).HasColumnName("status");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.HasOne(item => item.MenuAmendment).WithMany().HasForeignKey(item => item.MenuAmendmentId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class MenuAmendmentReconciliationCorrectionConfiguration : IEntityTypeConfiguration<MenuAmendmentReconciliationCorrection>
{
    public void Configure(EntityTypeBuilder<MenuAmendmentReconciliationCorrection> entity)
    {
        entity.HasKey(item => item.MenuAmendmentReconciliationCorrectionId).HasName("PRIMARY");
        entity.ToTable("menuamendmentreconciliationcorrections");
        entity.HasIndex(item => new { item.MenuAmendmentReconciliationCaseId, item.CreatedAt }, "ixMenuAmendmentReconciliationCorrectionsCaseCreatedAt");
        entity.HasIndex(item => item.ServiceRunDecisionItemId, "uqMenuAmendmentReconciliationCorrectionsDecision").IsUnique();
        entity.Property(item => item.MenuAmendmentReconciliationCorrectionId).HasMaxLength(16).IsFixedLength().HasColumnName("menuAmendmentReconciliationCorrectionId");
        entity.Property(item => item.MenuAmendmentReconciliationCaseId).HasMaxLength(16).IsFixedLength().HasColumnName("menuAmendmentReconciliationCaseId");
        entity.Property(item => item.ServiceRunId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunId");
        entity.Property(item => item.ServiceRunDecisionItemId).HasMaxLength(16).IsFixedLength().HasColumnName("serviceRunDecisionItemId");
        entity.Property(item => item.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(item => item.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
    }
}

internal sealed class MenuAmendmentReconciliationRemediationConfiguration : IEntityTypeConfiguration<MenuAmendmentReconciliationRemediation>
{
    public void Configure(EntityTypeBuilder<MenuAmendmentReconciliationRemediation> entity)
    {
        entity.HasKey(item => item.MenuAmendmentReconciliationRemediationId).HasName("PRIMARY");
        entity.ToTable("menuamendmentreconciliationremediations");
        entity.HasIndex(item => item.CommandId, "uqMenuAmendmentReconciliationRemediationsCommand").IsUnique();
        entity.HasIndex(item => new { item.MenuAmendmentReconciliationCaseId, item.CreatedAt }, "ixMenuAmendmentReconciliationRemediationsCaseCreatedAt");
        entity.Property(item => item.MenuAmendmentReconciliationRemediationId).HasMaxLength(16).IsFixedLength().HasColumnName("menuAmendmentReconciliationRemediationId");
        entity.Property(item => item.MenuAmendmentReconciliationCaseId).HasMaxLength(16).IsFixedLength().HasColumnName("menuAmendmentReconciliationCaseId");
        entity.Property(item => item.CommandId).HasMaxLength(80).HasColumnName("commandId");
        entity.Property(item => item.EffectiveImpactSnapshotJson).HasColumnType("longtext").HasColumnName("effectiveImpactSnapshotJson");
        entity.Property(item => item.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(item => item.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.HasOne(item => item.ReconciliationCase).WithMany(item => item.Remediations).HasForeignKey(item => item.MenuAmendmentReconciliationCaseId).OnDelete(DeleteBehavior.Restrict);
    }
}
