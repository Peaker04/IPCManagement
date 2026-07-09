using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Stocktake
{
    public byte[] StocktakeId { get; set; } = null!;

    public string StocktakeCode { get; set; } = null!;

    public byte[] WarehouseId { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string? Notes { get; set; }

    public byte[] CreatedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public byte[]? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public virtual ICollection<Stocktakeline> Stocktakelines { get; set; } = new List<Stocktakeline>();

    public virtual Warehouse Warehouse { get; set; } = null!;

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual User? ApprovedByNavigation { get; set; }
}
