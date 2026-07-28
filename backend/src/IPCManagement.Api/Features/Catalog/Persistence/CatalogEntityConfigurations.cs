using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Catalog.Persistence;

internal sealed class BomAdjustmentConfiguration : IEntityTypeConfiguration<BomAdjustment>
{
    public void Configure(EntityTypeBuilder<BomAdjustment> entity)
    {
        entity.HasKey(e => e.BomAdjustmentId).HasName("PRIMARY");
        entity.ToTable("bomadjustments");
        entity.HasIndex(e => e.AdjustedBy, "adjustedBy");
        entity.HasIndex(e => e.BomId, "bomId");

        entity.Property(e => e.BomAdjustmentId).HasMaxLength(16).IsFixedLength().HasColumnName("bomAdjustmentId");
        entity.Property(e => e.AdjustedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("adjustedAt");
        entity.Property(e => e.AdjustedBy).HasMaxLength(16).IsFixedLength().HasColumnName("adjustedBy");
        entity.Property(e => e.BomId).HasMaxLength(16).IsFixedLength().HasColumnName("bomId");
        entity.Property(e => e.NewGrossQtyPerServing).HasPrecision(18, 6).HasColumnName("newGrossQtyPerServing");
        entity.Property(e => e.NewWasteRatePercent).HasPrecision(5, 2).HasColumnName("newWasteRatePercent");
        entity.Property(e => e.OldGrossQtyPerServing).HasPrecision(18, 6).HasColumnName("oldGrossQtyPerServing");
        entity.Property(e => e.OldWasteRatePercent).HasPrecision(5, 2).HasColumnName("oldWasteRatePercent");
        entity.Property(e => e.Reason).HasColumnType("text").HasColumnName("reason");

        entity.HasOne(d => d.AdjustedByNavigation).WithMany(p => p.Bomadjustments)
            .HasForeignKey(d => d.AdjustedBy).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("bomadjustments_ibfk_2");
        entity.HasOne(d => d.Bom).WithMany(p => p.Bomadjustments)
            .HasForeignKey(d => d.BomId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("bomadjustments_ibfk_1");
    }
}

internal sealed class DishConfiguration : IEntityTypeConfiguration<Dish>
{
    public void Configure(EntityTypeBuilder<Dish> entity)
    {
        entity.HasKey(e => e.DishId).HasName("PRIMARY");
        entity.ToTable("dishes");
        entity.HasIndex(e => e.DishCode, "dishCode").IsUnique();
        entity.Property(e => e.DishId).HasMaxLength(16).IsFixedLength().HasColumnName("dishId");
        entity.Property(e => e.DishCode).HasMaxLength(50).HasColumnName("dishCode");
        entity.Property(e => e.DishGroup).HasMaxLength(100).HasColumnName("dishGroup");
        entity.Property(e => e.DishName).HasMaxLength(200).HasColumnName("dishName");
        entity.Property(e => e.DishType).HasMaxLength(100).HasColumnName("dishType");
        entity.Property(e => e.IsActive).IsRequired().HasDefaultValueSql("'1'").HasColumnName("isActive");
    }
}

internal sealed class DishBomConfiguration : IEntityTypeConfiguration<DishBom>
{
    public void Configure(EntityTypeBuilder<DishBom> entity)
    {
        entity.HasKey(e => e.BomId).HasName("PRIMARY");
        entity.ToTable("dishbom");
        entity.HasIndex(e => e.IngredientId, "ingredientId").HasDatabaseName("ingredientId");
        entity.HasIndex(e => new { e.DishId, e.EffectiveFrom, e.EffectiveTo }, "ixDishBomDishEffective");
        entity.HasIndex(e => e.CustomerId, "customerId");
        entity.HasIndex(e => new { e.DishId, e.CustomerId, e.PriceTierAmount, e.EffectiveFrom, e.EffectiveTo }, "ixDishBomTierEffective");
        entity.HasIndex(e => e.UnitId, "unitId").HasDatabaseName("unitId");

        entity.Property(e => e.BomId).HasMaxLength(16).IsFixedLength().HasColumnName("bomId");
        entity.Property(e => e.BomStatus).HasMaxLength(20).HasDefaultValueSql("'PUBLISHED'")
            .HasColumnName("bomStatus").HasCharSet("utf8mb4").UseCollation("utf8mb4_unicode_ci");
        entity.Property(e => e.DishId).HasMaxLength(16).IsFixedLength().HasColumnName("dishId");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.EffectiveFrom).HasColumnName("effectiveFrom");
        entity.Property(e => e.EffectiveTo).HasColumnName("effectiveTo");
        entity.Property(e => e.PriceTierAmount).HasPrecision(18, 2).HasDefaultValueSql("'25000.00'").HasColumnName("priceTierAmount");
        entity.Property(e => e.GrossQtyPerServing).HasPrecision(18, 6).HasColumnName("grossQtyPerServing");
        entity.Property(e => e.IngredientId).HasMaxLength(16).IsFixedLength().HasColumnName("ingredientId");
        entity.Property(e => e.UnitId).HasMaxLength(16).IsFixedLength().HasColumnName("unitId");
        entity.Property(e => e.WasteRatePercent).HasPrecision(5, 2).HasColumnName("wasteRatePercent");

        entity.HasOne(d => d.Customer).WithMany(p => p.Dishboms)
            .HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.SetNull).HasConstraintName("dishbom_ibfk_4");
        entity.HasOne(d => d.Dish).WithMany(p => p.Dishboms)
            .HasForeignKey(d => d.DishId).OnDelete(DeleteBehavior.ClientSetNull).HasConstraintName("dishbom_ibfk_1");
        entity.HasOne(d => d.Ingredient).WithMany(p => p.Dishboms)
            .HasForeignKey(d => d.IngredientId).OnDelete(DeleteBehavior.ClientSetNull).HasConstraintName("dishbom_ibfk_2");
        entity.HasOne(d => d.Unit).WithMany(p => p.Dishboms)
            .HasForeignKey(d => d.UnitId).OnDelete(DeleteBehavior.ClientSetNull).HasConstraintName("dishbom_ibfk_3");
    }
}

internal sealed class IngredientConfiguration : IEntityTypeConfiguration<Ingredient>
{
    public void Configure(EntityTypeBuilder<Ingredient> entity)
    {
        entity.HasKey(e => e.IngredientId).HasName("PRIMARY");
        entity.ToTable("ingredients");
        entity.HasIndex(e => e.IngredientCode, "ingredientCode").IsUnique();
        entity.HasIndex(e => e.UnitId, "unitId").HasDatabaseName("unitId1");
        entity.HasIndex(e => e.WarehouseId, "warehouseId");

        entity.Property(e => e.IngredientId).HasMaxLength(16).IsFixedLength().HasColumnName("ingredientId");
        entity.Property(e => e.IngredientCode).HasMaxLength(50).HasColumnName("ingredientCode");
        entity.Property(e => e.IngredientName).HasMaxLength(200).HasColumnName("ingredientName");
        entity.Property(e => e.IsActive).IsRequired().HasDefaultValueSql("'1'").HasColumnName("isActive");
        entity.Property(e => e.IsFreshDaily).HasColumnName("isFreshDaily");
        entity.Property(e => e.ReferencePrice).HasPrecision(18, 2).HasColumnName("referencePrice");
        entity.Property(e => e.UnitId).HasMaxLength(16).IsFixedLength().HasColumnName("unitId");
        entity.Property(e => e.WarehouseId).HasMaxLength(16).IsFixedLength().HasColumnName("warehouseId");

        entity.HasOne(d => d.Unit).WithMany(p => p.Ingredients)
            .HasForeignKey(d => d.UnitId).OnDelete(DeleteBehavior.ClientSetNull).HasConstraintName("ingredients_ibfk_1");
        entity.HasOne(d => d.Warehouse).WithMany(p => p.Ingredients)
            .HasForeignKey(d => d.WarehouseId).OnDelete(DeleteBehavior.ClientSetNull).HasConstraintName("ingredients_ibfk_2");
    }
}

internal sealed class UnitConfiguration : IEntityTypeConfiguration<Unit>
{
    public void Configure(EntityTypeBuilder<Unit> entity)
    {
        entity.HasKey(e => e.UnitId).HasName("PRIMARY");
        entity.ToTable("units");
        entity.HasIndex(e => e.UnitCode, "unitCode").IsUnique();
        entity.Property(e => e.UnitId).HasMaxLength(16).IsFixedLength().HasColumnName("unitId");
        entity.Property(e => e.BaseUnitCode).HasMaxLength(30).HasColumnName("baseUnitCode");
        entity.Property(e => e.ConvertRateToBase).HasPrecision(18, 6).HasDefaultValueSql("'1.000000'").HasColumnName("convertRateToBase");
        entity.Property(e => e.UnitCode).HasMaxLength(30).HasColumnName("unitCode");
        entity.Property(e => e.UnitName).HasMaxLength(100).HasColumnName("unitName");
    }
}
