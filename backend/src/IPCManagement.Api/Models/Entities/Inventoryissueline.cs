using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Inventoryissueline
{
    public byte[] IssueLineId { get; set; } = null!;

    public byte[] IssueId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public decimal RequestedQty { get; set; }

    public decimal IssuedQty { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Inventoryissue Issue { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;
}
