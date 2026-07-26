using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class User
{
    public byte[] UserId { get; set; } = null!;

    public string FullName { get; set; } = null!;

    public string Username { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public byte[] RoleId { get; set; } = null!;

    public bool? IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<AuditLog> Auditlogs { get; set; } = new List<AuditLog>();

    public virtual ICollection<BomAdjustment> Bomadjustments { get; set; } = new List<BomAdjustment>();

    public virtual ICollection<InventoryIssue> InventoryissueIssuedByNavigations { get; set; } = new List<InventoryIssue>();

    public virtual ICollection<InventoryIssue> InventoryissueReceivedByNavigations { get; set; } = new List<InventoryIssue>();

    public virtual ICollection<InventoryReceipt> Inventoryreceipts { get; set; } = new List<InventoryReceipt>();

    public virtual ICollection<InventoryReturn> Inventoryreturns { get; set; } = new List<InventoryReturn>();

    public virtual ICollection<MaterialRequest> MaterialrequestApprovedByNavigations { get; set; } = new List<MaterialRequest>();

    public virtual ICollection<MaterialRequest> MaterialrequestCreatedByNavigations { get; set; } = new List<MaterialRequest>();

    public virtual ICollection<MealQuantityPlan> Mealquantityplans { get; set; } = new List<MealQuantityPlan>();

    public virtual ICollection<ProductionPlan> Productionplans { get; set; } = new List<ProductionPlan>();

    public virtual ICollection<PurchaseRequest> PurchaserequestApprovedByNavigations { get; set; } = new List<PurchaseRequest>();

    public virtual ICollection<PurchaseRequest> PurchaserequestCreatedByNavigations { get; set; } = new List<PurchaseRequest>();

    public virtual ICollection<PurchaseOrder> Purchaseorders { get; set; } = new List<PurchaseOrder>();

    public virtual ICollection<QuantityAdjustment> Quantityadjustments { get; set; } = new List<QuantityAdjustment>();

    public virtual ICollection<QuantityImportBatch> Quantityimportbatches { get; set; } = new List<QuantityImportBatch>();

    public virtual Role Role { get; set; } = null!;

    public virtual ICollection<StockMovement> Stockmovements { get; set; } = new List<StockMovement>();

    public virtual ICollection<RefreshToken> Refreshtokens { get; set; } = new List<RefreshToken>();

    public virtual ICollection<Stocktake> StocktakesCreatedByNavigations { get; set; } = new List<Stocktake>();

    public virtual ICollection<Stocktake> StocktakesApprovedByNavigations { get; set; } = new List<Stocktake>();
}

