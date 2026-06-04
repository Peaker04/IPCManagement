using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Customer
{
    public byte[] CustomerId { get; set; } = null!;

    public string CustomerCode { get; set; } = null!;

    public string CustomerName { get; set; } = null!;

    public string? Note { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<Mealquantityplanline> Mealquantityplanlines { get; set; } = new List<Mealquantityplanline>();

    public virtual ICollection<Menuschedule> Menuschedules { get; set; } = new List<Menuschedule>();

    public virtual ICollection<Productionplanline> Productionplanlines { get; set; } = new List<Productionplanline>();
}
