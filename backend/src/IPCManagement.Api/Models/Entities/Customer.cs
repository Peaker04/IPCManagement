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

    public virtual ICollection<Customerimportmapping> Customerimportmappings { get; set; } = new List<Customerimportmapping>();

    public virtual ICollection<Mealquantityplanline> Mealquantityplanlines { get; set; } = new List<Mealquantityplanline>();

    public virtual ICollection<Customercontract> Customercontracts { get; set; } = new List<Customercontract>();

    public virtual ICollection<Menuversion> Menuversions { get; set; } = new List<Menuversion>();

    public virtual ICollection<Menuschedule> Menuschedules { get; set; } = new List<Menuschedule>();

    public virtual ICollection<Portionrule> Portionrules { get; set; } = new List<Portionrule>();

    public virtual ICollection<Productionplanline> Productionplanlines { get; set; } = new List<Productionplanline>();
}
