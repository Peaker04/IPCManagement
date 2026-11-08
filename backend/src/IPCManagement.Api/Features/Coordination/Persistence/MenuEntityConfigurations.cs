using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Coordination.Persistence;

internal sealed class MealQuantityPlanConfiguration : IEntityTypeConfiguration<MealQuantityPlan>
{
    public void Configure(EntityTypeBuilder<MealQuantityPlan> entity)
    {
        entity.HasKey(e => e.QuantityPlanId).HasName("PRIMARY");
        entity.ToTable("mealquantityplans");
        entity.HasIndex(e => e.ConfirmedBy, "confirmedBy");
        entity.HasIndex(e => e.ImportBatchId, "importBatchId");
        entity.HasIndex(e => new { e.ServiceDate, e.Status, e.ConfirmedAt }, "ixMealQuantityPlansDate");
        entity.HasIndex(e => e.PlanCode, "planCode").IsUnique();
        entity.Property(e => e.QuantityPlanId).HasMaxLength(16).IsFixedLength().HasColumnName("quantityPlanId");
        entity.Property(e => e.ConfirmationTime).HasDefaultValueSql("'08:30:00'").HasColumnType("time").HasColumnName("confirmationTime");
        entity.Property(e => e.ConfirmedAt).HasColumnType("datetime").HasColumnName("confirmedAt");
        entity.Property(e => e.ConfirmedBy).HasMaxLength(16).IsFixedLength().HasColumnName("confirmedBy");
        entity.Property(e => e.ForecastReceivedAt).HasColumnType("datetime").HasColumnName("forecastReceivedAt");
        entity.Property(e => e.ImportBatchId).HasMaxLength(16).IsFixedLength().HasColumnName("importBatchId");
        entity.Property(e => e.PlanCode).HasMaxLength(50).HasColumnName("planCode");
        entity.Property(e => e.ServiceDate).HasColumnName("serviceDate");
        entity.Property(e => e.Status).HasDefaultValueSql("'DRAFT'").HasColumnType("enum('DRAFT','FORECASTED','CONFIRMED','ADJUSTED','COMPLETED','CANCELLED')").HasColumnName("status");
        entity.Property(e => e.CompletedAt).HasColumnType("datetime").HasColumnName("completedAt");
        entity.Property(e => e.CompletedBy).HasMaxLength(16).IsFixedLength().HasColumnName("completedBy");
        entity.Property(e => e.RowVersion).IsRowVersion().HasColumnType("timestamp(6)").HasColumnName("rowVersion")
            .HasDefaultValueSql("CURRENT_TIMESTAMP(6)").ValueGeneratedOnAddOrUpdate();
        entity.HasOne(d => d.ConfirmedByNavigation).WithMany(p => p.Mealquantityplans)
            .HasForeignKey(d => d.ConfirmedBy).HasConstraintName("mealquantityplans_ibfk_2");
        entity.HasOne(d => d.CompletedByNavigation).WithMany()
            .HasForeignKey(d => d.CompletedBy).HasConstraintName("mealquantityplans_ibfk_3");
        entity.HasOne(d => d.ImportBatch).WithMany(p => p.Mealquantityplans)
            .HasForeignKey(d => d.ImportBatchId).HasConstraintName("mealquantityplans_ibfk_1");
    }
}

internal sealed class MealQuantityPlanLineConfiguration : IEntityTypeConfiguration<MealQuantityPlanLine>
{
    public void Configure(EntityTypeBuilder<MealQuantityPlanLine> entity)
    {
        entity.HasKey(e => e.QuantityPlanLineId).HasName("PRIMARY");
        entity.ToTable("mealquantityplanlines");
        entity.HasIndex(e => e.CustomerId, "customerId");
        entity.HasIndex(e => e.MenuId, "menuId");
        entity.HasIndex(e => e.MenuScheduleId, "menuScheduleId");
        entity.HasIndex(e => e.QuantityPlanId, "quantityPlanId");
        entity.Property(e => e.QuantityPlanLineId).HasMaxLength(16).IsFixedLength().HasColumnName("quantityPlanLineId");
        entity.Property(e => e.AdjustedServings).HasColumnName("adjustedServings");
        entity.Property(e => e.ConfirmedServings).HasColumnName("confirmedServings");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.FinalServings).HasColumnName("finalServings");
        entity.Property(e => e.ForecastServings).HasColumnName("forecastServings");
        entity.Property(e => e.MenuId).HasMaxLength(16).IsFixedLength().HasColumnName("menuId");
        entity.Property(e => e.MenuScheduleId).HasMaxLength(16).IsFixedLength().HasColumnName("menuScheduleId");
        entity.Property(e => e.QuantityPlanId).HasMaxLength(16).IsFixedLength().HasColumnName("quantityPlanId");
        entity.Property(e => e.ShiftName).HasColumnType("enum('MORNING','AFTERNOON')").HasColumnName("shiftName");
        entity.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("updatedAt");
        entity.HasOne(d => d.Customer).WithMany(p => p.Mealquantityplanlines)
            .HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("mealquantityplanlines_ibfk_3");
        entity.HasOne(d => d.Menu).WithMany(p => p.Mealquantityplanlines)
            .HasForeignKey(d => d.MenuId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("mealquantityplanlines_ibfk_4");
        entity.HasOne(d => d.MenuSchedule).WithMany(p => p.Mealquantityplanlines)
            .HasForeignKey(d => d.MenuScheduleId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("mealquantityplanlines_ibfk_2");
        entity.HasOne(d => d.QuantityPlan).WithMany(p => p.Mealquantityplanlines)
            .HasForeignKey(d => d.QuantityPlanId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("mealquantityplanlines_ibfk_1");
    }
}

internal sealed class MenuConfiguration : IEntityTypeConfiguration<Menu>
{
    public void Configure(EntityTypeBuilder<Menu> entity)
    {
        entity.HasKey(e => e.MenuId).HasName("PRIMARY");
        entity.ToTable("menus");
        entity.HasIndex(e => e.MenuCode, "menuCode").IsUnique();
        entity.Property(e => e.MenuId).HasMaxLength(16).IsFixedLength().HasColumnName("menuId");
        entity.Property(e => e.FromDate).HasColumnName("fromDate");
        entity.Property(e => e.IsActive).IsRequired().HasDefaultValueSql("'1'").HasColumnName("isActive");
        entity.Property(e => e.MenuCode).HasMaxLength(50).HasColumnName("menuCode");
        entity.Property(e => e.MenuName).HasMaxLength(200).HasColumnName("menuName");
        entity.Property(e => e.ToDate).HasColumnName("toDate");
    }
}

internal sealed class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> entity)
    {
        entity.HasKey(e => e.MenuItemId).HasName("PRIMARY");
        entity.ToTable("menuitems");
        entity.HasIndex(e => e.DishId, "dishId");
        entity.HasIndex(e => e.MenuId, "menuId");
        entity.Property(e => e.MenuItemId).HasMaxLength(16).IsFixedLength().HasColumnName("menuItemId");
        entity.Property(e => e.DishId).HasMaxLength(16).IsFixedLength().HasColumnName("dishId");
        entity.Property(e => e.DishSlot).HasMaxLength(100).HasColumnName("dishSlot");
        entity.Property(e => e.DisplayOrder).HasDefaultValueSql("'1'").HasColumnName("displayOrder");
        entity.Property(e => e.MenuId).HasMaxLength(16).IsFixedLength().HasColumnName("menuId");
        entity.HasOne(d => d.Dish).WithMany(p => p.Menuitems)
            .HasForeignKey(d => d.DishId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("menuitems_ibfk_2");
        entity.HasOne(d => d.Menu).WithMany(p => p.Menuitems)
            .HasForeignKey(d => d.MenuId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("menuitems_ibfk_1");
    }
}

internal sealed class MenuScheduleConfiguration : IEntityTypeConfiguration<MenuSchedule>
{
    public void Configure(EntityTypeBuilder<MenuSchedule> entity)
    {
        entity.HasKey(e => e.MenuScheduleId).HasName("PRIMARY");
        entity.ToTable("menuschedules");
        entity.HasIndex(e => new { e.WeekStartDate, e.ServiceDate, e.ShiftName, e.CustomerId }, "ixMenuSchedulesWeek");
        entity.HasIndex(e => e.MenuId, "menuId");
        entity.HasIndex(e => new { e.CustomerId, e.ServiceDate, e.ShiftName }, "uqMenuSchedulesCustomerDateShift").IsUnique();
        entity.HasIndex(e => new { e.CustomerId, e.WeekStartDate }, "ixMenuSchedulesCustomerWeek");
        entity.Property(e => e.MenuScheduleId).HasMaxLength(16).IsFixedLength().HasColumnName("menuScheduleId");
        entity.Property(e => e.BomRatePercent).HasPrecision(5, 2).HasDefaultValueSql("'100.00'").HasColumnName("bomRatePercent");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.MenuId).HasMaxLength(16).IsFixedLength().HasColumnName("menuId");
        entity.Property(e => e.MenuPrice).HasPrecision(18, 2).HasColumnName("menuPrice");
        entity.Property(e => e.ServiceDate).HasColumnName("serviceDate");
        entity.Property(e => e.ShiftName).HasColumnType("enum('MORNING','AFTERNOON')").HasColumnName("shiftName");
        entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValueSql("'DRAFT'").HasColumnName("status");
        entity.Property(e => e.WeekStartDate).HasColumnName("weekStartDate");
        entity.Property(e => e.MenuVersionId).HasMaxLength(16).IsFixedLength().HasColumnName("menuVersionId");
        entity.HasOne(d => d.Customer).WithMany(p => p.Menuschedules)
            .HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("menuschedules_ibfk_1");
        entity.HasOne(d => d.CustomerWeekMenuTier).WithMany(p => p.Menuschedules)
            .HasForeignKey(d => new { d.CustomerId, d.WeekStartDate })
            .HasPrincipalKey(p => new { p.CustomerId, p.WeekStartDate })
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("menuschedules_customerweek_tier_fk");
        entity.HasOne(d => d.Menu).WithMany(p => p.Menuschedules)
            .HasForeignKey(d => d.MenuId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("menuschedules_ibfk_2");
        entity.HasOne(d => d.MenuVersion).WithMany(p => p.Menuschedules)
            .HasForeignKey(d => d.MenuVersionId).OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("menuschedules_ibfk_3");
    }
}

internal sealed class CustomerWeekMenuTierConfiguration : IEntityTypeConfiguration<CustomerWeekMenuTier>
{
    public void Configure(EntityTypeBuilder<CustomerWeekMenuTier> entity)
    {
        entity.HasKey(e => e.TierId).HasName("PRIMARY");
        entity.ToTable("customerweekmenutiers");
        entity.HasAlternateKey(e => new { e.CustomerId, e.WeekStartDate })
            .HasName("uqCustomerWeekMenuTiersScope");
        entity.Property(e => e.TierId).HasMaxLength(16).IsFixedLength().HasColumnName("tierId");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.WeekStartDate).HasColumnName("weekStartDate");
        entity.Property(e => e.PriceTierAmount).HasPrecision(18, 2).HasColumnName("priceTierAmount");
        entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
        entity.HasOne(d => d.Customer).WithMany(p => p.Customerweekmenutiers)
            .HasForeignKey(d => d.CustomerId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("customerweekmenutiers_ibfk_1");
    }
}

internal sealed class MenuVersionConfiguration : IEntityTypeConfiguration<MenuVersion>
{
    public void Configure(EntityTypeBuilder<MenuVersion> entity)
    {
        entity.HasKey(e => e.MenuVersionId).HasName("PRIMARY");
        entity.ToTable("menuversions");
        entity.HasIndex(e => e.CustomerId, "customerId");
        entity.HasIndex(e => new { e.CustomerId, e.WeekStartDate, e.VersionNo }, "uqMenuVersionsCustomerWeekVersion").IsUnique();
        entity.HasIndex(e => new { e.CustomerId, e.WeekStartDate, e.Status }, "ixMenuVersionsCustomerWeekStatus");
        entity.Property(e => e.MenuVersionId).HasMaxLength(16).IsFixedLength().HasColumnName("menuVersionId");
        entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(e => e.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.PublishedAt).HasColumnType("datetime").HasColumnName("publishedAt");
        entity.Property(e => e.PublishedBy).HasMaxLength(16).IsFixedLength().HasColumnName("publishedBy");
        entity.Property(e => e.SourceChecksum).HasMaxLength(128).HasColumnName("sourceChecksum");
        entity.Property(e => e.SourceFileName).HasMaxLength(255).HasColumnName("sourceFileName");
        entity.Property(e => e.SourceImportBatch).HasMaxLength(80).HasColumnName("sourceImportBatch");
        entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValueSql("'DRAFT'").HasColumnName("status");
        entity.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("updatedAt");
        entity.Property(e => e.VersionNo).HasColumnName("versionNo");
        entity.Property(e => e.WeekStartDate).HasColumnName("weekStartDate");
        entity.Property(e => e.SuccessRowCount).HasDefaultValueSql("'0'").HasColumnName("successRowCount");
        entity.Property(e => e.ErrorRowCount).HasDefaultValueSql("'0'").HasColumnName("errorRowCount");
        entity.Property(e => e.WarningRowCount).HasDefaultValueSql("'0'").HasColumnName("warningRowCount");
        entity.HasOne(d => d.Customer).WithMany(p => p.Menuversions)
            .HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("menuversions_ibfk_1");
    }
}

internal sealed class PortionRuleConfiguration : IEntityTypeConfiguration<PortionRule>
{
    public void Configure(EntityTypeBuilder<PortionRule> entity)
    {
        entity.HasKey(e => e.PortionRuleId).HasName("PRIMARY");
        entity.ToTable("portionrules");
        entity.HasIndex(e => e.CustomerId, "customerId");
        entity.HasIndex(e => e.DishId, "dishId");
        entity.HasIndex(e => new { e.CustomerId, e.EffectiveFrom, e.EffectiveTo, e.Status }, "ixPortionRulesCustomerEffective");
        entity.Property(e => e.PortionRuleId).HasMaxLength(16).IsFixedLength().HasColumnName("portionRuleId");
        entity.Property(e => e.ActiveWeekDays).HasMaxLength(100).HasColumnName("activeWeekDays");
        entity.Property(e => e.BomRatePercent).HasPrecision(5, 2).HasColumnName("bomRatePercent");
        entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.DishCategory).HasMaxLength(100).HasColumnName("dishCategory");
        entity.Property(e => e.DishId).HasMaxLength(16).IsFixedLength().HasColumnName("dishId");
        entity.Property(e => e.EffectiveFrom).HasColumnName("effectiveFrom");
        entity.Property(e => e.EffectiveTo).HasColumnName("effectiveTo");
        entity.Property(e => e.MenuSectionName).HasMaxLength(150).HasColumnName("menuSectionName");
        entity.Property(e => e.MenuVariant).HasMaxLength(50).HasColumnName("menuVariant");
        entity.Property(e => e.PortionRatePercent).HasPrecision(5, 2).HasColumnName("portionRatePercent");
        entity.Property(e => e.Priority).HasDefaultValueSql("'0'").HasColumnName("priority");
        entity.Property(e => e.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(e => e.ShiftNames).HasMaxLength(100).HasColumnName("shiftNames");
        entity.Property(e => e.SlotName).HasMaxLength(100).HasColumnName("slotName");
        entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValueSql("'ACTIVE'").HasColumnName("status");
        entity.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("updatedAt");
        entity.Property(e => e.YieldLossPercent).HasPrecision(5, 2).HasColumnName("yieldLossPercent");
        entity.HasOne(d => d.Customer).WithMany(p => p.Portionrules)
            .HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("portionrules_ibfk_1");
        entity.HasOne(d => d.Dish).WithMany(p => p.Portionrules)
            .HasForeignKey(d => d.DishId).HasConstraintName("portionrules_ibfk_2");
    }
}
