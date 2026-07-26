using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class MenuSchedule
{
    public byte[] MenuScheduleId { get; set; } = null!;

    public byte[] CustomerId { get; set; } = null!;

    public byte[] MenuId { get; set; } = null!;

    public DateOnly ServiceDate { get; set; }

    public DateOnly WeekStartDate { get; set; }

    public string ShiftName { get; set; } = null!;

    public decimal MenuPrice { get; set; }

    public decimal BomRatePercent { get; set; }

    public string Status { get; set; } = null!;

    public byte[]? MenuVersionId { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual ICollection<MealQuantityPlanLine> Mealquantityplanlines { get; set; } = new List<MealQuantityPlanLine>();

    public virtual Menu Menu { get; set; } = null!;

    public virtual MenuVersion? MenuVersion { get; set; }
}
