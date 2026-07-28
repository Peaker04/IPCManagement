using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Menu
{
    public byte[] MenuId { get; set; } = null!;

    public string MenuCode { get; set; } = null!;

    public string MenuName { get; set; } = null!;

    public DateOnly? FromDate { get; set; }

    public DateOnly? ToDate { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<MealQuantityPlanLine> Mealquantityplanlines { get; set; } = new List<MealQuantityPlanLine>();

    public virtual ICollection<MenuItem> Menuitems { get; set; } = new List<MenuItem>();

    public virtual ICollection<MenuSchedule> Menuschedules { get; set; } = new List<MenuSchedule>();

    public virtual ICollection<ProductionPlanLine> Productionplanlines { get; set; } = new List<ProductionPlanLine>();
}
