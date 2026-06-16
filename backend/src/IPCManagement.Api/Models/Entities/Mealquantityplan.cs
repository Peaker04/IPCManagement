using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Mealquantityplan
{
    public byte[] QuantityPlanId { get; set; } = null!;

    public byte[]? ImportBatchId { get; set; }

    public string PlanCode { get; set; } = null!;

    public DateOnly ServiceDate { get; set; }

    public string Status { get; set; } = null!;

    public DateTime? ForecastReceivedAt { get; set; }

    public DateTime? ConfirmedAt { get; set; }

    public TimeOnly ConfirmationTime { get; set; }

    public byte[]? ConfirmedBy { get; set; }

    public virtual User? ConfirmedByNavigation { get; set; }

    public virtual Quantityimportbatch? ImportBatch { get; set; }

    public virtual ICollection<Mealquantityplanline> Mealquantityplanlines { get; set; } = new List<Mealquantityplanline>();
}
