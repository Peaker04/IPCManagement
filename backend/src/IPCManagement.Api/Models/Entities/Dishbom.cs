using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Dishbom
{
    public byte[] BomId { get; set; } = null!;

    public byte[] DishId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public decimal GrossQtyPerServing { get; set; }

    public decimal WasteRatePercent { get; set; }

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public virtual ICollection<Bomadjustment> Bomadjustments { get; set; } = new List<Bomadjustment>();

    public virtual Dish Dish { get; set; } = null!;

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;
}
