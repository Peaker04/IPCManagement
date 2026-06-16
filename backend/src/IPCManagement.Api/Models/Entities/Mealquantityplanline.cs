using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Mealquantityplanline
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

    public virtual Customer Customer { get; set; } = null!;

    public virtual Menu Menu { get; set; } = null!;

    public virtual Menuschedule MenuSchedule { get; set; } = null!;

    public virtual ICollection<Productionplanline> Productionplanlines { get; set; } = new List<Productionplanline>();

    public virtual Mealquantityplan QuantityPlan { get; set; } = null!;

    public virtual ICollection<Quantityadjustment> Quantityadjustments { get; set; } = new List<Quantityadjustment>();
}
