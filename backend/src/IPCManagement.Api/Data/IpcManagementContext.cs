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

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
