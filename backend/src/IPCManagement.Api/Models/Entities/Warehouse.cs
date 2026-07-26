using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Warehouse
{
    public byte[] WarehouseId { get; set; } = null!;

    public string WarehouseCode { get; set; } = null!;

    public string WarehouseName { get; set; } = null!;

    public string WarehouseType { get; set; } = null!;

    public string? Note { get; set; }

    public virtual ICollection<Ingredient> Ingredients { get; set; } = new List<Ingredient>();

    public virtual ICollection<InventoryIssue> Inventoryissues { get; set; } = new List<InventoryIssue>();

    public virtual ICollection<InventoryReceipt> Inventoryreceipts { get; set; } = new List<InventoryReceipt>();

    public virtual ICollection<InventoryReturn> Inventoryreturns { get; set; } = new List<InventoryReturn>();

    public virtual ICollection<StockMovement> Stockmovements { get; set; } = new List<StockMovement>();

    public virtual ICollection<CurrentStock> Currentstocks { get; set; } = new List<CurrentStock>();

    public virtual ICollection<CurrentStockLot> Currentstocklots { get; set; } = new List<CurrentStockLot>();

    public virtual ICollection<StockSnapshot> Stocksnapshots { get; set; } = new List<StockSnapshot>();

    public virtual ICollection<Stocktake> Stocktakes { get; set; } = new List<Stocktake>();
}
