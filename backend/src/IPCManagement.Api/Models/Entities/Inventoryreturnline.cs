using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Inventoryreturnline
{
    public byte[] ReturnLineId { get; set; } = null!;

    public byte[] ReturnId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public decimal Quantity { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Inventoryreturn Return { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;
}
