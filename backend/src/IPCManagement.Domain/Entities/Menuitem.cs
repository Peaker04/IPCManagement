using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Menuitem
{
    public byte[] MenuItemId { get; set; } = null!;

    public byte[] MenuId { get; set; } = null!;

    public byte[] DishId { get; set; } = null!;

    public string? DishSlot { get; set; }

    public int DisplayOrder { get; set; }

    public virtual Dish Dish { get; set; } = null!;

    public virtual Menu Menu { get; set; } = null!;
}
