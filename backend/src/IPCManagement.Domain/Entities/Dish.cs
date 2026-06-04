using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Dish
{
    public byte[] DishId { get; set; } = null!;

    public string DishCode { get; set; } = null!;

    public string DishName { get; set; } = null!;

    public string? DishGroup { get; set; }

    public string? DishType { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<Dishbom> Dishboms { get; set; } = new List<Dishbom>();

    public virtual ICollection<Menuitem> Menuitems { get; set; } = new List<Menuitem>();

    public virtual ICollection<Productionplanline> Productionplanlines { get; set; } = new List<Productionplanline>();
}
