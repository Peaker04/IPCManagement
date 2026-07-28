using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Planning.Persistence;

internal sealed class MaterialRequestConfiguration : IEntityTypeConfiguration<MaterialRequest>
{
    public void Configure(EntityTypeBuilder<MaterialRequest> entity)
    {
        entity.HasKey(e => e.RequestId).HasName("PRIMARY");
        entity.ToTable("materialrequests");
        entity.HasIndex(e => e.ApprovedBy, "approvedBy");
        entity.HasIndex(e => e.CreatedBy, "createdBy");
        entity.HasIndex(e => new { e.PlanId, e.Status }, "ixMaterialRequestsPlan");
        entity.HasIndex(e => e.RequestCode, "requestCode").IsUnique();
        entity.Property(e => e.RequestId).HasMaxLength(16).IsFixedLength().HasColumnName("requestId");
        entity.Property(e => e.ApprovedAt).HasColumnType("datetime").HasColumnName("approvedAt");
        entity.Property(e => e.ApprovedBy).HasMaxLength(16).IsFixedLength().HasColumnName("approvedBy");
        entity.Property(e => e.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(e => e.PlanId).HasMaxLength(16).IsFixedLength().HasColumnName("planId");
        entity.Property(e => e.RequestCode).HasMaxLength(50).HasColumnName("requestCode");
        entity.Property(e => e.RequestDate).HasColumnName("requestDate");
        entity.Property(e => e.RequestScope).HasDefaultValueSql("'FULLDAY'")
            .HasColumnType("enum('FULLDAY','MORNING','AFTERNOON')").HasColumnName("requestScope");
        entity.Property(e => e.Status).HasDefaultValueSql("'DRAFT'")
            .HasColumnType("enum('DRAFT','MANAGERAPPROVED','SENTTOWAREHOUSE','EXPORTED','CANCELLED')")
            .HasColumnName("status");
        entity.HasOne(d => d.ApprovedByNavigation).WithMany(p => p.MaterialrequestApprovedByNavigations)
            .HasForeignKey(d => d.ApprovedBy).HasConstraintName("materialrequests_ibfk_3");
        entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.MaterialrequestCreatedByNavigations)
            .HasForeignKey(d => d.CreatedBy).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("materialrequests_ibfk_2");
        entity.HasOne(d => d.Plan).WithMany(p => p.Materialrequests).HasForeignKey(d => d.PlanId)
            .OnDelete(DeleteBehavior.ClientSetNull).HasConstraintName("materialrequests_ibfk_1");
    }
}

internal sealed class MaterialRequestLineConfiguration : IEntityTypeConfiguration<MaterialRequestLine>
{
    public void Configure(EntityTypeBuilder<MaterialRequestLine> entity)
    {
        entity.HasKey(e => e.RequestLineId).HasName("PRIMARY");
        entity.ToTable("materialrequestlines");
        entity.HasIndex(e => e.IngredientId, "ingredientId").HasDatabaseName("ingredientId3");
        entity.HasIndex(e => e.PlanLineId, "planLineId");
        entity.HasIndex(e => e.RequestId, "requestId");
        entity.HasIndex(e => e.UnitId, "unitId").HasDatabaseName("unitId5");
        entity.HasIndex(e => e.AppliedPortionRuleId, "appliedPortionRuleId");
        entity.HasIndex(e => e.BomId, "bomId");
        entity.Property(e => e.RequestLineId).HasMaxLength(16).IsFixedLength().HasColumnName("requestLineId");
        entity.Property(e => e.AppliedPortionRatePercent).HasPrecision(5, 2).HasDefaultValueSql("'100.00'").HasColumnName("appliedPortionRatePercent");
        entity.Property(e => e.AppliedPortionRuleId).HasMaxLength(16).IsFixedLength().HasColumnName("appliedPortionRuleId");
        entity.Property(e => e.AppliedPortionRuleSource).HasMaxLength(50).HasDefaultValueSql("'CONTRACT_DEFAULT'").HasColumnName("appliedPortionRuleSource");
        entity.Property(e => e.BomRatePercent).HasPrecision(5, 2).HasDefaultValueSql("'100.00'").HasColumnName("bomRatePercent");
        entity.Property(e => e.BomId).HasMaxLength(16).IsFixedLength().HasColumnName("bomId");
        entity.Property(e => e.BomScope).HasMaxLength(20).HasDefaultValueSql("'global'").HasColumnName("bomScope");
        entity.Property(e => e.CurrentStockQty).HasPrecision(18, 6).HasColumnName("currentStockQty");
        entity.Property(e => e.GrossQtyPerServing).HasPrecision(18, 6).HasColumnName("grossQtyPerServing");
        entity.Property(e => e.IngredientId).HasMaxLength(16).IsFixedLength().HasColumnName("ingredientId");
        entity.Property(e => e.PlanLineId).HasMaxLength(16).IsFixedLength().HasColumnName("planLineId");
        entity.Property(e => e.PriceTierAmount).HasPrecision(18, 2).HasDefaultValueSql("'25000.00'").HasColumnName("priceTierAmount");
        entity.Property(e => e.RequestId).HasMaxLength(16).IsFixedLength().HasColumnName("requestId");
        entity.Property(e => e.SuggestedPurchaseQty).HasPrecision(18, 6).HasColumnName("suggestedPurchaseQty");
        entity.Property(e => e.TotalRequiredQty).HasPrecision(18, 6).HasColumnName("totalRequiredQty");
        entity.Property(e => e.TotalServings).HasColumnName("totalServings");
        entity.Property(e => e.UnitId).HasMaxLength(16).IsFixedLength().HasColumnName("unitId");
        entity.Property(e => e.YieldLossPercent).HasPrecision(5, 2).HasColumnName("yieldLossPercent");
        entity.HasOne(d => d.Ingredient).WithMany(p => p.Materialrequestlines)
            .HasForeignKey(d => d.IngredientId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("materialrequestlines_ibfk_3");
        entity.HasOne(d => d.Bom).WithMany().HasForeignKey(d => d.BomId)
            .OnDelete(DeleteBehavior.SetNull).HasConstraintName("materialrequestlines_ibfk_5");
        entity.HasOne(d => d.PlanLine).WithMany(p => p.Materialrequestlines)
            .HasForeignKey(d => d.PlanLineId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("materialrequestlines_ibfk_2");
        entity.HasOne(d => d.Request).WithMany(p => p.Materialrequestlines)
            .HasForeignKey(d => d.RequestId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("materialrequestlines_ibfk_1");
        entity.HasOne(d => d.Unit).WithMany(p => p.Materialrequestlines)
            .HasForeignKey(d => d.UnitId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("materialrequestlines_ibfk_4");
    }
}
