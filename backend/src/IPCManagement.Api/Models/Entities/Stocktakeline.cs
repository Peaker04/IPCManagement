using System;

namespace IPCManagement.Api.Models.Entities;

public partial class Stocktakeline
{
    public byte[] LineId { get; set; } = null!;

    public byte[] StocktakeId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public decimal SystemQty { get; set; }

    public decimal? ActualQty { get; set; }

    public decimal? DiscrepancyQty { get; set; }

    public string? Reason { get; set; }

    public virtual Stocktake Stocktake { get; set; } = null!;

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;
}
