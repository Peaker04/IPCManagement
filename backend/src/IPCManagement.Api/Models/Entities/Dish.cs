using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Dish
{
    public byte[] DishId { get; set; } = null!;

    public string DishCode { get; set; } = null!;

    public string DishName { get; set; } = null!;

    public string? DishGroup { get; set; }

    public string? DishType { get; set; }

    public bool? IsActive { get; set; }

    public string? SourceImportBatch { get; set; }

    public string? SourceFileName { get; set; }

    public string? SourceChecksum { get; set; }

    public virtual ICollection<DishBom> Dishboms { get; set; } = new List<DishBom>();

    public virtual ICollection<MenuItem> Menuitems { get; set; } = new List<MenuItem>();

    public virtual ICollection<PortionRule> Portionrules { get; set; } = new List<PortionRule>();

    public virtual ICollection<ProductionPlanLine> Productionplanlines { get; set; } = new List<ProductionPlanLine>();
}
