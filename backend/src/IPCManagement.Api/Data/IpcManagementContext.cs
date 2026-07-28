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

    public virtual DbSet<AuditLog> Auditlogs { get; set; }

    public virtual DbSet<ApprovalHistory> Approvalhistories { get; set; }

    public virtual DbSet<BomAdjustment> Bomadjustments { get; set; }

    public virtual DbSet<Customer> Customers { get; set; }

    public virtual DbSet<CustomerImportMapping> Customerimportmappings { get; set; }

    public virtual DbSet<CustomerContract> Customercontracts { get; set; }

    public virtual DbSet<Dish> Dishes { get; set; }

    public virtual DbSet<DishBom> Dishboms { get; set; }

    public virtual DbSet<Ingredient> Ingredients { get; set; }

    public virtual DbSet<SupplierQuotation> Supplierquotations { get; set; }

    public virtual DbSet<InventoryIssue> Inventoryissues { get; set; }

    public virtual DbSet<InventoryIssueLine> Inventoryissuelines { get; set; }

    public virtual DbSet<SupplementalMaterialRequest> Supplementalmaterialrequests { get; set; }

    public virtual DbSet<InventoryReceipt> Inventoryreceipts { get; set; }

    public virtual DbSet<InventoryReceiptLine> Inventoryreceiptlines { get; set; }

    public virtual DbSet<InventoryReturn> Inventoryreturns { get; set; }

    public virtual DbSet<InventoryReturnLine> Inventoryreturnlines { get; set; }

    public virtual DbSet<MaterialRequest> Materialrequests { get; set; }

    public virtual DbSet<MaterialRequestLine> Materialrequestlines { get; set; }

    public virtual DbSet<MealQuantityPlan> Mealquantityplans { get; set; }

    public virtual DbSet<MealQuantityPlanLine> Mealquantityplanlines { get; set; }

    public virtual DbSet<Menu> Menus { get; set; }

    public virtual DbSet<MenuItem> Menuitems { get; set; }

    public virtual DbSet<MenuSchedule> Menuschedules { get; set; }

    public virtual DbSet<MenuVersion> Menuversions { get; set; }

    public virtual DbSet<PortionRule> Portionrules { get; set; }

    public virtual DbSet<ProductionPlan> Productionplans { get; set; }

    public virtual DbSet<ProductionPlanLine> Productionplanlines { get; set; }

    public virtual DbSet<PurchaseRequest> Purchaserequests { get; set; }

    public virtual DbSet<PurchaseRequestLine> Purchaserequestlines { get; set; }

    public virtual DbSet<PurchaseOrder> Purchaseorders { get; set; }

    public virtual DbSet<PurchaseOrderLine> Purchaseorderlines { get; set; }

    public virtual DbSet<PurchaseLineSupplierDecision> Purchaselinesupplierdecisions { get; set; }

    public virtual DbSet<PurchasePriceException> Purchasepriceexceptions { get; set; }

    public virtual DbSet<PurchaseHistoryReconciliationRun> Purchasehistoryreconciliationruns { get; set; }

    public virtual DbSet<PurchaseHistoryReconciliationAction> Purchasehistoryreconciliationactions { get; set; }

    public virtual DbSet<QuantityAdjustment> Quantityadjustments { get; set; }

    public virtual DbSet<QuantityImportBatch> Quantityimportbatches { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<StockMovement> Stockmovements { get; set; }

    public virtual DbSet<CurrentStock> Currentstocks { get; set; }

    public virtual DbSet<CurrentStockLot> Currentstocklots { get; set; }

    public virtual DbSet<StockSnapshot> Stocksnapshots { get; set; }

    public virtual DbSet<Supplier> Suppliers { get; set; }

    public virtual DbSet<Unit> Units { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<RefreshToken> Refreshtokens { get; set; }

    public virtual DbSet<Stocktake> Stocktakes { get; set; }

    public virtual DbSet<StocktakeLine> Stocktakelines { get; set; }

    public virtual DbSet<Warehouse> Warehouses { get; set; }

    public virtual DbSet<ApprovalRule> Approvalrules { get; set; }

    public virtual DbSet<ApprovalAssignment> Approvalassignments { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder
            .UseCollation("utf8mb4_unicode_ci")
            .HasCharSet("utf8mb4");

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(IpcManagementContext).Assembly);

        modelBuilder.Entity<InventoryIssue>(entity =>
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

        modelBuilder.Entity<InventoryIssueLine>(entity =>
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

        modelBuilder.Entity<SupplementalMaterialRequest>(entity =>
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

            entity.HasOne<InventoryIssue>().WithMany().HasForeignKey(e => e.IssueId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<InventoryIssueLine>().WithMany().HasForeignKey(e => e.IssueLineId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Warehouse>().WithMany().HasForeignKey(e => e.WarehouseId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Ingredient>().WithMany().HasForeignKey(e => e.IngredientId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Unit>().WithMany().HasForeignKey(e => e.UnitId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<User>().WithMany().HasForeignKey(e => e.RequestedBy).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<InventoryReceipt>(entity =>
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

        modelBuilder.Entity<InventoryReceiptLine>(entity =>
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

        modelBuilder.Entity<InventoryReturn>(entity =>
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

        modelBuilder.Entity<InventoryReturnLine>(entity =>
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

        modelBuilder.Entity<PurchaseRequest>(entity =>
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

        modelBuilder.Entity<PurchaseRequestLine>(entity =>
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

        modelBuilder.Entity<PurchaseLineSupplierDecision>(entity =>
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

        modelBuilder.Entity<PurchasePriceException>(entity =>
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

        modelBuilder.Entity<PurchaseOrder>(entity =>
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

        modelBuilder.Entity<PurchaseOrderLine>(entity =>
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

            entity.HasOne(d => d.PurchaseRequestLine).WithOne(p => p.PurchaseOrderLine)
                .HasForeignKey<PurchaseOrderLine>(d => d.PurchaseRequestLineId)
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

        modelBuilder.Entity<StockMovement>(entity =>
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

        modelBuilder.Entity<CurrentStockLot>(entity =>
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

        modelBuilder.Entity<StockSnapshot>(entity =>
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

        modelBuilder.Entity<SupplierQuotation>(entity =>
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

        modelBuilder.Entity<CurrentStock>(entity =>
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

        modelBuilder.Entity<StocktakeLine>(entity =>
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
