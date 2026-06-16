using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Quantityadjustment
{
    public byte[] AdjustmentId { get; set; } = null!;

    public byte[] QuantityPlanLineId { get; set; } = null!;

    public int OldServings { get; set; }

    public int NewServings { get; set; }

    public string? Reason { get; set; }

    public byte[] AdjustedBy { get; set; } = null!;

    public DateTime AdjustedAt { get; set; }

    public virtual User AdjustedByNavigation { get; set; } = null!;

    public virtual Mealquantityplanline QuantityPlanLine { get; set; } = null!;
}
