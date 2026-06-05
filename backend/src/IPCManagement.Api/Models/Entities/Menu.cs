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

    public virtual ICollection<Mealquantityplanline> Mealquantityplanlines { get; set; } = new List<Mealquantityplanline>();

    public virtual ICollection<Menuitem> Menuitems { get; set; } = new List<Menuitem>();

    public virtual ICollection<Menuschedule> Menuschedules { get; set; } = new List<Menuschedule>();

    public virtual ICollection<Productionplanline> Productionplanlines { get; set; } = new List<Productionplanline>();
}
