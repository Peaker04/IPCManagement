using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class QuantityAdjustment
{
    public byte[] AdjustmentId { get; set; } = null!;

    public byte[] QuantityPlanLineId { get; set; } = null!;

    public int OldServings { get; set; }

    public int NewServings { get; set; }

    public string? Reason { get; set; }

    public byte[] AdjustedBy { get; set; } = null!;

    public DateTime AdjustedAt { get; set; }

    public virtual User AdjustedByNavigation { get; set; } = null!;

    public virtual MealQuantityPlanLine QuantityPlanLine { get; set; } = null!;
}
