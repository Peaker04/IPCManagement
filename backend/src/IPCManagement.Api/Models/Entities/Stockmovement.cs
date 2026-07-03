using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Stockmovement
{
    public byte[] MovementId { get; set; } = null!;

    public DateTime MovementDate { get; set; }

    public byte[] WarehouseId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public string MovementType { get; set; } = null!;

    public string? RefTable { get; set; }

    public byte[]? RefId { get; set; }

    public decimal QuantityIn { get; set; }

    public decimal QuantityOut { get; set; }

    public decimal BeforeQty { get; set; }

    public decimal AfterQty { get; set; }

    public string? LotNumber { get; set; }

    public DateOnly? ManufactureDate { get; set; }

    public DateOnly? ExpiredDate { get; set; }

    public string? Reason { get; set; }

    public string? Note { get; set; }

    public byte[] PerformedBy { get; set; } = null!;

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual User PerformedByNavigation { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;

    public virtual Warehouse Warehouse { get; set; } = null!;
}
