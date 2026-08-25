using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Reconciliation.Persistence;

internal static class ReconciliationMapping
{
    public static PropertyBuilder<byte[]> Id(PropertyBuilder<byte[]> property) => property.HasMaxLength(16).IsFixedLength();
}

internal sealed class ReconciliationBatchConfiguration : IEntityTypeConfiguration<ReconciliationBatch>
{
    public void Configure(EntityTypeBuilder<ReconciliationBatch> e)
    {
        e.ToTable("reconciliationbatches", t => t.HasCheckConstraint("ckReconciliationBatchStatus", "`status` IN ('DRAFT','READY','IN_PROGRESS','COMPLETED')"));
        e.HasKey(x => x.BatchId); ReconciliationMapping.Id(e.Property(x => x.BatchId));
        ReconciliationMapping.Id(e.Property(x => x.MenuVersionId)); ReconciliationMapping.Id(e.Property(x => x.QuantityImportBatchId));
        e.Property(x => x.Status).HasMaxLength(20); e.Property(x => x.Version).IsConcurrencyToken();
        ReconciliationMapping.Id(e.Property(x => x.CreatedBy)); e.Property(x => x.ReadyBy).HasMaxLength(16).IsFixedLength(); e.Property(x => x.CompletedBy).HasMaxLength(16).IsFixedLength();
        e.Property(x => x.CreatedAt).HasColumnType("datetime"); e.Property(x => x.ReadyAt).HasColumnType("datetime"); e.Property(x => x.CompletedAt).HasColumnType("datetime");
        e.HasOne<MenuVersion>().WithMany().HasForeignKey(x => x.MenuVersionId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<QuantityImportBatch>().WithMany().HasForeignKey(x => x.QuantityImportBatchId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationBatchLineConfiguration : IEntityTypeConfiguration<ReconciliationBatchLine>
{
    public void Configure(EntityTypeBuilder<ReconciliationBatchLine> e)
    {
        e.ToTable("reconciliationbatchlines"); e.HasKey(x => x.BatchLineId); ReconciliationMapping.Id(e.Property(x => x.BatchLineId));
        ReconciliationMapping.Id(e.Property(x => x.BatchId)); ReconciliationMapping.Id(e.Property(x => x.IngredientId)); ReconciliationMapping.Id(e.Property(x => x.CanonicalUnitId));
        e.HasIndex(x => new { x.BatchId, x.IngredientId, x.CanonicalUnitId }).IsUnique();
        e.Property(x => x.RequiredQuantity).HasPrecision(18, 6); e.Property(x => x.FrozenTolerance).HasPrecision(18, 6);
        e.Property(x => x.ToleranceSourceKind).HasMaxLength(32); e.Property(x => x.ToleranceSourceVersion).HasMaxLength(128); e.Property(x => x.Version).IsConcurrencyToken();
        e.HasOne(x => x.Batch).WithMany(x => x.Lines).HasForeignKey(x => x.BatchId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<Ingredient>().WithMany().HasForeignKey(x => x.IngredientId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<Unit>().WithMany().HasForeignKey(x => x.CanonicalUnitId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationBatchContributorConfiguration : IEntityTypeConfiguration<ReconciliationBatchContributor>
{
    public void Configure(EntityTypeBuilder<ReconciliationBatchContributor> e)
    {
        e.ToTable("reconciliationbatchcontributors"); e.HasKey(x => x.ContributorId); ReconciliationMapping.Id(e.Property(x => x.ContributorId));
        ReconciliationMapping.Id(e.Property(x => x.BatchLineId)); ReconciliationMapping.Id(e.Property(x => x.MenuScheduleId)); ReconciliationMapping.Id(e.Property(x => x.MealQuantityPlanLineId)); ReconciliationMapping.Id(e.Property(x => x.DishBomId));
        e.Property(x => x.SourceQuantity).HasPrecision(18, 6);
        e.HasOne(x => x.BatchLine).WithMany(x => x.Contributors).HasForeignKey(x => x.BatchLineId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<MenuSchedule>().WithMany().HasForeignKey(x => x.MenuScheduleId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<MealQuantityPlanLine>().WithMany().HasForeignKey(x => x.MealQuantityPlanLineId).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<DishBom>().WithMany().HasForeignKey(x => x.DishBomId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationToleranceConfiguration : IEntityTypeConfiguration<ReconciliationTolerance>
{
    public void Configure(EntityTypeBuilder<ReconciliationTolerance> e)
    {
        e.ToTable("reconciliationtolerances"); e.HasKey(x => x.ToleranceId); ReconciliationMapping.Id(e.Property(x => x.ToleranceId)); e.Property(x => x.ScopeId).HasMaxLength(16).IsFixedLength();
        e.Property(x => x.ScopeKind).HasMaxLength(32); e.Property(x => x.Value).HasPrecision(18, 6); e.Property(x => x.Version).IsConcurrencyToken();
        ReconciliationMapping.Id(e.Property(x => x.CreatedBy)); e.Property(x => x.CreatedAt).HasColumnType("datetime");
        e.HasIndex(x => new { x.ScopeKind, x.ScopeId }).IsUnique(); e.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationActualConfiguration : IEntityTypeConfiguration<ReconciliationActual>
{
    public void Configure(EntityTypeBuilder<ReconciliationActual> e)
    {
        e.ToTable("reconciliationactuals", t => t.HasCheckConstraint("ckReconciliationActualSide", "`side` IN ('PURCHASED','ISSUED')"));
        e.HasKey(x => x.ActualId); ReconciliationMapping.Id(e.Property(x => x.ActualId)); ReconciliationMapping.Id(e.Property(x => x.BatchLineId));
        e.Property(x => x.Side).HasMaxLength(16); e.Property(x => x.Quantity).HasPrecision(18, 6); e.Property(x => x.Version).IsConcurrencyToken();
        ReconciliationMapping.Id(e.Property(x => x.EnteredBy)); e.Property(x => x.EnteredAt).HasColumnType("datetime"); e.HasIndex(x => new { x.BatchLineId, x.Side }).IsUnique();
        e.HasOne(x => x.BatchLine).WithMany().HasForeignKey(x => x.BatchLineId).OnDelete(DeleteBehavior.Restrict); e.HasOne<User>().WithMany().HasForeignKey(x => x.EnteredBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationActualRevisionConfiguration : IEntityTypeConfiguration<ReconciliationActualRevision>
{
    public void Configure(EntityTypeBuilder<ReconciliationActualRevision> e)
    {
        e.ToTable("reconciliationactualrevisions"); e.HasKey(x => x.RevisionId); ReconciliationMapping.Id(e.Property(x => x.RevisionId)).ValueGeneratedNever(); ReconciliationMapping.Id(e.Property(x => x.ActualId));
        e.Property(x => x.OldQuantity).HasPrecision(18, 6); e.Property(x => x.NewQuantity).HasPrecision(18, 6); e.Property(x => x.Reason).HasMaxLength(1000);
        ReconciliationMapping.Id(e.Property(x => x.ChangedBy)); e.Property(x => x.ChangedAt).HasColumnType("datetime");
        e.HasOne(x => x.Actual).WithMany(x => x.Revisions).HasForeignKey(x => x.ActualId).OnDelete(DeleteBehavior.Restrict); e.HasOne<User>().WithMany().HasForeignKey(x => x.ChangedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ReconciliationDispositionConfiguration : IEntityTypeConfiguration<ReconciliationDisposition>
{
    public void Configure(EntityTypeBuilder<ReconciliationDisposition> e)
    {
        e.ToTable("reconciliationdispositions"); e.HasKey(x => x.DispositionId); ReconciliationMapping.Id(e.Property(x => x.DispositionId)); ReconciliationMapping.Id(e.Property(x => x.BatchLineId));
        e.Property(x => x.Category).HasMaxLength(40); e.Property(x => x.Reason).HasMaxLength(1000); e.Property(x => x.Version).IsConcurrencyToken(); ReconciliationMapping.Id(e.Property(x => x.DisposedBy)); e.Property(x => x.DisposedAt).HasColumnType("datetime");
        e.HasIndex(x => x.BatchLineId).IsUnique(); e.HasOne(x => x.BatchLine).WithMany().HasForeignKey(x => x.BatchLineId).OnDelete(DeleteBehavior.Restrict); e.HasOne<User>().WithMany().HasForeignKey(x => x.DisposedBy).OnDelete(DeleteBehavior.Restrict);
    }
}
