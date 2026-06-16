using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Productionplanline
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

    public virtual ICollection<Materialrequestline> Materialrequestlines { get; set; } = new List<Materialrequestline>();

    public virtual Menu Menu { get; set; } = null!;

    public virtual Productionplan Plan { get; set; } = null!;

    public virtual Mealquantityplanline QuantityPlanLine { get; set; } = null!;
}
