using System;
using System.Collections.Generic;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IPCManagement.Api.Data;

public partial class IpcManagementContext : DbContext
{
    public PaginationOptions PaginationOptions { get; }

    public IpcManagementContext(DbContextOptions<IpcManagementContext> options)
        : this(options, Microsoft.Extensions.Options.Options.Create(new PaginationOptions()))
    {
    }

    public IpcManagementContext(
        DbContextOptions<IpcManagementContext> options,
        IOptions<PaginationOptions> paginationOptions)
        : base(options)
    {
        PaginationOptions = paginationOptions.Value;
    }

    public virtual DbSet<Auditlog> Auditlogs { get; set; }

    public virtual DbSet<Approvalhistory> Approvalhistories { get; set; }

    public virtual DbSet<Bomadjustment> Bomadjustments { get; set; }

    public virtual DbSet<Customer> Customers { get; set; }

    public virtual DbSet<Customerimportmapping> Customerimportmappings { get; set; }

    public virtual DbSet<Customercontract> Customercontracts { get; set; }

    public virtual DbSet<Dish> Dishes { get; set; }

    public virtual DbSet<Dishbom> Dishboms { get; set; }

    public virtual DbSet<Ingredient> Ingredients { get; set; }

    public virtual DbSet<Supplierquotation> Supplierquotations { get; set; }

    public virtual DbSet<Inventoryissue> Inventoryissues { get; set; }

    public virtual DbSet<Inventoryissueline> Inventoryissuelines { get; set; }

    public virtual DbSet<Supplementalmaterialrequest> Supplementalmaterialrequests { get; set; }

    public virtual DbSet<Inventoryreceipt> Inventoryreceipts { get; set; }

    public virtual DbSet<Inventoryreceiptline> Inventoryreceiptlines { get; set; }

    public virtual DbSet<Inventoryreturn> Inventoryreturns { get; set; }

    public virtual DbSet<Inventoryreturnline> Inventoryreturnlines { get; set; }

    public virtual DbSet<Materialrequest> Materialrequests { get; set; }

    public virtual DbSet<Materialrequestline> Materialrequestlines { get; set; }

    public virtual DbSet<Mealquantityplan> Mealquantityplans { get; set; }

    public virtual DbSet<Mealquantityplanline> Mealquantityplanlines { get; set; }

    public virtual DbSet<Menu> Menus { get; set; }

    public virtual DbSet<Menuitem> Menuitems { get; set; }

    public virtual DbSet<Menuschedule> Menuschedules { get; set; }

    public virtual DbSet<Menuversion> Menuversions { get; set; }

    public virtual DbSet<Portionrule> Portionrules { get; set; }

    public virtual DbSet<Productionplan> Productionplans { get; set; }

    public virtual DbSet<Productionplanline> Productionplanlines { get; set; }

    public virtual DbSet<Purchaserequest> Purchaserequests { get; set; }

    public virtual DbSet<Purchaserequestline> Purchaserequestlines { get; set; }

    public virtual DbSet<Purchaseorder> Purchaseorders { get; set; }

    public virtual DbSet<Purchaseorderline> Purchaseorderlines { get; set; }

    public virtual DbSet<Purchaselinesupplierdecision> Purchaselinesupplierdecisions { get; set; }

    public virtual DbSet<Purchasepriceexception> Purchasepriceexceptions { get; set; }

    public virtual DbSet<Purchasehistoryreconciliationrun> Purchasehistoryreconciliationruns { get; set; }

    public virtual DbSet<Purchasehistoryreconciliationaction> Purchasehistoryreconciliationactions { get; set; }

    public virtual DbSet<Quantityadjustment> Quantityadjustments { get; set; }

    public virtual DbSet<Quantityimportbatch> Quantityimportbatches { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<Stockmovement> Stockmovements { get; set; }

    public virtual DbSet<Currentstock> Currentstocks { get; set; }

    public virtual DbSet<Currentstocklot> Currentstocklots { get; set; }

    public virtual DbSet<Stocksnapshot> Stocksnapshots { get; set; }

    public virtual DbSet<Supplier> Suppliers { get; set; }

    public virtual DbSet<Unit> Units { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<Refreshtoken> Refreshtokens { get; set; }

    public virtual DbSet<Stocktake> Stocktakes { get; set; }

    public virtual DbSet<Stocktakeline> Stocktakelines { get; set; }

    public virtual DbSet<Warehouse> Warehouses { get; set; }

    public virtual DbSet<Approvalrule> Approvalrules { get; set; }

    public virtual DbSet<Approvalassignment> Approvalassignments { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .UseCollation("utf8mb4_unicode_ci")
            .HasCharSet("utf8mb4");

        modelBuilder.Entity<Auditlog>(entity =>
        {
            entity.HasKey(e => e.AuditId).HasName("PRIMARY");

            entity.ToTable("auditlogs");

            entity.HasIndex(e => new { e.ChangedBy, e.ChangedAt }, "ixAuditLogsChangedBy");

            entity.Property(e => e.AuditId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("auditId");
            entity.Property(e => e.BusinessArea)
                .HasMaxLength(100)
                .HasColumnName("businessArea");
            entity.Property(e => e.ChangedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("changedAt");
            entity.Property(e => e.ChangedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("changedBy");
            entity.Property(e => e.EntityId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("entityId");
            entity.Property(e => e.EntityName)
                .HasMaxLength(100)
                .HasColumnName("entityName");
            entity.Property(e => e.FieldName)
                .HasMaxLength(100)
                .HasColumnName("fieldName");
            entity.Property(e => e.NewValue)
                .HasColumnType("text")
                .HasColumnName("newValue");
            entity.Property(e => e.OldValue)
                .HasColumnType("text")
                .HasColumnName("oldValue");
            entity.Property(e => e.Reason)
                .HasColumnType("text")
                .HasColumnName("reason");

            entity.HasOne(d => d.ChangedByNavigation).WithMany(p => p.Auditlogs)
                .HasForeignKey(d => d.ChangedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("auditlogs_ibfk_1");
        });

        modelBuilder.Entity<Approvalhistory>(entity =>
        {
            entity.HasKey(e => e.ApprovalHistoryId).HasName("PRIMARY");

            entity.ToTable("approvalhistories");

            entity.HasIndex(e => new { e.TargetType, e.TargetId, e.ActionAt }, "ixApprovalHistoriesTarget");

            entity.Property(e => e.ApprovalHistoryId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("approvalHistoryId");
            entity.Property(e => e.ActionAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("actionAt");
            entity.Property(e => e.ActionBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("actionBy");
            entity.Property(e => e.Decision)
                .HasMaxLength(20)
                .HasColumnName("decision");
            entity.Property(e => e.NewStatus)
                .HasMaxLength(50)
                .HasColumnName("newStatus");
            entity.Property(e => e.OldStatus)
                .HasMaxLength(50)
                .HasColumnName("oldStatus");
            entity.Property(e => e.Reason)
                .HasColumnType("text")
                .HasColumnName("reason");
            entity.Property(e => e.TargetId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("targetId");
            entity.Property(e => e.TargetType)
                .HasMaxLength(50)
                .HasColumnName("targetType");

            entity.HasOne(d => d.ActionByNavigation).WithMany()
                .HasForeignKey(d => d.ActionBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("approvalhistories_ibfk_1");
        });

        modelBuilder.Entity<Approvalrule>(entity =>
        {
            entity.HasKey(e => e.RuleId).HasName("PRIMARY");
            entity.ToTable("approvalrules");

            entity.Property(e => e.RuleId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ruleId");
            entity.Property(e => e.RuleName)
                .HasMaxLength(200)
                .HasColumnName("ruleName");
            entity.Property(e => e.DocumentType)
                .HasMaxLength(50)
                .HasColumnName("documentType");
            entity.Property(e => e.MinAmount)
                .HasPrecision(18, 2)
                .HasColumnName("minAmount");
            entity.Property(e => e.MaxAmount)
                .HasPrecision(18, 2)
                .HasColumnName("maxAmount");
            entity.Property(e => e.SlaHours)
                .HasColumnName("slaHours");
            entity.Property(e => e.IsActive)
                .HasColumnName("isActive")
                .HasDefaultValue(true);
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
        });

        modelBuilder.Entity<Approvalassignment>(entity =>
        {
            entity.HasKey(e => e.AssignmentId).HasName("PRIMARY");
            entity.ToTable("approvalassignments");

            entity.Property(e => e.AssignmentId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("assignmentId");
            entity.Property(e => e.RuleId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ruleId");
            entity.Property(e => e.Sequence)
                .HasColumnName("sequence");
            entity.Property(e => e.ApproverRole)
                .HasMaxLength(50)
                .HasColumnName("approverRole");
            entity.Property(e => e.ApproverUserId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("approverUserId");
            entity.Property(e => e.IsRequired)
                .HasColumnName("isRequired")
                .HasDefaultValue(true);

            entity.HasOne(d => d.Rule).WithMany(p => p.Approvalassignments)
                .HasForeignKey(d => d.RuleId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("approvalassignments_ibfk_1");

            entity.HasOne(d => d.ApproverUser).WithMany()
                .HasForeignKey(d => d.ApproverUserId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("approvalassignments_ibfk_2");
        });

        modelBuilder.Entity<Bomadjustment>(entity =>
        {
            entity.HasKey(e => e.BomAdjustmentId).HasName("PRIMARY");

            entity.ToTable("bomadjustments");

            entity.HasIndex(e => e.AdjustedBy, "adjustedBy");

            entity.HasIndex(e => e.BomId, "bomId");

            entity.Property(e => e.BomAdjustmentId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("bomAdjustmentId");
            entity.Property(e => e.AdjustedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("adjustedAt");
            entity.Property(e => e.AdjustedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("adjustedBy");
            entity.Property(e => e.BomId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("bomId");
            entity.Property(e => e.NewGrossQtyPerServing)
                .HasPrecision(18, 6)
                .HasColumnName("newGrossQtyPerServing");
            entity.Property(e => e.NewWasteRatePercent)
                .HasPrecision(5, 2)
                .HasColumnName("newWasteRatePercent");
            entity.Property(e => e.OldGrossQtyPerServing)
                .HasPrecision(18, 6)
                .HasColumnName("oldGrossQtyPerServing");
            entity.Property(e => e.OldWasteRatePercent)
                .HasPrecision(5, 2)
                .HasColumnName("oldWasteRatePercent");
            entity.Property(e => e.Reason)
                .HasColumnType("text")
                .HasColumnName("reason");

            entity.HasOne(d => d.AdjustedByNavigation).WithMany(p => p.Bomadjustments)
                .HasForeignKey(d => d.AdjustedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("bomadjustments_ibfk_2");

            entity.HasOne(d => d.Bom).WithMany(p => p.Bomadjustments)
                .HasForeignKey(d => d.BomId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("bomadjustments_ibfk_1");
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(e => e.CustomerId).HasName("PRIMARY");

            entity.ToTable("customers");

            entity.HasIndex(e => e.CustomerCode, "customerCode").IsUnique();

            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");
            entity.Property(e => e.CustomerCode)
                .HasMaxLength(50)
                .HasColumnName("customerCode");
            entity.Property(e => e.CustomerName)
                .HasMaxLength(200)
                .HasColumnName("customerName");
            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValueSql("'1'")
                .HasColumnName("isActive");
            entity.Property(e => e.Note)
                .HasColumnType("text")
                .HasColumnName("note");
        });

        modelBuilder.Entity<Customerimportmapping>(entity =>
        {
            entity.HasKey(e => e.MappingId).HasName("PRIMARY");

            entity.ToTable("customerimportmappings");

            entity.HasIndex(e => e.CustomerId, "ixCustomerImportMappingsCustomer").IsUnique();

            entity.Property(e => e.MappingId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("mappingId");

            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");

            entity.Property(e => e.SheetNameHint)
                .HasMaxLength(100)
                .HasColumnName("sheetNameHint");

            entity.Property(e => e.LabelColumn)
                .HasMaxLength(10)
                .HasColumnName("labelColumn");

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");

            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("updatedAt");

            entity.HasOne(d => d.Customer)
                .WithMany(p => p.Customerimportmappings)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("customerimportmappings_ibfk_1");
        });

        modelBuilder.Entity<Customercontract>(entity =>
        {
            entity.HasKey(e => e.ContractId).HasName("PRIMARY");

            entity.ToTable("customercontracts");

            entity.HasIndex(e => e.CustomerId, "customerId");

            entity.HasIndex(e => new { e.CustomerId, e.EffectiveFrom, e.EffectiveTo }, "ixCustomerContractsEffective");

            entity.Property(e => e.ContractId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("contractId");
            entity.Property(e => e.ActiveWeekDays)
                .HasMaxLength(100)
                .HasColumnName("activeWeekDays");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");
            entity.Property(e => e.DefaultBomRatePercent)
                .HasPrecision(5, 2)
                .HasDefaultValueSql("'100.00'")
                .HasColumnName("defaultBomRatePercent");
            entity.Property(e => e.DefaultMenuPrice)
                .HasPrecision(18, 2)
                .HasColumnName("defaultMenuPrice");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effectiveFrom");
            entity.Property(e => e.EffectiveTo).HasColumnName("effectiveTo");
            entity.Property(e => e.ShiftNames)
                .HasMaxLength(100)
                .HasColumnName("shiftNames");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValueSql("'ACTIVE'")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("updatedAt");

            entity.HasOne(d => d.Customer).WithMany(p => p.Customercontracts)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("customercontracts_ibfk_1");
        });

        modelBuilder.Entity<Dish>(entity =>
        {
            entity.HasKey(e => e.DishId).HasName("PRIMARY");

            entity.ToTable("dishes");

            entity.HasIndex(e => e.DishCode, "dishCode").IsUnique();

            entity.Property(e => e.DishId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("dishId");
            entity.Property(e => e.DishCode)
                .HasMaxLength(50)
                .HasColumnName("dishCode");
            entity.Property(e => e.DishGroup)
                .HasMaxLength(100)
                .HasColumnName("dishGroup");
            entity.Property(e => e.DishName)
                .HasMaxLength(200)
                .HasColumnName("dishName");
            entity.Property(e => e.DishType)
                .HasMaxLength(100)
                .HasColumnName("dishType");
            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValueSql("'1'")
                .HasColumnName("isActive");
        });

        modelBuilder.Entity<Dishbom>(entity =>
        {
            entity.HasKey(e => e.BomId).HasName("PRIMARY");

            entity.ToTable("dishbom");

            entity.HasIndex(e => e.IngredientId, "ingredientId")
                .HasDatabaseName("ingredientId");

            entity.HasIndex(e => new { e.DishId, e.EffectiveFrom, e.EffectiveTo }, "ixDishBomDishEffective");

            entity.HasIndex(e => e.CustomerId, "customerId");

            entity.HasIndex(e => new { e.DishId, e.CustomerId, e.PriceTierAmount, e.EffectiveFrom, e.EffectiveTo }, "ixDishBomTierEffective");

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId");

            entity.Property(e => e.BomId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("bomId");
            entity.Property(e => e.BomStatus)
                .HasMaxLength(20)
                .HasDefaultValueSql("'PUBLISHED'")
                .HasColumnName("bomStatus")
                .HasCharSet("utf8mb4")
                .UseCollation("utf8mb4_unicode_ci");
            entity.Property(e => e.DishId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("dishId");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effectiveFrom");
            entity.Property(e => e.EffectiveTo).HasColumnName("effectiveTo");
            entity.Property(e => e.PriceTierAmount)
                .HasPrecision(18, 2)
                .HasDefaultValueSql("'25000.00'")
                .HasColumnName("priceTierAmount");
            entity.Property(e => e.GrossQtyPerServing)
                .HasPrecision(18, 6)
                .HasColumnName("grossQtyPerServing");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");
            entity.Property(e => e.WasteRatePercent)
                .HasPrecision(5, 2)
                .HasColumnName("wasteRatePercent");

            entity.HasOne(d => d.Customer).WithMany(p => p.Dishboms)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("dishbom_ibfk_4");

            entity.HasOne(d => d.Dish).WithMany(p => p.Dishboms)
                .HasForeignKey(d => d.DishId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("dishbom_ibfk_1");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Dishboms)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("dishbom_ibfk_2");

            entity.HasOne(d => d.Unit).WithMany(p => p.Dishboms)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("dishbom_ibfk_3");
        });

        modelBuilder.Entity<Ingredient>(entity =>
        {
            entity.HasKey(e => e.IngredientId).HasName("PRIMARY");

            entity.ToTable("ingredients");

            entity.HasIndex(e => e.IngredientCode, "ingredientCode").IsUnique();

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId1");

            entity.HasIndex(e => e.WarehouseId, "warehouseId");

            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.IngredientCode)
                .HasMaxLength(50)
                .HasColumnName("ingredientCode");
            entity.Property(e => e.IngredientName)
                .HasMaxLength(200)
                .HasColumnName("ingredientName");
            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValueSql("'1'")
                .HasColumnName("isActive");
            entity.Property(e => e.IsFreshDaily).HasColumnName("isFreshDaily");
            entity.Property(e => e.ReferencePrice)
                .HasPrecision(18, 2)
                .HasColumnName("referencePrice");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");
            entity.Property(e => e.WarehouseId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("warehouseId");

            entity.HasOne(d => d.Unit).WithMany(p => p.Ingredients)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("ingredients_ibfk_1");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Ingredients)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("ingredients_ibfk_2");
        });

        modelBuilder.Entity<Inventoryissue>(entity =>
        {
            entity.HasKey(e => e.IssueId).HasName("PRIMARY");

            entity.ToTable("inventoryissues");

            entity.HasIndex(e => e.IssueCode, "issueCode").IsUnique();

            entity.HasIndex(e => e.IssuedBy, "issuedBy");

            entity.HasIndex(e => e.MaterialRequestId, "materialRequestId");

            entity.HasIndex(e => e.ReceivedBy, "receivedBy");

            entity.HasIndex(e => e.WarehouseId, "warehouseId");

            entity.Property(e => e.IssueId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("issueId");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.IssueCode)
                .HasMaxLength(50)
                .HasColumnName("issueCode");
            entity.Property(e => e.IssueDate).HasColumnName("issueDate");
            entity.Property(e => e.IssuedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("issuedBy");
            entity.Property(e => e.MaterialRequestId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("materialRequestId");
            entity.Property(e => e.ReceivedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("receivedBy");
            entity.Property(e => e.ReceivedAt)
                .HasColumnType("datetime")
                .HasColumnName("receivedAt");
            entity.Property(e => e.ShiftName)
                .HasColumnType("enum('MORNING','AFTERNOON')")
                .HasColumnName("shiftName");
            entity.Property(e => e.WarehouseId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("warehouseId");

            entity.HasOne(d => d.IssuedByNavigation).WithMany(p => p.InventoryissueIssuedByNavigations)
                .HasForeignKey(d => d.IssuedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryissues_ibfk_3");

            entity.HasOne(d => d.MaterialRequest).WithMany(p => p.Inventoryissues)
                .HasForeignKey(d => d.MaterialRequestId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryissues_ibfk_2");

            entity.HasOne(d => d.ReceivedByNavigation).WithMany(p => p.InventoryissueReceivedByNavigations)
                .HasForeignKey(d => d.ReceivedBy)
                .HasConstraintName("inventoryissues_ibfk_4");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Inventoryissues)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryissues_ibfk_1");
        });

        modelBuilder.Entity<Inventoryissueline>(entity =>
        {
            entity.HasKey(e => e.IssueLineId).HasName("PRIMARY");

            entity.ToTable("inventoryissuelines");

            entity.HasIndex(e => e.IngredientId, "ingredientId")
                .HasDatabaseName("ingredientId1");

            entity.HasIndex(e => e.IssueId, "issueId");

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId2");

            entity.Property(e => e.IssueLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("issueLineId");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.IssueId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("issueId");
            entity.Property(e => e.IssuedQty)
                .HasPrecision(18, 6)
                .HasColumnName("issuedQty");
            entity.Property(e => e.RequestedQty)
                .HasPrecision(18, 6)
                .HasColumnName("requestedQty");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Inventoryissuelines)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryissuelines_ibfk_2");

            entity.HasOne(d => d.Issue).WithMany(p => p.Inventoryissuelines)
                .HasForeignKey(d => d.IssueId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryissuelines_ibfk_1");

            entity.HasOne(d => d.Unit).WithMany(p => p.Inventoryissuelines)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryissuelines_ibfk_3");
        });

        modelBuilder.Entity<Supplementalmaterialrequest>(entity =>
        {
            entity.HasKey(e => e.RequestId).HasName("PRIMARY");
            entity.ToTable("supplementalmaterialrequests");
            entity.HasIndex(e => e.RequestCode).IsUnique();
            entity.HasIndex(e => new { e.WarehouseId, e.Status, e.RequestedAt });
            entity.HasIndex(e => e.IssueId);
            entity.HasIndex(e => e.IssueLineId);

            entity.Property(e => e.RequestId).HasMaxLength(16).IsFixedLength().HasColumnName("requestId");
            entity.Property(e => e.RequestCode).HasMaxLength(50).HasColumnName("requestCode");
            entity.Property(e => e.IssueId).HasMaxLength(16).IsFixedLength().HasColumnName("issueId");
            entity.Property(e => e.IssueLineId).HasMaxLength(16).IsFixedLength().HasColumnName("issueLineId");
            entity.Property(e => e.WarehouseId).HasMaxLength(16).IsFixedLength().HasColumnName("warehouseId");
            entity.Property(e => e.IngredientId).HasMaxLength(16).IsFixedLength().HasColumnName("ingredientId");
            entity.Property(e => e.UnitId).HasMaxLength(16).IsFixedLength().HasColumnName("unitId");
            entity.Property(e => e.RequestedQty).HasPrecision(18, 6).HasColumnName("requestedQty");
            entity.Property(e => e.Reason).HasMaxLength(1000).HasColumnName("reason");
            entity.Property(e => e.Status).HasMaxLength(24).HasColumnName("status");
            entity.Property(e => e.RequestedBy).HasMaxLength(16).IsFixedLength().HasColumnName("requestedBy");
            entity.Property(e => e.RequestedAt).HasColumnType("datetime").HasColumnName("requestedAt");

            entity.HasOne<Inventoryissue>().WithMany().HasForeignKey(e => e.IssueId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Inventoryissueline>().WithMany().HasForeignKey(e => e.IssueLineId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Warehouse>().WithMany().HasForeignKey(e => e.WarehouseId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Ingredient>().WithMany().HasForeignKey(e => e.IngredientId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Unit>().WithMany().HasForeignKey(e => e.UnitId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.RequestedBy).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Inventoryreceipt>(entity =>
        {
            entity.HasKey(e => e.ReceiptId).HasName("PRIMARY");

            entity.ToTable("inventoryreceipts");

            entity.HasIndex(e => e.CreatedBy, "createdBy");

            entity.HasIndex(e => e.PurchaseRequestId, "purchaseRequestId");

            entity.HasIndex(e => e.ReceiptCode, "receiptCode").IsUnique();

            entity.HasIndex(e => e.SupplierId, "supplierId");

            entity.HasIndex(e => e.WarehouseId, "warehouseId");

            entity.Property(e => e.ReceiptId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("receiptId");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("createdBy");
            entity.Property(e => e.PurchaseRequestId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseRequestId");
            entity.Property(e => e.ReceiptCode)
                .HasMaxLength(50)
                .HasColumnName("receiptCode");
            entity.Property(e => e.ReceiptDate).HasColumnName("receiptDate");
            entity.Property(e => e.SupplierId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("supplierId");
            entity.Property(e => e.WarehouseId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("warehouseId");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Inventoryreceipts)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreceipts_ibfk_4");

            entity.HasOne(d => d.PurchaseRequest).WithMany(p => p.Inventoryreceipts)
                .HasForeignKey(d => d.PurchaseRequestId)
                .HasConstraintName("inventoryreceipts_ibfk_3");

            entity.HasOne(d => d.Supplier).WithMany(p => p.Inventoryreceipts)
                .HasForeignKey(d => d.SupplierId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreceipts_ibfk_2");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Inventoryreceipts)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreceipts_ibfk_1");
        });

        modelBuilder.Entity<Inventoryreceiptline>(entity =>
        {
            entity.HasKey(e => e.ReceiptLineId).HasName("PRIMARY");

            entity.ToTable("inventoryreceiptlines", table =>
            {
                table.HasCheckConstraint(
                    "ckInventoryReceiptLinesPackageSnapshotComplete",
                    "(`packageQuantitySnapshot` IS NULL AND `packageBaseUnitIdSnapshot` IS NULL AND `packagePolicyVersionSnapshot` IS NULL) OR " +
                    "(`packageQuantitySnapshot` IS NOT NULL AND `packageBaseUnitIdSnapshot` IS NOT NULL AND `packagePolicyVersionSnapshot` IS NOT NULL)");
                table.HasCheckConstraint(
                    "ckInventoryReceiptLinesPackageQuantityPositive",
                    "`packageQuantitySnapshot` IS NULL OR `packageQuantitySnapshot` > 0");
            });

            entity.HasIndex(e => new { e.IngredientId, e.ExpiredDate, e.LotNumber }, "ixInventoryReceiptLinesExpiry");

            entity.HasIndex(e => e.PurchaseRequestLineId, "purchaseRequestLineId");

            entity.HasIndex(e => e.ReceiptId, "receiptId");

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId3");

            entity.Property(e => e.ReceiptLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("receiptLineId");
            entity.Property(e => e.Amount)
                .HasPrecision(18, 2)
                .HasComputedColumnSql("`quantity` * `unitPrice`", true)
                .HasColumnName("amount");
            entity.Property(e => e.ExpiredDate).HasColumnName("expiredDate");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.LotNumber)
                .HasMaxLength(100)
                .HasColumnName("lotNumber");
            entity.Property(e => e.ManufactureDate).HasColumnName("manufactureDate");
            entity.Property(e => e.PackageBaseUnitIdSnapshot)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("packageBaseUnitIdSnapshot");
            entity.Property(e => e.PackagePolicyVersionSnapshot)
                .HasMaxLength(100)
                .HasColumnName("packagePolicyVersionSnapshot");
            entity.Property(e => e.PackageQuantitySnapshot)
                .HasPrecision(18, 6)
                .HasColumnName("packageQuantitySnapshot");
            entity.Property(e => e.Quantity)
                .HasPrecision(18, 6)
                .HasColumnName("quantity");
            entity.Property(e => e.PurchaseRequestLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseRequestLineId");
            entity.Property(e => e.ReceiptId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("receiptId");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");
            entity.Property(e => e.UnitPrice)
                .HasPrecision(18, 2)
                .HasColumnName("unitPrice");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Inventoryreceiptlines)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreceiptlines_ibfk_2");

            entity.HasOne(d => d.Receipt).WithMany(p => p.Inventoryreceiptlines)
                .HasForeignKey(d => d.ReceiptId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreceiptlines_ibfk_1");

            entity.HasOne(d => d.PurchaseRequestLine).WithMany(p => p.Inventoryreceiptlines)
                .HasForeignKey(d => d.PurchaseRequestLineId)
                .HasConstraintName("inventoryreceiptlines_ibfk_4");

            entity.HasOne(d => d.Unit).WithMany(p => p.Inventoryreceiptlines)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreceiptlines_ibfk_3");

            entity.HasOne(d => d.PackageBaseUnitSnapshot).WithMany()
                .HasForeignKey(d => d.PackageBaseUnitIdSnapshot)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("inventoryreceiptlines_ibfk_5");
        });

        modelBuilder.Entity<Purchasehistoryreconciliationrun>(entity =>
        {
            entity.HasKey(e => e.PurchaseHistoryReconciliationRunId).HasName("PRIMARY");

            entity.ToTable("purchasehistoryreconciliationruns", table =>
            {
                table.HasCheckConstraint(
                    "ckPurchaseHistoryReconciliationRunsCounts",
                    "`candidateCount` >= 0 AND `currentUniqueBusinessKeyCount` >= 0 AND `auditedDeltaCount` >= 0 AND " +
                    "`actionCount` >= 0 AND `blockerCount` >= 0 AND `keepCount` >= 0 AND `versionCount` >= 0 AND " +
                    "`deactivateCount` >= 0 AND `deleteCount` >= 0 AND `blockCount` >= 0 AND " +
                    "`actionCount` = (`keepCount` + `versionCount` + `deactivateCount` + `deleteCount` + `blockCount`) AND " +
                    "`blockerCount` = `blockCount`");
                table.HasCheckConstraint(
                    "ckPurchaseHistoryReconciliationRunsStatus",
                    "`status` IN ('APPLIED', 'NOOP')");
                table.HasCheckConstraint(
                    "ckPurchaseHistoryReconciliationRunsRestoreVerified",
                    "`restoreVerified` = 1");
            });

            entity.HasIndex(e => e.ManifestHash, "uqPurchaseHistoryReconciliationRunsManifestHash").IsUnique();
            entity.HasIndex(e => e.ManifestId, "ixPurchaseHistoryReconciliationRunsManifestId");
            entity.HasIndex(e => new { e.AppliedBy, e.AppliedAt }, "ixPurchaseHistoryReconciliationRunsActor");

            entity.Property(e => e.PurchaseHistoryReconciliationRunId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseHistoryReconciliationRunId");
            entity.Property(e => e.ManifestId).HasMaxLength(32).HasColumnName("manifestId");
            entity.Property(e => e.ManifestHash).HasMaxLength(64).IsFixedLength().HasColumnName("manifestHash");
            entity.Property(e => e.SourceName).HasMaxLength(255).HasColumnName("sourceName");
            entity.Property(e => e.SourceSha256).HasMaxLength(64).IsFixedLength().HasColumnName("sourceSha256");
            entity.Property(e => e.PolicyVersion).HasMaxLength(100).HasColumnName("policyVersion");
            entity.Property(e => e.AsOfDate).HasColumnName("asOfDate");
            entity.Property(e => e.DatabaseFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("databaseFingerprint");
            entity.Property(e => e.BackupIdentifier).HasMaxLength(255).HasColumnName("backupIdentifier");
            entity.Property(e => e.BackupTargetFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("backupTargetFingerprint");
            entity.Property(e => e.RestoreFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("restoreFingerprint");
            entity.Property(e => e.RestoreVerified).HasColumnName("restoreVerified");
            entity.Property(e => e.AppliedBy).HasMaxLength(16).IsFixedLength().HasColumnName("appliedBy");
            entity.Property(e => e.AppliedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("appliedAt");
            entity.Property(e => e.Status).HasMaxLength(20).HasColumnName("status");
            entity.Property(e => e.CandidateCount).HasColumnName("candidateCount");
            entity.Property(e => e.CurrentUniqueBusinessKeyCount).HasColumnName("currentUniqueBusinessKeyCount");
            entity.Property(e => e.AuditedDeltaCount).HasColumnName("auditedDeltaCount");
            entity.Property(e => e.ActionCount).HasColumnName("actionCount");
            entity.Property(e => e.BlockerCount).HasColumnName("blockerCount");
            entity.Property(e => e.KeepCount).HasColumnName("keepCount");
            entity.Property(e => e.VersionCount).HasColumnName("versionCount");
            entity.Property(e => e.DeactivateCount).HasColumnName("deactivateCount");
            entity.Property(e => e.DeleteCount).HasColumnName("deleteCount");
            entity.Property(e => e.BlockCount).HasColumnName("blockCount");

            entity.HasOne(d => d.AppliedByNavigation).WithMany()
                .HasForeignKey(d => d.AppliedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("purchasehistoryreconciliationruns_ibfk_1");
        });

        modelBuilder.Entity<Purchasehistoryreconciliationaction>(entity =>
        {
            entity.HasKey(e => e.PurchaseHistoryReconciliationActionId).HasName("PRIMARY");

            entity.ToTable("purchasehistoryreconciliationactions", table =>
            {
                table.HasCheckConstraint(
                    "ckPurchaseHistoryReconciliationActionsDisposition",
                    "`actionType` IN ('keep', 'version', 'deactivate', 'delete', 'block')");
                table.HasCheckConstraint(
                    "ckPurchaseHistoryReconciliationActionsSourceRow",
                    "`sourceRow` IS NULL OR `sourceRow` > 0");
            });

            entity.HasIndex(
                    e => new { e.PurchaseHistoryReconciliationRunId, e.ActionId },
                    "uqPurchaseHistoryReconciliationActionsRunAction")
                .IsUnique();
            entity.HasIndex(e => e.ActionHash, "ixPurchaseHistoryReconciliationActionsHash");

            entity.Property(e => e.PurchaseHistoryReconciliationActionId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseHistoryReconciliationActionId");
            entity.Property(e => e.PurchaseHistoryReconciliationRunId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseHistoryReconciliationRunId");
            entity.Property(e => e.ActionId).HasMaxLength(32).IsFixedLength().HasColumnName("actionId");
            entity.Property(e => e.ActionType).HasMaxLength(20).HasColumnName("actionType");
            entity.Property(e => e.SourceKey).HasMaxLength(255).HasColumnName("sourceKey");
            entity.Property(e => e.SourceSheet).HasMaxLength(100).HasColumnName("sourceSheet");
            entity.Property(e => e.SourceRow).HasColumnName("sourceRow");
            entity.Property(e => e.BusinessKey).HasMaxLength(300).HasColumnName("businessKey");
            entity.Property(e => e.TargetType).HasMaxLength(100).HasColumnName("targetType");
            entity.Property(e => e.TargetId).HasMaxLength(64).HasColumnName("targetId");
            entity.Property(e => e.ReasonCode).HasMaxLength(100).HasColumnName("reasonCode");
            entity.Property(e => e.BeforeEvidence).HasColumnType("text").HasColumnName("beforeEvidence");
            entity.Property(e => e.BeforeHash).HasMaxLength(64).IsFixedLength().HasColumnName("beforeHash");
            entity.Property(e => e.AfterEvidence).HasColumnType("text").HasColumnName("afterEvidence");
            entity.Property(e => e.AfterHash).HasMaxLength(64).IsFixedLength().HasColumnName("afterHash");
            entity.Property(e => e.ActionHash).HasMaxLength(64).IsFixedLength().HasColumnName("actionHash");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");

            entity.HasOne(d => d.PurchaseHistoryReconciliationRun)
                .WithMany(p => p.Purchasehistoryreconciliationactions)
                .HasForeignKey(d => d.PurchaseHistoryReconciliationRunId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("purchasehistoryreconciliationactions_ibfk_1");
        });

        modelBuilder.Entity<Inventoryreturn>(entity =>
        {
            entity.HasKey(e => e.ReturnId).HasName("PRIMARY");

            entity.ToTable("inventoryreturns");

            entity.HasIndex(e => e.CreatedBy, "createdBy");

            entity.HasIndex(e => e.IssueId, "issueId");

            entity.HasIndex(e => e.ReturnCode, "returnCode").IsUnique();

            entity.HasIndex(e => e.WarehouseId, "warehouseId");

            entity.Property(e => e.ReturnId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("returnId");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("createdBy");
            entity.Property(e => e.IssueId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("issueId");
            entity.Property(e => e.Reason)
                .HasColumnType("text")
                .HasColumnName("reason");
            entity.Property(e => e.ReturnCode)
                .HasMaxLength(50)
                .HasColumnName("returnCode");
            entity.Property(e => e.ReturnDate).HasColumnName("returnDate");
            entity.Property(e => e.ReturnType)
                .HasMaxLength(20)
                .HasDefaultValue("RETURN")
                .HasColumnName("returnType");
            entity.Property(e => e.ShiftName)
                .HasColumnType("enum('MORNING','AFTERNOON')")
                .HasColumnName("shiftName");
            entity.Property(e => e.WarehouseId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("warehouseId");
            entity.Property(e => e.ReceivedAt)
                .HasColumnType("datetime")
                .HasColumnName("receivedAt");
            entity.Property(e => e.ReceivedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("receivedBy");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Inventoryreturns)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreturns_ibfk_3");

            entity.HasOne(d => d.ReceivedByNavigation).WithMany()
                .HasForeignKey(d => d.ReceivedBy)
                .HasConstraintName("inventoryreturns_ibfk_4");

            entity.HasOne(d => d.Issue).WithMany(p => p.Inventoryreturns)
                .HasForeignKey(d => d.IssueId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreturns_ibfk_2");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Inventoryreturns)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreturns_ibfk_1");
        });

        modelBuilder.Entity<Inventoryreturnline>(entity =>
        {
            entity.HasKey(e => e.ReturnLineId).HasName("PRIMARY");

            entity.ToTable("inventoryreturnlines");

            entity.HasIndex(e => e.IngredientId, "ingredientId")
                .HasDatabaseName("ingredientId2");

            entity.HasIndex(e => e.ReturnId, "returnId");

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId4");

            entity.Property(e => e.ReturnLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("returnLineId");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.Quantity)
                .HasPrecision(18, 6)
                .HasColumnName("quantity");
            entity.Property(e => e.ReturnId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("returnId");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Inventoryreturnlines)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreturnlines_ibfk_2");

            entity.HasOne(d => d.Return).WithMany(p => p.Inventoryreturnlines)
                .HasForeignKey(d => d.ReturnId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreturnlines_ibfk_1");

            entity.HasOne(d => d.Unit).WithMany(p => p.Inventoryreturnlines)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("inventoryreturnlines_ibfk_3");
        });

        modelBuilder.Entity<Materialrequest>(entity =>
        {
            entity.HasKey(e => e.RequestId).HasName("PRIMARY");

            entity.ToTable("materialrequests");

            entity.HasIndex(e => e.ApprovedBy, "approvedBy");

            entity.HasIndex(e => e.CreatedBy, "createdBy");

            entity.HasIndex(e => new { e.PlanId, e.Status }, "ixMaterialRequestsPlan");

            entity.HasIndex(e => e.RequestCode, "requestCode").IsUnique();

            entity.Property(e => e.RequestId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("requestId");
            entity.Property(e => e.ApprovedAt)
                .HasColumnType("datetime")
                .HasColumnName("approvedAt");
            entity.Property(e => e.ApprovedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("approvedBy");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("createdBy");
            entity.Property(e => e.PlanId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("planId");
            entity.Property(e => e.RequestCode)
                .HasMaxLength(50)
                .HasColumnName("requestCode");
            entity.Property(e => e.RequestDate).HasColumnName("requestDate");
            entity.Property(e => e.RequestScope)
                .HasDefaultValueSql("'FULLDAY'")
                .HasColumnType("enum('FULLDAY','MORNING','AFTERNOON')")
                .HasColumnName("requestScope");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'DRAFT'")
                .HasColumnType("enum('DRAFT','MANAGERAPPROVED','SENTTOWAREHOUSE','EXPORTED','CANCELLED')")
                .HasColumnName("status");

            entity.HasOne(d => d.ApprovedByNavigation).WithMany(p => p.MaterialrequestApprovedByNavigations)
                .HasForeignKey(d => d.ApprovedBy)
                .HasConstraintName("materialrequests_ibfk_3");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.MaterialrequestCreatedByNavigations)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("materialrequests_ibfk_2");

            entity.HasOne(d => d.Plan).WithMany(p => p.Materialrequests)
                .HasForeignKey(d => d.PlanId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("materialrequests_ibfk_1");
        });

        modelBuilder.Entity<Materialrequestline>(entity =>
        {
            entity.HasKey(e => e.RequestLineId).HasName("PRIMARY");

            entity.ToTable("materialrequestlines");

            entity.HasIndex(e => e.IngredientId, "ingredientId")
                .HasDatabaseName("ingredientId3");

            entity.HasIndex(e => e.PlanLineId, "planLineId");

            entity.HasIndex(e => e.RequestId, "requestId");

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId5");

            entity.HasIndex(e => e.AppliedPortionRuleId, "appliedPortionRuleId");

            entity.HasIndex(e => e.BomId, "bomId");

            entity.Property(e => e.RequestLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("requestLineId");
            entity.Property(e => e.AppliedPortionRatePercent)
                .HasPrecision(5, 2)
                .HasDefaultValueSql("'100.00'")
                .HasColumnName("appliedPortionRatePercent");
            entity.Property(e => e.AppliedPortionRuleId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("appliedPortionRuleId");
            entity.Property(e => e.AppliedPortionRuleSource)
                .HasMaxLength(50)
                .HasDefaultValueSql("'CONTRACT_DEFAULT'")
                .HasColumnName("appliedPortionRuleSource");
            entity.Property(e => e.BomRatePercent)
                .HasPrecision(5, 2)
                .HasDefaultValueSql("'100.00'")
                .HasColumnName("bomRatePercent");
            entity.Property(e => e.BomId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("bomId");
            entity.Property(e => e.BomScope)
                .HasMaxLength(20)
                .HasDefaultValueSql("'global'")
                .HasColumnName("bomScope");
            entity.Property(e => e.CurrentStockQty)
                .HasPrecision(18, 6)
                .HasColumnName("currentStockQty");
            entity.Property(e => e.GrossQtyPerServing)
                .HasPrecision(18, 6)
                .HasColumnName("grossQtyPerServing");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.PlanLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("planLineId");
            entity.Property(e => e.PriceTierAmount)
                .HasPrecision(18, 2)
                .HasDefaultValueSql("'25000.00'")
                .HasColumnName("priceTierAmount");
            entity.Property(e => e.RequestId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("requestId");
            entity.Property(e => e.SuggestedPurchaseQty)
                .HasPrecision(18, 6)
                .HasColumnName("suggestedPurchaseQty");
            entity.Property(e => e.TotalRequiredQty)
                .HasPrecision(18, 6)
                .HasColumnName("totalRequiredQty");
            entity.Property(e => e.TotalServings).HasColumnName("totalServings");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");
            entity.Property(e => e.YieldLossPercent)
                .HasPrecision(5, 2)
                .HasColumnName("yieldLossPercent");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Materialrequestlines)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("materialrequestlines_ibfk_3");

            entity.HasOne(d => d.Bom).WithMany()
                .HasForeignKey(d => d.BomId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("materialrequestlines_ibfk_5");

            entity.HasOne(d => d.PlanLine).WithMany(p => p.Materialrequestlines)
                .HasForeignKey(d => d.PlanLineId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("materialrequestlines_ibfk_2");

            entity.HasOne(d => d.Request).WithMany(p => p.Materialrequestlines)
                .HasForeignKey(d => d.RequestId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("materialrequestlines_ibfk_1");

            entity.HasOne(d => d.Unit).WithMany(p => p.Materialrequestlines)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("materialrequestlines_ibfk_4");
        });

        modelBuilder.Entity<Mealquantityplan>(entity =>
        {
            entity.HasKey(e => e.QuantityPlanId).HasName("PRIMARY");

            entity.ToTable("mealquantityplans");

            entity.HasIndex(e => e.ConfirmedBy, "confirmedBy");

            entity.HasIndex(e => e.ImportBatchId, "importBatchId");

            entity.HasIndex(e => new { e.ServiceDate, e.Status, e.ConfirmedAt }, "ixMealQuantityPlansDate");

            entity.HasIndex(e => e.PlanCode, "planCode").IsUnique();

            entity.Property(e => e.QuantityPlanId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("quantityPlanId");
            entity.Property(e => e.ConfirmationTime)
                .HasDefaultValueSql("'08:30:00'")
                .HasColumnType("time")
                .HasColumnName("confirmationTime");
            entity.Property(e => e.ConfirmedAt)
                .HasColumnType("datetime")
                .HasColumnName("confirmedAt");
            entity.Property(e => e.ConfirmedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("confirmedBy");
            entity.Property(e => e.ForecastReceivedAt)
                .HasColumnType("datetime")
                .HasColumnName("forecastReceivedAt");
            entity.Property(e => e.ImportBatchId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("importBatchId");
            entity.Property(e => e.PlanCode)
                .HasMaxLength(50)
                .HasColumnName("planCode");
            entity.Property(e => e.ServiceDate).HasColumnName("serviceDate");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'DRAFT'")
                .HasColumnType("enum('DRAFT','FORECASTED','CONFIRMED','ADJUSTED','COMPLETED','CANCELLED')")
                .HasColumnName("status");
            entity.Property(e => e.CompletedAt)
                .HasColumnType("datetime")
                .HasColumnName("completedAt");
            entity.Property(e => e.CompletedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("completedBy");
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .HasColumnType("timestamp(6)")
                .HasColumnName("rowVersion")
                .HasDefaultValueSql("CURRENT_TIMESTAMP(6)")
                .ValueGeneratedOnAddOrUpdate();

            entity.HasOne(d => d.ConfirmedByNavigation).WithMany(p => p.Mealquantityplans)
                .HasForeignKey(d => d.ConfirmedBy)
                .HasConstraintName("mealquantityplans_ibfk_2");

            entity.HasOne(d => d.CompletedByNavigation).WithMany()
                .HasForeignKey(d => d.CompletedBy)
                .HasConstraintName("mealquantityplans_ibfk_3");

            entity.HasOne(d => d.ImportBatch).WithMany(p => p.Mealquantityplans)
                .HasForeignKey(d => d.ImportBatchId)
                .HasConstraintName("mealquantityplans_ibfk_1");
        });

        modelBuilder.Entity<Mealquantityplanline>(entity =>
        {
            entity.HasKey(e => e.QuantityPlanLineId).HasName("PRIMARY");

            entity.ToTable("mealquantityplanlines");

            entity.HasIndex(e => e.CustomerId, "customerId");

            entity.HasIndex(e => e.MenuId, "menuId");

            entity.HasIndex(e => e.MenuScheduleId, "menuScheduleId");

            entity.HasIndex(e => e.QuantityPlanId, "quantityPlanId");

            entity.Property(e => e.QuantityPlanLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("quantityPlanLineId");
            entity.Property(e => e.AdjustedServings).HasColumnName("adjustedServings");
            entity.Property(e => e.ConfirmedServings).HasColumnName("confirmedServings");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");
            entity.Property(e => e.FinalServings).HasColumnName("finalServings");
            entity.Property(e => e.ForecastServings).HasColumnName("forecastServings");
            entity.Property(e => e.MenuId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuId");
            entity.Property(e => e.MenuScheduleId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuScheduleId");
            entity.Property(e => e.QuantityPlanId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("quantityPlanId");
            entity.Property(e => e.ShiftName)
                .HasColumnType("enum('MORNING','AFTERNOON')")
                .HasColumnName("shiftName");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("updatedAt");

            entity.HasOne(d => d.Customer).WithMany(p => p.Mealquantityplanlines)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("mealquantityplanlines_ibfk_3");

            entity.HasOne(d => d.Menu).WithMany(p => p.Mealquantityplanlines)
                .HasForeignKey(d => d.MenuId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("mealquantityplanlines_ibfk_4");

            entity.HasOne(d => d.MenuSchedule).WithMany(p => p.Mealquantityplanlines)
                .HasForeignKey(d => d.MenuScheduleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("mealquantityplanlines_ibfk_2");

            entity.HasOne(d => d.QuantityPlan).WithMany(p => p.Mealquantityplanlines)
                .HasForeignKey(d => d.QuantityPlanId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("mealquantityplanlines_ibfk_1");
        });

        modelBuilder.Entity<Menu>(entity =>
        {
            entity.HasKey(e => e.MenuId).HasName("PRIMARY");

            entity.ToTable("menus");

            entity.HasIndex(e => e.MenuCode, "menuCode").IsUnique();

            entity.Property(e => e.MenuId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuId");
            entity.Property(e => e.FromDate).HasColumnName("fromDate");
            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValueSql("'1'")
                .HasColumnName("isActive");
            entity.Property(e => e.MenuCode)
                .HasMaxLength(50)
                .HasColumnName("menuCode");
            entity.Property(e => e.MenuName)
                .HasMaxLength(200)
                .HasColumnName("menuName");
            entity.Property(e => e.ToDate).HasColumnName("toDate");
        });

        modelBuilder.Entity<Menuitem>(entity =>
        {
            entity.HasKey(e => e.MenuItemId).HasName("PRIMARY");

            entity.ToTable("menuitems");

            entity.HasIndex(e => e.DishId, "dishId");

            entity.HasIndex(e => e.MenuId, "menuId");

            entity.Property(e => e.MenuItemId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuItemId");
            entity.Property(e => e.DishId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("dishId");
            entity.Property(e => e.DishSlot)
                .HasMaxLength(100)
                .HasColumnName("dishSlot");
            entity.Property(e => e.DisplayOrder)
                .HasDefaultValueSql("'1'")
                .HasColumnName("displayOrder");
            entity.Property(e => e.MenuId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuId");

            entity.HasOne(d => d.Dish).WithMany(p => p.Menuitems)
                .HasForeignKey(d => d.DishId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("menuitems_ibfk_2");

            entity.HasOne(d => d.Menu).WithMany(p => p.Menuitems)
                .HasForeignKey(d => d.MenuId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("menuitems_ibfk_1");
        });

        modelBuilder.Entity<Menuschedule>(entity =>
        {
            entity.HasKey(e => e.MenuScheduleId).HasName("PRIMARY");

            entity.ToTable("menuschedules");

            entity.HasIndex(e => new { e.WeekStartDate, e.ServiceDate, e.ShiftName, e.CustomerId }, "ixMenuSchedulesWeek");

            entity.HasIndex(e => e.MenuId, "menuId");

            entity.HasIndex(e => new { e.CustomerId, e.ServiceDate, e.ShiftName }, "uqMenuSchedulesCustomerDateShift").IsUnique();

            entity.Property(e => e.MenuScheduleId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuScheduleId");
            entity.Property(e => e.BomRatePercent)
                .HasPrecision(5, 2)
                .HasDefaultValueSql("'100.00'")
                .HasColumnName("bomRatePercent");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");
            entity.Property(e => e.MenuId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuId");
            entity.Property(e => e.MenuPrice)
                .HasPrecision(18, 2)
                .HasColumnName("menuPrice");
            entity.Property(e => e.ServiceDate).HasColumnName("serviceDate");
            entity.Property(e => e.ShiftName)
                .HasColumnType("enum('MORNING','AFTERNOON')")
                .HasColumnName("shiftName");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValueSql("'DRAFT'")
                .HasColumnName("status");
            entity.Property(e => e.WeekStartDate).HasColumnName("weekStartDate");
            entity.Property(e => e.MenuVersionId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuVersionId");

            entity.HasOne(d => d.Customer).WithMany(p => p.Menuschedules)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("menuschedules_ibfk_1");

            entity.HasOne(d => d.Menu).WithMany(p => p.Menuschedules)
                .HasForeignKey(d => d.MenuId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("menuschedules_ibfk_2");

            entity.HasOne(d => d.MenuVersion).WithMany(p => p.Menuschedules)
                .HasForeignKey(d => d.MenuVersionId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("menuschedules_ibfk_3");
        });

        modelBuilder.Entity<Menuversion>(entity =>
        {
            entity.HasKey(e => e.MenuVersionId).HasName("PRIMARY");

            entity.ToTable("menuversions");

            entity.HasIndex(e => e.CustomerId, "customerId");

            entity.HasIndex(e => new { e.CustomerId, e.WeekStartDate, e.VersionNo }, "uqMenuVersionsCustomerWeekVersion")
                .IsUnique();

            entity.HasIndex(e => new { e.CustomerId, e.WeekStartDate, e.Status }, "ixMenuVersionsCustomerWeekStatus");

            entity.Property(e => e.MenuVersionId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuVersionId");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("createdBy");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");
            entity.Property(e => e.PublishedAt)
                .HasColumnType("datetime")
                .HasColumnName("publishedAt");
            entity.Property(e => e.PublishedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("publishedBy");
            entity.Property(e => e.SourceChecksum)
                .HasMaxLength(128)
                .HasColumnName("sourceChecksum");
            entity.Property(e => e.SourceFileName)
                .HasMaxLength(255)
                .HasColumnName("sourceFileName");
            entity.Property(e => e.SourceImportBatch)
                .HasMaxLength(80)
                .HasColumnName("sourceImportBatch");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValueSql("'DRAFT'")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("updatedAt");
            entity.Property(e => e.VersionNo).HasColumnName("versionNo");
            entity.Property(e => e.WeekStartDate).HasColumnName("weekStartDate");
            entity.Property(e => e.SuccessRowCount)
                .HasDefaultValueSql("'0'")
                .HasColumnName("successRowCount");
            entity.Property(e => e.ErrorRowCount)
                .HasDefaultValueSql("'0'")
                .HasColumnName("errorRowCount");
            entity.Property(e => e.WarningRowCount)
                .HasDefaultValueSql("'0'")
                .HasColumnName("warningRowCount");

            entity.HasOne(d => d.Customer).WithMany(p => p.Menuversions)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("menuversions_ibfk_1");
        });

        modelBuilder.Entity<Portionrule>(entity =>
        {
            entity.HasKey(e => e.PortionRuleId).HasName("PRIMARY");

            entity.ToTable("portionrules");

            entity.HasIndex(e => e.CustomerId, "customerId");

            entity.HasIndex(e => e.DishId, "dishId");

            entity.HasIndex(e => new { e.CustomerId, e.EffectiveFrom, e.EffectiveTo, e.Status }, "ixPortionRulesCustomerEffective");

            entity.Property(e => e.PortionRuleId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("portionRuleId");
            entity.Property(e => e.ActiveWeekDays)
                .HasMaxLength(100)
                .HasColumnName("activeWeekDays");
            entity.Property(e => e.BomRatePercent)
                .HasPrecision(5, 2)
                .HasColumnName("bomRatePercent");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");
            entity.Property(e => e.DishCategory)
                .HasMaxLength(100)
                .HasColumnName("dishCategory");
            entity.Property(e => e.DishId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("dishId");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effectiveFrom");
            entity.Property(e => e.EffectiveTo).HasColumnName("effectiveTo");
            entity.Property(e => e.MenuSectionName)
                .HasMaxLength(150)
                .HasColumnName("menuSectionName");
            entity.Property(e => e.MenuVariant)
                .HasMaxLength(50)
                .HasColumnName("menuVariant");
            entity.Property(e => e.PortionRatePercent)
                .HasPrecision(5, 2)
                .HasColumnName("portionRatePercent");
            entity.Property(e => e.Priority)
                .HasDefaultValueSql("'0'")
                .HasColumnName("priority");
            entity.Property(e => e.Reason)
                .HasColumnType("text")
                .HasColumnName("reason");
            entity.Property(e => e.ShiftNames)
                .HasMaxLength(100)
                .HasColumnName("shiftNames");
            entity.Property(e => e.SlotName)
                .HasMaxLength(100)
                .HasColumnName("slotName");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValueSql("'ACTIVE'")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("updatedAt");
            entity.Property(e => e.YieldLossPercent)
                .HasPrecision(5, 2)
                .HasColumnName("yieldLossPercent");

            entity.HasOne(d => d.Customer).WithMany(p => p.Portionrules)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("portionrules_ibfk_1");

            entity.HasOne(d => d.Dish).WithMany(p => p.Portionrules)
                .HasForeignKey(d => d.DishId)
                .HasConstraintName("portionrules_ibfk_2");
        });

        modelBuilder.Entity<Productionplan>(entity =>
        {
            entity.HasKey(e => e.PlanId).HasName("PRIMARY");

            entity.ToTable("productionplans");

            entity.HasIndex(e => e.CustomerId, "customerId");

            entity.HasIndex(e => e.CreatedBy, "createdBy");

            entity.HasIndex(e => e.MenuVersionId, "menuVersionId");

            entity.HasIndex(e => e.PlanCode, "planCode").IsUnique();

            entity.HasIndex(e => e.SentToKitchenBy, "sentToKitchenBy");

            entity.Property(e => e.PlanId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("planId");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("createdBy");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");
            entity.Property(e => e.MenuVersionId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuVersionId");
            entity.Property(e => e.PlanCode)
                .HasMaxLength(50)
                .HasColumnName("planCode");
            entity.Property(e => e.PlanDate).HasColumnName("planDate");
            entity.Property(e => e.SentToKitchenAt)
                .HasColumnType("datetime")
                .HasColumnName("sentToKitchenAt");
            entity.Property(e => e.SentToKitchenBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("sentToKitchenBy");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'CREATED'")
                .HasColumnType("enum('CREATED','SENTTOKITCHEN','COMPLETED','CANCELLED')")
                .HasColumnName("status");
            entity.Property(e => e.WeekStartDate).HasColumnName("weekStartDate");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("updatedAt");
            entity.Property(e => e.WeekStartDate).HasColumnName("weekStartDate");

            entity.HasOne(d => d.Customer).WithMany()
                .HasForeignKey(d => d.CustomerId)
                .HasConstraintName("productionplans_ibfk_2");

            entity.HasOne(d => d.MenuVersion).WithMany()
                .HasForeignKey(d => d.MenuVersionId)
                .HasConstraintName("productionplans_ibfk_3");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Productionplans)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("productionplans_ibfk_1");

            entity.HasOne(d => d.SentToKitchenByNavigation).WithMany()
                .HasForeignKey(d => d.SentToKitchenBy)
                .HasConstraintName("productionplans_ibfk_4");
        });

        modelBuilder.Entity<Productionplanline>(entity =>
        {
            entity.HasKey(e => e.PlanLineId).HasName("PRIMARY");

            entity.ToTable("productionplanlines");

            entity.HasIndex(e => e.CustomerId, "customerId");

            entity.HasIndex(e => e.DishId, "dishId");

            entity.HasIndex(e => e.MenuId, "menuId");

            entity.HasIndex(e => e.PlanId, "planId");

            entity.HasIndex(e => e.QuantityPlanLineId, "quantityPlanLineId");

            entity.Property(e => e.PlanLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("planLineId");
            entity.Property(e => e.CustomerId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("customerId");
            entity.Property(e => e.DishId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("dishId");
            entity.Property(e => e.MenuId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("menuId");
            entity.Property(e => e.PlanId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("planId");
            entity.Property(e => e.QuantityPlanLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("quantityPlanLineId");
            entity.Property(e => e.ShiftName)
                .HasColumnType("enum('MORNING','AFTERNOON')")
                .HasColumnName("shiftName");
            entity.Property(e => e.TotalServings).HasColumnName("totalServings");

            entity.HasOne(d => d.Customer).WithMany(p => p.Productionplanlines)
                .HasForeignKey(d => d.CustomerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("productionplanlines_ibfk_3");

            entity.HasOne(d => d.Dish).WithMany(p => p.Productionplanlines)
                .HasForeignKey(d => d.DishId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("productionplanlines_ibfk_5");

            entity.HasOne(d => d.Menu).WithMany(p => p.Productionplanlines)
                .HasForeignKey(d => d.MenuId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("productionplanlines_ibfk_4");

            entity.HasOne(d => d.Plan).WithMany(p => p.Productionplanlines)
                .HasForeignKey(d => d.PlanId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("productionplanlines_ibfk_1");

            entity.HasOne(d => d.QuantityPlanLine).WithMany(p => p.Productionplanlines)
                .HasForeignKey(d => d.QuantityPlanLineId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("productionplanlines_ibfk_2");
        });

        modelBuilder.Entity<Purchaserequest>(entity =>
        {
            entity.HasKey(e => e.PurchaseRequestId).HasName("PRIMARY");

            entity.ToTable("purchaserequests");

            entity.HasIndex(e => e.ApprovedBy, "approvedBy");

            entity.HasIndex(e => e.CreatedBy, "createdBy");

            entity.HasIndex(e => new { e.PurchaseForDate, e.Status }, "ixPurchaseRequestsDate");

            entity.HasIndex(e => e.PurchaseRequestCode, "purchaseRequestCode").IsUnique();

            entity.Property(e => e.PurchaseRequestId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseRequestId");
            entity.Property(e => e.ApprovedAt)
                .HasColumnType("datetime")
                .HasColumnName("approvedAt");
            entity.Property(e => e.ApprovedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("approvedBy");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("createdBy");
            entity.Property(e => e.PurchaseForDate).HasColumnName("purchaseForDate");
            entity.Property(e => e.PurchaseRequestCode)
                .HasMaxLength(50)
                .HasColumnName("purchaseRequestCode");
            entity.Property(e => e.RequestDate).HasColumnName("requestDate");
            entity.Property(e => e.ShiftName)
                .HasColumnType("enum('MORNING','AFTERNOON')")
                .HasColumnName("shiftName");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'DRAFT'")
                .HasColumnType("enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','PARTIALRECEIVED','RECEIVED','CANCELLED')")
                .HasColumnName("status");

            entity.HasOne(d => d.ApprovedByNavigation).WithMany(p => p.PurchaserequestApprovedByNavigations)
                .HasForeignKey(d => d.ApprovedBy)
                .HasConstraintName("purchaserequests_ibfk_2");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.PurchaserequestCreatedByNavigations)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaserequests_ibfk_1");
        });

        modelBuilder.Entity<Purchaserequestline>(entity =>
        {
            entity.HasKey(e => e.PurchaseRequestLineId).HasName("PRIMARY");

            entity.ToTable("purchaserequestlines");

            entity.HasIndex(e => e.IngredientId, "ingredientId")
                .HasDatabaseName("ingredientId4");

            entity.HasIndex(e => e.MaterialRequestLineId, "materialRequestLineId");

            entity.HasIndex(e => e.PurchaseRequestId, "purchaseRequestId");

            entity.HasIndex(e => e.SupplierId, "supplierId");

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId6");

            entity.Property(e => e.PurchaseRequestLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseRequestLineId");
            entity.Property(e => e.CurrentStockQty)
                .HasPrecision(18, 6)
                .HasColumnName("currentStockQty");
            entity.Property(e => e.EstimatedUnitPrice)
                .HasPrecision(18, 2)
                .HasColumnName("estimatedUnitPrice");
            entity.Property(e => e.ExpectedDeliveryDate)
                .HasColumnType("date")
                .HasColumnName("expectedDeliveryDate");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.MaterialRequestLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("materialRequestLineId");
            entity.Property(e => e.Note)
                .HasColumnType("text")
                .HasColumnName("note");
            entity.Property(e => e.IsLegacySupplierSnapshot)
                .HasDefaultValue(false)
                .HasColumnName("isLegacySupplierSnapshot");
            entity.Property(e => e.PurchaseQty)
                .HasPrecision(18, 6)
                .HasColumnName("purchaseQty");
            entity.Property(e => e.PurchaseRequestId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseRequestId");
            entity.Property(e => e.RequiredQty)
                .HasPrecision(18, 6)
                .HasColumnName("requiredQty");
            entity.Property(e => e.SupplierId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("supplierId");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Purchaserequestlines)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaserequestlines_ibfk_3");

            entity.HasOne(d => d.MaterialRequestLine).WithMany(p => p.Purchaserequestlines)
                .HasForeignKey(d => d.MaterialRequestLineId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaserequestlines_ibfk_2");

            entity.HasOne(d => d.PurchaseRequest).WithMany(p => p.Purchaserequestlines)
                .HasForeignKey(d => d.PurchaseRequestId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaserequestlines_ibfk_1");

            entity.HasOne(d => d.Supplier).WithMany(p => p.Purchaserequestlines)
                .HasForeignKey(d => d.SupplierId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .IsRequired(false)
                .HasConstraintName("purchaserequestlines_ibfk_4");

            entity.HasOne(d => d.Unit).WithMany(p => p.Purchaserequestlines)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaserequestlines_ibfk_5");
        });

        modelBuilder.Entity<Purchaselinesupplierdecision>(entity =>
        {
            entity.HasKey(e => e.PurchaseLineSupplierDecisionId).HasName("PRIMARY");

            entity.ToTable("purchaselinesupplierdecisions", table =>
            {
                table.HasCheckConstraint(
                    "ckPurchaseLineSupplierDecisionsEvidenceComplete",
                    "`evidenceType` IN ('EFFECTIVE_QUOTATION', 'LATEST_VALID_RECEIPT') AND " +
                    "`evidenceReferencePrice` > 0 AND `proposedUnitPrice` > 0");
                table.HasCheckConstraint(
                    "ckPurchaseLineSupplierDecisionsConfirmationComplete",
                    "`confirmedBy` IS NOT NULL AND `confirmedAt` IS NOT NULL AND `version` > 0 AND `concurrencyVersion` > 0");
                table.HasCheckConstraint(
                    "ckPurchaseLineSupplierDecisionsStatus",
                    "`status` IN ('CURRENT', 'SUPERSEDED')");
                table.HasCheckConstraint(
                    "ckPurchaseLineSupplierDecisionsCurrentKey",
                    "(`status` = 'CURRENT' AND `currentDecisionKey` = `purchaseRequestLineId` AND `supersededByDecisionId` IS NULL) OR " +
                    "(`status` = 'SUPERSEDED' AND `currentDecisionKey` IS NULL AND `supersededByDecisionId` IS NOT NULL)");
            });

            entity.HasIndex(e => new { e.PurchaseRequestLineId, e.Version }, "uqPurchaseLineSupplierDecisionsLineVersion").IsUnique();
            entity.HasIndex(e => new { e.PurchaseRequestLineId, e.DecisionFingerprint }, "uqPurchaseLineSupplierDecisionsLineFingerprint").IsUnique();
            entity.HasIndex(e => e.CurrentDecisionKey, "uqPurchaseLineSupplierDecisionsCurrentKey").IsUnique();
            entity.HasIndex(e => e.SupplierId, "ixPurchaseLineSupplierDecisionsSupplier");
            entity.HasIndex(e => e.ConfirmedBy, "ixPurchaseLineSupplierDecisionsConfirmer");
            entity.HasIndex(e => e.SupersededByDecisionId, "ixPurchaseLineSupplierDecisionsSupersededBy");

            entity.Property(e => e.PurchaseLineSupplierDecisionId).HasMaxLength(16).IsFixedLength().HasColumnName("purchaseLineSupplierDecisionId");
            entity.Property(e => e.PurchaseRequestLineId).HasMaxLength(16).IsFixedLength().HasColumnName("purchaseRequestLineId");
            entity.Property(e => e.SupplierId).HasMaxLength(16).IsFixedLength().HasColumnName("supplierId");
            entity.Property(e => e.EvidenceType).HasMaxLength(40).HasColumnName("evidenceType");
            entity.Property(e => e.EvidenceId).HasMaxLength(16).IsFixedLength().HasColumnName("evidenceId");
            entity.Property(e => e.EvidenceDate).HasColumnType("date").HasColumnName("evidenceDate");
            entity.Property(e => e.EvidenceReferencePrice).HasPrecision(18, 2).HasColumnName("evidenceReferencePrice");
            entity.Property(e => e.ProposedUnitPrice).HasPrecision(18, 2).HasColumnName("proposedUnitPrice");
            entity.Property(e => e.ProposedDeliveryDate).HasColumnType("date").HasColumnName("proposedDeliveryDate");
            entity.Property(e => e.ConfirmedBy).HasMaxLength(16).IsFixedLength().HasColumnName("confirmedBy");
            entity.Property(e => e.ConfirmedAt).HasColumnType("datetime").HasColumnName("confirmedAt");
            entity.Property(e => e.DecisionFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("decisionFingerprint");
            entity.Property(e => e.Version).HasColumnName("version");
            entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValue("CURRENT").HasColumnName("status");
            entity.Property(e => e.CurrentDecisionKey).HasMaxLength(16).IsFixedLength().HasColumnName("currentDecisionKey");
            entity.Property(e => e.SupersededByDecisionId).HasMaxLength(16).IsFixedLength().HasColumnName("supersededByDecisionId");
            entity.Property(e => e.ConcurrencyVersion).IsConcurrencyToken().HasDefaultValue(1).HasColumnName("concurrencyVersion");

            entity.HasOne(d => d.PurchaseRequestLine).WithMany(p => p.SupplierDecisions)
                .HasForeignKey(d => d.PurchaseRequestLineId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("purchaselinesupplierdecisions_ibfk_1");
            entity.HasOne(d => d.Supplier).WithMany()
                .HasForeignKey(d => d.SupplierId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("purchaselinesupplierdecisions_ibfk_2");
            entity.HasOne(d => d.ConfirmedByNavigation).WithMany()
                .HasForeignKey(d => d.ConfirmedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("purchaselinesupplierdecisions_ibfk_3");
            entity.HasOne(d => d.SupersededByDecision).WithMany(p => p.SupersededDecisions)
                .HasForeignKey(d => d.SupersededByDecisionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("purchaselinesupplierdecisions_ibfk_4");
        });

        modelBuilder.Entity<Purchasepriceexception>(entity =>
        {
            entity.HasKey(e => e.PurchasePriceExceptionId).HasName("PRIMARY");

            entity.ToTable("purchasepriceexceptions", table =>
            {
                table.HasCheckConstraint(
                    "ckPurchasePriceExceptionsStrictVariance",
                    "`referencePrice` > 0 AND `proposedPrice` > `referencePrice` AND `variancePercent` > 15");
                table.HasCheckConstraint(
                    "ckPurchasePriceExceptionsDecisionComplete",
                    "(`status` = 'PENDING' AND `decidedBy` IS NULL AND `decisionReason` IS NULL AND `decidedAt` IS NULL) OR " +
                    "(`status` IN ('APPROVED', 'REJECTED') AND `decidedBy` IS NOT NULL AND `decisionReason` IS NOT NULL AND `decidedAt` IS NOT NULL) OR " +
                    "`status` = 'SUPERSEDED'");
                table.HasCheckConstraint(
                    "ckPurchasePriceExceptionsStatus",
                    "`status` IN ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED')");
                table.HasCheckConstraint(
                    "ckPurchasePriceExceptionsSupersession",
                    "(`status` = 'SUPERSEDED' AND `supersededByExceptionId` IS NOT NULL) OR " +
                    "(`status` <> 'SUPERSEDED' AND `supersededByExceptionId` IS NULL)");
            });

            entity.HasIndex(
                    e => new { e.PurchaseLineSupplierDecisionId, e.ProposalFingerprint, e.ProposalVersion },
                    "uqPurchasePriceExceptionsProposal")
                .IsUnique();
            entity.HasIndex(e => e.RequestedBy, "ixPurchasePriceExceptionsRequester");
            entity.HasIndex(e => e.DecidedBy, "ixPurchasePriceExceptionsDecider");
            entity.HasIndex(e => e.SupersededByExceptionId, "ixPurchasePriceExceptionsSupersededBy");

            entity.Property(e => e.PurchasePriceExceptionId).HasMaxLength(16).IsFixedLength().HasColumnName("purchasePriceExceptionId");
            entity.Property(e => e.PurchaseLineSupplierDecisionId).HasMaxLength(16).IsFixedLength().HasColumnName("purchaseLineSupplierDecisionId");
            entity.Property(e => e.ReferencePrice).HasPrecision(18, 2).HasColumnName("referencePrice");
            entity.Property(e => e.ProposedPrice).HasPrecision(18, 2).HasColumnName("proposedPrice");
            entity.Property(e => e.VariancePercent).HasPrecision(9, 4).HasColumnName("variancePercent");
            entity.Property(e => e.EvidenceType).HasMaxLength(40).HasColumnName("evidenceType");
            entity.Property(e => e.EvidenceId).HasMaxLength(16).IsFixedLength().HasColumnName("evidenceId");
            entity.Property(e => e.EvidenceDate).HasColumnType("date").HasColumnName("evidenceDate");
            entity.Property(e => e.Reason).HasColumnType("text").HasColumnName("reason");
            entity.Property(e => e.ProposalFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("proposalFingerprint");
            entity.Property(e => e.ProposalVersion).HasColumnName("proposalVersion");
            entity.Property(e => e.RequestedBy).HasMaxLength(16).IsFixedLength().HasColumnName("requestedBy");
            entity.Property(e => e.RequestedAt).HasColumnType("datetime").HasColumnName("requestedAt");
            entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValue("PENDING").HasColumnName("status");
            entity.Property(e => e.DecidedBy).HasMaxLength(16).IsFixedLength().HasColumnName("decidedBy");
            entity.Property(e => e.DecisionReason).HasColumnType("text").HasColumnName("decisionReason");
            entity.Property(e => e.DecidedAt).HasColumnType("datetime").HasColumnName("decidedAt");
            entity.Property(e => e.SupersededByExceptionId).HasMaxLength(16).IsFixedLength().HasColumnName("supersededByExceptionId");
            entity.Property(e => e.ConcurrencyVersion).IsConcurrencyToken().HasDefaultValue(1).HasColumnName("concurrencyVersion");

            entity.HasOne(d => d.PurchaseLineSupplierDecision).WithMany(p => p.Purchasepriceexceptions)
                .HasForeignKey(d => d.PurchaseLineSupplierDecisionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("purchasepriceexceptions_ibfk_1");
            entity.HasOne(d => d.RequestedByNavigation).WithMany()
                .HasForeignKey(d => d.RequestedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("purchasepriceexceptions_ibfk_2");
            entity.HasOne(d => d.DecidedByNavigation).WithMany()
                .HasForeignKey(d => d.DecidedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("purchasepriceexceptions_ibfk_3");
            entity.HasOne(d => d.SupersededByException).WithMany(p => p.SupersededExceptions)
                .HasForeignKey(d => d.SupersededByExceptionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("purchasepriceexceptions_ibfk_4");
        });

        modelBuilder.Entity<Purchaseorder>(entity =>
        {
            entity.HasKey(e => e.PurchaseOrderId).HasName("PRIMARY");

            entity.ToTable("purchaseorders");

            entity.HasIndex(e => e.PurchaseOrderCode, "purchaseOrderCode").IsUnique();

            entity.HasIndex(e => e.PurchaseRequestId, "ixPurchaseOrdersRequest");

            entity.HasIndex(e => e.SupplierId, "ixPurchaseOrdersSupplier");

            entity.HasIndex(e => new { e.PurchaseRequestId, e.SupplierId }, "ixPurchaseOrdersRequestSupplier").IsUnique();

            entity.Property(e => e.PurchaseOrderId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseOrderId");
            entity.Property(e => e.PurchaseOrderCode)
                .HasMaxLength(50)
                .HasColumnName("purchaseOrderCode");
            entity.Property(e => e.PurchaseRequestId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseRequestId");
            entity.Property(e => e.SupplierId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("supplierId");
            entity.Property(e => e.OrderDate).HasColumnName("orderDate");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValue("ORDERED")
                .HasColumnName("status");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("createdBy");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("updatedAt");

            entity.HasOne(d => d.PurchaseRequest).WithMany(p => p.Purchaseorders)
                .HasForeignKey(d => d.PurchaseRequestId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaseorders_ibfk_1");

            entity.HasOne(d => d.Supplier).WithMany(p => p.Purchaseorders)
                .HasForeignKey(d => d.SupplierId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaseorders_ibfk_2");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Purchaseorders)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaseorders_ibfk_3");
        });

        modelBuilder.Entity<Purchaseorderline>(entity =>
        {
            entity.HasKey(e => e.PurchaseOrderLineId).HasName("PRIMARY");

            entity.ToTable("purchaseorderlines");

            entity.HasIndex(e => e.PurchaseOrderId, "ixPurchaseOrderLinesOrder");

            entity.HasIndex(e => e.PurchaseRequestLineId, "ixPurchaseOrderLinesRequestLine").IsUnique();

            entity.HasIndex(e => e.IngredientId, "ixPurchaseOrderLinesIngredient");

            entity.HasIndex(e => e.UnitId, "ixPurchaseOrderLinesUnit");

            entity.Property(e => e.PurchaseOrderLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseOrderLineId");
            entity.Property(e => e.PurchaseOrderId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseOrderId");
            entity.Property(e => e.PurchaseRequestLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("purchaseRequestLineId");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");
            entity.Property(e => e.OrderedQty)
                .HasPrecision(18, 6)
                .HasColumnName("orderedQty");
            entity.Property(e => e.ReceivedQty)
                .HasPrecision(18, 6)
                .HasColumnName("receivedQty");
            entity.Property(e => e.UnitPrice)
                .HasPrecision(18, 2)
                .HasColumnName("unitPrice");

            entity.HasOne(d => d.PurchaseOrder).WithMany(p => p.Purchaseorderlines)
                .HasForeignKey(d => d.PurchaseOrderId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaseorderlines_ibfk_1");

            entity.HasOne(d => d.PurchaseRequestLine).WithOne(p => p.Purchaseorderline)
                .HasForeignKey<Purchaseorderline>(d => d.PurchaseRequestLineId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaseorderlines_ibfk_2");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Purchaseorderlines)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaseorderlines_ibfk_3");

            entity.HasOne(d => d.Unit).WithMany(p => p.Purchaseorderlines)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("purchaseorderlines_ibfk_4");
        });

        modelBuilder.Entity<Quantityadjustment>(entity =>
        {
            entity.HasKey(e => e.AdjustmentId).HasName("PRIMARY");

            entity.ToTable("quantityadjustments");

            entity.HasIndex(e => e.AdjustedBy, "adjustedBy");

            entity.HasIndex(e => e.QuantityPlanLineId, "quantityPlanLineId");

            entity.Property(e => e.AdjustmentId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("adjustmentId");
            entity.Property(e => e.AdjustedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("adjustedAt");
            entity.Property(e => e.AdjustedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("adjustedBy");
            entity.Property(e => e.NewServings).HasColumnName("newServings");
            entity.Property(e => e.OldServings).HasColumnName("oldServings");
            entity.Property(e => e.QuantityPlanLineId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("quantityPlanLineId");
            entity.Property(e => e.Reason)
                .HasColumnType("text")
                .HasColumnName("reason");

            entity.HasOne(d => d.AdjustedByNavigation).WithMany(p => p.Quantityadjustments)
                .HasForeignKey(d => d.AdjustedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("quantityadjustments_ibfk_2");

            entity.HasOne(d => d.QuantityPlanLine).WithMany(p => p.Quantityadjustments)
                .HasForeignKey(d => d.QuantityPlanLineId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("quantityadjustments_ibfk_1");
        });

        modelBuilder.Entity<Quantityimportbatch>(entity =>
        {
            entity.HasKey(e => e.ImportBatchId).HasName("PRIMARY");

            entity.ToTable("quantityimportbatches");

            entity.HasIndex(e => e.BatchCode, "batchCode").IsUnique();

            entity.HasIndex(e => e.ImportedBy, "importedBy");

            entity.Property(e => e.ImportBatchId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("importBatchId");
            entity.Property(e => e.BatchCode)
                .HasMaxLength(50)
                .HasColumnName("batchCode");
            entity.Property(e => e.ImportedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("importedAt");
            entity.Property(e => e.ImportedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("importedBy");
            entity.Property(e => e.SourceCompanyName)
                .HasMaxLength(200)
                .HasColumnName("sourceCompanyName");
            entity.Property(e => e.SourceType)
                .HasDefaultValueSql("'MANUAL'")
                .HasColumnType("enum('EXCEL','API','EMAIL','MANUAL')")
                .HasColumnName("sourceType");
            entity.Property(e => e.Status)
                .HasDefaultValueSql("'RECEIVED'")
                .HasColumnType("enum('RECEIVED','VALIDATED','CONFIRMED','REJECTED')")
                .HasColumnName("status");

            entity.HasOne(d => d.ImportedByNavigation).WithMany(p => p.Quantityimportbatches)
                .HasForeignKey(d => d.ImportedBy)
                .HasConstraintName("quantityimportbatches_ibfk_1");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.RoleId).HasName("PRIMARY");

            entity.ToTable("roles");

            entity.HasIndex(e => e.RoleCode, "roleCode").IsUnique();

            entity.Property(e => e.RoleId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("roleId");
            entity.Property(e => e.RoleCode)
                .HasMaxLength(50)
                .HasColumnName("roleCode");
            entity.Property(e => e.RoleName)
                .HasMaxLength(100)
                .HasColumnName("roleName");
        });

        modelBuilder.Entity<Stockmovement>(entity =>
        {
            entity.HasKey(e => e.MovementId).HasName("PRIMARY");

            entity.ToTable("stockmovements");

            entity.HasIndex(e => e.IngredientId, "ingredientId")
                .HasDatabaseName("ingredientId5");

            entity.HasIndex(e => new { e.WarehouseId, e.IngredientId, e.MovementDate }, "ixStockMovementsLookup");

            // Index cho báo cáo biến động NVL theo ngày
            entity.HasIndex(e => new { e.IngredientId, e.MovementDate }, "ixStockMovementsIngredientDate");

            // Index cho báo cáo theo loại giao dịch
            entity.HasIndex(e => new { e.MovementType, e.MovementDate }, "ixStockMovementsTypeDate");

            // Index cho truy vấn tham chiếu chứng từ gốc
            entity.HasIndex(e => new { e.RefTable, e.RefId }, "ixStockMovementsRef");

            entity.HasIndex(e => e.PerformedBy, "performedBy");

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId7");

            entity.Property(e => e.MovementId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("movementId");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.MovementDate)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("movementDate");
            entity.Property(e => e.MovementType)
                .HasColumnType("enum('RECEIPT','ISSUE','RETURN','ADJUSTMENT')")
                .HasColumnName("movementType");
            entity.Property(e => e.ExpiredDate).HasColumnName("expiredDate");
            entity.Property(e => e.LotNumber)
                .HasMaxLength(100)
                .HasColumnName("lotNumber");
            entity.Property(e => e.ManufactureDate).HasColumnName("manufactureDate");
            entity.Property(e => e.Note)
                .HasColumnType("text")
                .HasColumnName("note");
            entity.Property(e => e.PerformedBy)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("performedBy");
            entity.Property(e => e.QuantityIn)
                .HasPrecision(18, 6)
                .HasColumnName("quantityIn");
            entity.Property(e => e.QuantityOut)
                .HasPrecision(18, 6)
                .HasColumnName("quantityOut");
            entity.Property(e => e.BeforeQty)
                .HasPrecision(18, 6)
                .HasColumnName("beforeQty");
            entity.Property(e => e.AfterQty)
                .HasPrecision(18, 6)
                .HasColumnName("afterQty");
            entity.Property(e => e.Reason)
                .HasColumnType("text")
                .HasColumnName("reason");
            entity.Property(e => e.RefId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("refId");
            entity.Property(e => e.RefTable)
                .HasMaxLength(80)
                .HasColumnName("refTable");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");
            entity.Property(e => e.WarehouseId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("warehouseId");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Stockmovements)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("stockmovements_ibfk_2");

            entity.HasOne(d => d.PerformedByNavigation).WithMany(p => p.Stockmovements)
                .HasForeignKey(d => d.PerformedBy)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("stockmovements_ibfk_4");

            entity.HasOne(d => d.Unit).WithMany(p => p.Stockmovements)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("stockmovements_ibfk_3");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Stockmovements)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("stockmovements_ibfk_1");
        });

        modelBuilder.Entity<Currentstocklot>(entity =>
        {
            entity.HasKey(e => e.LotStockId).HasName("PRIMARY");

            entity.ToTable("currentstocklots");

            entity.HasIndex(e => new { e.WarehouseId, e.IngredientId, e.ExpiredDate, e.LotNumber }, "ixCurrentStockLotsFefo");

            entity.HasIndex(e => new { e.WarehouseId, e.IngredientId, e.UnitId, e.LotNumber, e.ManufactureDate, e.ExpiredDate }, "ixCurrentStockLotsIdentity");

            entity.HasIndex(e => e.IngredientId, "ingredientId")
                .HasDatabaseName("ingredientId");

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId");

            entity.Property(e => e.LotStockId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("lotStockId");
            entity.Property(e => e.WarehouseId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("warehouseId");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");
            entity.Property(e => e.LotNumber)
                .HasMaxLength(100)
                .HasColumnName("lotNumber");
            entity.Property(e => e.ManufactureDate).HasColumnName("manufactureDate");
            entity.Property(e => e.ExpiredDate).HasColumnName("expiredDate");
            entity.Property(e => e.CurrentQty)
                .HasPrecision(18, 6)
                .HasDefaultValueSql("0.000000")
                .HasColumnName("currentQty");
            entity.Property(e => e.LastUpdated)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("lastUpdated");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Currentstocklots)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("currentstocklots_ibfk_2");

            entity.HasOne(d => d.Unit).WithMany(p => p.Currentstocklots)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("currentstocklots_ibfk_3");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Currentstocklots)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("currentstocklots_ibfk_1");
        });

        modelBuilder.Entity<Stocksnapshot>(entity =>
        {
            entity.HasKey(e => e.SnapshotId).HasName("PRIMARY");

            entity.ToTable("stocksnapshots");

            entity.HasIndex(e => new { e.PeriodMonth, e.WarehouseId, e.IngredientId }, "ixStockSnapshotsPeriod");

            entity.HasIndex(e => new { e.WarehouseId, e.IngredientId, e.UnitId, e.PeriodMonth }, "ixStockSnapshotsIdentity")
                .IsUnique();

            entity.HasIndex(e => e.IngredientId, "ingredientId")
                .HasDatabaseName("ingredientId");

            entity.HasIndex(e => e.UnitId, "unitId")
                .HasDatabaseName("unitId");

            entity.Property(e => e.SnapshotId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("snapshotId");
            entity.Property(e => e.WarehouseId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("warehouseId");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");
            entity.Property(e => e.PeriodMonth).HasColumnName("periodMonth");
            entity.Property(e => e.OpeningQty)
                .HasPrecision(18, 6)
                .HasDefaultValueSql("0.000000")
                .HasColumnName("openingQty");
            entity.Property(e => e.QuantityIn)
                .HasPrecision(18, 6)
                .HasDefaultValueSql("0.000000")
                .HasColumnName("quantityIn");
            entity.Property(e => e.QuantityOut)
                .HasPrecision(18, 6)
                .HasDefaultValueSql("0.000000")
                .HasColumnName("quantityOut");
            entity.Property(e => e.ClosingQty)
                .HasPrecision(18, 6)
                .HasDefaultValueSql("0.000000")
                .HasColumnName("closingQty");
            entity.Property(e => e.GeneratedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("generatedAt");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Stocksnapshots)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("stocksnapshots_ibfk_2");

            entity.HasOne(d => d.Unit).WithMany(p => p.Stocksnapshots)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("stocksnapshots_ibfk_3");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Stocksnapshots)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("stocksnapshots_ibfk_1");
        });

        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.HasKey(e => e.SupplierId).HasName("PRIMARY");

            entity.ToTable("suppliers");

            entity.HasIndex(e => e.SupplierCode, "supplierCode").IsUnique();

            entity.Property(e => e.SupplierId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("supplierId");
            entity.Property(e => e.Address)
                .HasMaxLength(255)
                .HasColumnName("address");
            entity.Property(e => e.ContactName)
                .HasMaxLength(150)
                .HasColumnName("contactName");
            entity.Property(e => e.DebtPolicy)
                .HasColumnType("text")
                .HasColumnName("debtPolicy");
            entity.Property(e => e.InvoicePolicy)
                .HasColumnType("text")
                .HasColumnName("invoicePolicy");
            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValueSql("'1'")
                .HasColumnName("isActive");
            entity.Property(e => e.Phone)
                .HasMaxLength(30)
                .HasColumnName("phone");
            entity.Property(e => e.SupplierCode)
                .HasMaxLength(50)
                .HasColumnName("supplierCode");
            entity.Property(e => e.SupplierName)
                .HasMaxLength(200)
                .HasColumnName("supplierName");
        });

        modelBuilder.Entity<Supplierquotation>(entity =>
        {
            entity.HasKey(e => e.QuotationId).HasName("PRIMARY");

            entity.ToTable("supplierquotations");

            entity.HasIndex(e => new { e.SupplierId, e.IngredientId, e.EffectiveFrom }, "ixSupplierQuotationsSupplierIngredientEffective");

            entity.HasIndex(e => e.IngredientId, "ixSupplierQuotationsIngredient");

            entity.Property(e => e.QuotationId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("quotationId");
            entity.Property(e => e.SupplierId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("supplierId");
            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");
            entity.Property(e => e.UnitPrice)
                .HasPrecision(18, 2)
                .HasColumnName("unitPrice");
            entity.Property(e => e.EffectiveFrom)
                .HasColumnName("effectiveFrom");
            entity.Property(e => e.EffectiveTo)
                .HasColumnName("effectiveTo");
            entity.Property(e => e.Note)
                .HasMaxLength(255)
                .HasColumnName("note");
            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValueSql("'1'")
                .HasColumnName("isActive");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("updatedAt");

            entity.HasOne(d => d.Supplier).WithMany(p => p.Supplierquotations)
                .HasForeignKey(d => d.SupplierId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("supplierquotations_ibfk_1");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Supplierquotations)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("supplierquotations_ibfk_2");
        });

        modelBuilder.Entity<Unit>(entity =>
        {
            entity.HasKey(e => e.UnitId).HasName("PRIMARY");

            entity.ToTable("units");

            entity.HasIndex(e => e.UnitCode, "unitCode").IsUnique();

            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");
            entity.Property(e => e.BaseUnitCode)
                .HasMaxLength(30)
                .HasColumnName("baseUnitCode");
            entity.Property(e => e.ConvertRateToBase)
                .HasPrecision(18, 6)
                .HasDefaultValueSql("'1.000000'")
                .HasColumnName("convertRateToBase");
            entity.Property(e => e.UnitCode)
                .HasMaxLength(30)
                .HasColumnName("unitCode");
            entity.Property(e => e.UnitName)
                .HasMaxLength(100)
                .HasColumnName("unitName");
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("PRIMARY");

            entity.ToTable("users");

            entity.HasIndex(e => e.RoleId, "roleId");

            entity.HasIndex(e => e.Username, "username").IsUnique();

            entity.Property(e => e.UserId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("userId");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");
            entity.Property(e => e.FullName)
                .HasMaxLength(150)
                .HasColumnName("fullName");
            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValueSql("'1'")
                .HasColumnName("isActive");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .HasColumnName("passwordHash");
            entity.Property(e => e.RoleId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("roleId");
            entity.Property(e => e.Username)
                .HasMaxLength(100)
                .HasColumnName("username");

            entity.HasOne(d => d.Role).WithMany(p => p.Users)
                .HasForeignKey(d => d.RoleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("users_ibfk_1");
        });

        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.HasKey(e => e.WarehouseId).HasName("PRIMARY");

            entity.ToTable("warehouses");

            entity.HasIndex(e => e.WarehouseCode, "warehouseCode").IsUnique();

            entity.Property(e => e.WarehouseId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("warehouseId");
            entity.Property(e => e.Note)
                .HasColumnType("text")
                .HasColumnName("note");
            entity.Property(e => e.WarehouseCode)
                .HasMaxLength(50)
                .HasColumnName("warehouseCode");
            entity.Property(e => e.WarehouseName)
                .HasMaxLength(150)
                .HasColumnName("warehouseName");
            entity.Property(e => e.WarehouseType)
                .HasDefaultValueSql("'KHAC'")
                .HasColumnType("enum('PHULIEUGIAVI','TUOI','DONGLANH','KHAC')")
                .HasColumnName("warehouseType");
        });

        modelBuilder.Entity<Currentstock>(entity =>
        {
            entity.HasKey(e => new { e.WarehouseId, e.IngredientId }).HasName("PRIMARY");

            entity.ToTable("currentstock");

            entity.HasIndex(e => e.IngredientId, "ix_currentstock_ingredient");

            entity.Property(e => e.WarehouseId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("warehouseId");

            entity.Property(e => e.IngredientId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("ingredientId");

            entity.Property(e => e.UnitId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("unitId");

            entity.Property(e => e.CurrentQty)
                .HasPrecision(18, 6)
                .HasColumnName("currentQty")
                .HasDefaultValueSql("0.000000");

            entity.Property(e => e.LastUpdated)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("lastUpdated");

            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken()
                .HasDefaultValueSql("CURRENT_TIMESTAMP(6)")
                .HasColumnType("timestamp(6)")
                .HasColumnName("rowVersion");

            entity.HasOne(d => d.Ingredient).WithMany(p => p.Currentstocks)
                .HasForeignKey(d => d.IngredientId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("currentstock_ibfk_2");

            entity.HasOne(d => d.Unit).WithMany(p => p.Currentstocks)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("currentstock_ibfk_3");

            entity.HasOne(d => d.Warehouse).WithMany(p => p.Currentstocks)
                .HasForeignKey(d => d.WarehouseId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("currentstock_ibfk_1");
        });

        modelBuilder.Entity<Refreshtoken>(entity =>
        {
            entity.HasKey(e => e.TokenId).HasName("PRIMARY");

            entity.ToTable("refreshtokens");

            // Tìm kiếm nhanh theo user + trạng thái hạn
            entity.HasIndex(e => new { e.UserId, e.ExpiresAt }, "ixRefreshTokensUserExpiry");
            // Hash là unique (mỗi token là duy nhất)
            entity.HasIndex(e => e.TokenHash, "ixRefreshTokensHash").IsUnique();

            entity.Property(e => e.TokenId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("tokenId");

            entity.Property(e => e.UserId)
                .HasMaxLength(16)
                .IsFixedLength()
                .HasColumnName("userId");

            entity.Property(e => e.TokenHash)
                .HasMaxLength(64)   // SHA-256 hex = 64 chars
                .IsFixedLength()
                .HasColumnName("tokenHash");

            entity.Property(e => e.DeviceInfo)
                .HasMaxLength(200)
                .HasDefaultValue(string.Empty)
                .HasColumnName("deviceInfo");

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP")
                .HasColumnType("datetime")
                .HasColumnName("createdAt");

            entity.Property(e => e.ExpiresAt)
                .HasColumnType("datetime")
                .HasColumnName("expiresAt");

            entity.Property(e => e.IsUsed)
                .HasDefaultValue(false)
                .HasColumnName("isUsed");

            entity.Property(e => e.IsRevoked)
                .HasDefaultValue(false)
                .HasColumnName("isRevoked");

            entity.Property(e => e.RevokedAt)
                .HasColumnType("datetime")
                .HasColumnName("revokedAt");

            entity.Property(e => e.ReplacedByToken)
                .HasMaxLength(64)
                .HasColumnName("replacedByToken");

            entity.HasOne(d => d.User)
                .WithMany(p => p.Refreshtokens)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("refreshtokens_ibfk_1");
        });

        modelBuilder.Entity<Stocktake>(entity =>
        {
            entity.HasKey(e => e.StocktakeId).HasName("PRIMARY");
            entity.ToTable("stocktakes");
            entity.HasIndex(e => e.StocktakeCode, "ixStocktakeCode").IsUnique();
            entity.HasIndex(e => e.WarehouseId, "ixStocktakeWarehouse");
            entity.Property(e => e.StocktakeId).HasMaxLength(16).IsFixedLength().HasColumnName("stocktakeId");
            entity.Property(e => e.StocktakeCode).HasMaxLength(50).HasColumnName("stocktakeCode");
            entity.Property(e => e.WarehouseId).HasMaxLength(16).IsFixedLength().HasColumnName("warehouseId");
            entity.Property(e => e.Status).HasMaxLength(50).HasColumnName("status");
            entity.Property(e => e.Notes).HasMaxLength(1000).HasColumnName("notes");
            entity.Property(e => e.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
            entity.Property(e => e.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
            entity.Property(e => e.ApprovedBy).HasMaxLength(16).IsFixedLength().HasColumnName("approvedBy");
            entity.Property(e => e.ApprovedAt).HasColumnType("datetime").HasColumnName("approvedAt");
            entity.HasOne(d => d.Warehouse).WithMany(p => p.Stocktakes).HasForeignKey(d => d.WarehouseId).OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.StocktakesCreatedByNavigations).HasForeignKey(d => d.CreatedBy).OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne(d => d.ApprovedByNavigation).WithMany(p => p.StocktakesApprovedByNavigations).HasForeignKey(d => d.ApprovedBy);
        });

        modelBuilder.Entity<Stocktakeline>(entity =>
        {
            entity.HasKey(e => e.LineId).HasName("PRIMARY");
            entity.ToTable("stocktakelines");
            entity.HasIndex(e => e.StocktakeId, "ixStocktakelineStocktake");
            entity.HasIndex(e => e.IngredientId, "ixStocktakelineIngredient");
            entity.Property(e => e.LineId).HasMaxLength(16).IsFixedLength().HasColumnName("lineId");
            entity.Property(e => e.StocktakeId).HasMaxLength(16).IsFixedLength().HasColumnName("stocktakeId");
            entity.Property(e => e.IngredientId).HasMaxLength(16).IsFixedLength().HasColumnName("ingredientId");
            entity.Property(e => e.UnitId).HasMaxLength(16).IsFixedLength().HasColumnName("unitId");
            entity.Property(e => e.SystemQty).HasPrecision(18, 2).HasColumnName("systemQty");
            entity.Property(e => e.ActualQty).HasPrecision(18, 2).HasColumnName("actualQty");
            entity.Property(e => e.DiscrepancyQty).HasPrecision(18, 2).HasColumnName("discrepancyQty");
            entity.Property(e => e.Reason).HasMaxLength(1000).HasColumnName("reason");
            entity.HasOne(d => d.Stocktake).WithMany(p => p.Stocktakelines).HasForeignKey(d => d.StocktakeId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(d => d.Ingredient).WithMany(p => p.Stocktakelines).HasForeignKey(d => d.IngredientId).OnDelete(DeleteBehavior.ClientSetNull);
            entity.HasOne(d => d.Unit).WithMany().HasForeignKey(d => d.UnitId).OnDelete(DeleteBehavior.ClientSetNull);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
