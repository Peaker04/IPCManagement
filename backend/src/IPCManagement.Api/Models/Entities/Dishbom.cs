using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Dishbom
{
    public byte[] BomId { get; set; } = null!;

    public byte[] DishId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public byte[]? CustomerId { get; set; }

    public decimal PriceTierAmount { get; set; } = 25000m;

    public decimal GrossQtyPerServing { get; set; }

    public decimal WasteRatePercent { get; set; }

    public string BomStatus { get; set; } = "PUBLISHED";

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public virtual ICollection<Bomadjustment> Bomadjustments { get; set; } = new List<Bomadjustment>();

    public virtual Customer? Customer { get; set; }

    public virtual Dish Dish { get; set; } = null!;

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;
}
