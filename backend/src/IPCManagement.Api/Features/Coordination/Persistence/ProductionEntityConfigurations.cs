using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Coordination.Persistence;

internal sealed class ProductionPlanConfiguration : IEntityTypeConfiguration<ProductionPlan>
{
    public void Configure(EntityTypeBuilder<ProductionPlan> entity)
    {
        entity.HasKey(e => e.PlanId).HasName("PRIMARY");
        entity.ToTable("productionplans");
        entity.HasIndex(e => e.CustomerId, "customerId");
        entity.HasIndex(e => e.CreatedBy, "createdBy");
        entity.HasIndex(e => e.MenuVersionId, "menuVersionId");
        entity.HasIndex(e => e.PlanCode, "planCode").IsUnique();
        entity.HasIndex(e => e.SentToKitchenBy, "sentToKitchenBy");
        entity.Property(e => e.PlanId).HasMaxLength(16).IsFixedLength().HasColumnName("planId");
        entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(e => e.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.MenuVersionId).HasMaxLength(16).IsFixedLength().HasColumnName("menuVersionId");
        entity.Property(e => e.PlanCode).HasMaxLength(50).HasColumnName("planCode");
        entity.Property(e => e.PlanDate).HasColumnName("planDate");
        entity.Property(e => e.SentToKitchenAt).HasColumnType("datetime").HasColumnName("sentToKitchenAt");
        entity.Property(e => e.SentToKitchenBy).HasMaxLength(16).IsFixedLength().HasColumnName("sentToKitchenBy");
        entity.Property(e => e.Status).HasDefaultValueSql("'CREATED'")
            .HasColumnType("enum('CREATED','SENTTOKITCHEN','COMPLETED','CANCELLED')").HasColumnName("status");
        entity.Property(e => e.WeekStartDate).HasColumnName("weekStartDate");
        entity.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("updatedAt");
        entity.Property(e => e.WeekStartDate).HasColumnName("weekStartDate");
        entity.HasOne(d => d.Customer).WithMany()
            .HasForeignKey(d => d.CustomerId).HasConstraintName("productionplans_ibfk_2");
        entity.HasOne(d => d.MenuVersion).WithMany()
            .HasForeignKey(d => d.MenuVersionId).HasConstraintName("productionplans_ibfk_3");
        entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Productionplans)
            .HasForeignKey(d => d.CreatedBy).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("productionplans_ibfk_1");
        entity.HasOne(d => d.SentToKitchenByNavigation).WithMany()
            .HasForeignKey(d => d.SentToKitchenBy).HasConstraintName("productionplans_ibfk_4");
    }
}

internal sealed class ProductionPlanLineConfiguration : IEntityTypeConfiguration<ProductionPlanLine>
{
    public void Configure(EntityTypeBuilder<ProductionPlanLine> entity)
    {
        entity.HasKey(e => e.PlanLineId).HasName("PRIMARY");
        entity.ToTable("productionplanlines");
        entity.HasIndex(e => e.CustomerId, "customerId");
        entity.HasIndex(e => e.DishId, "dishId");
        entity.HasIndex(e => e.MenuId, "menuId");
        entity.HasIndex(e => e.PlanId, "planId");
        entity.HasIndex(e => e.QuantityPlanLineId, "quantityPlanLineId");
        entity.Property(e => e.PlanLineId).HasMaxLength(16).IsFixedLength().HasColumnName("planLineId");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.DishId).HasMaxLength(16).IsFixedLength().HasColumnName("dishId");
        entity.Property(e => e.MenuId).HasMaxLength(16).IsFixedLength().HasColumnName("menuId");
        entity.Property(e => e.PlanId).HasMaxLength(16).IsFixedLength().HasColumnName("planId");
        entity.Property(e => e.QuantityPlanLineId).HasMaxLength(16).IsFixedLength().HasColumnName("quantityPlanLineId");
        entity.Property(e => e.ShiftName).HasColumnType("enum('MORNING','AFTERNOON')").HasColumnName("shiftName");
        entity.Property(e => e.TotalServings).HasColumnName("totalServings");
        entity.HasOne(d => d.Customer).WithMany(p => p.Productionplanlines)
            .HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("productionplanlines_ibfk_3");
        entity.HasOne(d => d.Dish).WithMany(p => p.Productionplanlines)
            .HasForeignKey(d => d.DishId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("productionplanlines_ibfk_5");
        entity.HasOne(d => d.Menu).WithMany(p => p.Productionplanlines)
            .HasForeignKey(d => d.MenuId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("productionplanlines_ibfk_4");
        entity.HasOne(d => d.Plan).WithMany(p => p.Productionplanlines)
            .HasForeignKey(d => d.PlanId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("productionplanlines_ibfk_1");
        entity.HasOne(d => d.QuantityPlanLine).WithMany(p => p.Productionplanlines)
            .HasForeignKey(d => d.QuantityPlanLineId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("productionplanlines_ibfk_2");
    }
}

internal sealed class QuantityAdjustmentConfiguration : IEntityTypeConfiguration<QuantityAdjustment>
{
    public void Configure(EntityTypeBuilder<QuantityAdjustment> entity)
    {
        entity.HasKey(e => e.AdjustmentId).HasName("PRIMARY");
        entity.ToTable("quantityadjustments");
        entity.HasIndex(e => e.AdjustedBy, "adjustedBy");
        entity.HasIndex(e => e.QuantityPlanLineId, "quantityPlanLineId");
        entity.Property(e => e.AdjustmentId).HasMaxLength(16).IsFixedLength().HasColumnName("adjustmentId");
        entity.Property(e => e.AdjustedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("adjustedAt");
        entity.Property(e => e.AdjustedBy).HasMaxLength(16).IsFixedLength().HasColumnName("adjustedBy");
        entity.Property(e => e.NewServings).HasColumnName("newServings");
        entity.Property(e => e.OldServings).HasColumnName("oldServings");
        entity.Property(e => e.QuantityPlanLineId).HasMaxLength(16).IsFixedLength().HasColumnName("quantityPlanLineId");
        entity.Property(e => e.Reason).HasColumnType("text").HasColumnName("reason");
        entity.HasOne(d => d.AdjustedByNavigation).WithMany(p => p.Quantityadjustments)
            .HasForeignKey(d => d.AdjustedBy).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("quantityadjustments_ibfk_2");
        entity.HasOne(d => d.QuantityPlanLine).WithMany(p => p.Quantityadjustments)
            .HasForeignKey(d => d.QuantityPlanLineId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("quantityadjustments_ibfk_1");
    }
}

internal sealed class QuantityImportBatchConfiguration : IEntityTypeConfiguration<QuantityImportBatch>
{
    public void Configure(EntityTypeBuilder<QuantityImportBatch> entity)
    {
        entity.HasKey(e => e.ImportBatchId).HasName("PRIMARY");
        entity.ToTable("quantityimportbatches");
        entity.HasIndex(e => e.BatchCode, "batchCode").IsUnique();
        entity.HasIndex(e => e.ImportedBy, "importedBy");
        entity.Property(e => e.ImportBatchId).HasMaxLength(16).IsFixedLength().HasColumnName("importBatchId");
        entity.Property(e => e.BatchCode).HasMaxLength(50).HasColumnName("batchCode");
        entity.Property(e => e.ImportedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("importedAt");
        entity.Property(e => e.ImportedBy).HasMaxLength(16).IsFixedLength().HasColumnName("importedBy");
        entity.Property(e => e.SourceCompanyName).HasMaxLength(200).HasColumnName("sourceCompanyName");
        entity.Property(e => e.SourceType).HasDefaultValueSql("'MANUAL'")
            .HasColumnType("enum('EXCEL','API','EMAIL','MANUAL')").HasColumnName("sourceType");
        entity.Property(e => e.Status).HasDefaultValueSql("'RECEIVED'")
            .HasColumnType("enum('RECEIVED','VALIDATED','CONFIRMED','REJECTED')").HasColumnName("status");
        entity.HasOne(d => d.ImportedByNavigation).WithMany(p => p.Quantityimportbatches)
            .HasForeignKey(d => d.ImportedBy).HasConstraintName("quantityimportbatches_ibfk_1");
    }
}
