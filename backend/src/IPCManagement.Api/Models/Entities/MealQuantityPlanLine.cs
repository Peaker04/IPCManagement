using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class MealQuantityPlanLine
{
    public byte[] QuantityPlanLineId { get; set; } = null!;

    public byte[] QuantityPlanId { get; set; } = null!;

    public byte[] MenuScheduleId { get; set; } = null!;

    public byte[] CustomerId { get; set; } = null!;

    public byte[] MenuId { get; set; } = null!;

    public string ShiftName { get; set; } = null!;

    public int ForecastServings { get; set; }

    public int ConfirmedServings { get; set; }

    public int AdjustedServings { get; set; }

    public int FinalServings { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual Menu Menu { get; set; } = null!;

    public virtual MenuSchedule MenuSchedule { get; set; } = null!;

    public virtual ICollection<ProductionPlanLine> Productionplanlines { get; set; } = new List<ProductionPlanLine>();

    public virtual MealQuantityPlan QuantityPlan { get; set; } = null!;

    public virtual ICollection<QuantityAdjustment> Quantityadjustments { get; set; } = new List<QuantityAdjustment>();
}
