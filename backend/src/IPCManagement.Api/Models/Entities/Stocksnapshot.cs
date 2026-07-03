using System;

namespace IPCManagement.Api.Models.Entities;

public partial class Stocksnapshot
{
    public byte[] SnapshotId { get; set; } = null!;

    public byte[] WarehouseId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public DateOnly PeriodMonth { get; set; }

    public decimal OpeningQty { get; set; }

    public decimal QuantityIn { get; set; }

    public decimal QuantityOut { get; set; }

    public decimal ClosingQty { get; set; }

    public DateTime GeneratedAt { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;

    public virtual Warehouse Warehouse { get; set; } = null!;
}
