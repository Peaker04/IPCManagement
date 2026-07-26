using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class ProductionPlanLine
{
    public byte[] PlanLineId { get; set; } = null!;

    public byte[] PlanId { get; set; } = null!;

    public byte[] QuantityPlanLineId { get; set; } = null!;

    public byte[] CustomerId { get; set; } = null!;

    public byte[] MenuId { get; set; } = null!;

    public byte[] DishId { get; set; } = null!;

    public string ShiftName { get; set; } = null!;

    public int TotalServings { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual Dish Dish { get; set; } = null!;

    public virtual ICollection<MaterialRequestLine> Materialrequestlines { get; set; } = new List<MaterialRequestLine>();

    public virtual Menu Menu { get; set; } = null!;

    public virtual ProductionPlan Plan { get; set; } = null!;

    public virtual MealQuantityPlanLine QuantityPlanLine { get; set; } = null!;
}
