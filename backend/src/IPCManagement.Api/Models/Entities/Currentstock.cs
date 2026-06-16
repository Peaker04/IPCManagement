using System;

namespace IPCManagement.Api.Models.Entities;

public partial class Currentstock
{
    public byte[] WarehouseId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public decimal CurrentQty { get; set; }

    public DateTime LastUpdated { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;

    public virtual Warehouse Warehouse { get; set; } = null!;
}
