using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Ingredient
{
    public byte[] IngredientId { get; set; } = null!;

    public string IngredientCode { get; set; } = null!;

    public string IngredientName { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public byte[] WarehouseId { get; set; } = null!;

    public decimal ReferencePrice { get; set; }

    public bool IsFreshDaily { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<DishBom> Dishboms { get; set; } = new List<DishBom>();

    public virtual ICollection<InventoryIssueLine> Inventoryissuelines { get; set; } = new List<InventoryIssueLine>();

    public virtual ICollection<InventoryReceiptLine> Inventoryreceiptlines { get; set; } = new List<InventoryReceiptLine>();

    public virtual ICollection<InventoryReturnLine> Inventoryreturnlines { get; set; } = new List<InventoryReturnLine>();

    public virtual ICollection<MaterialRequestLine> Materialrequestlines { get; set; } = new List<MaterialRequestLine>();

    public virtual ICollection<PurchaseRequestLine> Purchaserequestlines { get; set; } = new List<PurchaseRequestLine>();

    public virtual ICollection<StockMovement> Stockmovements { get; set; } = new List<StockMovement>();

    public virtual ICollection<CurrentStock> Currentstocks { get; set; } = new List<CurrentStock>();

    public virtual ICollection<CurrentStockLot> Currentstocklots { get; set; } = new List<CurrentStockLot>();

    public virtual ICollection<StockSnapshot> Stocksnapshots { get; set; } = new List<StockSnapshot>();

    public virtual ICollection<SupplierQuotation> Supplierquotations { get; set; } = new List<SupplierQuotation>();

    public virtual ICollection<PurchaseOrderLine> Purchaseorderlines { get; set; } = new List<PurchaseOrderLine>();

    public virtual Unit Unit { get; set; } = null!;

    public virtual Warehouse Warehouse { get; set; } = null!;

    public virtual ICollection<StocktakeLine> Stocktakelines { get; set; } = new List<StocktakeLine>();
}
