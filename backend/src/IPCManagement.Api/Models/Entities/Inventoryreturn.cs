using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Inventoryreturn
{
    public byte[] ReturnId { get; set; } = null!;

    public string ReturnCode { get; set; } = null!;

    public DateOnly ReturnDate { get; set; }

    public string? ShiftName { get; set; }

    public string ReturnType { get; set; } = null!;

    public byte[] WarehouseId { get; set; } = null!;

    public byte[] IssueId { get; set; } = null!;

    public string? Reason { get; set; }

    public byte[] CreatedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<Inventoryreturnline> Inventoryreturnlines { get; set; } = new List<Inventoryreturnline>();

    public virtual Inventoryissue Issue { get; set; } = null!;

    public virtual Warehouse Warehouse { get; set; } = null!;
}
