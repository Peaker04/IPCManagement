using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Materialrequestline
{
    public byte[] RequestLineId { get; set; } = null!;

    public byte[] RequestId { get; set; } = null!;

    public byte[] PlanLineId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public int TotalServings { get; set; }

    public decimal GrossQtyPerServing { get; set; }

    public decimal BomRatePercent { get; set; }

    public decimal TotalRequiredQty { get; set; }

    public decimal CurrentStockQty { get; set; }

    public decimal SuggestedPurchaseQty { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Productionplanline PlanLine { get; set; } = null!;

    public virtual ICollection<Purchaserequestline> Purchaserequestlines { get; set; } = new List<Purchaserequestline>();

    public virtual Materialrequest Request { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;
}
