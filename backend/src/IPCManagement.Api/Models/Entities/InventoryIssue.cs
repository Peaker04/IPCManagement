using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class InventoryIssue
{
    public byte[] IssueId { get; set; } = null!;

    public string IssueCode { get; set; } = null!;

    public DateOnly IssueDate { get; set; }

    public string? ShiftName { get; set; }

    public byte[] WarehouseId { get; set; } = null!;

    public byte[]? MaterialRequestId { get; set; }

    public byte[]? ReconciliationBatchId { get; set; }

    public byte[] IssuedBy { get; set; } = null!;

    public byte[]? ReceivedBy { get; set; }

    public DateTime? ReceivedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<InventoryIssueLine> Inventoryissuelines { get; set; } = new List<InventoryIssueLine>();

    public virtual ICollection<InventoryReturn> Inventoryreturns { get; set; } = new List<InventoryReturn>();

    public virtual User IssuedByNavigation { get; set; } = null!;

    public virtual MaterialRequest? MaterialRequest { get; set; }

    public virtual ReconciliationBatch? ReconciliationBatch { get; set; }

    public virtual User? ReceivedByNavigation { get; set; }

    public virtual Warehouse Warehouse { get; set; } = null!;
}
