using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class ProductionPlan
{
    public byte[] PlanId { get; set; } = null!;

    public string PlanCode { get; set; } = null!;

    public DateOnly PlanDate { get; set; }

    public byte[]? CustomerId { get; set; }

    public DateOnly? WeekStartDate { get; set; }

    public byte[]? MenuVersionId { get; set; }

    public string Status { get; set; } = null!;

    public byte[] CreatedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? SentToKitchenAt { get; set; }

    public byte[]? SentToKitchenBy { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual User? SentToKitchenByNavigation { get; set; }

    public virtual Customer? Customer { get; set; }

    public virtual MenuVersion? MenuVersion { get; set; }

    public virtual ICollection<MaterialRequest> Materialrequests { get; set; } = new List<MaterialRequest>();

    public virtual ICollection<ProductionPlanLine> Productionplanlines { get; set; } = new List<ProductionPlanLine>();
}
