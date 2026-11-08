using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Customer
{
    public byte[] CustomerId { get; set; } = null!;

    public string CustomerCode { get; set; } = null!;

    public string CustomerName { get; set; } = null!;

    public string? Note { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<CustomerImportMapping> Customerimportmappings { get; set; } = new List<CustomerImportMapping>();

    public virtual ICollection<MealQuantityPlanLine> Mealquantityplanlines { get; set; } = new List<MealQuantityPlanLine>();

    public virtual ICollection<CustomerContract> Customercontracts { get; set; } = new List<CustomerContract>();

    public virtual ICollection<CustomerWeekMenuTier> Customerweekmenutiers { get; set; } = new List<CustomerWeekMenuTier>();

    public virtual ICollection<DishBom> Dishboms { get; set; } = new List<DishBom>();

    public virtual ICollection<MenuVersion> Menuversions { get; set; } = new List<MenuVersion>();

    public virtual ICollection<MenuSchedule> Menuschedules { get; set; } = new List<MenuSchedule>();

    public virtual ICollection<PortionRule> Portionrules { get; set; } = new List<PortionRule>();

    public virtual ICollection<ProductionPlanLine> Productionplanlines { get; set; } = new List<ProductionPlanLine>();
}
