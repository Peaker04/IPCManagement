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

    public virtual ICollection<Dishbom> Dishboms { get; set; } = new List<Dishbom>();

    public virtual ICollection<Inventoryissueline> Inventoryissuelines { get; set; } = new List<Inventoryissueline>();

    public virtual ICollection<Inventoryreceiptline> Inventoryreceiptlines { get; set; } = new List<Inventoryreceiptline>();

    public virtual ICollection<Inventoryreturnline> Inventoryreturnlines { get; set; } = new List<Inventoryreturnline>();

    public virtual ICollection<Materialrequestline> Materialrequestlines { get; set; } = new List<Materialrequestline>();

    public virtual ICollection<Purchaserequestline> Purchaserequestlines { get; set; } = new List<Purchaserequestline>();

    public virtual ICollection<Stockmovement> Stockmovements { get; set; } = new List<Stockmovement>();

    public virtual ICollection<Currentstock> Currentstocks { get; set; } = new List<Currentstock>();

    public virtual ICollection<Supplierquotation> Supplierquotations { get; set; } = new List<Supplierquotation>();

    public virtual Unit Unit { get; set; } = null!;

    public virtual Warehouse Warehouse { get; set; } = null!;
}
