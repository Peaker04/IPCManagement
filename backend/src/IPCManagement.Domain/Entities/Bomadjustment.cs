using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Bomadjustment
{
    public byte[] BomAdjustmentId { get; set; } = null!;

    public byte[] BomId { get; set; } = null!;

    public decimal OldGrossQtyPerServing { get; set; }

    public decimal NewGrossQtyPerServing { get; set; }

    public decimal OldWasteRatePercent { get; set; }

    public decimal NewWasteRatePercent { get; set; }

    public string? Reason { get; set; }

    public byte[] AdjustedBy { get; set; } = null!;

    public DateTime AdjustedAt { get; set; }

    public virtual User AdjustedByNavigation { get; set; } = null!;

    public virtual Dishbom Bom { get; set; } = null!;
}
