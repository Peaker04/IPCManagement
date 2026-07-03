using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Unit
{
    public byte[] UnitId { get; set; } = null!;

    public string UnitCode { get; set; } = null!;

    public string UnitName { get; set; } = null!;

    public string? BaseUnitCode { get; set; }

    public decimal ConvertRateToBase { get; set; }

    public virtual ICollection<Dishbom> Dishboms { get; set; } = new List<Dishbom>();

    public virtual ICollection<Ingredient> Ingredients { get; set; } = new List<Ingredient>();

    public virtual ICollection<Inventoryissueline> Inventoryissuelines { get; set; } = new List<Inventoryissueline>();

    public virtual ICollection<Inventoryreceiptline> Inventoryreceiptlines { get; set; } = new List<Inventoryreceiptline>();

    public virtual ICollection<Inventoryreturnline> Inventoryreturnlines { get; set; } = new List<Inventoryreturnline>();

    public virtual ICollection<Materialrequestline> Materialrequestlines { get; set; } = new List<Materialrequestline>();

    public virtual ICollection<Purchaserequestline> Purchaserequestlines { get; set; } = new List<Purchaserequestline>();

    public virtual ICollection<Stockmovement> Stockmovements { get; set; } = new List<Stockmovement>();

    public virtual ICollection<Currentstock> Currentstocks { get; set; } = new List<Currentstock>();

    public virtual ICollection<Purchaseorderline> Purchaseorderlines { get; set; } = new List<Purchaseorderline>();
}
