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

    public virtual ICollection<Inventoryissue> Inventoryissues { get; set; } = new List<Inventoryissue>();

    public virtual ICollection<Inventoryreceipt> Inventoryreceipts { get; set; } = new List<Inventoryreceipt>();

    public virtual ICollection<Inventoryreturn> Inventoryreturns { get; set; } = new List<Inventoryreturn>();

    public virtual ICollection<Stockmovement> Stockmovements { get; set; } = new List<Stockmovement>();

    public virtual ICollection<Currentstock> Currentstocks { get; set; } = new List<Currentstock>();

    public virtual ICollection<Currentstocklot> Currentstocklots { get; set; } = new List<Currentstocklot>();

    public virtual ICollection<Stocksnapshot> Stocksnapshots { get; set; } = new List<Stocksnapshot>();

    public virtual ICollection<Stocktake> Stocktakes { get; set; } = new List<Stocktake>();
}
