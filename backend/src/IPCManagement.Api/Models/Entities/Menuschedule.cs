using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Menuschedule
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

    public virtual ICollection<Mealquantityplanline> Mealquantityplanlines { get; set; } = new List<Mealquantityplanline>();

    public virtual Menu Menu { get; set; } = null!;

    public virtual Menuversion? MenuVersion { get; set; }
}
