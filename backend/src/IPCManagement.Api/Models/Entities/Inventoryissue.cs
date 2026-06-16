using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Inventoryissue
{
    public byte[] IssueId { get; set; } = null!;

    public string IssueCode { get; set; } = null!;

    public DateOnly IssueDate { get; set; }

    public string? ShiftName { get; set; }

    public byte[] WarehouseId { get; set; } = null!;

    public byte[] MaterialRequestId { get; set; } = null!;

    public byte[] IssuedBy { get; set; } = null!;

    public byte[]? ReceivedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<Inventoryissueline> Inventoryissuelines { get; set; } = new List<Inventoryissueline>();

    public virtual ICollection<Inventoryreturn> Inventoryreturns { get; set; } = new List<Inventoryreturn>();

    public virtual User IssuedByNavigation { get; set; } = null!;

    public virtual Materialrequest MaterialRequest { get; set; } = null!;

    public virtual User? ReceivedByNavigation { get; set; }

    public virtual Warehouse Warehouse { get; set; } = null!;
}
