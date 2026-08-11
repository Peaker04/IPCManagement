using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class InventoryReturnLine
{
    public byte[] ReturnLineId { get; set; } = null!;

    public byte[] ReturnId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public byte[]? SourceIssueLineId { get; set; }

    public decimal Quantity { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual InventoryReturn Return { get; set; } = null!;

    public virtual InventoryIssueLine? SourceIssueLine { get; set; }

    public virtual Unit Unit { get; set; } = null!;
}
