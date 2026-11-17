using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Reconciliation.Persistence;

internal sealed class ReconciliationSupplementalDemandConfiguration : IEntityTypeConfiguration<ReconciliationSupplementalDemand>
{
    public void Configure(EntityTypeBuilder<ReconciliationSupplementalDemand> e)
    {
        e.ToTable("reconciliationsupplementaldemands", t => t.HasCheckConstraint("ckMrxSupplementalDemandStatus",
            "`Status` IN ('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED')"));
        e.HasKey(x => x.DemandId); ReconciliationMapping.Id(e.Property(x => x.DemandId));
        e.HasAlternateKey(x => new { x.DemandId, x.BatchId });
        ReconciliationMapping.Id(e.Property(x => x.BatchId)); ReconciliationMapping.Id(e.Property(x => x.CreatedBy));
        e.Property(x => x.DecidedBy).HasMaxLength(16).IsFixedLength();
        e.Property(x => x.Version).IsConcurrencyToken(); e.Property(x => x.Status).HasMaxLength(20);
        e.Property(x => x.SnapshotFingerprint).HasMaxLength(64); e.Property(x => x.Reason).HasMaxLength(2000);
        e.Property(x => x.DecisionReason).HasMaxLength(2000); e.Property(x => x.ServiceDate).HasColumnType("date");
        e.Property(x => x.CreatedAt).HasColumnType("datetime(6)"); e.Property(x => x.SubmittedAt).HasColumnType("datetime(6)");
        e.Property(x => x.DecidedAt).HasColumnType("datetime(6)");
        e.HasIndex(x => new { x.BatchId, x.ServiceDate, x.Status });
        e.HasOne(x => x.Batch).WithMany().HasForeignKey(x => x.BatchId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<User>().WithMany().HasForeignKey(x => x.DecidedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationSupplementalDemandDishConfiguration : IEntityTypeConfiguration<ReconciliationSupplementalDemandDish>
{
    public void Configure(EntityTypeBuilder<ReconciliationSupplementalDemandDish> e)
    {
        e.ToTable("reconciliationsupplementaldemanddishes", t => t.HasCheckConstraint("ckMrxExtraServingsPositive", "`ExtraServings` > 0"));
        e.HasKey(x => x.DemandDishId); ReconciliationMapping.Id(e.Property(x => x.DemandDishId));
        ReconciliationMapping.Id(e.Property(x => x.DemandId)); ReconciliationMapping.Id(e.Property(x => x.DishId));
        e.Property(x => x.ShiftName).HasMaxLength(60); e.Property(x => x.MenuVariant).HasMaxLength(30);
        e.Property(x => x.FrozenDishCode).HasMaxLength(80); e.Property(x => x.FrozenDishName).HasMaxLength(255);
        e.HasIndex(x => new { x.DemandId, x.DishId, x.ShiftName, x.MenuVariant }).IsUnique();
        e.HasOne(x => x.Demand).WithMany(x => x.Dishes).HasForeignKey(x => x.DemandId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<Dish>().WithMany().HasForeignKey(x => x.DishId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationSupplementalDemandMaterialConfiguration : IEntityTypeConfiguration<ReconciliationSupplementalDemandMaterial>
{
    public void Configure(EntityTypeBuilder<ReconciliationSupplementalDemandMaterial> e)
    {
        e.ToTable("reconciliationsupplementaldemandmaterials", t => t.HasCheckConstraint("ckMrxExtraRequiredPositive", "`RequiredQuantity` > 0"));
        e.HasKey(x => x.DemandMaterialId); ReconciliationMapping.Id(e.Property(x => x.DemandMaterialId));
        ReconciliationMapping.Id(e.Property(x => x.DemandId)); ReconciliationMapping.Id(e.Property(x => x.DailyLineId));
        ReconciliationMapping.Id(e.Property(x => x.BatchId));
        ReconciliationMapping.Id(e.Property(x => x.IngredientId)); ReconciliationMapping.Id(e.Property(x => x.CanonicalUnitId));
        e.Property(x => x.RequiredQuantity).HasPrecision(18, 6);
        e.HasIndex(x => new { x.DemandId, x.DailyLineId }).IsUnique();
        e.HasOne(x => x.Demand).WithMany(x => x.Materials).HasForeignKey(x => new { x.DemandId, x.BatchId })
            .HasPrincipalKey(x => new { x.DemandId, x.BatchId }).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.DailyLine).WithMany().HasForeignKey(x => new { x.DailyLineId, x.BatchId, x.IngredientId, x.CanonicalUnitId })
            .HasPrincipalKey(x => new { x.DailyLineId, x.BatchId, x.IngredientId, x.CanonicalUnitId }).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationSupplementalDemandContributionConfiguration : IEntityTypeConfiguration<ReconciliationSupplementalDemandContribution>
{
    public void Configure(EntityTypeBuilder<ReconciliationSupplementalDemandContribution> e)
    {
        e.ToTable("reconciliationsupplementaldemandcontributions");
        e.HasKey(x => x.DemandContributionId); ReconciliationMapping.Id(e.Property(x => x.DemandContributionId));
        ReconciliationMapping.Id(e.Property(x => x.DemandDishId)); ReconciliationMapping.Id(e.Property(x => x.DemandMaterialId));
        ReconciliationMapping.Id(e.Property(x => x.FrozenContributorId));
        e.Property(x => x.CanonicalQuantityPerServing).HasPrecision(38, 24);
        e.Property(x => x.FrozenBomQuantityPerServing).HasPrecision(18, 6);
        e.Property(x => x.FrozenBomUnitToBaseRate).HasPrecision(18, 6);
        e.Property(x => x.FrozenCanonicalUnitToBaseRate).HasPrecision(18, 6);
        e.Property(x => x.WasteRatePercent).HasPrecision(18, 6); e.Property(x => x.RequiredQuantity).HasPrecision(38, 24);
        e.HasIndex(x => new { x.DemandDishId, x.DemandMaterialId }).IsUnique();
        e.HasOne(x => x.DemandDish).WithMany(x => x.Contributions).HasForeignKey(x => x.DemandDishId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.DemandMaterial).WithMany(x => x.Contributions).HasForeignKey(x => x.DemandMaterialId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<ReconciliationBatchContributor>().WithMany().HasForeignKey(x => x.FrozenContributorId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationIssueAllocationConfiguration : IEntityTypeConfiguration<ReconciliationIssueAllocation>
{
    public void Configure(EntityTypeBuilder<ReconciliationIssueAllocation> e)
    {
        e.ToTable("reconciliationissueallocations", t =>
        {
            t.HasCheckConstraint("ckMrxIssueAllocationPurpose", "(`Purpose` = 'APPROVED_EXTRA_DEMAND' AND `DemandMaterialId` IS NOT NULL) OR (`Purpose` IN ('BASELINE_SHORTAGE','UNPLANNED_EXTRA') AND `DemandMaterialId` IS NULL)");
            t.HasCheckConstraint("ckMrxIssueAllocationQuantity", "`Quantity` > 0");
        });
        e.HasKey(x => x.AllocationId); ReconciliationMapping.Id(e.Property(x => x.AllocationId));
        ReconciliationMapping.Id(e.Property(x => x.IssueLineId)); ReconciliationMapping.Id(e.Property(x => x.DailyLineId));
        e.Property(x => x.DemandMaterialId).HasMaxLength(16).IsFixedLength(); e.Property(x => x.Purpose).HasMaxLength(30);
        e.Property(x => x.Quantity).HasPrecision(18, 6); e.HasIndex(x => new { x.IssueLineId, x.Purpose, x.DemandMaterialId });
        e.HasOne(x => x.IssueLine).WithMany().HasForeignKey(x => x.IssueLineId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.DailyLine).WithMany().HasForeignKey(x => x.DailyLineId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne(x => x.DemandMaterial).WithMany().HasForeignKey(x => x.DemandMaterialId).OnDelete(DeleteBehavior.Restrict);
    }
}
