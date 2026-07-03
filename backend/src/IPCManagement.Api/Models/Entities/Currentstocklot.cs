using System;

namespace IPCManagement.Api.Models.Entities;

public partial class Currentstocklot
{
    public byte[] LotStockId { get; set; } = null!;

    public byte[] WarehouseId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public string? LotNumber { get; set; }

    public DateOnly? ManufactureDate { get; set; }

    public DateOnly? ExpiredDate { get; set; }

    public decimal CurrentQty { get; set; }

    public DateTime LastUpdated { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;

    public virtual Warehouse Warehouse { get; set; } = null!;
}
