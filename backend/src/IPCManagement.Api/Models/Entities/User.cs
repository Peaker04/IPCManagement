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

    public virtual ICollection<Auditlog> Auditlogs { get; set; } = new List<Auditlog>();

    public virtual ICollection<Bomadjustment> Bomadjustments { get; set; } = new List<Bomadjustment>();

    public virtual ICollection<Inventoryissue> InventoryissueIssuedByNavigations { get; set; } = new List<Inventoryissue>();

    public virtual ICollection<Inventoryissue> InventoryissueReceivedByNavigations { get; set; } = new List<Inventoryissue>();

    public virtual ICollection<Inventoryreceipt> Inventoryreceipts { get; set; } = new List<Inventoryreceipt>();

    public virtual ICollection<Inventoryreturn> Inventoryreturns { get; set; } = new List<Inventoryreturn>();

    public virtual ICollection<Materialrequest> MaterialrequestApprovedByNavigations { get; set; } = new List<Materialrequest>();

    public virtual ICollection<Materialrequest> MaterialrequestCreatedByNavigations { get; set; } = new List<Materialrequest>();

    public virtual ICollection<Mealquantityplan> Mealquantityplans { get; set; } = new List<Mealquantityplan>();

    public virtual ICollection<Productionplan> Productionplans { get; set; } = new List<Productionplan>();

    public virtual ICollection<Purchaserequest> PurchaserequestApprovedByNavigations { get; set; } = new List<Purchaserequest>();

    public virtual ICollection<Purchaserequest> PurchaserequestCreatedByNavigations { get; set; } = new List<Purchaserequest>();

    public virtual ICollection<Purchaseorder> Purchaseorders { get; set; } = new List<Purchaseorder>();

    public virtual ICollection<Quantityadjustment> Quantityadjustments { get; set; } = new List<Quantityadjustment>();

    public virtual ICollection<Quantityimportbatch> Quantityimportbatches { get; set; } = new List<Quantityimportbatch>();

    public virtual Role Role { get; set; } = null!;

    public virtual ICollection<Stockmovement> Stockmovements { get; set; } = new List<Stockmovement>();

    public virtual ICollection<Refreshtoken> Refreshtokens { get; set; } = new List<Refreshtoken>();

    public virtual ICollection<Stocktake> StocktakesCreatedByNavigations { get; set; } = new List<Stocktake>();

    public virtual ICollection<Stocktake> StocktakesApprovedByNavigations { get; set; } = new List<Stocktake>();
}

